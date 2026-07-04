# 🚀 FinTrack — Deployment Guide

Frontend → **Vercel** · Backend → **Railway** · DB → **Neon (Postgres)**

---

## 0. Push code to GitHub

The repo is already committed locally on the `main` branch. After creating an
empty repo on GitHub (no README), run:

```bash
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

---

## 1. Database — Neon (Postgres)

1. Create a project at https://neon.tech
2. Copy two connection strings:
   - **Pooled** → use as `DATABASE_URL`
   - **Direct** (unpooled) → use as `DIRECT_URL`
   - Both must include `?sslmode=require`

---

## 2. Backend — Railway

1. New Project → **Deploy from GitHub repo** → pick this repo
2. Settings → **Root Directory** = `backend`
3. Railway auto-reads `backend/railway.json`:
   - Build: `npm ci && npx prisma generate`
   - Start: `npx prisma migrate deploy && node src/server.js`
   - Healthcheck: `/api/health`
4. Add a **Redis** plugin (gives `REDIS_URL`) — or set your own.
5. **Variables** (paste all): see the checklist below.
6. Deploy. First boot runs the `0_init` migration → creates all tables.
7. Copy the public backend URL, e.g. `https://fintrack-backend.up.railway.app`

### Required backend env vars
```
NODE_ENV=production
DATABASE_URL=<neon pooled>
DIRECT_URL=<neon direct>
REDIS_URL=<railway redis>
JWT_ACCESS_SECRET=<64-char random>
JWT_REFRESH_SECRET=<64-char random>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
FRONTEND_URL=https://<your-vercel-domain>
GROQ_API_KEY=<groq key>
GROQ_MODEL=llama-3.3-70b-versatile
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<...>
GOOGLE_CALLBACK_URL=https://<railway-domain>/api/auth/google/callback
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<...>
SMTP_PASS=<gmail app password>
FROM_EMAIL=noreply@fintrack.in
ADMIN_SECRET_KEY=<...>
WHATSAPP_ENABLED=false      # keep false on Railway (no terminal/persistent disk)
```
> Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 3. Frontend — Vercel

1. New Project → import the same GitHub repo
2. **Root Directory** = `frontend` (Framework auto-detects as Vite)
3. Edit **`frontend/vercel.json`** → replace
   `REPLACE-WITH-RAILWAY-BACKEND.up.railway.app` with your real Railway domain,
   commit & push. This proxies `/api/*` to the backend so auth cookies stay
   same-origin (no `VITE_API_BASE_URL` needed).
4. Deploy. Copy the Vercel domain.

---

## 4. Wire the two together

1. Set backend `FRONTEND_URL` = the Vercel domain (redeploy backend).
2. In Google Cloud Console → OAuth credentials → add the authorized redirect URI:
   `https://<railway-domain>/api/auth/google/callback`

---

## 5. Smoke test

- `GET https://<railway-domain>/api/health` → `{ success: true }`
- Open the Vercel URL → register → add an expense → dashboard loads.

---

## Local / self-hosted (Docker)

```bash
docker compose up --build
# then, once, to create tables:
docker compose exec backend npx prisma migrate deploy
```
Frontend → http://localhost:8080 · Backend → http://localhost:5000

WhatsApp bot works here: set `WHATSAPP_ENABLED=true` in `backend/.env`,
restart, scan the terminal QR. Session persists in the `wa_auth` volume.
