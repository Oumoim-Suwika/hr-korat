/**
 * Database bootstrap.
 *
 * DB_DRIVER=pglite  -> embedded Postgres (local dev, no server needed)
 * DB_DRIVER=pg      -> real Postgres / Amazon Aurora (production)
 *
 * Both use the SAME Postgres dialect so dev and prod behave identically.
 */
import 'dotenv/config';
import * as schema from './schema.js';

const driver = process.env.DB_DRIVER ?? 'pglite';

// drizzle db handle (typed against our schema)
let db: any;
// low-level exec(sql) used for idempotent DDL
let rawExec: (sql: string) => Promise<void>;

if (driver === 'pg') {
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { Pool } = await import('pg');
  // In production (Lambda/Fargate) the Aurora credentials come from Secrets
  // Manager: DB_SECRET_ARN points at the generated secret. We resolve it and
  // set the standard PG* env vars that node-postgres reads automatically.
  if (!process.env.DATABASE_URL && process.env.DB_SECRET_ARN && !process.env.PGHOST) {
    const s = await fetchDbSecret(process.env.DB_SECRET_ARN);
    process.env.PGHOST = s.host;
    process.env.PGPORT = String(s.port ?? 5432);
    process.env.PGUSER = s.username;
    process.env.PGPASSWORD = s.password;
    process.env.PGDATABASE = s.dbname ?? 'sati';
  }
  const url = process.env.DATABASE_URL;
  const pool = url ? new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } })
                   : new Pool({ ssl: { rejectUnauthorized: false } });
  db = drizzle(pool, { schema });
  rawExec = async (sql: string) => { await pool.query(sql); };
} else {
  const { drizzle } = await import('drizzle-orm/pglite');
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR ?? './.data/pglite';
  const client = new PGlite(dir);
  await client.waitReady;
  db = drizzle(client, { schema });
  rawExec = async (sql: string) => { await client.exec(sql); };
}

export { db, schema };

interface DbSecret { host: string; port?: number; username: string; password: string; dbname?: string; }
async function fetchDbSecret(arn: string): Promise<DbSecret> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  return JSON.parse(res.SecretString ?? '{}') as DbSecret;
}

/** Idempotent schema creation (dev-friendly; prod should use real migrations). */
export async function runMigrations(): Promise<void> {
  await rawExec(DDL);
}

const DDL = /* sql */ `
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('staff','supervisor','finance','admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('doctor','nurse','assistant','room','support');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE staff_line AS ENUM ('แพทย์','พยาบาล','สนับสนุน');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('รายเดือน','รายวัน','รายคาบ');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE roster_status AS ENUM ('draft','pending_approval','approved');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE request_type AS ENUM ('shift_change','leave','ot','shift_add');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE signer_role AS ENUM ('controller','approver','other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id serial PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wards (
  id serial PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  building text,
  phone text,
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX IF NOT EXISTS wards_code_idx ON wards (code);
ALTER TABLE wards ADD COLUMN IF NOT EXISTS conditions text;

CREATE TABLE IF NOT EXISTS staffing_requirements (
  id serial PRIMARY KEY,
  ward_id integer NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  level text NOT NULL,
  shift_code text NOT NULL,
  count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS holidays (
  id serial PRIMARY KEY,
  year integer NOT NULL,
  date text NOT NULL,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_settings (
  id serial PRIMARY KEY,
  role text NOT NULL,
  code text NOT NULL,
  amount double precision NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS rate_role_code_idx ON rate_settings (role, code);

CREATE TABLE IF NOT EXISTS ward_shift_times (
  id serial PRIMARY KEY,
  ward_id integer NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  code text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ward_shift_time_idx ON ward_shift_times (ward_id, code);

CREATE TABLE IF NOT EXISTS time_scans (
  id serial PRIMARY KEY,
  ward_id integer NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  employee_id integer NOT NULL REFERENCES employees(id),
  year integer NOT NULL,
  month integer NOT NULL,
  day integer NOT NULL,
  time_in text,
  time_out text,
  source text NOT NULL DEFAULT 'import'
);
CREATE UNIQUE INDEX IF NOT EXISTS scan_emp_ymd_idx ON time_scans (employee_id, year, month, day);

CREATE TABLE IF NOT EXISTS or_procedures (
  id serial PRIMARY KEY,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'case',
  role_rates jsonb NOT NULL,
  ot_threshold_hours double precision NOT NULL DEFAULT 0,
  ot_bonus_per_hour double precision NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS or_cases (
  id serial PRIMARY KEY,
  ward_id integer NOT NULL REFERENCES wards(id),
  year integer NOT NULL,
  month integer NOT NULL,
  day integer NOT NULL,
  procedure_id integer REFERENCES or_procedures(id),
  procedure_name text,
  hours double precision NOT NULL DEFAULT 0,
  participants jsonb NOT NULL,
  note text,
  created_by integer REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orcase_scope_idx ON or_cases (ward_id, year, month);

CREATE TABLE IF NOT EXISTS positions (
  id serial PRIMARY KEY,
  name text NOT NULL,
  line staff_line NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
  id serial PRIMARY KEY,
  employee_code text,
  prefix text,
  first_name text NOT NULL,
  last_name text,
  role staff_role NOT NULL,
  position_id integer REFERENCES positions(id),
  position_text text,
  employee_type text,
  payment_type payment_type NOT NULL DEFAULT 'รายเดือน',
  base_wage double precision,
  line staff_line,
  home_ward_id integer REFERENCES wards(id),
  bank_account text,
  start_date text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS employees_home_ward_idx ON employees (home_ward_id);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role user_role NOT NULL,
  employee_id integer REFERENCES employees(id),
  ward_id integer REFERENCES wards(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS shift_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  hours double precision NOT NULL DEFAULT 0,
  start_hour double precision,
  end_hour double precision,
  is_ot boolean NOT NULL DEFAULT false,
  is_work boolean NOT NULL DEFAULT true,
  category text,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS rate double precision NOT NULL DEFAULT 0;
ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS levels text;

CREATE TABLE IF NOT EXISTS working_calendars (
  id serial PRIMARY KEY,
  ward_id integer NOT NULL REFERENCES wards(id),
  year integer NOT NULL,
  month integer NOT NULL,
  working_days integer NOT NULL DEFAULT 0,
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS wc_ward_ym_idx ON working_calendars (ward_id, year, month);

CREATE TABLE IF NOT EXISTS rosters (
  id serial PRIMARY KEY,
  ward_id integer NOT NULL REFERENCES wards(id),
  year integer NOT NULL,
  month integer NOT NULL,
  status roster_status NOT NULL DEFAULT 'draft',
  note text,
  created_by integer REFERENCES users(id),
  approved_by integer REFERENCES users(id),
  approved_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS roster_ward_ym_idx ON rosters (ward_id, year, month);
ALTER TABLE rosters ADD COLUMN IF NOT EXISTS finance_locked boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS roster_cells (
  id serial PRIMARY KEY,
  roster_id integer NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  employee_id integer NOT NULL REFERENCES employees(id),
  day integer NOT NULL,
  normal_code text,
  ot_code text,
  pinned boolean NOT NULL DEFAULT false,
  external boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS cell_roster_emp_day_idx ON roster_cells (roster_id, employee_id, day);
ALTER TABLE roster_cells ADD COLUMN IF NOT EXISTS ot_code2 text;

CREATE TABLE IF NOT EXISTS roster_signers (
  id serial PRIMARY KEY,
  roster_id integer NOT NULL REFERENCES rosters(id) ON DELETE CASCADE,
  ordinal integer NOT NULL,
  name text NOT NULL,
  title text,
  signer_role signer_role NOT NULL DEFAULT 'other'
);

CREATE TABLE IF NOT EXISTS requests (
  id serial PRIMARY KEY,
  type request_type NOT NULL,
  employee_id integer NOT NULL REFERENCES employees(id),
  ward_id integer NOT NULL REFERENCES wards(id),
  year integer NOT NULL,
  month integer NOT NULL,
  day integer,
  to_day integer,
  from_code text,
  to_code text,
  reason text,
  status request_status NOT NULL DEFAULT 'pending',
  requested_by integer REFERENCES users(id),
  decided_by integer REFERENCES users(id),
  decided_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS req_scope_idx ON requests (ward_id, year, month);

CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  ts timestamp NOT NULL DEFAULT now(),
  actor_user_id integer REFERENCES users(id),
  entity text NOT NULL,
  entity_id text,
  action text NOT NULL,
  detail jsonb
);
`;
