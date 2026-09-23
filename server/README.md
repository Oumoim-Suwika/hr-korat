# Sati Backend API

Real multi-user backend for Sati Shift · OT · Payroll. Built to run identically
in local dev (embedded Postgres via PGlite) and production (Amazon Aurora
PostgreSQL), so there are no dialect surprises when we deploy.

## Stack
- **Hono** — portable HTTP framework (runs on Node / Bun / AWS Fargate / Lambda)
- **Drizzle ORM** — type-safe SQL, Postgres dialect
- **PGlite** (dev) / **node-postgres → Aurora** (prod), switched by `DB_DRIVER`
- **jose** (JWT) + **bcryptjs** — auth
- **zod** — request validation

## Run locally
```bash
cd server
cp .env.example .env
mkdir -p .data/pglite        # PGlite data dir (first run only)
bun install                  # or: npm install
bun run seed                 # creates schema + baseline data
bun run start                # http://localhost:4000
```

### Test logins (password `Sati@1234`)
| email | role |
|---|---|
| admin@sati.local | admin |
| finance@sati.local | finance |
| head.u01@sati.local | supervisor (ward U01) |
| staff.u01@sati.local | staff (ward U01) |

## API (v0)
- `POST /api/auth/login` → `{ token, user }`; `GET /api/me`
- `GET /api/wards`, `GET /api/employees?wardId=`, `GET /api/shift-types`
- `GET/POST /api/working-calendar` — set & **lock** working days (required before OT)
- `GET/POST /api/rosters` — save roster (normal + OT code per day) + up to 4 signers
- `POST /api/rosters/:id/submit` (supervisor), `POST /api/rosters/:id/approve` (finance)
- `GET/POST /api/requests` — shift change / leave / OT / shift add
  - OT enforces: calendar locked + no duplicate OT on same day
- `POST /api/requests/:id/decide` — approve / reject

## Business rules already enforced (from staff feedback)
- Working days of the month must be **locked** before any OT can be entered.
- **Duplicate OT** on the same day for the same person is blocked.
- Roster carries **signers** (หัวหน้าผู้ควบคุม / ผู้อนุมัติ) — max 4.
- Role separation: supervisor arranges & submits; finance approves.

## Production / AWS (next)
Set `DB_DRIVER=pg` and `DATABASE_URL` to the Aurora endpoint. JWT secret and DB
credentials come from AWS Secrets Manager. Infrastructure-as-Code (Aurora
Serverless v2 + Fargate + Cognito + S3/CloudFront) is a follow-up task.
