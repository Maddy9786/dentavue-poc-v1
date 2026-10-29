# DentaVue-backend — Architecture

Developer reference for the DentaVue API. Pairs with the repo `README.md`
(commands, layer rules) and the root `CLAUDE.md`. For the whole-system view, see
[`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Runtime | **Node 20+**, **Express 5**, TypeScript (ESM, `.js` import specifiers) |
| Shape | **MVC** — routes → controllers → services → models → views |
| Data + auth | **Supabase** (Postgres + Storage; also the auth provider) |
| Validation | **zod** (at the boundary) |
| Logging | **pino** / `pino-http` |
| Security | **helmet**, **cors**, **express-rate-limit** |
| Tests | **Vitest** + **supertest** |

The backend is the **only front door**: the web app never touches Supabase
directly. This process holds the Supabase **service-role key**, which bypasses
Row Level Security — so **authorization is this layer's job**, not the
database's.

---

## 2. Directory map

```
src/
├── app.ts              # createApp(): builds Express, no port (tests import it)
├── server.ts           # listen() + graceful shutdown (SIGTERM/SIGINT drain)
├── config/
│   ├── env.ts          # dotenv + zod schema; process.exit on invalid config
│   ├── logger.ts       # pino
│   └── supabase.ts     # supabaseAdmin (service-role) + supabaseAuth (anon)
├── routes/v1/          # path + middleware + controller wiring (no logic)
│   ├── index.ts        # mounts every module under API_PREFIX
│   ├── auth.routes.ts  # …incl. POST /auth/session (restore)
│   ├── scan.routes.ts  # POST /scans (upload), GET /scans (list)
│   └── profile.routes.ts
├── middlewares/
│   ├── authenticate.ts # verify Bearer token → req.user; requireUserType()
│   ├── validate.ts     # zod parse of body/params/query
│   ├── rateLimit.ts    # per-IP + per-account limiters + scanUploadLimiter
│   └── errorHandler.ts # ZodError→422, ApiError→status, else 500; notFound
├── controllers/        # HTTP ⇄ service; thin, no business rules
├── services/           # business logic; compose models; the only place rules live
├── models/             # all DB access for a table; snake_case ⇄ camelCase
├── views/response.ts   # the { success, message, data } envelope helpers
├── validators/         # zod request schemas (reused by controllers + tests)
├── utils/              # ApiError, supabaseError mapping, cookies (refresh cookie)
├── types/              # domain.ts, express.d.ts (req.user augmentation)
├── integrations/       # OpenAI/Razorpay/Maps/… placeholders (.gitkeep)
└── jobs/               # background jobs placeholder (.gitkeep)
db/migrations/          # plain .sql (no runner yet) — 0001 profiles, 0002 onboarding,
                        #   0003 scans (+ private bucket), 0004 scan_images
```

---

## 3. Request lifecycle

```
HTTP request
  │  helmet · cors · express.json · pino-http        (app.ts, global)
  ▼
router (/v1/...)  ──►  rateLimit  ──►  validate(zod)  ──►  authenticate*  ──►  controller
                                                                                 │
                                              service (rules)  ◄─────────────────┘
                                                 │
                                              model (Supabase)  ──►  Postgres / auth.users
                                                 │
                       views/response.ts  ◄──── returns domain object
                                 │
                       { success, message, data }  ──►  client
```
`*` only on protected routes. **Express 5 forwards rejected promises to the
error handler**, so controllers need no try/catch — they stay thin.

**Layer rules (enforced by convention):**
- Controllers never import models. Services compose models.
- Models own persistence only — no HTTP, no rules, no authorization.
- Every response goes through `views/response.ts` so the envelope holds.

---

## 4. Supabase: two clients, one is a foot-gun

[`config/supabase.ts`](src/config/supabase.ts) exports two clients; using the
wrong one is the likeliest way to open a hole:

| Client | Key | Use for |
|---|---|---|
| `supabaseAdmin` | service-role (**bypasses RLS**) | tables, admin ops (`createUser`, `getUser` token check) |
| `supabaseAuth` | anon | sign-in flows (`signInWithPassword`, OTP, OAuth) — unauthenticated by definition |

**Supabase owns identity.** `auth.users` holds email, passwords, sessions, SMS
OTP, OAuth, and issues the JWTs the API returns — there are **no JWT secrets and
no password hashing in this repo**. App data lives in `public.profiles`, sharing
the same primary key (FK → `auth.users.id`, `on delete cascade`). **Never write
to `auth.users` directly.**

- `userType` is read from `profiles`, **never** from the JWT's `user_metadata`
  (user-writable in some configs — a self-assigned `"provider"` would walk
  through `requireUserType()`).
- Rows are `snake_case`; the API contract is `camelCase`. The mapping is the
  model's job (`toDomain`).
- **IDs are plain UUIDs** on the wire and in the DB. The spec's prefixed
  `user_12345` form was a sketch and was not adopted (`profiles.id` is a FK onto
  a uuid the project doesn't control).

---

## 5. Auth

[`middlewares/authenticate.ts`](src/middlewares/authenticate.ts) verifies the
Bearer token by asking Supabase (`getUser` — checks signature **and** that the
session wasn't revoked), loads the `profiles` row, and populates `req.user`
(`{ userId, userType, email }`). `requireUserType(...)` is a coarse persona gate
mounted after it — ownership checks (does this provider own this clinic?) belong
in the service layer, because the service-role client bypasses RLS.

**Flows** ([`services/auth.service.ts`](src/services/auth.service.ts)):
- **`signup`** — `admin.createUser({ email_confirm: true })` (created confirmed,
  so sign-in works regardless of the dashboard "Confirm email" toggle) →
  inserts the profile (rolls the identity back if that fails) → **signs in to
  mint a session**, so the response carries real tokens and onboarding is
  authenticated.
- **`signin`** — `signInWithPassword`; a 4xx flattens to a vague 401 (no account
  enumeration), but the real reason is logged server-side. Non-4xx must **not**
  read as bad credentials (an outage isn't a wrong password).
- **Phone OTP** — real Supabase path exists; the web app mocks it (paid SMS).
- **Google OAuth** — `getOAuthUrl` (302 to consent) + `completeOAuth` (validates
  relayed tokens, creates the profile for a first-time user).
- **Session persistence** — the refresh token is set as an **httpOnly cookie**
  (`utils/cookies.ts`) on signin/signup/verify-otp/oauth; `POST /auth/session`
  (`restoreSession`) reads it and mints a fresh session so the web app survives a
  reload. Only a genuine 401 clears the cookie (a transient 5xx leaves it).

**Scans** ([`services/scan.service.ts`](src/services/scan.service.ts)) — a guided
scan is four images. `createScan` decodes each data URL, uploads to the private
`scans` Storage bucket (`<userId>/<scanId>/<position>.<ext>`), inserts the session
row (cover = front teeth) + a `scan_images` row per angle, and returns signed URLs;
it unwinds the objects and row if any insert fails. `listScans` returns the cover
plus every angle, each signed (1-hour TTL). The AI `score` is null — analysis isn't
built. See [`../SCANS_AND_COMPARE.md`](../SCANS_AND_COMPARE.md).

---

## 6. Conventions & cross-cutting

- **Response envelope** — every response, success or error:
  `{ "success": true, "message": "...", "data": { } }` (`views/response.ts`).
- **Errors** — throw `ApiError` (`utils/ApiError.ts`) with a meaningful status
  (401 unauthenticated vs 403 wrong persona; 422 missing field vs 400 invalid).
  `mapSupabaseAuthError` translates Supabase failures. `errorHandler` renders
  `ZodError` as a 422 with field detail.
- **Validation** — schemas in `validators/`, applied by `validate({ body, … })`.
  Validated query lands on `req.validatedQuery` (Express 5's `req.query` has no
  setter). Anything past the boundary is trusted, so it **must** be checked here
  regardless of what the client validated.
- **Rate limiting** — `middlewares/rateLimit.ts`, **in-memory** so limits are
  per-process: per-IP + per-account on `/signin`, per-IP on signup/OTP/verify/
  refresh/session, per-user (`scanUploadLimiter`, 30/hr) on `POST /scans`.
  `env.REDIS_URL` is reserved to make them global before running more than one
  instance. `app.ts` also raises the JSON body limit to **8mb** for the four-image
  scan upload.
- **Migrations** — plain `.sql` in `db/migrations/` (no runner chosen yet): paste
  into the Supabase SQL editor or run via psql, in order. `0001` creates `profiles`;
  `0002` adds onboarding columns; `0003` creates `scans` + the private `scans`
  Storage bucket; `0004` creates `scan_images` (one row per captured angle). **Run
  0003 and 0004 or `POST /scans` fails.**
- **Storage** — the `scans` bucket is **private**; only the service-role client
  reads/writes it, and the API hands the browser short-lived **signed URLs**
  (personal health images, never public).

### Config

`config/env.ts` loads `.env` (dotenv) and validates with zod, calling
`process.exit` on invalid config — so a missing Supabase var fails loudly at
boot, not mysteriously at request time. `.env.example` lists every var
(including integration placeholders).

### Endpoints implemented

`/auth/*` (signup, signin, signin-phone, verify/resend-phone-otp, refresh-token,
**session** (restore), google + oauth/complete, logout), `PATCH /profile`, and
`POST`/`GET /scans`. The API spec covers ~37 endpoints then stops; roughly half the
modules (payments, notifications, reviews, search, messaging, scan, clinic,
onboarding) have **no spec** — those are designed, not transcribed (the scan and
session endpoints among them). Flag design decisions for review.

### Commands

```bash
npm run dev        # tsx watch src/server.ts
npm run build      # tsc -p tsconfig.build.json && tsc-alias
npm start          # node dist/server.js
npm run lint
npm run typecheck
npm test           # vitest + supertest
```
