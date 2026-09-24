/**
 * Sati domain schema (PostgreSQL via Drizzle).
 *
 * Modeled on the real Maharat Nakhon Ratchasima ("Korat") hospital
 * "ตารางปฏิบัติงาน / หลักฐานการจ่ายเงิน" forms:
 *  - Each employee has, per day, a NORMAL duty code (ช / ออฟ ...) and an
 *    optional OT code (BD / ชot / บot / ดot / OR) — the two-row layout.
 *  - Rosters carry up to 4 signers (หัวหน้าผู้ควบคุม, ผู้อนุมัติ, ...).
 *  - Working days of the month must be locked before OT is allowed.
 */
import {
  pgTable, serial, text, integer, boolean, timestamp, doublePrecision,
  uniqueIndex, index, jsonb, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---- enums -----------------------------------------------------------------
export const userRoleEnum = pgEnum('user_role', ['staff', 'supervisor', 'finance', 'admin']);
export const staffRoleEnum = pgEnum('staff_role', ['doctor', 'nurse', 'assistant', 'room', 'support']);
export const staffLineEnum = pgEnum('staff_line', ['แพทย์', 'พยาบาล', 'สนับสนุน']);
export const paymentTypeEnum = pgEnum('payment_type', ['รายเดือน', 'รายวัน', 'รายคาบ']);
export const rosterStatusEnum = pgEnum('roster_status', ['draft', 'pending_approval', 'approved']);
export const requestTypeEnum = pgEnum('request_type', ['shift_change', 'leave', 'ot', 'shift_add']);
export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'rejected', 'cancelled']);
export const signerRoleEnum = pgEnum('signer_role', ['controller', 'approver', 'other']);

// ---- organization (single tenant, but explicit for clarity) ----------------
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ---- wards / กลุ่มงาน --------------------------------------------------------
export const wards = pgTable('wards', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),            // e.g. U01, ICU, ER
  name: text('name').notNull(),
  building: text('building'),
  phone: text('phone'),
  conditions: text('conditions'),          // per-ward scheduling conditions (free text for AI/rules)
  active: boolean('active').default(true).notNull(),
}, (t) => ({ codeIdx: uniqueIndex('wards_code_idx').on(t.code) }));

// ---- staffing requirements per ward (headcount by position/level & shift) ---
export const staffingRequirements = pgTable('staffing_requirements', {
  id: serial('id').primaryKey(),
  wardId: integer('ward_id').references(() => wards.id, { onDelete: 'cascade' }).notNull(),
  level: text('level').notNull(),          // e.g. หัวหน้าเวร / RN / PN / NA  or L/M/S
  shiftCode: text('shift_code').notNull(), // ช / บ / ด
  count: integer('count').default(0).notNull(),
});

// ---- rate settings / อัตราค่าตอบแทน (OT rate per role/code + base salary) ----
// One row per (role, code). code = OT code (ชot/บot/ดot/BD/OR) for the OT rate,
// or the special code 'BASE' for the monthly base salary of that role.
export const rateSettings = pgTable('rate_settings', {
  id: serial('id').primaryKey(),
  role: text('role').notNull(),      // doctor / nurse / assistant / room / support
  code: text('code').notNull(),      // ชot / บot / ดot / BD / OR / BASE
  amount: doublePrecision('amount').default(0).notNull(),
}, (t) => ({ uniq: uniqueIndex('rate_role_code_idx').on(t.role, t.code) }));

// ---- holidays -------------------------------------------------------------
export const holidays = pgTable('holidays', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),         // Buddhist Era
  date: text('date').notNull(),            // 'MM-DD'
  name: text('name').notNull(),
});

// ---- positions / ตำแหน่ง ----------------------------------------------------
export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),            // e.g. นักวิชาการเงินและบัญชี
  line: staffLineEnum('line').notNull(),   // สายงานเบิก
});

// ---- employees / บุคลากร ----------------------------------------------------
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  employeeCode: text('employee_code'),     // รหัสพนักงาน (optional)
  prefix: text('prefix'),                  // คำนำหน้า
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  role: staffRoleEnum('role').notNull(),
  positionId: integer('position_id').references(() => positions.id),
  positionText: text('position_text'),     // free-text position label as on forms
  employeeType: text('employee_type'),     // ข้าราชการ / ลูกจ้างชั่วคราว (รายวัน) ...
  paymentType: paymentTypeEnum('payment_type').default('รายเดือน').notNull(),
  baseWage: doublePrecision('base_wage'),  // per day/period/month
  line: staffLineEnum('line'),             // reimbursement line override
  homeWardId: integer('home_ward_id').references(() => wards.id),
  bankAccount: text('bank_account'),       // for KTB payout (later)
  startDate: text('start_date'),           // วันเริ่มจ้าง (ISO date)
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
}, (t) => ({ wardIdx: index('employees_home_ward_idx').on(t.homeWardId) }));

// ---- users / บัญชีผู้ใช้ (login) ---------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: userRoleEnum('role').notNull(),
  employeeId: integer('employee_id').references(() => employees.id),
  wardId: integer('ward_id').references(() => wards.id),  // scope for supervisor
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ emailIdx: uniqueIndex('users_email_idx').on(t.email) }));

// ---- shift types / ประเภทกะ -------------------------------------------------
export const shiftTypes = pgTable('shift_types', {
  code: text('code').primaryKey(),         // ช, บ, ด, ออฟ, BD, ชot, บot, ดot, OR, O, V, T
  name: text('name').notNull(),
  hours: doublePrecision('hours').default(0).notNull(),
  startHour: doublePrecision('start_hour'),
  endHour: doublePrecision('end_hour'),
  isOt: boolean('is_ot').default(false).notNull(),
  isWork: boolean('is_work').default(true).notNull(),  // false for ออฟ/O/V/T
  category: text('category'),              // ช / บ / ด / BD / OR (base group)
  sortOrder: integer('sort_order').default(0).notNull(),
});

// ---- working calendar / วันทำการของเดือน (must lock before OT) --------------
export const workingCalendars = pgTable('working_calendars', {
  id: serial('id').primaryKey(),
  wardId: integer('ward_id').references(() => wards.id).notNull(),
  year: integer('year').notNull(),         // Buddhist Era, e.g. 2569
  month: integer('month').notNull(),       // 1-12
  workingDays: integer('working_days').default(0).notNull(),
  locked: boolean('locked').default(false).notNull(),
  lockedAt: timestamp('locked_at'),
}, (t) => ({ uniq: uniqueIndex('wc_ward_ym_idx').on(t.wardId, t.year, t.month) }));

// ---- rosters / ตารางเวร -----------------------------------------------------
export const rosters = pgTable('rosters', {
  id: serial('id').primaryKey(),
  wardId: integer('ward_id').references(() => wards.id).notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: rosterStatusEnum('status').default('draft').notNull(),
  note: text('note'),                      // หมายเหตุท้ายตาราง
  createdBy: integer('created_by').references(() => users.id),
  approvedBy: integer('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  financeLocked: boolean('finance_locked').default(false).notNull(),  // finance closes the month (after day 5)
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({ uniq: uniqueIndex('roster_ward_ym_idx').on(t.wardId, t.year, t.month) }));

// ---- roster cells / ช่องเวร (normal + OT per day) ---------------------------
export const rosterCells = pgTable('roster_cells', {
  id: serial('id').primaryKey(),
  rosterId: integer('roster_id').references(() => rosters.id, { onDelete: 'cascade' }).notNull(),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  day: integer('day').notNull(),           // 1-31
  normalCode: text('normal_code'),         // ช / ออฟ ... (bottom row)
  otCode: text('ot_code'),                 // BD / ชot ... (top row), nullable
  pinned: boolean('pinned').default(false).notNull(),
  external: boolean('external').default(false).notNull(),  // คนนอกหน่วย (OT-only)
}, (t) => ({ uniq: uniqueIndex('cell_roster_emp_day_idx').on(t.rosterId, t.employeeId, t.day) }));

// ---- roster signers / ผู้เกี่ยวข้อง (max 4) ---------------------------------
export const rosterSigners = pgTable('roster_signers', {
  id: serial('id').primaryKey(),
  rosterId: integer('roster_id').references(() => rosters.id, { onDelete: 'cascade' }).notNull(),
  ordinal: integer('ordinal').notNull(),   // 1-4
  name: text('name').notNull(),
  title: text('title'),                    // ตำแหน่ง/บทบาทที่เซ็น
  signerRole: signerRoleEnum('signer_role').default('other').notNull(),
});

// ---- requests / คำขอ (ขอเวร/เปลี่ยนเวร/ลา/OT) --------------------------------
export const requests = pgTable('requests', {
  id: serial('id').primaryKey(),
  type: requestTypeEnum('type').notNull(),
  employeeId: integer('employee_id').references(() => employees.id).notNull(),
  wardId: integer('ward_id').references(() => wards.id).notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  day: integer('day'),                     // target day (nullable for range leave)
  toDay: integer('to_day'),                // end day for leave range
  fromCode: text('from_code'),
  toCode: text('to_code'),
  reason: text('reason'),
  status: requestStatusEnum('status').default('pending').notNull(),
  requestedBy: integer('requested_by').references(() => users.id),
  decidedBy: integer('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ scopeIdx: index('req_scope_idx').on(t.wardId, t.year, t.month) }));

// ---- audit log --------------------------------------------------------------
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  ts: timestamp('ts').defaultNow().notNull(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  entity: text('entity').notNull(),
  entityId: text('entity_id'),
  action: text('action').notNull(),
  detail: jsonb('detail'),
});

// ---- relations --------------------------------------------------------------
export const wardRelations = relations(wards, ({ many }) => ({
  employees: many(employees),
  rosters: many(rosters),
}));
export const employeeRelations = relations(employees, ({ one }) => ({
  position: one(positions, { fields: [employees.positionId], references: [positions.id] }),
  homeWard: one(wards, { fields: [employees.homeWardId], references: [wards.id] }),
}));
export const rosterRelations = relations(rosters, ({ one, many }) => ({
  ward: one(wards, { fields: [rosters.wardId], references: [wards.id] }),
  cells: many(rosterCells),
  signers: many(rosterSigners),
}));
export const rosterCellRelations = relations(rosterCells, ({ one }) => ({
  roster: one(rosters, { fields: [rosterCells.rosterId], references: [rosters.id] }),
  employee: one(employees, { fields: [rosterCells.employeeId], references: [employees.id] }),
}));
