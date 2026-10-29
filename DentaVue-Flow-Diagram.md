# DentaVue Flow Diagram (Printable One-Page Version)

## 1. SYSTEM OVERVIEW

```text
[USER]
   |
   | login
   v
[FRONTEND: Next.js UI]
   |
   | API call
   v
[BACKEND: Express API]
   |
   +--> login / signup / session
   +--> database
   +--> storage
   +--> AI analysis
   v
[SUPABASE + GEMINI]
   |
   +--> Auth
   +--> Database
   +--> Storage
   +--> AI
   v
[RESULT BACK TO FRONTEND]
```

---

## 2. LOGIN FLOW

```text
[USER]
   |
   | login
   v
[FRONTEND]
   |
   | send request
   v
[BACKEND]
   |
   | validate user
   v
[SUPABASE AUTH]
   |
   | create session
   v
[FRONTEND STORE SESSION]
   |
   | open dashboard / onboarding
   v
[USER PAGE]
```

---

## 3. SESSION RESTORE FLOW

```text
[APP RELOAD]
   |
   | restore session
   v
[FRONTEND]
   |
   | call /auth/session
   v
[BACKEND]
   |
   | read cookie
   v
[SUPABASE AUTH]
   |
   | refresh token
   v
[FRONTEND USER STATE]
```

---

## 4. SCAN FLOW

```text
[USER]
   |
   | scan
   v
[FRONTEND CAPTURE SCREEN]
   |
   | upload scan
   v
[BACKEND]
   |
   +--> upload images to storage
   +--> save scan record in database
   +--> return signed image URLs
   v
[FRONTEND SHOWS SCAN RESULT]
```

---

## 5. AI FLOW

```text
[BACKEND]
   |
   | AI
   v
[GEMINI AI]
   |
   | analyze images
   v
[AI RESULTS]
   |
   | save result
   v
[DATABASE]
   |
   | return result
   v
[FRONTEND AI INSIGHT / COMPARE SCREEN]
```

---

## 6. DATABASE FLOW

```text
[FRONTEND]
   |
   | data request
   v
[BACKEND]
   |
   | read / write
   v
[SUPABASE DATABASE]
   |
   +--> profiles
   +--> scans
   +--> scan_images
   +--> analysis
   v
[FRONTEND UPDATES UI]
```

---

## 7. PROTECTED PAGE FLOW

```text
[USER OPENS PROTECTED PAGE]
   |
   | auth check
   v
[FRONTEND]
   |
   +--> if logged in -> open page
   +--> if not logged in -> redirect to login
```

---

## 8. ONE-LINE SUMMARY

```text
USER -> FRONTEND -> BACKEND -> SUPABASE / GEMINI -> FRONTEND -> USER
```

---

## 9. QUICK LABEL GUIDE

- login = signup / signin / session
- scan = upload images and save scan data
- AI = Gemini analysis and insight generation
- database = profiles, scans, analysis results

---

## 10. FINAL SIMPLE EXPLANATION

- Frontend = screens, buttons, forms, pages
- Backend = logic, validation, API rules
- Supabase = auth, database, storage
- Gemini = AI analysis engine

This version is made for quick printing and easy understanding.
