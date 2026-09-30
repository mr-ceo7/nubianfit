# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

NubianFit is an online fitness-coaching platform (target: Everfit-level features for coaches and clients). One React 19 + Vite + Tailwind v4 build (a PWA) serves three sites by hostname, backed by a FastAPI + async SQLAlchemy API in `backend/`.

## Commands

Frontend (repo root):
- `npm run dev` — Vite on port 3000; proxies `/api` to `API_PROXY_TARGET` (default `http://127.0.0.1:8000`)
- `npm run build` / `npm run preview`
- `npm run lint` — type-check only (`tsc --noEmit`); there is no ESLint
- `npm test` — Vitest (jsdom, setup in `src/test/setup.ts`)
- Single test: `npx vitest run src/test/auth.test.tsx` (add `-t "name"` to filter)

Backend (run from `backend/`, venv at `backend/venv`):
- `ENABLE_DEV_SEED=true ./venv/bin/uvicorn app.main:app --reload --port 8000` (docs at `/docs`; demo coach `coach@nubianfit.com` / `Coach@123`)
- `./venv/bin/pytest` — suite in `backend/tests/`; `conftest.py` points at a throwaway SQLite DB and reseeds before every test
- Single test: `./venv/bin/pytest tests/test_access.py -k name`
- `./venv/bin/python seed_data.py --force` — drop all tables and reseed demo data
- Migrations: `./venv/bin/alembic revision --autogenerate -m "..."`, then `./venv/bin/alembic upgrade head`

`./start.sh` runs both servers (frontend :3010, backend :8010; override with `FRONTEND_PORT`/`BACKEND_PORT`), establishes an automatic Cloudflare Quick Tunnel with public preview links, kills whatever holds those ports/tunnel, creates the venv, and reseeds `backend/nubianfit.db` when the schema is out of date.

## Architecture

### Three portals, one build
`src/config/portal.ts` chooses the portal from the hostname:
- `nubianfit.xn--jhb4c.com` → landing
- `coach.` → Coach OS
- `app.` → client PWA

On localhost or preview hosts, use `?portal=landing|coach|client`; a small switcher appears on those hosts. `src/App.tsx` lazy-loads one of these:
- `components/landing/LandingPage.tsx` — marketing. Dashed amber `<Placeholder>` blocks mark copy still to be supplied.
- `components/layout/CoachLayout.tsx` — coach app, gated by `CoachLogin` (email + password; sign-up needs an invite code). There is no router: views switch on `activeTab`.
- `components/clientApp/ClientApp.tsx` — client app, gated by `ClientLogin` (6-digit code emailed via `/auth/otp/*`).

A user who signs in to the wrong portal for their role sees a `WrongPortal` screen.

### Frontend state
- `context/AuthContext.tsx` owns the session: it restores it from the stored JWT via `/auth/me`, and signs out when `apiClient` fires `SESSION_EXPIRED_EVENT` on a 401.
- `context/AppContext.tsx` owns all domain data and mutations, read through `useApp()`. The server is the source of truth: data loads after sign-in and is cleared on sign-out. Mutations call the API first, then store the server's response, and toast any error. They return a success flag (`saveProgram` returns the saved program). The same context serves both roles, because the API already scopes every list to the caller.
- Client-side ids like `draft-…` exist only until the first save. The server assigns every real id.

### API contract
Backend schemas extend `CamelModel` (`backend/app/schemas/common.py`): Python stays snake_case and JSON is camelCase, matching `src/types.ts`. Timestamps use `UtcDatetime`, which serializes as timezone-aware UTC; format them with `src/utils/dates.ts`. For calendar dates use `localDateStr()`, never `toISOString()` (that gives the UTC date). A new field needs changes to the model, the schema, `types.ts`, an Alembic migration, and possibly `seed_data.json`.

### Backend access control
The core is `app/dependencies.py`:
- Coaches own clients (`Client.coach_id`), programs, custom exercises and activity items.
- A client user (`User.role == "client"`, `User.client_id`) sees only their own record.
- Every per-client query goes through `get_accessible_client` / `resolve_client_filter`. A client that isn't yours returns 404, never 403.
- Exercises with `coach_id NULL` form the shared, read-only global library.
- Clients may log their own workouts only through `CLIENT_EDITABLE_FIELDS` (`routers/workouts.py`). They never see coach notes.

### Backend startup and config
`app/config.py` validates production at import time. With `ENVIRONMENT=production` it refuses to start if any of these are missing or default: `SECRET_KEY`, `COACH_INVITE_CODE`, `RESEND_API_KEY`, a Postgres `DATABASE_URL`.

Startup (`app/main.py`) depends on the environment:
- Production: Alembic manages the schema (`migrations/`). Startup only seeds the global exercise library, and creates the head coach once when `BOOTSTRAP_INITIAL_ADMIN=true`.
- Dev and tests: startup runs `create_all`, plus the demo seed when `ENABLE_DEV_SEED` or `TESTING` is set.

Email (`app/services/email.py`) goes through Resend. Without a key, messages are logged and collected in `email.outbox`, which the tests read to get login codes. Auth endpoints are rate-limited in memory (`app/rate_limiter.py`, single instance).

### Training content (workouts, programs, library)
All workout JSON has the same shape: `WorkoutContent` in `src/types.ts`, validated server-side by `backend/app/schemas/training.py`. Three places store it:
- library workouts (`WorkoutTemplate`)
- program days (`TrainingProgram.days`)
- client calendar entries (`ScheduledWorkout`)

The shape:
- `exercises` is one ordered list. Each item has a `section` (`warmup`, `main` or `cooldown`) and a `trackingType`: `reps_weight`, `reps`, `time`, `distance` or `time_distance`.
- Items sharing a `groupId` form one block (`superset`, `circuit`, `amrap` or `emom`). The block itself is defined in `groups`.

Edits go through the pure functions in `src/utils/workoutEdit.ts`. They keep a group's exercises contiguous and in one section, dissolve groups left with fewer than two exercises, and keep a superset or circuit's rounds equal to its exercises' set counts. For display, `buildSections()` in `src/utils/workout.ts` arranges the flat list into sections and blocks.

When content moves between the library, programs and calendars, it is copied with `cloneContent()`, which assigns fresh ids and clears logged results. Nothing is shared by reference.

Programs are weekly calendars. `WorkoutDay.dayNumber` counts from the start of the program (1 = week 1 Monday, 8 = week 2 Monday), and empty days are rest days. `POST /programs/{id}/assign` takes `startDate` and places day N on `startDate + N - 1`. `DELETE /programs/{id}/assign/{clientId}` removes only future workouts that haven't been completed.

Exercise videos are YouTube or Vimeo links, validated on both sides and embedded with `VideoEmbed`. The CSP `frame-src` in `vercel.json` allows exactly those two players.

### Nutrition and habits
This state lives in `context/NutritionContext.tsx` (`useNutrition()`), separate from `AppContext`. It loads lazily: the first component that calls `useNutrition()` triggers the load, so screens without nutrition data, such as the coach dashboard, never fetch it. It loads about the last 35 days of history; `loadRange()` fetches older dates when the diary navigates back.

**Foods.** `GET /foods/search` returns the coach's `CustomFood`s first, then USDA FoodData Central results. The USDA client (`backend/app/services/usda.py`):
- caches responses in memory
- normalises every food to `per100g` plus `servings`
- degrades to a `usdaError` message on rate limits

`FDC_API_KEY` defaults to `DEMO_KEY`, which allows about 30 requests an hour.

**Diary entries and meal-plan items** store a nutrition snapshot: totals for `quantity` × serving, computed on the frontend by `portionOf()` in `src/utils/nutrition.ts`. Editing a food never rewrites history.

**Goals.** `ClientGoals` holds training-day targets plus optional `restDay*` overrides. A day counts as a training day if it has any scheduled workout (`targetsFor()`).

**Meal plans** are N days × meals × food items. `MealPlanAssignment` places day 1 on its start date, and the plan repeats (`mealPlanDayFor()`).

**Habits** are per-client `Habit` rows. `daysOfWeek` holds ISO weekdays, and an empty list means every day. Check-ins are one row per habit per day, upserted with `PUT /habits/checkins`. Streaks and completion rates are computed on the frontend.

**Water and steps** are entered manually into `DailyMetric`; the PWA can't read Apple Health or Google Fit.

Watch out: the camelCase alias generator turns `per100g` into `per100G`, so fields with digits need an explicit `Field(alias=...)`.

### Engagement: notifications, live events, community, check-ins, Autoflow
**Live events.** `backend/app/services/events.py` is an in-memory pub/sub, so it only works with a single server process. Clients open the stream in two steps:
1. `POST /api/events/ticket` returns a one-time ticket.
2. `GET /api/events/stream?ticket=` opens the SSE stream. `EventSource` can't send an auth header, which is why the ticket exists.

On the frontend, `src/services/realtime.ts` fetches a fresh ticket on every reconnect. `context/EngagementContext.tsx` handles the `notification`, `message`, `group_message` and `community` events, and catches up when a reconnect succeeds.

**Notifications.** `services/notify.notify()` stores a `Notification`, commits, publishes it to the live stream, and sends a web push (pywebpush; push is off unless the VAPID keys are set). Email digests go to users with unread, un-emailed notifications older than `DIGEST_DELAY_MINUTES`, except users who are currently connected or have opted out.

**Scheduled jobs.** `services/scheduler.run_tick()` runs Autoflow steps, "check-in due" notifications and email digests. It runs from a loop in the app lifespan (disabled when `TESTING`), and from `POST /api/internal/tick` with the header `X-Cron-Token: $CRON_TOKEN`, for hosts that sleep. It's idempotent.

**Check-ins.**
- A `CheckinAssignment` is a form scheduled for a client: `once` on its start date, or `weekly` on the start date's weekday.
- Due dates are computed, not stored (`services/checkins.py`). A `CheckinResponse` snapshots the questions it answered.
- A `weight` answer also writes a `MetricEntry`. A `photo` answer also writes a `ProgressPhoto` whose `photo_url` is `file:<StoredFile id>`.

**Uploaded photos.** Photos live in Postgres (`StoredFile`) and are compressed in the browser first (`utils/image.ts`). They're served only via HMAC-signed URLs (`sign_file`, valid 24 h), because `<img>` tags can't send the bearer token. Never hand out a `file:` reference without checking that the file's `client_id` matches.

**Autoflow.** An Autoflow's steps are `{day, type: message|checkin|habit}`, where day 1 is the assignment's start date. Completed step ids are stored on the assignment, and assigning runs any step already due.

**Deep links.** Notification links look like `{tab, clientId?, groupId?}`. Push taps open `/?open=<tab>&…`, which `utils/deepLink.ts` reads and then clears.

### Business: marketplace billing and admin
Coaches are independent sellers. Each coach links a payout account, which creates a Paystack subaccount (`PayoutAccount`). Payments split at checkout: `subaccount=<coach>` and `bearer=subaccount`, so the coach pays Paystack's fee. `PLATFORM_FEE_PERCENT` is NubianFit's cut, currently 0. The Paystack client is `services/paystack.py`, and money is stored in minor units (KES cents).

**Payment flow** (`services/billing.py`):
1. The coach sends a `PaymentRequest`, which is emailed to the client as `CLIENT_URL/?pay=<token>`.
2. The public pay page (`PayPage`, no login) calls `/pay/{token}/checkout`, which creates a pending `Payment` and redirects to Paystack.
3. Paystack confirms the payment in two ways: the `charge.success` webhook (the signature is HMAC-SHA512 of the raw body, and the transaction is re-verified), and `/pay/{token}/verify` when the client returns.
4. Both call `fulfil()`, which is idempotent through `Payment.fulfilled`. It rejects amount or currency mismatches, then creates or extends the `Subscription`.

On first purchase, `fulfil()` also applies the package's program, Autoflow and onboarding form.

**Renewals** (`run_renewals`, from the scheduler):
- If a reusable card authorization is saved, it's charged with `charge_authorization` (same split).
- Otherwise (M-Pesa etc.) the client gets a renewal `PaymentRequest` `RENEWAL_NOTICE_DAYS` before the end.
- Unpaid subscriptions become `past_due`.
- One-time packages become `completed`, and ones set to cancel at period end become `cancelled`.

**Admin.** Admin rights come only from the `users.is_admin` column. It's set for the bootstrapped head coach and the dev demo coach; `scripts/make_admin.py` grants it to others. It's never derived from an email address, because coach sign-up doesn't verify email ownership. The `/admin/*` endpoints list coaches and can suspend one, which sets `is_active`. That blocks the coach's login and their pay links.

### Theming
Chart marks use `--chart-1`, validated with the dataviz palette checks against both card surfaces. Tailwind colors are remapped to CSS variables in `src/index.css`. `slate-*` and `emerald-*` follow light and dark mode, and `text-white` becomes dark green in light mode. For text on an accent background, use `bg-emerald-500 text-slate-950`.

## Deployment

- Frontend: Vercel. `vercel.json` rewrites `/api/*` to `https://nubianfit-backend.onrender.com` (same-origin, so no CORS) and sets a strict CSP; add any new external host to the CSP. All three subdomains point at the same Vercel project.
- Backend: Render blueprint `render.yaml` (Postgres plus web service). The start command runs `alembic upgrade head` before uvicorn.
- PWA: `public/sw.js` never caches `/api/`. It registers in production builds only, so web push works only in production builds. The worker also handles `push` and `notificationclick`.
- Live events pass through the Vercel `/api` rewrite. The server sends a keep-alive every 20 s, and the client reconnects if the proxy cuts the stream.

<!-- imported-from: gemini:project:instructions -->
# Workspace Design Guidelines

## Responsive Mobile Grid & Scaling Rules
- **Multi-Column Layouts on Mobile:** When building or modifying responsive grids for mobile, do not automatically default to stacking all components (such as stats cards, metrics, or list elements) vertically in a single full-width column.
- **Proportional Scaling:** Scale down component dimensions (such as paddings, font sizes, margins, and icon sizes) to comfortably accommodate a 2-column or multi-column layout on small screens (e.g., using `grid-cols-2`).
- **Layout Integrity:** Ensure that scaled-down elements are optimized to prevent text wrapping, vertical overflow, or visual crowding, keeping the design clean, dense, and native-feeling.

## Automated Testing & Code Verification
- **Test-Driven Changes:** Whenever significant new features, layout patterns, or backend capabilities are added or modified, write or update the corresponding unit or integration tests to prevent regressions.
- **Verification Rule:** Always run both the frontend test runner (`npm run test`) and backend test suite (`pytest`) after modifications to ensure all assertions pass successfully before finishing edits.
