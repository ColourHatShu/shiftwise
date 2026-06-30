# Supabase Setup (Database)

ShiftWise uses **Supabase Postgres** as its database via Prisma. (Auth stays on
Clerk + worker JWT/OTP; file storage stays on local/R2 — those are not on Supabase.)

## One-time setup

1. **Create a project** at https://supabase.com (free tier is fine; pick a nearby region).
2. In the dashboard, click **Connect → ORMs → Prisma**. Copy the two strings it shows:
   - `DATABASE_URL` — Transaction pooler (port **6543**), keep `?pgbouncer=true`.
   - `DIRECT_URL` — Direct connection (port **5432**).
3. Put both (with your real DB password) into `backend/.env` — **never commit `.env`**:
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```
4. Apply the schema and (optionally) seed:
   ```
   cd backend
   npx prisma migrate deploy   # runs existing migrations against Supabase (uses DIRECT_URL)
   npx prisma generate
   npm run db:seed             # optional starter data
   ```
5. Sanity check: start the API (`npm run dev`) and hit `GET /api/health` — it should
   report `database: connected`.

## Notes
- `schema.prisma` declares both `url` (runtime) and `directUrl` (migrations).
- On Windows, run the `prisma` commands from a normal terminal/PowerShell — some
  sandboxes can't resolve `*.supabase.co` / `*.pooler.supabase.com`.
- For a **test database** (so integration tests don't touch real data), create a
  second Supabase project (or a separate schema/branch) and point the test env at it.

## Gotchas hit during first setup (2026-06-30) — read if re-doing this
1. **URL-encode special characters in the DB password.** The password is part of
   the connection URI, so `%` → `%25`, `@` → `%40`, etc. An un-encoded `@` or `%`
   makes Prisma fail to parse `DATABASE_URL`.
2. **Empty `public` schema required for `migrate deploy`.** A brand-new project had
   a stray empty `test` table (Supabase quickstart sample) → Prisma error **P3005**
   ("schema is not empty"). Dropped the empty table to proceed.
3. **A broken/empty migration dir** (`20260518025559_add_shift_management_tables`,
   no `migration.sql`) caused **P3015**. It was a duplicate stub of the real
   `20260518093000_add_shift_management_tables`; removed it.
4. **⚠️ Migrations lag `schema.prisma` (known drift).** After applying all
   migrations, the DB was missing `compliance_snapshots` + `failed_alerts` (and
   columns like `workers.isActive`, `agencies.complianceThresholds`,
   `compliance_documents.analysisResult`, plus several indexes). The project was
   evidently developed with `prisma db push` on dev while migrations lagged. **The
   app's source of truth is `schema.prisma`**, so setup finished with:
   ```
   npx prisma db push --accept-data-loss   # safe on an empty DB
   ```
   which brought the DB to exactly match `schema.prisma` (14 tables incl.
   `_prisma_migrations`). **Follow-up (not done):** squash/regenerate the migrations
   so `migrate deploy` alone reproduces `schema.prisma` for future environments.
