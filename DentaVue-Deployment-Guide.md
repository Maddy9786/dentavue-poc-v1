# DentaVue Deployment Guide

This guide explains how to run the DentaVue project locally and deploy it using the Docker setup already created in this workspace.

## 1. Prerequisites

Before starting, make sure you have the following installed on your machine:

- Docker Desktop or Docker Engine
- Docker Compose
- Git
- A text editor to update environment variables

### Recommended versions
- Docker: latest stable
- Node.js: 20+
- npm: 10+

## 2. Project structure used by this guide

The deployment setup expects the following files in the workspace root:

- `Dockerfile.backend`
- `Dockerfile.frontend`
- `docker-compose.yml`
- `.env.example`
- `.env` (you create this)

## 3. Prepare environment variables

1. Open the workspace root.
2. Copy the sample environment file:

```bash
copy .env.example .env
```

3. Update `.env` with your real values.

### Required values

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### Optional values

```env
NODE_ENV=production
PORT=4000
API_PREFIX=/v1
CORS_ORIGINS=http://localhost:3000
WEB_APP_URL=http://localhost:3000
COOKIE_SAMESITE=lax

NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000

DATABASE_URL=
REDIS_URL=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_NARRATIVE_MODEL=gemini-3.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-flash-lite-latest
GEMINI_MEDIA_RESOLUTION=MEDIUM
GEMINI_TIMEOUT_MS=60000
AI_ANALYSIS_ENABLED=true
DISABLE_RATE_LIMIT=false
```

> If you do not provide a Gemini key, AI analysis will be skipped but uploads and UI flows can still run.

## 4. Start the project with Docker Compose

From the workspace root, run:

```bash
docker compose up --build
```

This will build and start:

- Frontend on `http://localhost:3000`
- Backend on `http://localhost:4000`

### Run in detached mode

```bash
docker compose up --build -d
```

### Stop the stack

```bash
docker compose down
```

### Rebuild only when code changes

```bash
docker compose up --build
```

## 5. Check whether the services are running

### Check container status

```bash
docker compose ps
```

### Check backend health

```bash
curl http://localhost:4000/health
```

Expected result:

```json
{ "success": true, "message": "ok", "data": { "status": "healthy" } }
```

### Check frontend

```bash
curl -I http://localhost:3000
```

Expected result: an HTTP 200 response.

## 6. View logs

### View all logs

```bash
docker compose logs -f
```

### View only backend logs

```bash
docker compose logs -f backend
```

### View only frontend logs

```bash
docker compose logs -f frontend
```

## 7. Local development workflow

If you want to develop without rebuilding every time, you can run the apps manually.

### 7.1 Run backend manually

From the backend folder:

```bash
cd "DentaVue-backend"
npm install
npm run dev
```

The backend will start on:

```text
http://localhost:4000/v1
```

### 7.2 Run frontend manually

From the frontend folder:

```bash
cd "DentaVue-frontend"
npm install
npm run dev
```

The frontend will start on:

```text
http://localhost:3000
```

### 7.3 Build production locally

Backend:

```bash
cd "DentaVue-backend"
npm install
npm run build
npm start
```

Frontend:

```bash
cd "DentaVue-frontend"
npm install
npm run build
npm run start
```

## 8. Deployment steps for a real environment

### Option A: Deploy with Docker Compose on a server

1. Copy the project to the target machine.
2. Create `.env` with production values.
3. Run:

```bash
docker compose up --build -d
```

4. Verify:

```bash
docker compose ps
curl http://localhost:4000/health
curl -I http://localhost:3000
```

5. Enable restart policy and monitoring as needed.

### Option B: Deploy the built images manually

You can also build the images directly:

```bash
docker build -f Dockerfile.backend -t dentavue-backend .
docker build -f Dockerfile.frontend -t dentavue-frontend .
```

Then run them manually:

```bash
docker run -d -p 4000:4000 --env-file .env --name dentavue-backend dentavue-backend
docker run -d -p 3000:3000 --name dentavue-frontend dentavue-frontend
```

## 9. Common troubleshooting

### Issue: Docker Compose cannot find the source folders

Make sure the folder names in the Dockerfiles match exactly:

- `DentaVue-backend`
- `DentaVue-frontend`

### Issue: backend shows missing Supabase environment variables

Check `.env` and make sure these values are filled:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

### Issue: frontend cannot reach backend

Verify `NEXT_PUBLIC_API_BASE_URL` in `.env` and in the Docker build arguments:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1
```

### Issue: health check fails

Check logs:

```bash
docker compose logs -f backend
```

### Issue: the frontend starts but API calls fail

Make sure CORS is configured correctly:

```env
CORS_ORIGINS=http://localhost:3000
```

## 10. Useful commands summary

### Start everything

```bash
docker compose up --build
```

### Start in background

```bash
docker compose up --build -d
```

### Stop everything

```bash
docker compose down
```

### Restart after edits

```bash
docker compose up --build -d
```

### Verify backend

```bash
curl http://localhost:4000/health
```

### Verify frontend

```bash
curl -I http://localhost:3000
```

### View logs

```bash
docker compose logs -f
```

## 11. Recommended production hardening

Before using this in production, consider adding:

- Docker volumes for persistent data if needed
- Reverse proxy with TLS termination
- External secret management
- Health monitoring and alerting
- Redis for shared rate limiting
- CI/CD pipeline for automated builds

## 12. Final quick run checklist

Use this checklist before saying the app is running:

- [ ] `.env` exists and contains valid Supabase values
- [ ] Docker Compose config validates
- [ ] `docker compose up --build -d` completes successfully
- [ ] Backend health is reachable on port 4000
- [ ] Frontend is reachable on port 3000
- [ ] Browser loads the app without API errors

## 13. Summary

The easiest way to run DentaVue is:

```bash
copy .env.example .env
# fill in real Supabase / Gemini values

docker compose up --build -d
```

Then verify:

```bash
curl http://localhost:4000/health
curl -I http://localhost:3000
```

This will bring up the complete project for local testing and a deployment-ready Docker-based setup.
