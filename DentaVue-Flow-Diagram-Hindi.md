# DentaVue Flow Diagram (Hindi – One Page Cheat Sheet)

## 1. Simple system flow

```text
[User]
   |
   v
[Frontend: Next.js]
   |
   | 1. Login / Signup
   | 2. Show pages
   | 3. Capture scan images
   v
[Backend: Express API]
   |
   | 4. Validate request
   | 5. Check user session
   | 6. Save data / upload scans
   v
[Supabase Auth]
   |
   +--> Login / Signup / Session

[Supabase Database]
   |
   +--> Store profile, scan records, analysis data

[Supabase Storage]
   |
   +--> Store patient scan images securely

[Gemini AI]
   |
   +--> Analyze scan images

Result
   |
   v
[Frontend shows dashboard / AI insight / compare page]
```

---

## 2. Login flow

```text
[User] --> [Frontend Login Page] --> [Backend /auth/signin]
                                      |
                                      v
                              [Supabase Auth]
                                      |
                                      v
                           [Session / Token create hota hai]
                                      |
                                      v
                              [Frontend stores session]
                                      |
                                      v
                           [Dashboard / Onboarding open hota hai]
```

### Simple meaning
- User frontend par login karta hai.
- Frontend backend ko request bhejta hai.
- Backend Supabase Auth se user ko verify karta hai.
- Supabase session/token deta hai.
- Frontend us session ko save karta hai.

---

## 3. Session restore flow

```text
[Browser reload] --> [Frontend app starts]
                        |
                        v
              [Frontend calls /auth/session]
                        |
                        v
                    [Backend reads cookie]
                        |
                        v
                  [Supabase refreshes session]
                        |
                        v
              [Frontend user ko logged-in state mein rakhta hai]
```

### Simple meaning
- User ko dobara login nahi karna padta.
- Frontend backend se cookie ke basis par session restore karta hai.

---

## 4. Scan upload flow

```text
[User] --> [Frontend capture screen]
               |
               v
     [Frontend sends 4 images to /scans]
               |
               v
        [Backend uploads images]
               |
               +--> [Supabase Storage]
               |
               +--> [Supabase Database]
               |
               v
      [Backend returns signed image URLs]
               |
               v
        [Frontend shows scan success]
```

### Simple meaning
- User image capture karta hai.
- Frontend images ko backend ko bhejta hai.
- Backend images ko storage mein save karta hai.
- Database mein scan ka record banta hai.
- Frontend ko image URLs milte hain.

---

## 5. AI analysis flow

```text
[Scan uploaded] --> [Backend triggers AI analysis]
                          |
                          v
                     [Gemini AI]
                          |
                          v
                [AI result: score, findings, annotations]
                          |
                          v
                [Backend stores analysis in database]
                          |
                          v
              [Frontend shows AI insight / compare page]
```

### Simple meaning
- Images upload hone ke baad backend Gemini ko send karta hai.
- Gemini analysis result deta hai.
- Backend result ko database mein save karta hai.
- Frontend us result ko user ko dikhata hai.

---

## 6. Protected page flow

```text
[User opens protected page]
            |
            v
[Frontend checks auth session]
            |
            +--> If logged in --> [Open page]
            |
            +--> If not logged in --> [Redirect to login page]
```

### Simple meaning
- Protected pages sirf logged-in users ke liye hote hain.
- Agar session valid nahi hai, to user ko login page par bhej diya jata hai.

---

## 7. One-line summary

```text
User -> Frontend -> Backend -> Supabase / Gemini -> Frontend -> User
```

### Short explanation
- Frontend = UI / user interface
- Backend = logic / processing
- Supabase = database, auth, storage
- Gemini = AI analysis engine

---

## 8. Fast cheat sheet

- Frontend: screens, forms, routes, UI
- Backend: API, auth, validation, rules
- Supabase Auth: login, signup, sessions
- Supabase Database: profile, scans, results
- Supabase Storage: private images
- Gemini: AI analysis

---

## 9. Quick notes

- Frontend kabhi directly Supabase nahi bolta.
- Backend hi Supabase aur Gemini ka trusted point hai.
- Safeguard ke liye protected pages session check karte hain.
- Scan images private storage mein save hote hain.
