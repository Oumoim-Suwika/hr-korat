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
import { eq, sql } from 'drizzle-orm';

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

  console.log('Seed complete. Wards:', wardRows.length, '| Positions:', posRows.length);
}

// CLI: `tsx src/seed.ts` runs migrations then seeds.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/seed.ts')) {
  runMigrations()
    .then(seed)
    .then(() => { console.log('Done. Logins (pw Sati@1234): admin@sati.local, finance@sati.local, head.u01@sati.local, staff.u01@sati.local'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
