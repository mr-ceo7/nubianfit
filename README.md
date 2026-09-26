# NubianFit

Online fitness-coaching platform: a marketing site, a coach dashboard (Coach OS) and a client PWA, served from one React build by hostname, with a FastAPI backend.

| Site | URL |
| --- | --- |
| Landing | https://nubianfit.xn--jhb4c.com |
| Coach OS | https://coach.nubianfit.xn--jhb4c.com |
| Client app | https://app.nubianfit.xn--jhb4c.com |

## Local development

```bash
npm install
./start.sh            # backend on :8010 (demo data), frontend on :3010
```

Open `http://localhost:3010/?portal=coach` and sign in as `coach@nubianfit.com` / `Coach@123`. For the client app, open `?portal=client` and enter a demo client's email. The login code is printed in the backend log, because no email key is set locally.

Tests: `npm test` and `cd backend && ./venv/bin/pytest`.

## Deploying

**Backend (Render).** Create a Blueprint from `render.yaml`. It provisions Postgres and the API and generates `SECRET_KEY` and `COACH_INVITE_CODE`. Set these in the dashboard:
- `RESEND_API_KEY` and `FROM_EMAIL` (a sender on a domain verified in Resend).
- `DEFAULT_COACH_NAME`, `DEFAULT_COACH_EMAIL` and a strong `DEFAULT_COACH_PASSWORD`.
- `BOOTSTRAP_INITIAL_ADMIN=true` for the first deploy only. It creates the head coach; set it back to `false` afterwards.

**Frontend (Vercel).** Import the repo and add all three domains to the project. `vercel.json` proxies `/api` to `https://nubianfit-backend.onrender.com`. If Render gives the service a different URL, update that rewrite.
