# DentaVue High-Level Design (HLD)

## 1. Overview

DentaVue is a patient and provider-facing oral care application split into a Next.js frontend and an Express + TypeScript backend. The product currently focuses on:

- Authentication and session management
- Onboarding and profile management
- Guided scan capture
- AI analysis and comparison
- Provider / patient dashboards and route-gated screens

The backend is the single trusted integration point to Supabase and Gemini, while the frontend stays focused on UX and client-side state.

## 2. System context

### Actors
- Patient users
- Provider users
- System administrators
- Supabase platform services
- Gemini AI service

### External systems
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Gemini model API

## 3. Architecture principles

1. Frontend never accesses Supabase directly.
2. Backend owns authorization and API contracts.
3. Controllers stay thin and delegate business logic to services.
4. Models own persistence and data mapping.
5. All responses use a consistent envelope.
6. Protected screens rely on session restoration via secure cookie flow.

## 4. Logical architecture

```text
+---------------------------+
| Frontend (Next.js 16)     |
|   - Route groups          |
|   - Redux + RTK Query     |
|   - Tailwind UI           |
+-------------+-------------+
              |
              | HTTPS / REST
              v
+---------------------------+
| Backend (Express 5 / TS)  |
|   - Routes                |
|   - Controllers           |
|   - Services              |
|   - Models                |
|   - Validators            |
+------+------+-------------+
       |      |
       |      +--------------------+
       |                           |
       v                           v
+-----------------+         +-------------------+
| Supabase Auth   |         | Supabase Storage  |
| Email / password|         | Private scans     |
| Phone OTP      |         | signed URLs       |
| OAuth          |         +-------------------+
+-----------------+                     |
       |                               v
       +-------------------> Supabase Postgres / profiles / scans / scan_images
                               |
                               +----------------------+
                                      |
                                      v
                               Gemini AI analysis
```

## 5. Frontend subsystem design

### Route groups
The frontend is organized into these main route areas:

- `(auth)` — sign-in, sign-up, OTP, OAuth callback
- `(patient)` — patient-facing flows
- `(provider)` — provider-facing screens
- `onboarding/` — persona/profile setup flow
- `guided-scan/` — guided capture flow
- `ai-insight/` — analysis result rendering
- `compare/` — scan-to-scan comparison

### Frontend state and data layer
- `src/features/*` contains feature slices and injected RTK Query endpoints.
- `src/services/api/baseApi.ts` implements the single API instance.
- `src/store/*` contains app state wiring.
- `scanDraft` holds in-progress capture data that has not been uploaded yet.
- `auth` slice holds in-memory session credentials.

### Important frontend integration rules
- `NEXT_PUBLIC_API_BASE_URL` points to the backend API base.
- `credentials: 'include'` is used so the backend refresh cookie is sent with requests.
- RTK Query endpoints unwrap the backend response envelope to return clean payloads.
- `RequireAuth` protects sensitive routes.

## 6. Backend subsystem design

### Route layer
Current mounted route modules include:

- `/v1/auth` — signup, signin, OTP sign-in, oauth, session restore, logout
- `/v1/profile` — update profile
- `/v1/scans` — upload scans, list scans, fetch analysis, re-run analysis, comparison

### Controller layer
Controllers simply receive HTTP input and delegate to services. They do not own business rules.

### Service layer
Services implement:

- session creation
- account creation and sign-in
- profile updates
- scan upload orchestration
- signed URL generation
- AI analysis orchestration
- comparison arithmetic

### Model layer
Models interact with Supabase Postgres and Storage.

### Middleware layer
- `authenticate` verifies bearer tokens and populates `req.user`
- `validate` enforces request schema rules
- `rateLimit` throttles abusive requests
- `errorHandler` renders consistent API errors

## 7. Data model summary

### Frontend session state
- `user`
- `accessToken`
- `refreshToken`

### Backend session payload
- `user.userId`
- `user.email`
- `user.userType`
- `user.firstName`
- `user.lastName`
- `user.emailVerified`
- `accessToken`
- `refreshToken`

### Scan storage model
- `public.profiles` holds app profile metadata
- `public.scans` stores the scan session metadata
- `public.scan_images` stores per-angle scan image rows
- Supabase Storage bucket `scans` stores raw image objects privately

## 8. Detailed flow diagrams

### A. Authentication flow

```text
[Frontend form]
    -> POST /v1/auth/signin or /signup
    -> Backend auth route
    -> auth service
    -> Supabase Auth
    -> profile lookup / create
    -> session response
    -> frontend stores session in Redux
    -> cookie set for refresh persistence
```

### B. Session restore flow

```text
[App reload]
    -> SessionLoader in Providers
    -> POST /v1/auth/session
    -> Backend reads httpOnly refresh cookie
    -> Supabase refreshes session
    -> frontend stores new access token
```

### C. Guided scan upload flow

```text
[Frontend capture UI]
    -> POST /v1/scans
    -> Backend createScan service
    -> decode images
    -> upload four images to private bucket
    -> write scan rows + image rows
    -> return signed image URLs
    -> Backend triggers analysis asynchronously
    -> Frontend polls /analysis until ready
```

### D. AI analysis flow

```text
[Upload complete]
    -> analysisService.runAnalysis
    -> fetch scan images and metadata
    -> call Gemini model
    -> score, annotations, risk, narrative
    -> persist analysis results
    -> frontend polls and renders results
```

### E. Simple AI flow (quick reference)

```text
[Frontend scan upload]
    -> [Backend API]
    -> [Analysis service]
    -> [Gemini AI]
    -> [Database save]
    -> [Frontend shows AI insight]
```

## 9. Security design

### Auth trust boundaries
- Supabase owns identity lifecycle.
- The backend verifies Supabase-issued JWTs and authorizes the request using profile metadata.
- The browser never receives the service-role key.

### Storage security
- Scan images are stored in a private bucket.
- The API returns short-lived signed URLs.
- Public URLs are never used for personal health images.

### Data protection principles
- Role checks happen in the backend.
- Ownership checks are enforced in services.
- Signed-in-only endpoints require authentication middleware.

## 10. Operational architecture

### Runtime environment
- Frontend runs on Next.js and serves the UI on port 3000.
- Backend runs Express on port 4000.
- Both are designed for container deployment.

### Deployment support included
This workspace now includes root-level multi-stage Docker assets:

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `.dockerignore`

These are intended to simplify local composition and container deployment.

## 11. Known implementation realities

The project already contains several domain skeletons and placeholders. Some modules are scaffolded but not fully implemented:

- appointments
- availability
- clinic
- payments
- notifications
- reviews
- search
- messaging

This means the architecture is already designed for growth, but the full end-to-end coverage of those modules is not yet complete.

## 12. Suggested production hardening steps

1. Add Redis-backed rate limiting.
2. Add health checks and readiness endpoints for both apps.
3. Add centralized logging and request tracing.
4. Add CI/CD pipeline and image scanning.
5. Add environment validation and deployment secrets handling.
6. Add a reverse proxy or ingress with TLS termination.

## 13. Summary

The DentaVue MVP is a clean split between a browser app and a single back-end API. That separation gives the team a clear boundary for auth, storage, AI processing, and domain logic. The included Docker assets and architecture docs make the project easier to understand, containerize, and extend.
