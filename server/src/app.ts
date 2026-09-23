/** Sati backend API (Hono). */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';

import { db, schema } from './db/index.js';
import {
  requireAuth, requireRole, signToken, verifyPassword, type AuthUser,
} from './auth.js';

export const app = new Hono();

app.use('*', cors({
  origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

const getUser = (c: any) => c.get('user') as AuthUser;

async function audit(actorUserId: number | null, entity: string, entityId: string | null, action: string, detail?: unknown) {
  try {
    await db.insert(schema.auditLogs).values({ actorUserId, entity, entityId, action, detail: detail ?? null });
  } catch { /* non-fatal */ }
}

// ---- health -----------------------------------------------------------------
app.get('/api/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ---- auth -------------------------------------------------------------------
app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);

  const rows = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email.toLowerCase()));
  const user = rows[0];
  if (!user || !user.active) return c.json({ error: 'invalid_credentials' }, 401);
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  const authUser: AuthUser = {
    id: user.id, email: user.email, displayName: user.displayName,
    role: user.role, wardId: user.wardId, employeeId: user.employeeId,
  };
  const token = await signToken(authUser);
  await audit(user.id, 'user', String(user.id), 'login');
  return c.json({ token, user: authUser });
});

app.get('/api/me', requireAuth, (c) => c.json({ user: getUser(c) }));

// ---- reference data ---------------------------------------------------------
app.get('/api/wards', requireAuth, async (c) => {
  const rows = await db.select().from(schema.wards).where(eq(schema.wards.active, true));
  return c.json({ wards: rows });
});

app.get('/api/shift-types', requireAuth, async (c) => {
  const rows = await db.select().from(schema.shiftTypes).orderBy(schema.shiftTypes.sortOrder);
  return c.json({ shiftTypes: rows });
});

app.get('/api/employees', requireAuth, async (c) => {
  const wardId = c.req.query('wardId');
  const q = db.select().from(schema.employees).where(eq(schema.employees.active, true)).orderBy(schema.employees.sortOrder);
  const rows = wardId
    ? await db.select().from(schema.employees).where(and(eq(schema.employees.active, true), eq(schema.employees.homeWardId, Number(wardId)))).orderBy(schema.employees.sortOrder)
    : await q;
  return c.json({ employees: rows });
});

// ---- working calendar (must be locked before OT) ----------------------------
const ymSchema = z.object({ wardId: z.number(), year: z.number(), month: z.number().min(1).max(12) });

app.get('/api/working-calendar', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId'));
  const year = Number(c.req.query('year'));
  const month = Number(c.req.query('month'));
  const rows = await db.select().from(schema.workingCalendars)
    .where(and(eq(schema.workingCalendars.wardId, wardId), eq(schema.workingCalendars.year, year), eq(schema.workingCalendars.month, month)));
  return c.json({ calendar: rows[0] ?? null });
});

// set working days / lock — supervisor or finance
app.post('/api/working-calendar', requireAuth, requireRole('supervisor', 'finance'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = ymSchema.extend({ workingDays: z.number().int().min(0), locked: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  const { wardId, year, month, workingDays, locked } = parsed.data;
  const set: any = { workingDays, locked: locked ?? false };
  if (locked) set.lockedAt = new Date();
  const inserted = await db.insert(schema.workingCalendars)
    .values({ wardId, year, month, workingDays, locked: locked ?? false, lockedAt: locked ? new Date() : null })
    .onConflictDoUpdate({ target: [schema.workingCalendars.wardId, schema.workingCalendars.year, schema.workingCalendars.month], set })
    .returning();
  await audit(getUser(c).id, 'working_calendar', `${wardId}-${year}-${month}`, locked ? 'lock' : 'set', { workingDays });
  return c.json({ calendar: inserted[0] });
});

async function isCalendarLocked(wardId: number, year: number, month: number): Promise<boolean> {
  const rows = await db.select().from(schema.workingCalendars)
    .where(and(eq(schema.workingCalendars.wardId, wardId), eq(schema.workingCalendars.year, year), eq(schema.workingCalendars.month, month)));
  return !!rows[0]?.locked;
}

// ---- rosters ----------------------------------------------------------------
app.get('/api/rosters', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId'));
  const year = Number(c.req.query('year'));
  const month = Number(c.req.query('month'));
  const rosterRows = await db.select().from(schema.rosters)
    .where(and(eq(schema.rosters.wardId, wardId), eq(schema.rosters.year, year), eq(schema.rosters.month, month)));
  const roster = rosterRows[0];
  if (!roster) return c.json({ roster: null, cells: [], signers: [] });
  const cells = await db.select().from(schema.rosterCells).where(eq(schema.rosterCells.rosterId, roster.id));
  const signers = await db.select().from(schema.rosterSigners).where(eq(schema.rosterSigners.rosterId, roster.id)).orderBy(schema.rosterSigners.ordinal);
  return c.json({ roster, cells, signers });
});

const cellSchema = z.object({
  employeeId: z.number(), day: z.number().min(1).max(31),
  normalCode: z.string().nullable().optional(),
  otCode: z.string().nullable().optional(),
  pinned: z.boolean().optional(), external: z.boolean().optional(),
});
const saveRosterSchema = ymSchema.extend({
  note: z.string().nullable().optional(),
  signers: z.array(z.object({ ordinal: z.number(), name: z.string(), title: z.string().nullable().optional(), signerRole: z.enum(['controller', 'approver', 'other']).optional() })).max(4).optional(),
  cells: z.array(cellSchema),
});

// save/replace a roster (draft) — supervisor
app.post('/api/rosters', requireAuth, requireRole('supervisor'), async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = saveRosterSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  const { wardId, year, month, note, signers, cells } = parsed.data;

  // Guard: OT only allowed once the working calendar for the month is locked.
  const hasOt = cells.some((x) => x.otCode);
  if (hasOt && !(await isCalendarLocked(wardId, year, month))) {
    return c.json({ error: 'calendar_not_locked', message: 'ต้องกำหนดและล็อกวันทำการของเดือนก่อน จึงจะใส่ OT ได้' }, 409);
  }

  // upsert roster header
  const rosterRows = await db.insert(schema.rosters)
    .values({ wardId, year, month, note: note ?? null, createdBy: getUser(c).id, status: 'draft', updatedAt: new Date() })
    .onConflictDoUpdate({ target: [schema.rosters.wardId, schema.rosters.year, schema.rosters.month], set: { note: note ?? null, updatedAt: new Date() } })
    .returning();
  const roster = rosterRows[0];

  // replace cells
  await db.delete(schema.rosterCells).where(eq(schema.rosterCells.rosterId, roster.id));
  if (cells.length) {
    await db.insert(schema.rosterCells).values(cells.map((x) => ({
      rosterId: roster.id, employeeId: x.employeeId, day: x.day,
      normalCode: x.normalCode ?? null, otCode: x.otCode ?? null,
      pinned: x.pinned ?? false, external: x.external ?? false,
    })));
  }
  // replace signers
  await db.delete(schema.rosterSigners).where(eq(schema.rosterSigners.rosterId, roster.id));
  if (signers?.length) {
    await db.insert(schema.rosterSigners).values(signers.map((s) => ({
      rosterId: roster.id, ordinal: s.ordinal, name: s.name, title: s.title ?? null, signerRole: s.signerRole ?? 'other',
    })));
  }
  await audit(getUser(c).id, 'roster', String(roster.id), 'save', { cells: cells.length });
  return c.json({ roster, savedCells: cells.length });
});

// submit for approval — supervisor
app.post('/api/rosters/:id/submit', requireAuth, requireRole('supervisor'), async (c) => {
  const id = Number(c.req.param('id'));
  const rows = await db.update(schema.rosters).set({ status: 'pending_approval', updatedAt: new Date() }).where(eq(schema.rosters.id, id)).returning();
  if (!rows[0]) return c.json({ error: 'not_found' }, 404);
  await audit(getUser(c).id, 'roster', String(id), 'submit');
  return c.json({ roster: rows[0] });
});

// approve — finance (or admin)
app.post('/api/rosters/:id/approve', requireAuth, requireRole('finance'), async (c) => {
  const id = Number(c.req.param('id'));
  const rows = await db.update(schema.rosters).set({ status: 'approved', approvedBy: getUser(c).id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(schema.rosters.id, id)).returning();
  if (!rows[0]) return c.json({ error: 'not_found' }, 404);
  await audit(getUser(c).id, 'roster', String(id), 'approve');
  return c.json({ roster: rows[0] });
});

// ---- requests (shift change / leave / OT / shift add) -----------------------
app.get('/api/requests', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId'));
  const year = Number(c.req.query('year'));
  const month = Number(c.req.query('month'));
  const rows = await db.select().from(schema.requests)
    .where(and(eq(schema.requests.wardId, wardId), eq(schema.requests.year, year), eq(schema.requests.month, month)))
    .orderBy(desc(schema.requests.createdAt));
  return c.json({ requests: rows });
});

const requestSchema = z.object({
  type: z.enum(['shift_change', 'leave', 'ot', 'shift_add']),
  employeeId: z.number(), wardId: z.number(), year: z.number(), month: z.number().min(1).max(12),
  day: z.number().min(1).max(31).nullable().optional(),
  toDay: z.number().min(1).max(31).nullable().optional(),
  fromCode: z.string().nullable().optional(), toCode: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
});

app.post('/api/requests', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 400);
  const r = parsed.data;

  if (r.type === 'ot') {
    // OT requires a locked working calendar.
    if (!(await isCalendarLocked(r.wardId, r.year, r.month))) {
      return c.json({ error: 'calendar_not_locked', message: 'ต้องล็อกวันทำการก่อน จึงจะขอ OT ได้' }, 409);
    }
    // Duplicate-OT guard: no existing pending/approved OT for same employee+day.
    if (r.day != null) {
      const dupes = await db.select().from(schema.requests).where(and(
        eq(schema.requests.type, 'ot'),
        eq(schema.requests.employeeId, r.employeeId),
        eq(schema.requests.year, r.year),
        eq(schema.requests.month, r.month),
        eq(schema.requests.day, r.day),
      ));
      const clash = dupes.find((d: any) => d.status === 'pending' || d.status === 'approved');
      if (clash) return c.json({ error: 'duplicate_ot', message: 'มีการขอ OT ในวัน/เวรเดียวกันอยู่แล้ว' }, 409);
    }
  }

  const rows = await db.insert(schema.requests).values({
    type: r.type, employeeId: r.employeeId, wardId: r.wardId, year: r.year, month: r.month,
    day: r.day ?? null, toDay: r.toDay ?? null, fromCode: r.fromCode ?? null, toCode: r.toCode ?? null,
    reason: r.reason ?? null, requestedBy: getUser(c).id, status: 'pending',
  }).returning();
  await audit(getUser(c).id, 'request', String(rows[0].id), 'create', { type: r.type });
  return c.json({ request: rows[0] });
});

// approve / reject a request — supervisor (controller) or finance
app.post('/api/requests/:id/decide', requireAuth, requireRole('supervisor', 'finance'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ decision: z.enum(['approved', 'rejected']) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
  const rows = await db.update(schema.requests)
    .set({ status: parsed.data.decision, decidedBy: getUser(c).id, decidedAt: new Date() })
    .where(eq(schema.requests.id, id)).returning();
  if (!rows[0]) return c.json({ error: 'not_found' }, 404);
  await audit(getUser(c).id, 'request', String(id), parsed.data.decision);
  return c.json({ request: rows[0] });
});

export default app;
