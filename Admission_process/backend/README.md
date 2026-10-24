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
