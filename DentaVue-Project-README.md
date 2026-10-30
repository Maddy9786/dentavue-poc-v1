# DentaVue Project README

This document captures the current architecture, runtime flow, and deployment approach for the DentaVue MVP that is split into two repos:

- Backend: `DentaVue-backend`
- Frontend: `DentaVue-frontend`

The project is intentionally organized as a browser app plus a single API service. The browser never talks directly to Supabase, and the backend is the only layer that owns Supabase credentials and auth logic.

## 1. High-level system view

```text
Browser / Mobile UI (Next.js)
    |
    | REST API calls via RTK Query
    v
DentaVue Backend (Express + TypeScript)
    |
    +--> Supabase Auth (email/password, phone OTP, OAuth)
    +--> Supabase Postgres (profiles, scans, scan_images)
    +--> Supabase Storage (private scan image bucket)
    +--> Gemini (optional AI analysis pipeline)
```

## 2. Current responsibilities

### Frontend responsibilities
- Acts as the user-facing product shell.
- Uses Next.js App Router with route groups for auth, patient, provider, onboarding, guided-scan, AI insight, and compare.
- Uses Redux Toolkit + RTK Query as the single API data layer.
- Stores session tokens in Redux memory only; session restore relies on the backend refresh cookie.
- Contains route protection for guided-scan and AI pages.
- Handles scan capture UX, compare UI, and analysis polling.

### Backend responsibilities
- Owns all Supabase integration and authorization.
- Exposes `/v1/*` endpoints for auth, profile, and scans.
- Provides envelope-based responses, input validation, rate limiting, and shared error handling.
- Stores scan images in a private Supabase Storage bucket and returns signed URLs.
- Runs asynchronous AI analysis on uploaded scans and persists analysis results.

## 3. Core runtime flows

### Authentication flow
1. User signs in or signs up in the frontend.
2. Frontend sends request to backend `/v1/auth/*`.
3. Backend validates input, calls Supabase Auth, creates or joins the `profiles` row, and returns a session payload.
4. Frontend stores access token in memory and refresh token in the browser through an httpOnly cookie.
5. On reload, the frontend calls `/v1/auth/session`, which reads the cookie and restores the session.

### Guided scan flow
1. User captures 4 images (front teeth, upper gums, tongue, lower gums).
2. Frontend sends all images to `POST /v1/scans`.
3. Backend decodes data URLs, uploads each image to the private `scans` bucket, writes `scans` and `scan_images` rows, and returns signed URLs.
4. Backend triggers AI analysis asynchronously.
5. Frontend polls `GET /v1/scans/:scanId/analysis` until analysis is ready.

### AI insight and comparison flow
1. Frontend loads scans via `GET /v1/scans`.
2. Frontend requests analysis results via `GET /v1/scans/:scanId/analysis`.
3. Frontend loads comparison data from `GET /v1/scans/comparison`.
4. Compare and AI insight screens render the analyzed outputs and trends.

## 4. Key architectural patterns

### Frontend pattern
- `src/app/` defines routes and layouts.
- `src/features/*` groups domain APIs, slices, and UI logic.
- `src/services/api/baseApi.ts` holds the single RTK Query instance.
- `src/store/` holds Redux state.
- The server response envelope is stripped at the edge so components consume clean payloads.

### Backend pattern
- `src/routes/v1/*` wires endpoints.
- `src/controllers/*` are thin HTTP adapters.
- `src/services/*` hold business rules and authorization logic.
- `src/models/*` manage Supabase persistence mappings.
- `src/views/response.ts` standardizes the API response envelope.

## 5. Major component connections

### Browser to backend
- Frontend `baseApi` sends requests to `NEXT_PUBLIC_API_BASE_URL`.
- `prepareHeaders` injects the bearer token when available.
- `credentials: 'include'` ensures the refresh cookie is sent.

### Backend to external services
- `supabaseAdmin` is used for privileged operations and token verification.
- `supabaseAuth` is used for auth flows, including password and OTP sign-in.
- `scan.service.ts` uploads images and triggers the AI pipeline.
- `analysis.service.ts` calls Gemini when AI analysis is enabled.

## 6. Project gaps and current assumptions

The docs in the repos indicate that several modules are not yet implemented in full, such as provider/appointment/clinic/service/payment/review/search modules. Some of those folders exist as scaffolds, but their full endpoints are not yet wired.

## 7. Docker setup included

This workspace now includes root-level Docker assets for the two apps:

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `.dockerignore`

These are designed to follow a multi-stage build approach for both services.

## 8. How to run locally with Docker

1. Populate environment values for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and Gemini settings.
2. Run the stack:

```bash
docker compose up --build
```

3. Access:
   - Frontend: `http://localhost:3000`
   - Backend: `http://localhost:4000`

## 9. Additional docs included

- `DentaVue-HLD.md` — complete high-level design document
- `DentaVue-Flow-Diagram.md` — Mermaid flow and sequence diagrams

## 10. Recommended next steps

- Add a real `.env.example` for both apps.
- Add a production-ready reverse proxy and TLS layer for web deployment.
- Add Redis for distributed rate limiting and shared session state.
- Add health checks and observability.
- Complete the unimplemented modules in backend and frontend.
