# DentaVue-Web — Architecture

Developer reference for the DentaVue patient/provider web app. Pairs with the
repo `README.md` (commands, layer rules) and the design-system notes in the
root `CLAUDE.md`. For the whole-system view and how this repo talks to the API,
see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router), **React 19**, Turbopack |
| Language | TypeScript (strict; `noUncheckedIndexedAccess` on) |
| State / data | **Redux Toolkit** + **RTK Query** (one `baseApi`) |
| Styling | **Tailwind v4**, CSS-first (`@theme`, no `tailwind.config.js`) |
| Icons | **SVGR** — `.svg` compiled to components at build |
| Font | **Nunito** via `next/font` (SF Pro Rounded substitution) |
| Tests | **Vitest** |

The web app talks **only** to the DentaVue backend over REST. There is
deliberately **no Supabase client here** — the browser never holds the
service-role key, and authorization is the API's job.

---

## 2. Directory map

```
src/
├── app/                      # App Router: routes, layouts, route groups
│   ├── (auth)/               # sign-in / sign-up / verify-otp / oauth callback
│   ├── (patient)/            # patient dashboard, appointments, scan, …
│   ├── (provider)/           # provider dashboard, availability, clinic, …
│   ├── onboarding/           # persona → intro → profile (3 steps)
│   ├── layout.tsx            # root layout (server component)
│   ├── providers.tsx         # Redux <Provider> (client)
│   └── globals.css           # imports every token file — see §5
├── components/
│   ├── ui/                   # design-system primitives (Button, TextField, …)
│   ├── auth/                 # AuthHeader/…, RequireAuth (route guard)
│   ├── dashboard/  layout/  onboarding/  compare/  insight/   # feature components
│   └── scan/                 # guided-scan flow (capture, quality, analysing, …)
├── features/                 # one folder per domain
│   ├── auth/                 # authApi (RTK Query) + authSlice + mockAuth
│   ├── dashboard/            # mock data shaped as the future API response
│   ├── onboarding/           # persona / intro / profile field data
│   ├── profile/              # profileApi (PATCH /profile)
│   └── scan/                 # scansApi + scanDisplay + useScanComparison + scanDraftSlice
├── services/api/baseApi.ts   # the single RTK Query instance
├── store/                    # makeStore, rootReducer, typed hooks
├── lib/                      # cn, fonts, env, apiError, validation, …
├── styles/tokens/            # colors / typography / geometry / effects (@theme)
├── icons/                    # raw .svg — SVGR-compiled
├── constants/routes.ts       # every path, typed
└── types/api.ts              # shared API contract types (envelope, branded IDs)
```

Route groups `(auth)`, `(patient)`, `(provider)` are **URL-transparent** — the
parens keep them out of the path, so all personas share one namespace. Keep
segment names distinct across groups to avoid collisions.

Empty `features/*` folders (`appointments`, `availability`, `clinic`, …) are
scaffold placeholders held by `.gitkeep`.

---

## 3. Data flow

```
Component
  │  useXxxMutation() / useXxxQuery()   (hooks from injectEndpoints)
  ▼
RTK Query endpoint  ── query() ──►  baseQuery (fetchBaseQuery)
  │                                    │  prepareHeaders: Bearer <accessToken>
  │  transformResponse: strip envelope │
  ▼                                    ▼
component sees `data` directly    DentaVue backend  (REST, /v1)
```

- **One API instance.** Every feature attaches endpoints with
  `baseApi.injectEndpoints(...)` ([`services/api/baseApi.ts`](src/services/api/baseApi.ts)) —
  never a second `createApi`, so cache and tag invalidation stay coherent.
- **The envelope is stripped at the edge.** The backend wraps everything in
  `{ success, message, data }`; each endpoint's `transformResponse: (r) => r.data`
  hands components the payload directly. They never see the envelope.
- **Auth header is automatic.** `prepareHeaders` reads `state.auth.accessToken`
  and sets `Authorization: Bearer …`. `baseQueryWithReauth` is a stub for
  refresh-on-401 (TODO: implement against `POST /auth/refresh-token`).
- **`onQueryStarted`** is where a successful auth mutation dispatches
  `credentialsReceived`. These awaits are wrapped in `try/catch` — `queryFulfilled`
  is a separate promise from the component's `.unwrap()`, and an uncaught
  rejection surfaces as a Next "[object Object]" overlay.

### State split

`store/rootReducer.ts` combines:

- `api` — the **RTK Query cache** (all server data lives here; do not mirror
  fetched entities into slices).
- `auth` — client-only session state ([`features/auth/authSlice.ts`](src/features/auth/authSlice.ts)):
  `user`, `accessToken`, `refreshToken`.
- `scanDraft` — the exception-that-proves-the-rule: the **in-progress captured
  images** ([`features/scan/scanDraftSlice.ts`](src/features/scan/scanDraftSlice.ts)),
  not yet server data, so the results screen can show them regardless of upload.

**Access tokens are in memory only** — they do not survive a reload, so on load
the app restores the session from the API's httpOnly refresh cookie via
`POST /auth/session` (fired once by the `SessionLoader` in `providers.tsx`). That
persistence is what now makes **route protection** viable: `RequireAuth`
([`components/auth/RequireAuth.tsx`](src/components/auth/RequireAuth.tsx)) waits for
that restore to settle before deciding, so it never bounces a real signed-in user
mid-refresh. It guards the AI pages via a `layout.tsx` on each — the whole
`/guided-scan` flow, `/ai-insight`, and `/compare`; a signed-out visitor is sent to
`/signin`. Home (`/`) stays public.

`makeStore()` builds a **fresh store per request on the server** (never a
module-level singleton — that leaks one user's state into another's request);
`Providers` creates it once per client mount via `useState(makeStore)`.

---

## 4. Auth in the client

Endpoints live in [`features/auth/authApi.ts`](src/features/auth/authApi.ts):
`signup`, `signin`, `signinPhone`, `verifyPhoneOtp`, `resendPhoneOtp`,
`oauthComplete`, `session` (restore on load), `logout`.

- **`signup` now returns a full session** and stores it (like `signin`), so the
  onboarding flow that runs straight after is authenticated and can save the
  profile. (This replaced the older "no session at sign-up" behaviour.)
- **Phone OTP is mocked in the browser** — SMS is a paid service not yet bought.
  `isPhoneOtpMocked()` gates the three phone endpoints only (`mockAuth.ts`); the
  flag is substituted at build time, so with it off the guard compiles to a
  constant. Email sign-in/up always hit the real backend.
- **Google OAuth** uses the implicit flow: the backend builds the consent URL,
  Supabase redirects to `/(auth)/auth/callback`, that page relays the hash
  tokens to `oauthComplete`, which the backend re-validates.

---

## 5. Design system (Tailwind v4, CSS-first)

There is **no `tailwind.config.js`** — adding one is a mistake. The theme lives
in `@theme` blocks inside `styles/tokens/*.css`, and **every token file must be
imported in `app/globals.css`** or its utilities silently never generate.

**Two tiers, load-bearing:**

- `--palette-*` (`:root`) — raw hexes/weights. No meaning, never used by a
  component.
- `--color-*` / `--text-*` / `--font-*` (`@theme`) — semantic roles. Tailwind
  generates `bg-primary`, `text-h1`, etc. **Components use semantic utilities
  only** — a hex or raw palette class (`bg-blue-500`) has left the system.

**`cn()` must know every custom token.** [`lib/cn.ts`](src/lib/cn.ts) extends
`tailwind-merge` with each token, because tailwind-merge only ships knowledge of
Tailwind's default theme. Miss one and merges fail silently (over-merge drops a
class; under-merge lets conflicting classes both survive). `tests/unit/cn.test.ts`
guards both directions.

**Contrast is resolved by pairing.** Brand fills are light, so the design's
white "text on primary" fails AA; each fill has a matching `on-*` token measured
to pass (`bg-primary` + `text-on-primary`, etc.). *Note:* per client direction,
onboarding/dashboard fills currently override this with white text (`text-surface`)
— flagged in-code as below-AA, pending client confirmation.

**Icons** are the `.svg` files in `src/icons`, imported directly
(`import X from '@/icons/x.svg'`). SVGR compiles them at build; `replaceAttrValues`
in `next.config.ts` maps palette hexes → token vars (`#736B61`→`currentColor`,
`#221E19`→`var(--color-foreground)`, `#2FB6A0`→`var(--color-secondary)`).
`dimensions:false` means every icon needs a size class. Two kinds:
- **currentColor glyphs** (`#736B61`) — tint with `text-*`.
- **Self-contained chips** (contain an `#ECE7DF` box) — render at chip size, no
  wrapper, no tint.

**Font** is chosen in exactly one place — [`lib/fonts.ts`](src/lib/fonts.ts),
exposed as `--font-app`.

---

## 6. Conventions & how to extend

- **Add an API call:** create/extend `features/<domain>/<domain>Api.ts` with
  `baseApi.injectEndpoints`, type the envelope, strip it in `transformResponse`,
  add tags for cache invalidation, export the generated hook.
- **Add a route:** add the path to `constants/routes.ts` (typed), then the
  `app/**/page.tsx`.
- **Add a UI primitive:** put it in `components/ui/`, style with semantic
  utilities via `cn()`, keep it accessible (labelled controls, focus-visible
  rings, `aria-*`).
- **Add a token:** add it to `styles/tokens/*.css`, import the file in
  `globals.css`, **and** register it in `lib/cn.ts`. Run `npm test`.
- **Screens are data-driven:** presentational screens map over data shaped like
  the future API response (`features/*/mock*.ts`, `*Fields.ts`), so a real fetch
  drops in without touching markup.
- **Protect a page:** wrap its route in `<RequireAuth>` via a `layout.tsx` (see
  `app/guided-scan/layout.tsx`) — it waits for the session restore before
  redirecting, so it won't bounce a signed-in user on refresh.

The **guided-scan flow** (capture → analyse → results), the **Compare** and
**AI-insight** screens, scan storage, session persistence, and route protection
are documented end-to-end in [`../SCANS_AND_COMPARE.md`](../SCANS_AND_COMPARE.md).

### Commands

```bash
npm run dev        # next dev (Turbopack)
npm run build      # production build (run it — config that never ran isn't trusted)
npm run lint
npm run typecheck  # tsc --noEmit
npm test           # vitest
```
