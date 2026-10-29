# DentaVue-Web

This is DentaVue web application.

Next.js 16 (App Router) + TypeScript + Redux Toolkit / RTK Query + Tailwind v4.

## Getting started

```bash
npm install
cp .env.example .env.local    # point NEXT_PUBLIC_API_BASE_URL at DentaVue-backend
npm run dev                   # http://localhost:3000
```

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` | Prettier |

## Data access

All data comes from the **DentaVue Node backend** over REST. There is deliberately no Supabase
client here — the backend owns Supabase, and its service-role key must never reach a browser.
Point `NEXT_PUBLIC_API_BASE_URL` at the backend and go through RTK Query.

## ⚠ Mock phone auth (development only)

`NEXT_PUBLIC_MOCK_PHONE_OTP=true` replaces Supabase phone OTP with a code generated, displayed, and
checked **in the browser**, so the sign-in screens can be clicked through before an SMS provider
is configured. Enter the code shown on the OTP screen and you "sign in".

**It authenticates nobody.** The code is printed on screen and the session it returns is
fabricated — no API will accept those tokens. Setting this flag in a deployed build is an
authentication bypass.

Why it can't leak silently:

- `NEXT_PUBLIC_*` is substituted at **build** time, so the guard compiles to a literal. Verified
  in a no-flag production build: `isPhoneOtpMocked` minifies to `function n(){return!1}`. There
  is no runtime switch — enabling it requires a rebuild with the flag set.
- The flag is absent from `.env.example`, so copying that file does not inherit it.
- Whenever it is live, the OTP screen shows a red dashed banner saying the sign-in is fake.

Note the guard is a function call, not an inline literal, so the minifier keeps `mockAuth.ts` in
the bundle even when unreachable. It is inert dead weight, not an exposure — but it is there until
the file is deleted.

**Removing it** (once Supabase is attached): unset the flag, delete `src/features/auth/mockAuth.ts`,
`src/components/auth/MockOtpNotice.tsx`, `tests/unit/mockAuth.test.ts`, and the
`if (isPhoneOtpMocked())` branches in `features/auth/authApi.ts`. Nothing else changes — the mock
returns exactly the shapes the API returns, so no screen knows which path is live.

## Structure

```
src/app/         App Router. Route groups: (auth), (patient), (provider), onboarding.
                 Global fallbacks: not-found.tsx (404), error.tsx (route errors,
                 network-aware), global-error.tsx (root crash).
src/features/    One folder per domain: a slice + injected RTK Query endpoints.
src/components/  ui/ primitives, auth/, layout/, forms/, shared/, feedback/
                 (StatusScreen + the offline overlay, mounted globally in providers).
src/icons/       Figma-exported .svg — these ARE the icon components (see below).
src/services/api Single RTK Query `baseApi`; features inject into it.
src/store/       configureStore, rootReducer, typed hooks.
src/styles/      tokens/*.css — the Tailwind theme.
src/lib/         Framework-agnostic helpers (env, cn, fonts, validation).
src/types/       Shared API contract types.
```

## Icons

**Import the `.svg` straight from `src/icons` — do not hand-write a component around it.**

```tsx
import PhoneIcon from '@/icons/phone.svg'

<PhoneIcon aria-hidden="true" className="size-6 text-foreground-secondary" />
```

SVGR (configured in `next.config.ts`) compiles each file into a React component at build time, so
the exported artwork is the single source of truth — there is no second copy of the path data to
drift when someone re-exports from Figma.

That config also does two things worth knowing:

- **`replaceAttrValues` maps the palette hexes onto tokens as the icon compiles** — `#736B61` →
  `currentColor`, `#221E19`/`#2FB6A0` → the logo's tokens. So the files stay pristine exports while
  the rendered icons still follow the design system. As exported they hardcode `#736B61`, which
  would ignore a palette change and stay dark in a dark theme. Keep the map in sync with
  `tokens/colors.css`; hexes match literally, so they must stay uppercase as Figma writes them.
- **`dimensions: false` strips the exported width/height**, so size comes from CSS. Give every icon
  a size class. They are not all square — `apple.svg` is a `0 0 24 28` viewBox, so `size-6` would
  letterbox it; it uses `h-7 w-6`.

Raster brand marks (`google.png`) are unaffected and still go through `next/image`.

`src/features/auth/` is the reference pattern for a domain — copy its slice + api shape.

## Design system

Tailwind v4 is configured **in CSS** — there is no `tailwind.config.js`. The `@theme` blocks in
`src/styles/tokens/` **are** the theme. Read them before styling anything; no components are built
yet, so this is the whole system.

| File | Holds | Utilities |
|---|---|---|
| `colors.css` | palette + semantic roles | `bg-primary`, `text-foreground`, `border-border` |
| `typography.css` | font, size scale, weights | `text-h1`, `text-body`, `font-semibold` |
| `geometry.css` | spacing, radius, stroke | `p-md`, `gap-lg`, `rounded-2` |
| `effects.css` | shadows | `shadow-drop`, `shadow-elevated` |

**Every token file must be imported in `src/app/globals.css`.** An `@theme` block in an unimported
file is dead — Tailwind never sees it, no utilities are generated, and the classes silently do
nothing.

`--stroke-*` is deliberately utility-less (Tailwind has no `--stroke` namespace); use
`border-[var(--stroke-1)]`. Tailwind's numeric spacing (`p-4`) still works alongside the named
scale (`p-md`).

- **Semantic utilities only.** `bg-primary`, `text-h2`, `border-border`. Never `bg-[#3B9DF0]`,
  never `bg-blue-500` — those bypass the system and won't follow a theme change.
- **Two tiers.** `--palette-*` holds raw values; `--color-*`/`--text-*` name roles. Components
  touch roles, never the palette.
- **Type comes from the scale**: `text-h1-lg` (20px) · `text-h1` (16) · `text-h2` (14) ·
  `text-body` (12) · `text-nav` (10), each pairing size with line-height. Weight is separate:
  `font-regular` · `font-medium` · `font-semibold`.
- **Pair every fill with its `on-` token** — `bg-error text-on-error`, never `bg-error
  text-on-primary`. Each `on-` token is the text colour measured to pass WCAG AA on that fill, so
  the pair is accessible by construction. They are not interchangeable: the brand fills are light
  and take dark text; error is dark and takes white.
- **Merge classes with `cn()`** from `src/lib/cn.ts`, not string concatenation — otherwise
  conflicting utilities both land and stylesheet order picks the winner. **Adding a token to
  `styles/tokens/` means adding it to `cn.ts` too**, or twMerge will silently strip it at runtime.
  `npm test` guards this.
- The font is **Nunito**, not the SF Pro Rounded in the Figma — Apple's licence forbids web
  embedding. See the note in `styles/tokens/typography.css`.
- **`text-foreground-tertiary` is decoration only** — 2.46:1, illegible at any size. Use
  `text-foreground-secondary` for muted text.
- **No dark palette exists yet**, despite every Figma screen having a dark variant. Don't invent
  values; the override point is documented at the foot of `tokens/colors.css`.

### Web sizing (≥850px)

The design is drawn for a 375px phone, which reads small on a desktop. Two **single knobs** in
`src/app/globals.css` scale it up on web — change only these values, nothing else:

- **Root `font-size: 112.5%`** at `min-width: 850px`. Because the whole scale (type, spacing,
  radius, icons) is `rem`-based, everything grows in proportion; borders (`px`) stay crisp.
  `rem` in the `@media` condition is measured against the browser default, so Tailwind's own
  breakpoints don't drift.
- **`--app-column`** — the content-column width (440 phone / 560 tablet / 680 web), applied via
  the **`app-column` utility**. New screens centre content with `mx-auto … app-column`, **not**
  inline `max-w-[440px] md:max-w-[560px]` — the old pattern was replaced everywhere so the column
  is tunable from one place. Kept in `px` on purpose, so it doesn't compound with the font scale-up.
- **Scan images use `aspect-[3/2]`** (the AI-insight showcase and results carousel); the live
  capture preview is `aspect-[3/4]` on phones, `md:aspect-[3/2]` on web. A square or portrait image
  would tower in the wide web column, so aspect ratios shorten rather than max-heights crop.

## Conventions

- **Server data lives in the RTK Query cache**, not in slices. Slices hold client state only
  (`auth`; `scanDraft` = the in-progress captured images, not yet server data). Don't mirror
  fetched entities into a slice.
- **Protected routes**: the AI pages (`/guided-scan/*`, `/ai-insight`, `/compare`) are gated by
  `<RequireAuth>` (a `layout.tsx` per route) — a signed-out visitor is sent to `/signin`. The guard
  waits for the session restore (`POST /auth/session`, fired by `providers.tsx`) so it never bounces
  a signed-in user on refresh. The guided-scan flow, scans, and this protection are documented in
  [`../SCANS_AND_COMPARE.md`](../SCANS_AND_COMPARE.md).
- **One `baseApi`.** Features call `baseApi.injectEndpoints(...)` rather than creating their
  own `createApi` — one instance keeps caching and tag invalidation coherent.
- **Unwrap the envelope at the edge.** The backend returns `{success, message, data}`;
  endpoints strip it in `transformResponse` so components see the payload directly.
- **Typed hooks only** — `useAppDispatch` / `useAppSelector` from `src/store/hooks.ts`.
- **Both themes from the start.** The Figma set is mobile-first with every screen in light and
  dark; tokens for both are in `src/app/globals.css`.
