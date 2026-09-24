/**
 * Seed baseline data for local dev / demo.
 * Idempotent: safe to run multiple times.
 *
 * Test logins (all password: Sati@1234):
 *   admin@sati.local      -> admin
 *   finance@sati.local    -> finance
 *   head.u01@sati.local   -> supervisor (ward U01)
 *   staff.u01@sati.local  -> staff      (ward U01)
 */
import { db, schema, runMigrations } from './db/index.js';
import { hashPassword } from './auth.js';
import { eq, and, sql } from 'drizzle-orm';

const PASSWORD = 'Sati@1234';

const WARDS = [
  { code: 'U01', name: 'กลุ่มงานการเงิน (U01)', building: 'ตึกการเงิน/อำนวยการ', phone: '32077' },
  { code: 'A01', name: 'กลุ่มงานวิสัญญีวิทยา (A01)', building: 'ตึกศัลยกรรม', phone: '32078' },
  { code: 'M01', name: 'กลุ่มงานอายุรกรรม (M01)', building: 'ตึกอายุรกรรม', phone: '35870' },
  { code: 'ICU', name: 'หอผู้ป่วยวิกฤต (ICU)', building: 'ตึกวิกฤตบำบัด', phone: '31415' },
  { code: 'ER', name: 'แผนกฉุกเฉิน (ER)', building: 'ตึกฉุกเฉินอุบัติเหตุ', phone: '39911' },
];

// Shift codes from the real Maharat Korat form legend + standard hospital codes.
const SHIFT_TYPES = [
  { code: 'ช', name: 'เวรเช้า (ในเวลาราชการ 08.30-16.30)', hours: 8, startHour: 8.3, endHour: 16.3, isOt: false, isWork: true, category: 'ช', sortOrder: 1 },
  { code: 'บ', name: 'เวรบ่าย', hours: 8, startHour: 16.3, endHour: 24, isOt: false, isWork: true, category: 'บ', sortOrder: 2 },
  { code: 'ด', name: 'เวรดึก', hours: 8, startHour: 0, endHour: 8, isOt: false, isWork: true, category: 'ด', sortOrder: 3 },
  { code: 'ออฟ', name: 'วันหยุด (Off)', hours: 0, isOt: false, isWork: false, category: null, sortOrder: 4 },
  { code: 'ชot', name: 'ปฏิบัติงานวันหยุดราชการ 08.30-16.30 (OT)', hours: 8, startHour: 8.3, endHour: 16.3, isOt: true, isWork: true, category: 'ช', sortOrder: 5 },
  { code: 'บot', name: 'OT เวรบ่าย', hours: 8, isOt: true, isWork: true, category: 'บ', sortOrder: 6 },
  { code: 'ดot', name: 'OT เวรดึก', hours: 8, isOt: true, isWork: true, category: 'ด', sortOrder: 7 },
  { code: 'BD', name: 'ปฏิบัติงานนอกเวลาราชการ (บ่ายดึก) 16.30-20.30', hours: 4, startHour: 16.3, endHour: 20.3, isOt: true, isWork: true, category: 'BD', sortOrder: 8 },
  { code: 'OR', name: 'OT ห้องผ่าตัด', hours: 0, isOt: true, isWork: true, category: 'OR', sortOrder: 9 },
  { code: 'O', name: 'หยุด (O)', hours: 0, isOt: false, isWork: false, category: null, sortOrder: 10 },
  { code: 'V', name: 'ลา (Vacation/Leave)', hours: 0, isOt: false, isWork: false, category: null, sortOrder: 11 },
  { code: 'T', name: 'อบรม/ไปราชการ (Training)', hours: 0, isOt: false, isWork: false, category: null, sortOrder: 12 },
];

export async function seed() {
  // organization
  const orgCount = await db.select({ n: sql<number>`count(*)` }).from(schema.organizations);
  if (Number(orgCount[0].n) === 0) {
    await db.insert(schema.organizations).values({ name: 'โรงพยาบาลมหาราชนครราชสีมา' });
  }

  // wards
  for (const w of WARDS) {
    await db.insert(schema.wards).values(w).onConflictDoNothing({ target: schema.wards.code });
  }
  const wardRows = await db.select().from(schema.wards);
  const wardByCode = Object.fromEntries(wardRows.map((w: any) => [w.code, w.id]));

  // shift types
  for (const s of SHIFT_TYPES) {
    await db.insert(schema.shiftTypes).values(s).onConflictDoNothing({ target: schema.shiftTypes.code });
  }

  // positions
  const positionNames: { name: string; line: 'แพทย์' | 'พยาบาล' | 'สนับสนุน' }[] = [
    { name: 'นักวิชาการเงินและบัญชี', line: 'สนับสนุน' },
    { name: 'จพ.การเงินและบัญชี', line: 'สนับสนุน' },
    { name: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
    { name: 'นายแพทย์', line: 'แพทย์' },
  ];
  for (const p of positionNames) {
    const exists = await db.select().from(schema.positions).where(eq(schema.positions.name, p.name));
    if (exists.length === 0) await db.insert(schema.positions).values(p);
  }
  const posRows = await db.select().from(schema.positions);
  const posByName = Object.fromEntries(posRows.map((p: any) => [p.name, p.id]));

  // employees (from the real CSV example, กลุ่มงานการเงิน U01)
  const empCount = await db.select({ n: sql<number>`count(*)` }).from(schema.employees);
  let firstEmpId: number | null = null;
  if (Number(empCount[0].n) === 0) {
    const inserted = await db.insert(schema.employees).values([
      { prefix: 'นางสาว', firstName: 'ดินสอ', lastName: 'ระบายสี', role: 'support', positionId: posByName['นักวิชาการเงินและบัญชี'], positionText: 'นักวิชาการเงินและบัญชี', employeeType: 'ข้าราชการ', paymentType: 'รายเดือน', line: 'สนับสนุน', homeWardId: wardByCode['U01'], sortOrder: 1 },
      { prefix: 'นาย', firstName: 'ต้นไม้', lastName: 'ยืนต้น', role: 'support', positionId: posByName['จพ.การเงินและบัญชี'], positionText: 'จพ.การเงินและบัญชี', employeeType: 'พนักงานราชการ', paymentType: 'รายเดือน', line: 'สนับสนุน', homeWardId: wardByCode['U01'], sortOrder: 2 },
    ]).returning({ id: schema.employees.id });
    firstEmpId = inserted[0].id;
  } else {
    const e = await db.select().from(schema.employees).limit(1);
    firstEmpId = e[0]?.id ?? null;
  }

  // users (one per role)
  const hash = await hashPassword(PASSWORD);
  const users = [
    { email: 'admin@sati.local', displayName: 'ผู้ดูแลระบบ', role: 'admin' as const, wardId: null, employeeId: null },
    { email: 'finance@sati.local', displayName: 'ทีมการเงิน', role: 'finance' as const, wardId: null, employeeId: null },
    { email: 'head.u01@sati.local', displayName: 'หัวหน้ากลุ่มงานการเงิน', role: 'supervisor' as const, wardId: wardByCode['U01'], employeeId: null },
    { email: 'staff.u01@sati.local', displayName: 'เจ้าหน้าที่การเงิน', role: 'staff' as const, wardId: wardByCode['U01'], employeeId: firstEmpId },
  ];
  for (const u of users) {
    await db.insert(schema.users).values({ ...u, passwordHash: hash }).onConflictDoNothing({ target: schema.users.email });
  }

  // ---- sample roster for demo (U01, 2569/07) — idempotent ------------------
  const SY = 2569, SM = 7, ceY = SY - 543; // July 2026
  const u01 = wardByCode['U01'];
  const existingRoster = await db.select().from(schema.rosters)
    .where(and(eq(schema.rosters.wardId, u01), eq(schema.rosters.year, SY), eq(schema.rosters.month, SM)));
  if (u01 && existingRoster.length === 0) {
    // lock working calendar
    await db.insert(schema.workingCalendars)
      .values({ wardId: u01, year: SY, month: SM, workingDays: 22, locked: true, lockedAt: new Date() })
      .onConflictDoNothing({ target: [schema.workingCalendars.wardId, schema.workingCalendars.year, schema.workingCalendars.month] });

    const rosterRows = await db.insert(schema.rosters)
      .values({ wardId: u01, year: SY, month: SM, status: 'approved', note: 'เบิกตามเวลาที่ขึ้นปฏิบัติงานจริง', approvedAt: new Date() })
      .onConflictDoNothing({ target: [schema.rosters.wardId, schema.rosters.year, schema.rosters.month] })
      .returning();
    const rosterId = rosterRows[0]?.id;

    if (rosterId) {
      const u01emps = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, u01));
      const daysInMonth = new Date(ceY, SM, 0).getDate();
      const otDays = [3, 10, 17, 24];       // BD
      const holidayOtDays = [6, 13, 20];    // ชot (weekend duty)
      const cellValues: any[] = [];
      for (const emp of u01emps) {
        for (let d = 1; d <= daysInMonth; d++) {
          const wd = new Date(ceY, SM - 1, d).getDay();
          const weekend = wd === 0 || wd === 6;
          const normalCode = weekend ? 'ออฟ' : 'ช';
          let otCode: string | null = null;
          if (otDays.includes(d)) otCode = 'BD';
          else if (holidayOtDays.includes(d)) otCode = 'ชot';
          cellValues.push({ rosterId, employeeId: emp.id, day: d, normalCode, otCode });
        }
      }
      if (cellValues.length) await db.insert(schema.rosterCells).values(cellValues);

      await db.insert(schema.rosterSigners).values([
        { rosterId, ordinal: 1, name: 'นางสาววรรณทิพย์  รีพล', title: 'หัวหน้ากลุ่มงานการเงิน', signerRole: 'controller' },
        { rosterId, ordinal: 2, name: 'นางนฤมล  ศรีสรรพ์', title: 'รองผู้อำนวยการฝ่ายบริหาร', signerRole: 'approver' },
      ]);
    }
  }

  // ---- richer mock data across wards (idempotent) --------------------------
  const SY2 = 2569, SM2 = 7, ceY2 = SY2 - 543;
  const rot = ['ช', 'บ', 'ด', 'ออฟ', 'ช', 'บ', 'ออฟ']; // weekly rotation
  const otMap: Record<number, string> = { 4: 'BD', 6: 'ชot', 11: 'BD', 13: 'ชot', 18: 'BD', 20: 'ชot', 25: 'BD' };

  const wardStaff: Record<string, { prefix: string; first: string; last: string; role: any; pos: string; line: any }[]> = {
    ICU: [
      { prefix: 'นาง', first: 'สมหญิง', last: 'ดูแลดี', role: 'nurse', pos: 'พยาบาลวิชาชีพชำนาญการ (หัวหน้าเวร)', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'มาลี', last: 'ใจงาม', role: 'nurse', pos: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'จันทรา', last: 'พริ้งเพรา', role: 'nurse', pos: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'อัญชลี', last: 'สดใส', role: 'nurse', pos: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
      { prefix: 'นาย', first: 'รักงาน', last: 'ขยันยิ่ง', role: 'assistant', pos: 'ผู้ช่วยพยาบาล', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'รัตนา', last: 'สุขใจ', role: 'assistant', pos: 'ผู้ช่วยพยาบาล', line: 'พยาบาล' },
    ],
    ER: [
      { prefix: 'นพ.', first: 'สมชาย', last: 'กู้ชีพ', role: 'doctor', pos: 'แพทย์เวชศาสตร์ฉุกเฉิน', line: 'แพทย์' },
      { prefix: 'นาง', first: 'ปิยะดา', last: 'ทองดี', role: 'nurse', pos: 'พยาบาลวิชาชีพชำนาญการ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'กานดา', last: 'มีสุข', role: 'nurse', pos: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'สุพรรณ', last: 'ดีมาก', role: 'assistant', pos: 'พนักงานช่วยเหลือคนไข้', line: 'พยาบาล' },
    ],
    A01: [
      { prefix: 'พญ.', first: 'สิรินทร์', last: 'แก้วดี', role: 'doctor', pos: 'วิสัญญีแพทย์', line: 'แพทย์' },
      { prefix: 'นพ.', first: 'วิชัย', last: 'สิริประเสริฐ', role: 'doctor', pos: 'วิสัญญีแพทย์', line: 'แพทย์' },
      { prefix: 'นางสาว', first: 'อรุณี', last: 'แจ่มใส', role: 'nurse', pos: 'พยาบาลวิสัญญี', line: 'พยาบาล' },
    ],
    M01: [
      { prefix: 'นาง', first: 'วราภรณ์', last: 'เมตตา', role: 'nurse', pos: 'พยาบาลวิชาชีพชำนาญการ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'ธิดา', last: 'อ่อนหวาน', role: 'nurse', pos: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'กมล', last: 'ศรีสุข', role: 'assistant', pos: 'ผู้ช่วยพยาบาล', line: 'พยาบาล' },
    ],
  };

  for (const [code, staff] of Object.entries(wardStaff)) {
    const wid = wardByCode[code];
    if (!wid) continue;
    const existing = await db.select({ n: sql<number>`count(*)` }).from(schema.employees).where(eq(schema.employees.homeWardId, wid));
    if (Number(existing[0].n) > 0) continue; // already seeded

    const inserted = await db.insert(schema.employees).values(staff.map((s, i) => ({
      prefix: s.prefix, firstName: s.first, lastName: s.last, role: s.role, positionText: s.pos,
      employeeType: s.role === 'doctor' ? 'ข้าราชการ' : 'พนักงานราชการ', paymentType: 'รายเดือน' as const,
      line: s.line, homeWardId: wid, sortOrder: i + 1,
    }))).returning({ id: schema.employees.id });

    // roster with rotation + OT
    const rosterRows = await db.insert(schema.rosters)
      .values({ wardId: wid, year: SY2, month: SM2, status: 'approved', note: 'ปฏิบัติงานตามตารางเวรที่ได้รับอนุมัติ', approvedAt: new Date() })
      .onConflictDoNothing({ target: [schema.rosters.wardId, schema.rosters.year, schema.rosters.month] }).returning();
    const rid = rosterRows[0]?.id;
    if (rid) {
      const daysInMonth = new Date(ceY2, SM2, 0).getDate();
      const cells: any[] = [];
      inserted.forEach((emp: { id: number }, idx: number) => {
        for (let d = 1; d <= daysInMonth; d++) {
          const normalCode = rot[(d + idx) % rot.length];
          const otCode = (idx % 2 === 0 && otMap[d]) ? otMap[d] : null;
          cells.push({ rosterId: rid, employeeId: emp.id, day: d, normalCode, otCode });
        }
      });
      await db.insert(schema.rosterCells).values(cells);
      await db.insert(schema.rosterSigners).values([
        { rosterId: rid, ordinal: 1, name: 'หัวหน้าหอผู้ป่วย', title: `หัวหน้า ${code}`, signerRole: 'controller' },
        { rosterId: rid, ordinal: 2, name: 'นางนฤมล  ศรีสรรพ์', title: 'รองผู้อำนวยการฝ่ายการพยาบาล', signerRole: 'approver' },
      ]);
      await db.insert(schema.workingCalendars)
        .values({ wardId: wid, year: SY2, month: SM2, workingDays: 22, locked: true, lockedAt: new Date() })
        .onConflictDoNothing({ target: [schema.workingCalendars.wardId, schema.workingCalendars.year, schema.workingCalendars.month] });
    }

    // staffing requirement sample
    const stExisting = await db.select({ n: sql<number>`count(*)` }).from(schema.staffingRequirements).where(eq(schema.staffingRequirements.wardId, wid));
    if (Number(stExisting[0].n) === 0) {
      await db.insert(schema.staffingRequirements).values([
        { wardId: wid, level: 'พยาบาลวิชาชีพ (RN)', shiftCode: 'ช', count: 2 },
        { wardId: wid, level: 'พยาบาลวิชาชีพ (RN)', shiftCode: 'บ', count: 2 },
        { wardId: wid, level: 'พยาบาลวิชาชีพ (RN)', shiftCode: 'ด', count: 1 },
        { wardId: wid, level: 'ผู้ช่วยพยาบาล (PN)', shiftCode: 'ช', count: 1 },
        { wardId: wid, level: 'ผู้ช่วยพยาบาล (PN)', shiftCode: 'บ', count: 1 },
      ]);
    }
  }

  // holidays 2569 (a few key ones) — idempotent
  const hExisting = await db.select({ n: sql<number>`count(*)` }).from(schema.holidays).where(eq(schema.holidays.year, SY2));
  if (Number(hExisting[0].n) === 0) {
    await db.insert(schema.holidays).values([
      { year: SY2, date: '07-28', name: 'วันเฉลิมพระชนมพรรษา ร.10' },
      { year: SY2, date: '07-29', name: 'วันอาสาฬหบูชา' },
      { year: SY2, date: '07-30', name: 'วันเข้าพรรษา' },
      { year: SY2, date: '08-12', name: 'วันแม่แห่งชาติ' },
      { year: SY2, date: '10-13', name: 'วันคล้ายวันสวรรคต ร.9' },
      { year: SY2, date: '10-23', name: 'วันปิยมหาราช' },
      { year: SY2, date: '12-05', name: 'วันพ่อแห่งชาติ' },
      { year: SY2, date: '12-10', name: 'วันรัฐธรรมนูญ' },
    ]);
  }

  // ---- daily-wage employee in U01 (for รายวัน forms) — idempotent ----------
  const u01b = wardByCode['U01'];
  if (u01b) {
    const hasDaily = await db.select({ n: sql<number>`count(*)` }).from(schema.employees)
      .where(and(eq(schema.employees.homeWardId, u01b), eq(schema.employees.paymentType, 'รายวัน')));
    if (Number(hasDaily[0].n) === 0) {
      await db.insert(schema.employees).values([
        { prefix: 'นางสาว', firstName: 'การเงิน', lastName: 'มหาราช', role: 'support', positionText: 'ลูกจ้างชั่วคราว (รายวัน)', employeeType: 'ลูกจ้างชั่วคราว (รายวัน)', paymentType: 'รายวัน', line: 'สนับสนุน', baseWage: 420, bankAccount: '983-1-45xxx-1', startDate: '2024-10-01', homeWardId: u01b, sortOrder: 10 },
        { prefix: 'นาย', firstName: 'บัญชี', lastName: 'ราชสีมา', role: 'support', positionText: 'ลูกจ้างชั่วคราว (รายวัน)', employeeType: 'ลูกจ้างชั่วคราว (รายวัน)', paymentType: 'รายวัน', line: 'สนับสนุน', baseWage: 420, bankAccount: '983-1-45xxx-2', startDate: '2025-01-15', homeWardId: u01b, sortOrder: 11 },
      ]);
    }
  }

  // ---- sample requests per ward (all roles: หมอ/พยาบาล/สนับสนุน) — idempotent
  const reqPlan: Record<string, { type: any; day: number; toDay?: number; fromCode?: string; toCode?: string; reason: string; status: any }[]> = {
    ICU: [
      { type: 'shift_change', day: 12, fromCode: 'ด', toCode: 'บ', reason: 'ติดธุระครอบครัว ขอสลับกับเวรบ่าย', status: 'pending' },
      { type: 'leave', day: 15, toDay: 16, reason: 'ลากิจ 2 วัน', status: 'approved' },
      { type: 'ot', day: 22, toCode: 'BD', reason: 'ช่วยเวรบ่ายดึกช่วงผู้ป่วยล้น', status: 'pending' },
      { type: 'leave', day: 28, reason: 'ลาป่วย', status: 'rejected' },
    ],
    A01: [ // แพทย์วิสัญญี
      { type: 'ot', day: 6, toCode: 'ชot', reason: 'ผ่าตัดฉุกเฉินวันหยุด', status: 'approved' },
      { type: 'shift_change', day: 18, fromCode: 'บ', toCode: 'ช', reason: 'แลกเวรกับเพื่อนร่วมทีม', status: 'pending' },
    ],
    ER: [ // แพทย์ฉุกเฉิน
      { type: 'ot', day: 10, toCode: 'ดot', reason: 'อยู่เวรดึกเสริมช่วงเทศกาล', status: 'pending' },
      { type: 'leave', day: 20, reason: 'ลาพักผ่อนประจำปี', status: 'approved' },
    ],
    M01: [
      { type: 'ot', day: 13, toCode: 'ชot', reason: 'ดูแลผู้ป่วยในวันหยุด', status: 'pending' },
      { type: 'leave', day: 25, reason: 'ลากิจ', status: 'pending' },
    ],
    U01: [ // สายสนับสนุน (การเงิน)
      { type: 'ot', day: 3, toCode: 'BD', reason: 'ประจำจุดเก็บเงินนอกเวลา', status: 'approved' },
      { type: 'ot', day: 17, toCode: 'BD', reason: 'ปิดงบสิ้นเดือน', status: 'pending' },
    ],
  };
  for (const [code, plan] of Object.entries(reqPlan)) {
    const wid = wardByCode[code];
    if (!wid) continue;
    const existing = await db.select({ n: sql<number>`count(*)` }).from(schema.requests).where(eq(schema.requests.wardId, wid));
    if (Number(existing[0].n) > 0) continue;
    const emps = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, wid)).limit(4);
    if (emps.length === 0) continue;
    await db.insert(schema.requests).values(plan.map((p, i) => ({
      type: p.type, employeeId: emps[i % emps.length].id, wardId: wid, year: 2569, month: 7,
      day: p.day, toDay: p.toDay ?? null, fromCode: p.fromCode ?? null, toCode: p.toCode ?? null, reason: p.reason, status: p.status,
    })));
  }

  console.log('Seed complete. Wards:', wardRows.length, '| Positions:', posRows.length);
}

// CLI: `tsx src/seed.ts` runs migrations then seeds.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/seed.ts')) {
  runMigrations()
    .then(seed)
    .then(() => { console.log('Done. Logins (pw Sati@1234): admin@sati.local, finance@sati.local, head.u01@sati.local, staff.u01@sati.local'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
