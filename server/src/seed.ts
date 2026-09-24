/**
 * Seed baseline data for local dev / demo.
 * Idempotent: safe to run multiple times.
 *
 * Test logins (all password: Sati@1234):
 *   admin@sati.local      -> admin
 *   finance@sati.local    -> finance
 *   head.u01@sati.local   -> supervisor (ward U01 การเงิน)
 *   head.icu / head.er / head.a01 / head.m01 / head.or / head.gs @sati.local
 *                         -> supervisor (per ward)
 *   staff.u01@sati.local  -> staff      (ward U01)
 *   staff.icu@sati.local  -> staff      (ward ICU)
 */
import { db, schema, runMigrations } from './db/index.js';
import { hashPassword } from './auth.js';
import { eq, and, sql, isNull } from 'drizzle-orm';

const PASSWORD = 'Sati@1234';

const WARDS = [
  { code: 'U01', name: 'กลุ่มงานการเงิน (U01)', building: 'ตึกการเงิน/อำนวยการ', phone: '32077' },
  { code: 'A01', name: 'กลุ่มงานวิสัญญีวิทยา (A01)', building: 'ตึกศัลยกรรม', phone: '32078' },
  { code: 'M01', name: 'กลุ่มงานอายุรกรรม (M01)', building: 'ตึกอายุรกรรม', phone: '35870' },
  { code: 'ICU', name: 'หอผู้ป่วยวิกฤต (ICU)', building: 'ตึกวิกฤตบำบัด', phone: '31415' },
  { code: 'ER', name: 'แผนกฉุกเฉิน (ER)', building: 'ตึกฉุกเฉินอุบัติเหตุ', phone: '39911' },
  { code: 'OR', name: 'กลุ่มงานการพยาบาลผู้ป่วยผ่าตัด (OR)', building: 'อาคารผ่าตัด', phone: '32090' },
  { code: 'GS', name: 'งานบริการกลางและซ่อมบำรุง (GS)', building: 'อาคารบริการกลาง', phone: '32010' },
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
      { prefix: 'นพ.', first: 'ธนา', last: 'อายุรเวช', role: 'doctor', pos: 'อายุรแพทย์', line: 'แพทย์' },
      { prefix: 'นาง', first: 'วราภรณ์', last: 'เมตตา', role: 'nurse', pos: 'พยาบาลวิชาชีพชำนาญการ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'ธิดา', last: 'อ่อนหวาน', role: 'nurse', pos: 'พยาบาลวิชาชีพ', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'กมล', last: 'ศรีสุข', role: 'assistant', pos: 'ผู้ช่วยพยาบาล', line: 'พยาบาล' },
    ],
    OR: [ // ห้องผ่าตัด — หมอ + พยาบาลห้องผ่าตัด + พนักงานห้องผ่าตัด
      { prefix: 'นพ.', first: 'สุรชัย', last: 'ผ่าตัดดี', role: 'doctor', pos: 'ศัลยแพทย์ทั่วไป', line: 'แพทย์' },
      { prefix: 'นาง', first: 'พิมพ์', last: 'สเตอไรล์', role: 'nurse', pos: 'พยาบาลห้องผ่าตัด (Scrub)', line: 'พยาบาล' },
      { prefix: 'นางสาว', first: 'ชญา', last: 'เซอร์คูเลต', role: 'nurse', pos: 'พยาบาลห้องผ่าตัด (Circulate)', line: 'พยาบาล' },
      { prefix: 'นาย', first: 'ทวี', last: 'ยกเปล', role: 'room', pos: 'พนักงานประจำห้องผ่าตัด', line: 'สนับสนุน' },
    ],
    GS: [ // สายสนับสนุน — คนสวน / ช่าง / ธุรการ / พนักงานออฟฟิศ
      { prefix: 'นาย', first: 'สมพงษ์', last: 'รดน้ำต้นไม้', role: 'support', pos: 'พนักงานดูแลสวน (คนสวน)', line: 'สนับสนุน' },
      { prefix: 'นาย', first: 'ช่างเอก', last: 'ซ่อมได้', role: 'support', pos: 'ช่างเทคนิค/ซ่อมบำรุง', line: 'สนับสนุน' },
      { prefix: 'นางสาว', first: 'ธุรกิจ', last: 'เอกสารดี', role: 'support', pos: 'เจ้าพนักงานธุรการ', line: 'สนับสนุน' },
      { prefix: 'นางสาว', first: 'ออฟฟิศ', last: 'บันทึกข้อมูล', role: 'support', pos: 'พนักงานบันทึกข้อมูล (ออฟฟิศ)', line: 'สนับสนุน' },
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
    OR: [ // ห้องผ่าตัด
      { type: 'ot', day: 8, toCode: 'ชot', reason: 'ผ่าตัดฉุกเฉินวันหยุด (on-call)', status: 'approved' },
      { type: 'ot', day: 21, toCode: 'OR', reason: 'สแตนด์บายห้องผ่าตัด', status: 'pending' },
    ],
    GS: [ // คนสวน/ช่าง/ธุรการ
      { type: 'ot', day: 5, toCode: 'BD', reason: 'ดูแลระบบสาธารณูปโภคนอกเวลา (ช่าง)', status: 'approved' },
      { type: 'ot', day: 14, toCode: 'ชot', reason: 'จัดสถานที่งานพิธีวันหยุด (คนสวน)', status: 'pending' },
      { type: 'leave', day: 26, reason: 'ลากิจ (ธุรการ)', status: 'pending' },
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

  // ==========================================================================
  // BACKFILLS — make mock data complete for every page & role (idempotent).
  // These run even when the core blocks above were already seeded, patching
  // data that was missing (e.g. employees added after their roster existed).
  // ==========================================================================

  // (A) Ensure EVERY ward employee has roster cells. Daily-wage staff in U01
  //     were inserted after the U01 roster was built, so their เบิกรายวัน form
  //     showed 0 วัน/0 บาท. Backfill weekday ช / weekend ออฟ for anyone missing.
  const allRostersBf = await db.select().from(schema.rosters);
  for (const r of allRostersBf) {
    const wardEmps = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, r.wardId));
    if (wardEmps.length === 0) continue;
    const cellRows = await db.select({ employeeId: schema.rosterCells.employeeId }).from(schema.rosterCells).where(eq(schema.rosterCells.rosterId, r.id));
    const have = new Set(cellRows.map((c: any) => c.employeeId));
    const missing = wardEmps.filter((e: any) => !have.has(e.id));
    if (missing.length === 0) continue;
    const dim = new Date(r.year - 543, r.month, 0).getDate();
    const cells: any[] = [];
    for (const emp of missing) {
      for (let d = 1; d <= dim; d++) {
        const wd = new Date(r.year - 543, r.month - 1, d).getDay();
        const weekend = wd === 0 || wd === 6;
        cells.push({ rosterId: r.id, employeeId: emp.id, day: d, normalCode: weekend ? 'ออฟ' : 'ช', otCode: null });
      }
    }
    if (cells.length) await db.insert(schema.rosterCells).values(cells);
  }

  // (B) Staffing requirement for wards that have none (U01, GS) so the
  //     "ความต้องการพนักงาน" page is populated for every ward.
  for (const code of ['U01', 'GS']) {
    const wid = wardByCode[code];
    if (!wid) continue;
    const n = await db.select({ n: sql<number>`count(*)` }).from(schema.staffingRequirements).where(eq(schema.staffingRequirements.wardId, wid));
    if (Number(n[0].n) > 0) continue;
    await db.insert(schema.staffingRequirements).values([
      { wardId: wid, level: 'พยาบาลวิชาชีพ (RN)', shiftCode: 'ช', count: 2 },
      { wardId: wid, level: 'พยาบาลวิชาชีพ (RN)', shiftCode: 'บ', count: 1 },
      { wardId: wid, level: 'ผู้ช่วยพยาบาล (PN)', shiftCode: 'ช', count: 1 },
    ]);
  }

  // (C) U01 (default finance ward) should also have leave & shift_change so the
  //     คำขอลา / คำขอแลกเวร pages show data for supervisor & staff. Assigned to
  //     firstEmpId so the staff.u01 login (scoped to own requests) sees them.
  if (u01b && firstEmpId) {
    const u01types = await db.select({ type: schema.requests.type }).from(schema.requests).where(eq(schema.requests.wardId, u01b));
    const have = new Set(u01types.map((r: any) => r.type));
    const add: any[] = [];
    if (!have.has('leave')) add.push({ type: 'leave', employeeId: firstEmpId, wardId: u01b, year: 2569, month: 7, day: 23, toDay: 24, reason: 'ลากิจส่วนตัว 2 วัน', status: 'approved' });
    if (!have.has('shift_change')) add.push({ type: 'shift_change', employeeId: firstEmpId, wardId: u01b, year: 2569, month: 7, day: 15, fromCode: 'ช', toCode: 'บ', reason: 'ขอสลับเป็นเวรบ่ายเพื่อเข้าประชุม', status: 'pending' });
    if (add.length) await db.insert(schema.requests).values(add);
  }

  // (D) Seed a few audit-log entries so the "บันทึกการตรวจสอบ" page (finance/admin)
  //     shows data before any live action is taken.
  const auditN = await db.select({ n: sql<number>`count(*)` }).from(schema.auditLogs);
  if (Number(auditN[0].n) === 0) {
    const adminU = await db.select().from(schema.users).where(eq(schema.users.email, 'admin@sati.local'));
    const finU = await db.select().from(schema.users).where(eq(schema.users.email, 'finance@sati.local'));
    const supU = await db.select().from(schema.users).where(eq(schema.users.email, 'head.u01@sati.local'));
    const aId = adminU[0]?.id ?? null, fId = finU[0]?.id ?? null, sId = supU[0]?.id ?? null;
    const anyRoster = await db.select().from(schema.rosters).limit(1);
    const rId = anyRoster[0]?.id ? String(anyRoster[0].id) : null;
    await db.insert(schema.auditLogs).values([
      { actorUserId: aId, entity: 'auth', entityId: null, action: 'login', detail: { email: 'admin@sati.local' } },
      { actorUserId: sId, entity: 'working_calendar', entityId: rId, action: 'lock', detail: { wardId: wardByCode['U01'], workingDays: 22 } },
      { actorUserId: sId, entity: 'roster', entityId: rId, action: 'submit', detail: { year: 2569, month: 7 } },
      { actorUserId: fId, entity: 'roster', entityId: rId, action: 'approve', detail: { year: 2569, month: 7 } },
      { actorUserId: fId, entity: 'request', entityId: null, action: 'decide', detail: { decision: 'approved', type: 'ot' } },
    ]);
  }

  // ==========================================================================
  // DEMO ENRICHMENT — multi-month data, per-ward logins, seniority, full
  // staffing, external staff, and full request status/type coverage.
  // All idempotent (guarded), so safe to re-run on every cold start.
  // ==========================================================================

  // (E) Per-ward supervisor logins + an extra nursing-staff login (all pw Sati@1234).
  const wardHeads = [
    { email: 'head.icu@sati.local', name: 'หัวหน้าหอผู้ป่วยวิกฤต (ICU)', code: 'ICU' },
    { email: 'head.er@sati.local', name: 'หัวหน้าแผนกฉุกเฉิน (ER)', code: 'ER' },
    { email: 'head.a01@sati.local', name: 'หัวหน้ากลุ่มงานวิสัญญี (A01)', code: 'A01' },
    { email: 'head.m01@sati.local', name: 'หัวหน้ากลุ่มงานอายุรกรรม (M01)', code: 'M01' },
    { email: 'head.or@sati.local', name: 'หัวหน้าห้องผ่าตัด (OR)', code: 'OR' },
    { email: 'head.gs@sati.local', name: 'หัวหน้างานบริการกลาง (GS)', code: 'GS' },
  ];
  for (const h of wardHeads) {
    const wid = wardByCode[h.code];
    if (!wid) continue;
    const firstEmp = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, wid)).limit(1);
    await db.insert(schema.users).values({
      email: h.email, displayName: h.name, role: 'supervisor', wardId: wid,
      employeeId: firstEmp[0]?.id ?? null, passwordHash: hash,
    }).onConflictDoNothing({ target: schema.users.email });
  }
  {
    const icu = wardByCode['ICU'];
    if (icu) {
      const icuEmps = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, icu)).limit(3);
      const staffEmp = icuEmps[icuEmps.length - 1];
      if (staffEmp) await db.insert(schema.users).values({
        email: 'staff.icu@sati.local', displayName: 'พยาบาลประจำ ICU', role: 'staff', wardId: icu,
        employeeId: staffEmp.id, passwordHash: hash,
      }).onConflictDoNothing({ target: schema.users.email });
    }
  }

  // (F) Seniority + employee code backfill — drives AI senior detection & อายุงาน.
  const noStart = await db.select().from(schema.employees).where(isNull(schema.employees.startDate));
  for (const e of noStart) {
    const senior = /ชำนาญการ|หัวหน้า|อาวุโส/.test(e.positionText ?? '');
    const yearsAgo = senior ? 9 : 1 + (e.id % 6);
    const d = new Date(); d.setFullYear(d.getFullYear() - yearsAgo);
    await db.update(schema.employees)
      .set({ startDate: d.toISOString().slice(0, 10), employeeCode: e.employeeCode ?? `EMP-${String(e.id).padStart(4, '0')}` })
      .where(eq(schema.employees.id, e.id));
  }

  // (G) Full 4-level staffing matrix for clinical wards.
  const LEVELS_FULL = [
    { level: 'หัวหน้าเวร', ch: 1, ba: 1, du: 1 },
    { level: 'พยาบาลวิชาชีพ (RN)', ch: 2, ba: 2, du: 1 },
    { level: 'ผู้ช่วยพยาบาล (PN)', ch: 1, ba: 1, du: 1 },
    { level: 'พนักงานช่วยเหลือ (NA)', ch: 1, ba: 1, du: 0 },
  ];
  for (const code of ['ICU', 'ER', 'A01', 'M01', 'OR']) {
    const wid = wardByCode[code];
    if (!wid) continue;
    const existing = await db.select().from(schema.staffingRequirements).where(eq(schema.staffingRequirements.wardId, wid));
    const combo = new Set(existing.map((s: any) => `${s.level}|${s.shiftCode}`));
    const toAdd: any[] = [];
    for (const lv of LEVELS_FULL) {
      for (const [sc, cnt] of [['ช', lv.ch], ['บ', lv.ba], ['ด', lv.du]] as [string, number][]) {
        if (!combo.has(`${lv.level}|${sc}`)) toAdd.push({ wardId: wid, level: lv.level, shiftCode: sc, count: cnt });
      }
    }
    if (toAdd.length) await db.insert(schema.staffingRequirements).values(toAdd);
  }

  // (H) Multi-month rosters: June = closed (approved + finance-locked),
  //     August = pipeline (pending_approval, calendar locked) — except GS which
  //     stays draft + unlocked to demonstrate the "lock before OT" rule.
  const rotDemo = ['ช', 'บ', 'ด', 'ออฟ', 'ช', 'บ', 'ออฟ'];
  const otMapDemo: Record<number, string> = { 4: 'BD', 6: 'ชot', 11: 'BD', 13: 'ชot', 18: 'BD', 20: 'ชot', 25: 'BD' };
  const genMonth = async (wid: number, y: number, m: number, status: 'draft' | 'pending_approval' | 'approved', financeLocked: boolean, calLocked: boolean) => {
    const exists = await db.select().from(schema.rosters).where(and(eq(schema.rosters.wardId, wid), eq(schema.rosters.year, y), eq(schema.rosters.month, m)));
    if (exists.length) return;
    const emps = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, wid));
    if (emps.length === 0) return;
    const rows = await db.insert(schema.rosters).values({
      wardId: wid, year: y, month: m, status, financeLocked,
      note: 'ปฏิบัติงานตามตารางเวรที่ได้รับอนุมัติ', approvedAt: status === 'approved' ? new Date() : null,
    }).onConflictDoNothing({ target: [schema.rosters.wardId, schema.rosters.year, schema.rosters.month] }).returning();
    const rid = rows[0]?.id;
    if (!rid) return;
    const ce = y - 543;
    const dim = new Date(ce, m, 0).getDate();
    const cells: any[] = [];
    emps.forEach((e: any, idx: number) => {
      for (let d = 1; d <= dim; d++) {
        const normalCode = rotDemo[(d + idx) % rotDemo.length];
        const otCode = (idx % 2 === 0 && calLocked && otMapDemo[d]) ? otMapDemo[d] : null;
        cells.push({ rosterId: rid, employeeId: e.id, day: d, normalCode, otCode });
      }
    });
    await db.insert(schema.rosterCells).values(cells);
    await db.insert(schema.rosterSigners).values([
      { rosterId: rid, ordinal: 1, name: 'หัวหน้าหน่วยงาน', title: 'หัวหน้าผู้ควบคุม', signerRole: 'controller' },
      { rosterId: rid, ordinal: 2, name: 'นางนฤมล  ศรีสรรพ์', title: 'รองผู้อำนวยการฝ่ายการพยาบาล', signerRole: 'approver' },
    ]);
    await db.insert(schema.workingCalendars)
      .values({ wardId: wid, year: y, month: m, workingDays: 21, locked: calLocked, lockedAt: calLocked ? new Date() : null })
      .onConflictDoNothing({ target: [schema.workingCalendars.wardId, schema.workingCalendars.year, schema.workingCalendars.month] });
  };
  for (const code of ['U01', 'A01', 'M01', 'ICU', 'ER', 'OR', 'GS']) {
    const wid = wardByCode[code];
    if (!wid) continue;
    await genMonth(wid, 2569, 6, 'approved', true, true);
    if (code === 'GS') await genMonth(wid, 2569, 8, 'draft', false, false);
    else await genMonth(wid, 2569, 8, 'pending_approval', false, true);
  }

  // (I) External staff (คนนอกหน่วย) — an M01 nurse helps ICU on OT days (OT-only).
  const icuId = wardByCode['ICU'], m01Id = wardByCode['M01'];
  if (icuId && m01Id) {
    const icuRoster = await db.select().from(schema.rosters).where(and(eq(schema.rosters.wardId, icuId), eq(schema.rosters.year, 2569), eq(schema.rosters.month, 7)));
    if (icuRoster.length) {
      const rid = icuRoster[0].id;
      const hasExt = await db.select({ n: sql<number>`count(*)` }).from(schema.rosterCells).where(and(eq(schema.rosterCells.rosterId, rid), eq(schema.rosterCells.external, true)));
      if (Number(hasExt[0].n) === 0) {
        const m01Nurse = await db.select().from(schema.employees).where(and(eq(schema.employees.homeWardId, m01Id), eq(schema.employees.role, 'nurse'))).limit(1);
        if (m01Nurse.length) {
          await db.insert(schema.rosterCells).values(
            [6, 13, 20].map((d) => ({ rosterId: rid, employeeId: m01Nurse[0].id, day: d, normalCode: null, otCode: 'ชot', external: true }))
          );
        }
      }
    }
  }

  // (J) Full request status + type coverage (adds shift_add + cancelled + August).
  {
    const icu = wardByCode['ICU'];
    if (icu) {
      const icuEmps = await db.select().from(schema.employees).where(eq(schema.employees.homeWardId, icu)).limit(4);
      const hasShiftAdd = await db.select({ n: sql<number>`count(*)` }).from(schema.requests).where(and(eq(schema.requests.wardId, icu), eq(schema.requests.type, 'shift_add')));
      if (Number(hasShiftAdd[0].n) === 0 && icuEmps.length) {
        await db.insert(schema.requests).values([
          { type: 'shift_add', employeeId: icuEmps[0].id, wardId: icu, year: 2569, month: 7, day: 9, toCode: 'ช', reason: 'ขอขึ้นเวรเพิ่มช่วงผู้ป่วยหนาแน่น', status: 'approved' },
          { type: 'leave', employeeId: icuEmps[1 % icuEmps.length].id, wardId: icu, year: 2569, month: 7, day: 5, reason: 'ยกเลิกคำขอลา (เปลี่ยนแผน)', status: 'cancelled' },
          { type: 'ot', employeeId: icuEmps[2 % icuEmps.length].id, wardId: icu, year: 2569, month: 8, day: 2, toCode: 'BD', reason: 'เวรบ่ายดึกเดือนถัดไป', status: 'pending' },
          { type: 'shift_change', employeeId: icuEmps[0].id, wardId: icu, year: 2569, month: 8, day: 7, fromCode: 'ด', toCode: 'บ', reason: 'สลับเวรเดือนถัดไป', status: 'pending' },
        ]);
      }
    }
  }

  // (K) De-duplicate rows that lack a DB unique constraint. Concurrent Lambda
  //     cold-starts can both pass a count guard and double-insert; this keeps
  //     the lowest id per natural key and is safe to run repeatedly.
  await db.execute(sql`DELETE FROM staffing_requirements a USING staffing_requirements b
    WHERE a.id > b.id AND a.ward_id = b.ward_id AND a.level = b.level AND a.shift_code = b.shift_code`);
  await db.execute(sql`DELETE FROM roster_signers a USING roster_signers b
    WHERE a.id > b.id AND a.roster_id = b.roster_id AND a.ordinal = b.ordinal`);
  await db.execute(sql`DELETE FROM requests a USING requests b
    WHERE a.id > b.id AND a.ward_id = b.ward_id AND a.type = b.type AND a.employee_id = b.employee_id
      AND COALESCE(a.day,-1) = COALESCE(b.day,-1) AND COALESCE(a.reason,'') = COALESCE(b.reason,'')`);

  console.log('Seed complete. Wards:', wardRows.length, '| Positions:', posRows.length);
}

// CLI: `tsx src/seed.ts` runs migrations then seeds.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/seed.ts')) {
  runMigrations()
    .then(seed)
    .then(() => { console.log('Done. Logins (pw Sati@1234): admin@sati.local, finance@sati.local, head.u01@sati.local, staff.u01@sati.local'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
