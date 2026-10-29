# DentaVue Flow Diagram (Developer Version)

## 1. High-level component interaction

```mermaid
flowchart LR
    U[User] --> F[Next.js Frontend]
    F --> RTK[RTK Query baseApi]
    RTK --> API[Express API /v1]

    API --> AUTH[Auth Routes]
    API --> PROF[Profile Routes]
    API --> SCAN[Scan Routes]

    AUTH --> SA[Supabase Auth]
    PROF --> DB[Supabase Postgres]
    SCAN --> ST[Supabase Storage]
    SCAN --> DB

    API --> ANALYSIS[Analysis Service]
    ANALYSIS --> GEMINI[Gemini AI]
    ANALYSIS --> DB

    F --> Redux[Redux Store]
    F --> Routes[App Router Routes]
    Routes --> UI[UI Components]
```

---

## 2. Login / signup flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant S as Supabase Auth
    participant P as Profiles table

    U->>F: Enter email/password
    F->>B: POST /auth/signup or /auth/signin
    B->>S: createUser / signInWithPassword
    S-->>B: Session + tokens
    B->>P: Create or load profile row
    B-->>F: Session payload
    F->>F: Store access token in Redux
```

---

## 3. Session restore flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant B as Backend
    participant S as Supabase Auth
    participant C as Browser Cookie

    F->>C: Read refresh cookie
    F->>B: POST /auth/session
    B->>C: Read httpOnly refresh token
    B->>S: Refresh session
    S-->>B: New access token
    B-->>F: Refreshed session response
    F->>F: Update auth state
```

---

## 4. Guided scan upload flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant ST as Supabase Storage
    participant DB as Supabase Postgres

    U->>F: Capture four images
    F->>B: POST /v1/scans
    B->>ST: Upload images to private bucket
    B->>DB: Insert scan and scan_images rows
    B-->>F: Return signed image URLs
    B->>B: Trigger async analysis
    F-->>U: Show upload success
```

---

## 5. AI analysis flow

```mermaid
sequenceDiagram
    participant B as Backend
    participant G as Gemini
    participant DB as Supabase DB
    participant F as Frontend

    B->>G: Run analysis for uploaded scan
    G-->>B: score, annotations, risk, narrative
    B->>DB: Persist analysis result
    B-->>F: Return analysis status/result
    F->>F: Render AI insight / compare screens
```

---

## 6. Protected route flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant P as RequireAuth
    participant B as Backend

    U->>F: Open protected route
    F->>P: Evaluate auth state
    P->>F: Wait for session restore
    F->>B: POST /auth/session
    alt Session valid
        B-->>F: Authenticated state
        P-->>F: Allow route
    else Session invalid
        B-->>F: 401 response
        P-->>F: Redirect to /signin
    end
```

---

## 7. API mapping

```text
Frontend feature modules
  - auth
  - profile
  - scan
  - analysis
  - onboarding
  - dashboard

       |
       v
RTK Query baseApi
       |
       +--> /v1/auth
       +--> /v1/profile
       +--> /v1/scans

Backend modules
  - routes/v1
  - controllers
  - services
  - models
  - middleware
  - validators
  - integrations
```

---

## 8. Developer notes

- Frontend uses a single RTK Query instance (`baseApi`) for cache consistency.
- Backend is the only service that talks to Supabase directly.
- Scan images are stored in a private Supabase Storage bucket.
- Signed URLs are returned to the browser for image rendering.
- AI analysis is asynchronous and the UI polls for status.
- Session persistence depends on an httpOnly refresh cookie.

---

## 9. Very short version

```text
User -> Frontend -> Backend -> Supabase / Gemini -> Frontend
```

This means:
- Frontend handles screens and user interaction.
- Backend handles logic, validation, and orchestration.
- Supabase handles auth, storage, and database.
- Gemini handles AI analysis.
