# JCER College ERP — Backend API

Backend service for the JCER College ERP System built with Node.js, Express, TypeScript, and Sequelize (PostgreSQL).

---

## Railway Deployment Guide

This backend is pre-configured for one-click deployment on [Railway](https://railway.com).

### 1. Railway Service Setup
When adding this repository as a GitHub Service in your Railway project:
1. In the service settings, set the **Root Directory** to:
   ```text
   Admission_process/backend
   ```
2. Railway detects [`railway.json`](./railway.json) automatically:
   - **Builder:** `NIXPACKS` (or Dockerfile)
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Healthcheck Path:** `/health`

---

### 2. Required Railway Environment Variables

In your Railway service **Variables** tab, configure the following:

| Variable | Example / Description | Required |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | **Yes** |
| `PORT` | Auto-provided by Railway (do not override) | Auto |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Reference Railway PostgreSQL) | **Yes** |
| `JWT_SECRET` | Super secure random string (minimum 32 characters) | **Yes** |
| `JWT_REFRESH_SECRET` | Super secure random string (minimum 32 characters) | **Yes** |
| `REFRESH_TOKEN_SECRET` | Super secure random string (minimum 32 characters) | **Yes** |
| `CORS_ORIGIN` | `https://your-frontend.pages.dev,https://your-frontend.railway.app` | **Yes** |
| `FRONTEND_URL` | `https://your-frontend.pages.dev` | Recommended |
| `API_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}/api` | Recommended |

#### Optional / Cloud Services:
| Variable | Description |
| :--- | :--- |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (if using Railway Redis; in-memory fallback is active if omitted) |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint (for student document persistence) |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Key |
| `R2_BUCKET_NAME` | Cloudflare R2 Bucket Name (e.g. `jcer-erp-bucket`) |
| `EMAIL_USER` / `EMAIL_PASS` | SMTP credentials for email alerts / OTP |
| `BREVO_API_KEY` | Brevo email API key |

---

### 3. Database Initialization & Auto-Seeding
- The backend automatically verifies and synchronizes required schemas idempotently on startup.
- If the database is freshly initialized (0 Admin accounts detected), the server automatically runs initial seeding to configure system roles, master departments, and default rejection reasons.

---

### 4. Health Check Endpoints
- **Liveness/Readiness:** `/health` (verifies HTTP server & PostgreSQL connectivity, returns HTTP 200).
- **Alternative:** `/api/health`
- **Lightweight Ping:** `/api`

---

## Render Deployment Guide

This backend can be deployed on [Render](https://render.com) either automatically via Blueprint or manually via the Dashboard.

### Option A: One-Click Blueprint Deployment (Recommended)
1. In your Render Dashboard, click **New +** > **Blueprint**.
2. Connect `https://github.com/Arihantdesai165/Jcer-erp-testing`.
3. Render automatically reads [`render.yaml`](../../render.yaml) to provision:
   - A managed PostgreSQL database (`jcer-erp-postgres`).
   - The Web Service configured with `Admission_process/backend`.
   - All connection strings, JWT secrets, and `/health` monitoring.
4. Click **Apply**.

### Option B: Manual Web Service Setup
1. **Create PostgreSQL Database:**
   - Click **New +** > **PostgreSQL**.
   - Name: `jcer-erp-postgres`, Database: `college_erp_db`, User: `erp_user`.
   - Copy the **Internal Database URL** (e.g. `postgresql://erp_user:...@dpg-...:5432/college_erp_db`).
2. **Create Web Service:**
   - Click **New +** > **Web Service** > Connect GitHub repo.
   - **Root Directory:** `Admission_process/backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
3. **Environment Variables:**
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Paste the Internal Database URL from step 1)*
   - `JWT_SECRET`: *(32+ character random secret)*
   - `JWT_REFRESH_SECRET`: *(32+ character random secret)*
   - `REFRESH_TOKEN_SECRET`: *(32+ character random secret)*
   - `CORS_ORIGIN`: `https://jcererp-system.pages.dev,https://your-frontend.onrender.com`

