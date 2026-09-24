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

  // On approval, reflect the change into the ward roster so ตารางเวร stays in
  // sync automatically (ลา/ไปราชการ, เปลี่ยนเวร, ยกเวร, ขึ้นเวรเพิ่ม).
  const r = rows[0];
  let applied = false;
  if (parsed.data.decision === 'approved') {
    const ros = await db.select().from(schema.rosters)
      .where(and(eq(schema.rosters.wardId, r.wardId), eq(schema.rosters.year, r.year), eq(schema.rosters.month, r.month))).limit(1);
    const rid = ros[0]?.id;
    if (rid && r.day) {
      const OT_CODES = ['ชot', 'บot', 'ดot', 'BD', 'OR'];
      const applyCell = async (day: number, set: { normalCode?: string; otCode?: string }) => {
        await db.insert(schema.rosterCells)
          .values({ rosterId: rid, employeeId: r.employeeId, day, normalCode: set.normalCode ?? null, otCode: set.otCode ?? null })
          .onConflictDoUpdate({ target: [schema.rosterCells.rosterId, schema.rosterCells.employeeId, schema.rosterCells.day], set });
      };
      if (r.type === 'leave') {
        const training = /อบรม|ราชการ|ประชุม|สัมมนา/.test(r.reason ?? '');
        const from = r.day, to = r.toDay ?? r.day;
        for (let d = from; d <= to; d++) await applyCell(d, { normalCode: training ? 'T' : 'V' });
        applied = true;
      } else if (r.type === 'shift_change' && r.toCode) {
        await applyCell(r.day, { normalCode: r.toCode });   // toCode='ออฟ' = ยกเวร
        applied = true;
      } else if (r.type === 'shift_add' && r.toCode) {
        await applyCell(r.day, OT_CODES.includes(r.toCode) ? { otCode: r.toCode } : { normalCode: r.toCode });
        applied = true;
      }
    }
  }
  await audit(getUser(c).id, 'request', String(id), parsed.data.decision, { type: r.type, appliedToRoster: applied });
  return c.json({ request: rows[0], appliedToRoster: applied });
});

// ---- roster list (form history) --------------------------------------------
app.get('/api/rosters/list', requireAuth, async (c) => {
  const wardId = c.req.query('wardId');
  const base = db.select().from(schema.rosters).orderBy(desc(schema.rosters.year), desc(schema.rosters.month));
  const rows = wardId
    ? await db.select().from(schema.rosters).where(eq(schema.rosters.wardId, Number(wardId))).orderBy(desc(schema.rosters.year), desc(schema.rosters.month))
    : await base;
  return c.json({ rosters: rows });
});

// finance closes/reopens the month (timeline: units edit until day 5, then finance locks)
app.post('/api/rosters/:id/finance-lock', requireAuth, requireRole('finance', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const locked = body?.locked !== false;
  const rows = await db.update(schema.rosters).set({ financeLocked: locked, updatedAt: new Date() }).where(eq(schema.rosters.id, id)).returning();
  if (!rows[0]) return c.json({ error: 'not_found' }, 404);
  await audit(getUser(c).id, 'roster', String(id), locked ? 'finance_lock' : 'finance_unlock');
  return c.json({ roster: rows[0] });
});

// ---- audit logs -------------------------------------------------------------
app.get('/api/audit-logs', requireAuth, requireRole('finance', 'admin'), async (c) => {
  const rows = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.ts)).limit(200);
  return c.json({ logs: rows });
});

// ---- users (admin) ----------------------------------------------------------
app.get('/api/users', requireAuth, requireRole('admin'), async (c) => {
  const rows = await db.select({
    id: schema.users.id, email: schema.users.email, displayName: schema.users.displayName,
    role: schema.users.role, wardId: schema.users.wardId, active: schema.users.active,
  }).from(schema.users).orderBy(schema.users.id);
  return c.json({ users: rows });
});
app.post('/api/users', requireAuth, requireRole('admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ email: z.string().email(), displayName: z.string().min(1), password: z.string().min(6), role: z.enum(['staff', 'supervisor', 'finance', 'admin']), wardId: z.number().nullable().optional() }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input', issues: p.error.issues }, 400);
  const { hashPassword } = await import('./auth.js');
  const rows = await db.insert(schema.users).values({
    email: p.data.email.toLowerCase(), displayName: p.data.displayName, role: p.data.role,
    wardId: p.data.wardId ?? null, passwordHash: await hashPassword(p.data.password),
  }).onConflictDoNothing({ target: schema.users.email }).returning({ id: schema.users.id, email: schema.users.email });
  await audit(getUser(c).id, 'user', String(rows[0]?.id), 'create');
  return c.json({ user: rows[0] ?? null });
});

// ---- wards CRUD (admin) -----------------------------------------------------
app.post('/api/wards', requireAuth, requireRole('admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ code: z.string().min(1), name: z.string().min(1), building: z.string().nullable().optional(), phone: z.string().nullable().optional(), conditions: z.string().nullable().optional() }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  const rows = await db.insert(schema.wards).values(p.data as any).onConflictDoNothing({ target: schema.wards.code }).returning();
  await audit(getUser(c).id, 'ward', String(rows[0]?.id), 'create');
  return c.json({ ward: rows[0] ?? null });
});
app.patch('/api/wards/:id', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const id = Number(c.req.param('id'));
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ name: z.string().optional(), building: z.string().nullable().optional(), phone: z.string().nullable().optional(), conditions: z.string().nullable().optional() }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  const rows = await db.update(schema.wards).set(p.data as any).where(eq(schema.wards.id, id)).returning();
  await audit(getUser(c).id, 'ward', String(id), 'update');
  return c.json({ ward: rows[0] ?? null });
});

// ---- employees create / bulk import ----------------------------------------
const empInput = z.object({
  prefix: z.string().nullable().optional(), firstName: z.string().min(1), lastName: z.string().nullable().optional(),
  role: z.enum(['doctor', 'nurse', 'assistant', 'room', 'support']).default('support'),
  positionText: z.string().nullable().optional(), employeeType: z.string().nullable().optional(),
  paymentType: z.enum(['รายเดือน', 'รายวัน', 'รายคาบ']).default('รายเดือน'),
  line: z.enum(['แพทย์', 'พยาบาล', 'สนับสนุน']).nullable().optional(),
  baseWage: z.number().nullable().optional(), bankAccount: z.string().nullable().optional(),
  employeeCode: z.string().nullable().optional(),   // เลขที่คำสั่งจ้าง
  startDate: z.string().nullable().optional(),       // วันที่เริ่มจ้าง (ISO)
  homeWardId: z.number(),
});
app.post('/api/employees', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = empInput.safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input', issues: p.error.issues }, 400);
  const rows = await db.insert(schema.employees).values(p.data as any).returning();
  await audit(getUser(c).id, 'employee', String(rows[0]?.id), 'create');
  return c.json({ employee: rows[0] });
});
app.post('/api/employees/import', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ employees: z.array(empInput) }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input', issues: p.error.issues }, 400);
  if (!p.data.employees.length) return c.json({ imported: 0 });
  const rows = await db.insert(schema.employees).values(p.data.employees as any).returning({ id: schema.employees.id });
  await audit(getUser(c).id, 'employee', null, 'import', { count: rows.length });
  return c.json({ imported: rows.length });
});

// ---- shift types upsert (supervisor/admin) ---------------------------------
app.post('/api/shift-types', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ code: z.string().min(1), name: z.string().min(1), hours: z.number().default(0), startHour: z.number().nullable().optional(), endHour: z.number().nullable().optional(), isOt: z.boolean().default(false), isWork: z.boolean().default(true), category: z.string().nullable().optional(), sortOrder: z.number().default(0) }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  const rows = await db.insert(schema.shiftTypes).values(p.data as any)
    .onConflictDoUpdate({ target: schema.shiftTypes.code, set: p.data as any }).returning();
  return c.json({ shiftType: rows[0] });
});

// ---- staffing requirements --------------------------------------------------
app.get('/api/staffing', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId'));
  const rows = await db.select().from(schema.staffingRequirements).where(eq(schema.staffingRequirements.wardId, wardId));
  return c.json({ staffing: rows });
});
app.put('/api/staffing', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ wardId: z.number(), items: z.array(z.object({ level: z.string(), shiftCode: z.string(), count: z.number().int().min(0) })) }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  await db.delete(schema.staffingRequirements).where(eq(schema.staffingRequirements.wardId, p.data.wardId));
  if (p.data.items.length) await db.insert(schema.staffingRequirements).values(p.data.items.map((i) => ({ wardId: p.data.wardId, ...i })));
  await audit(getUser(c).id, 'staffing', String(p.data.wardId), 'set', { items: p.data.items.length });
  return c.json({ ok: true, count: p.data.items.length });
});

// ---- rate settings (OT rate per role/code + base salary) --------------------
app.get('/api/rate-settings', requireAuth, async (c) => {
  const rows = await db.select().from(schema.rateSettings);
  return c.json({ rates: rows });
});
app.put('/api/rate-settings', requireAuth, requireRole('finance', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ items: z.array(z.object({ role: z.string().min(1), code: z.string().min(1), amount: z.number().min(0) })) }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  for (const it of p.data.items) {
    await db.insert(schema.rateSettings).values(it)
      .onConflictDoUpdate({ target: [schema.rateSettings.role, schema.rateSettings.code], set: { amount: it.amount } });
  }
  await audit(getUser(c).id, 'rate_settings', null, 'update', { count: p.data.items.length });
  return c.json({ ok: true, count: p.data.items.length });
});

// ---- per-ward shift times ---------------------------------------------------
app.get('/api/ward-shift-times', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId'));
  const rows = await db.select().from(schema.wardShiftTimes).where(eq(schema.wardShiftTimes.wardId, wardId));
  return c.json({ times: rows });
});
app.put('/api/ward-shift-times', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ wardId: z.number(), items: z.array(z.object({ code: z.string().min(1), startTime: z.string().min(1), endTime: z.string().min(1) })) }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  for (const it of p.data.items) {
    await db.insert(schema.wardShiftTimes).values({ wardId: p.data.wardId, ...it })
      .onConflictDoUpdate({ target: [schema.wardShiftTimes.wardId, schema.wardShiftTimes.code], set: { startTime: it.startTime, endTime: it.endTime } });
  }
  await audit(getUser(c).id, 'ward_shift_times', String(p.data.wardId), 'set', { count: p.data.items.length });
  return c.json({ ok: true });
});

// ---- actual time-clock scans ------------------------------------------------
app.get('/api/time-scans', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId')), year = Number(c.req.query('year')), month = Number(c.req.query('month'));
  const rows = await db.select().from(schema.timeScans)
    .where(and(eq(schema.timeScans.wardId, wardId), eq(schema.timeScans.year, year), eq(schema.timeScans.month, month)));
  return c.json({ scans: rows });
});
app.post('/api/time-scans/import', requireAuth, requireRole('supervisor', 'finance', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({
    wardId: z.number(), year: z.number(), month: z.number(),
    items: z.array(z.object({ employeeId: z.number(), day: z.number().int().min(1).max(31), timeIn: z.string().nullable().optional(), timeOut: z.string().nullable().optional() })),
  }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  for (const it of p.data.items) {
    await db.insert(schema.timeScans)
      .values({ wardId: p.data.wardId, employeeId: it.employeeId, year: p.data.year, month: p.data.month, day: it.day, timeIn: it.timeIn ?? null, timeOut: it.timeOut ?? null, source: 'import' })
      .onConflictDoUpdate({ target: [schema.timeScans.employeeId, schema.timeScans.year, schema.timeScans.month, schema.timeScans.day], set: { timeIn: it.timeIn ?? null, timeOut: it.timeOut ?? null } });
  }
  await audit(getUser(c).id, 'time_scans', String(p.data.wardId), 'import', { count: p.data.items.length });
  return c.json({ ok: true, count: p.data.items.length });
});

// ---- OR procedures (config) + cases (log) -----------------------------------
app.get('/api/or-procedures', requireAuth, async (c) => {
  const rows = await db.select().from(schema.orProcedures).where(eq(schema.orProcedures.active, true));
  return c.json({ procedures: rows });
});
app.post('/api/or-procedures', requireAuth, requireRole('supervisor', 'finance', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({
    id: z.number().optional(), name: z.string().min(1), mode: z.enum(['case', 'hour']).default('case'),
    roleRates: z.record(z.number()), otThresholdHours: z.number().default(0), otBonusPerHour: z.number().default(0),
  }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  const { id, ...vals } = p.data;
  const rows = id
    ? await db.update(schema.orProcedures).set(vals as any).where(eq(schema.orProcedures.id, id)).returning()
    : await db.insert(schema.orProcedures).values(vals as any).returning();
  await audit(getUser(c).id, 'or_procedure', String(rows[0]?.id ?? ''), id ? 'update' : 'create');
  return c.json({ procedure: rows[0] });
});
app.delete('/api/or-procedures/:id', requireAuth, requireRole('supervisor', 'finance', 'admin'), async (c) => {
  await db.update(schema.orProcedures).set({ active: false }).where(eq(schema.orProcedures.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});
app.get('/api/or-cases', requireAuth, async (c) => {
  const wardId = Number(c.req.query('wardId')), year = Number(c.req.query('year')), month = Number(c.req.query('month'));
  const rows = await db.select().from(schema.orCases)
    .where(and(eq(schema.orCases.wardId, wardId), eq(schema.orCases.year, year), eq(schema.orCases.month, month))).orderBy(schema.orCases.day);
  return c.json({ cases: rows });
});
app.post('/api/or-cases', requireAuth, async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({
    wardId: z.number(), year: z.number(), month: z.number(), day: z.number().int().min(1).max(31),
    procedureId: z.number().nullable().optional(), procedureName: z.string().nullable().optional(),
    hours: z.number().default(0), participants: z.array(z.object({ employeeId: z.number(), name: z.string(), slot: z.string() })), note: z.string().nullable().optional(),
  }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  const rows = await db.insert(schema.orCases).values({ ...p.data, createdBy: getUser(c).id } as any).returning();
  await audit(getUser(c).id, 'or_case', String(rows[0]?.id ?? ''), 'create', { day: p.data.day });
  return c.json({ case: rows[0] });
});
app.delete('/api/or-cases/:id', requireAuth, async (c) => {
  await db.delete(schema.orCases).where(eq(schema.orCases.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

// ---- holidays ---------------------------------------------------------------
app.get('/api/holidays', requireAuth, async (c) => {
  const year = Number(c.req.query('year'));
  const rows = await db.select().from(schema.holidays).where(eq(schema.holidays.year, year));
  return c.json({ holidays: rows });
});
app.post('/api/holidays', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const p = z.object({ year: z.number(), date: z.string(), name: z.string() }).safeParse(b);
  if (!p.success) return c.json({ error: 'invalid_input' }, 400);
  const rows = await db.insert(schema.holidays).values(p.data).returning();
  return c.json({ holiday: rows[0] });
});
app.delete('/api/holidays/:id', requireAuth, requireRole('supervisor', 'admin'), async (c) => {
  await db.delete(schema.holidays).where(eq(schema.holidays.id, Number(c.req.param('id'))));
  return c.json({ ok: true });
});

export default app;
