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
- `schema.prisma` declares both `url` (runtime, pooled) and `directUrl` (migrations).
- On Windows, run the `prisma` commands from a normal terminal/PowerShell — some
  sandboxes can't resolve `*.pooler.supabase.com`.
- For a **test database** (so integration tests don't touch real data), create a
  second Supabase project (or a separate schema/branch) and point the test env at it.
