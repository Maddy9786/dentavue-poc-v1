# DentaVue-backend

A backend for DentaVue App and Website.

Node.js + Express 5 + TypeScript, MVC, with Supabase as both the data layer (Postgres + Storage)
and the auth provider. This API is the **only** thing that talks to Supabase — the web app never
holds a Supabase key.

## Getting started

```bash
npm install
cp .env.example .env    # fill in the Supabase project URL + keys
npm run dev             # http://localhost:4000/v1  (health: /health)
```

Auth calls need a real Supabase project; without one they return `503`. Phone OTP additionally
needs an SMS provider configured in the Supabase dashboard (Auth → Providers → Phone), not here.

| Command | Does |
|---|---|
| `npm run dev` | Watch-mode server via tsx |
| `npm run build` | Compile to `dist/` (tsc + tsc-alias to rewrite `@/` paths) |
| `npm start` | Run the compiled build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`npm test -- auth` for one file) |
| `npm run try:gemini -- a.jpg b.jpg` | Run the scan-analysis pipeline against photos on disk — no Supabase, nothing persisted. Prints the raw model output, the computed bands and score, and every field the results screen renders. Add `--narrative` for the prose pass |

Scan analysis needs `GEMINI_API_KEY` and migration `0005_scan_analysis.sql`. Without the key the
API still boots and uploads still work — analysis is skipped and the screens fall back to
placeholder copy. See [AI_INTEGRATION.md](../docs/AI_INTEGRATION.md).

## Layers

A request flows strictly one direction. Each layer may call the one below it, never above.

```
routes/       path + middleware + controller. No logic.
controllers/  HTTP in, HTTP out. Thin. No DB, no rules.
services/     Business rules and authorization. The real work.
models/       Supabase/Postgres access. snake_case ↔ camelCase mapping.
views/        Response envelope presenters.
```

Supporting: `config/` (env, supabase, logger), `middlewares/`, `validators/` (zod schemas),
`integrations/` (Razorpay, OpenAI, Resend, MSG91, Firebase), `jobs/`, `utils/`, `types/`,
`db/migrations`, `db/seeds`.

`src/routes/v1/auth.routes.ts` → `controllers/auth.controller.ts` → `services/auth.service.ts`
→ `models/profile.model.ts` is a complete vertical slice; follow it when adding a module.

## Conventions

**Every response uses one envelope**, per `DentaVue_API_Endpoints.md`:

```json
{ "success": true, "message": "Account created successfully", "data": {} }
```

Return through `views/response.ts` (`sendSuccess` / `sendCreated` / `sendError`) — never
`res.json` directly.

**Errors**: throw `ApiError.badRequest(...)` / `.unauthorized()` / `.forbidden()` etc. from
services. Express 5 forwards rejected promises to `errorHandler`, so controllers need no
try/catch. `401` means unauthenticated; `403` means wrong persona or not the owner; `422` is
field validation; `400` is an invalid but well-formed request.

**Authorization is this API's job.** `config/supabase.ts` exports two clients and the difference
matters: `supabaseAdmin` (service-role) bypasses Row Level Security entirely, so the database will
not stop a patient reading another patient's appointment; `supabaseAuth` (anon key) is for the
sign-in flows, which are unauthenticated by definition. `requireUserType()` gates the persona;
ownership checks belong in the service layer.

## Auth

Supabase owns identity: `auth.users`, password hashing, sessions, refresh tokens, SMS OTP delivery
and expiry, OAuth. This API adapts it to the spec's endpoints and envelope. There are no JWT
secrets and no password hashing here.

- Identity lives in Supabase's managed `auth.users`. **Never write to it directly.**
- App data lives in `public.profiles`, sharing the same primary key. See `db/migrations/README.md`.
- `userType` is read from `profiles`, never from the JWT's `user_metadata` — that is user-writable
  in some Supabase configurations, and a self-assigned `"provider"` would pass `requireUserType()`.
- Bearer tokens are verified via `supabaseAdmin.auth.getUser(token)`, which also catches revoked
  sessions. Verifying the signature locally would be faster but would accept a signed-out user's
  token until it expired.
- **Session persistence.** The access token is short-lived and rides as a Bearer header; the
  **refresh token is set as an httpOnly cookie** (`utils/cookies.ts`) on signin/signup/verify-otp/
  oauth. `POST /auth/session` (`restoreSession`) reads that cookie and mints a fresh session, so the
  web app stays signed in across reloads. Only a genuine 401 clears the cookie — a transient 5xx
  leaves it.

**Map Supabase errors through `utils/supabaseError.ts`.** A raw `throw ApiError.badRequest(err.message)`
reports an outage as the caller's fault — the API returned `400 "fetch failed"` when Supabase was
unreachable, and `signin` told users "Invalid email or password" during a network failure, sending
them off to reset a password that was fine. The rule: faults on our side of the boundary are 5xx and
never echo the upstream's words; faults in the caller's request are 4xx and may.

**Rate limiting** lives in `middlewares/rateLimit.ts` (`express-rate-limit`): per-IP + per-account on
`/signin`, per-IP on signup/OTP/verify/refresh/session, and per-user (`scanUploadLimiter`, 30/hr) on
`POST /scans`. The store is **in-memory**, so limits are per-process — a second instance doubles them
and a deploy resets counters. `env.REDIS_URL` is reserved to make them global before running more
than one instance.

## Scans (guided-scan capture)

A guided scan is **four images** (front teeth → upper gums → tongue → lower gums) captured in one
session. `POST /scans` uploads them to a private Supabase Storage bucket and records `public.scans`
(the session, its cover = the front-teeth shot) + `public.scan_images` (every angle). `GET /scans`
returns each scan with a signed cover `imageUrl` **and** an `images[]` array of signed per-angle URLs.
Run `db/migrations/0003_scans.sql` **and** `0004_scan_images.sql` before either endpoint works. The
`score` is null and the AI analysis isn't built — see `../SCANS_AND_COMPARE.md` for the full flow.
