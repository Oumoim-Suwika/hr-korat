import { Personnel, ShiftType, OTSettings, PolicySettings, DailyCoverage, Role, StaffLine } from './types';

/**
 * หน่วยเบิก (reimbursement unit) per line — the เลขที่หนังสือ prefix and OT memo template.
 * Derived from the toSATI form templates:
 *   - สายการพยาบาล → นม 0033.103/   (กลุ่มภารกิจด้านการพยาบาล)
 *   - สายแพทย์/สนับสนุน → นม 0033.101.3/
 */
export const REIMBURSEMENT_UNITS: Record<StaffLine, { prefix: string; label: string; timeText: string }> = {
  'แพทย์': {
    prefix: 'นม 0033.101.3/',
    label: 'สายแพทย์',
    timeText: 'เวลา 24.00-08.00 น. / 08.00-16.00 น. / 16.00-24.00 น.',
  },
  'พยาบาล': {
    prefix: 'นม 0033.103/',
    label: 'สายการพยาบาล',
    timeText: 'เวลา 24.00-08.00 น. / 08.00-16.00 น. / 16.00-24.00 น.',
  },
  'สนับสนุน': {
    prefix: 'นม 0033.101.3/',
    label: 'สายงานสนับสนุน',
    timeText: 'เวลา 16.00-20.00 น. (วันทำการ) และ 08.00-16.00 น. (วันหยุดราชการ)',
  },
};

export const STAFF_LINES: StaffLine[] = ['แพทย์', 'พยาบาล', 'สนับสนุน'];

/** Default reimbursement line inferred from the clinical role. */
export function lineForRole(role: Role): StaffLine {
  if (role === 'doctor') return 'แพทย์';
  if (role === 'nurse' || role === 'assistant') return 'พยาบาล';
  return 'สนับสนุน';
}

/** Effective line for a person (explicit override or role default). */
export function personLine(p: Personnel): StaffLine {
  return p.line || lineForRole(p.role);
}

/** Effective หน่วยเบิก prefix for a person. */
export function personUnitPrefix(p: Personnel): string {
  return p.unit || REIMBURSEMENT_UNITS[personLine(p)].prefix;
}

export const DEFAULT_PERSONNEL: Personnel[] = [
  // Doctors
  { id: 'DOC001', name: 'นพ.สมศักดิ์ รักรักษา', role: 'doctor', position: 'ศัลยแพทย์กระดูกและข้อ (Orthopedics)', active: true, order: 1 },
  { id: 'DOC002', name: 'นพ.วิชัย สิริประเสริฐ', role: 'doctor', position: 'ศัลยแพทย์หัวใจและทรวงอก (CVT)', active: true, order: 2 },
  { id: 'DOC003', name: 'พญ.สิรินทร์ แก้วดี', role: 'doctor', position: 'วิสัญญีแพทย์ (Anesthesiologist)', active: true, order: 3 },
  { id: 'DOC004', name: 'พญ.กานดา มีสุข', role: 'doctor', position: 'กุมารศัลยแพทย์ (Pediatric Surgery)', active: true, order: 4 },
  
  // Nurses
  { id: 'RN001', name: 'นางสมหญิง พยาบาลดี', role: 'nurse', position: 'พยาบาลวิชาชีพชำนาญการพิเศษ (OR Head)', active: true, order: 5 },
  { id: 'RN002', name: 'นางสาวมาลี ใจดีงาม', role: 'nurse', position: 'พยาบาลวิชาชีพชำนาญการ (Scrub Nurse)', active: true, order: 6 },
  { id: 'RN003', name: 'นางสาวจันทร์ พริ้งเพรา', role: 'nurse', position: 'พยาบาลวิชาชีพชำนาญการ (Scrub Nurse)', active: true, order: 7 },
  { id: 'RN004', name: 'นางสาวอัญชลี สดใส', role: 'nurse', position: 'พยาบาลวิชาชีพปฏิบัติการ (Circulate)', active: true, order: 8 },
  { id: 'RN005', name: 'นางสาวปิยะดา ทองดี', role: 'nurse', position: 'พยาบาลวิชาชีพปฏิบัติการ (Circulate)', active: true, order: 9 },
  
  // Assistants
  { id: 'PN001', name: 'นายรักงาน ขยันยิ่ง', role: 'assistant', position: 'ผู้ช่วยพยาบาล (PN)', active: true, order: 10 },
  { id: 'PN002', name: 'นางสาวรัตนา สุขใจ', role: 'assistant', position: 'ผู้ช่วยพยาบาล (PN)', active: true, order: 11 },
  { id: 'NA001', name: 'นางสาวสุพรรณ ดีมาก', role: 'assistant', position: 'พนักงานช่วยเหลือคนไข้ (NA)', active: true, order: 12 },
  
  // Operating Rooms
  { id: 'OR001', name: 'ห้องผ่าตัด OR 1 (Major)', role: 'room', position: 'ห้องผ่าตัดเคสใหญ่/ส่องกล้อง', active: true, order: 13 },
  { id: 'OR002', name: 'ห้องผ่าตัด OR 2 (General)', role: 'room', position: 'ห้องผ่าตัดทั่วไป/กระดูก', active: true, order: 14 },
  { id: 'OR003', name: 'ห้องผ่าตัด OR 3 (Emergency)', role: 'room', position: 'ห้องผ่าตัดฉุกเฉิน 24 ชม.', active: true, order: 15 },
];

export const SHIFT_TYPES: ShiftType[] = [
  // Regular in-hours duty (not reimbursed as OT)
  { code: 'ช', name: 'เวรเช้า (08:00 - 16:00)', hours: 8, bgClass: 'bg-amber-100', textClass: 'text-amber-800', startHour: 8.0, endHour: 16.0 },
  { code: 'บ', name: 'เวรบ่าย (16:00 - 24:00)', hours: 8, bgClass: 'bg-sky-100', textClass: 'text-sky-800', startHour: 16.0, endHour: 24.0 },
  { code: 'ด', name: 'เวรดึก (00:00 - 08:00)', hours: 8, bgClass: 'bg-indigo-100', textClass: 'text-indigo-800', startHour: 0.0, endHour: 8.0 },
  // Out-of-hours / holiday shifts that are directly reimbursable as OT
  // (mirror the codes used in the toSATI hospital schedule forms: ชot / บot / ดot / BD)
  { code: 'ชot', name: 'เวรเช้า OT/วันหยุด (08:00 - 16:00)', hours: 8, bgClass: 'bg-amber-200', textClass: 'text-amber-900', startHour: 8.0, endHour: 16.0, isOT: true },
  { code: 'บot', name: 'เวรบ่าย OT (16:00 - 24:00)', hours: 8, bgClass: 'bg-sky-200', textClass: 'text-sky-900', startHour: 16.0, endHour: 24.0, isOT: true },
  { code: 'ดot', name: 'เวรดึก OT (00:00 - 08:00)', hours: 8, bgClass: 'bg-indigo-200', textClass: 'text-indigo-900', startHour: 0.0, endHour: 8.0, isOT: true },
  { code: 'BD', name: 'เวรเสริมบ่ายดึก (16:30 - 20:30)', hours: 4, bgClass: 'bg-rose-100', textClass: 'text-rose-800', startHour: 16.5, endHour: 20.5, isOT: true },
  { code: 'OR', name: 'เวรผ่าตัด/สแตนด์บาย (On-Call)', hours: 8, bgClass: 'bg-emerald-100', textClass: 'text-emerald-800', startHour: 8.0, endHour: 16.0, isOT: true },
  // Non-working
  { code: 'O', name: 'วันหยุดพักผ่อน (OFF)', hours: 0, bgClass: 'bg-slate-100', textClass: 'text-slate-600', startHour: 0.0, endHour: 0.0 },
  { code: 'V', name: 'ลาพักร้อน (Vacation)', hours: 0, bgClass: 'bg-green-100', textClass: 'text-green-800', startHour: 0.0, endHour: 0.0 },
  { code: 'T', name: 'ลาประชุม/อบรม (Training)', hours: 0, bgClass: 'bg-fuchsia-100', textClass: 'text-fuchsia-800', startHour: 0.0, endHour: 0.0 },
];

/**
 * Codes considered OT/reimbursable, derived from SHIFT_TYPES (single source of truth).
 */
export const OT_SHIFT_CODES: string[] = SHIFT_TYPES.filter(s => s.isOT).map(s => s.code);

/**
 * Normalize a raw shift code coming from imports / legacy data to a canonical code.
 * Handles Thai "ออฟ" (off), case for latin codes, and OT suffix variants.
 */
export function normalizeShiftCode(raw: string): string | null {
  if (!raw) return null;
  let code = raw.trim();
  if (code === '' || code === '·' || code === '-') return null;

  const lower = code.toLowerCase();
  // Off / vacation / training aliases
  if (['ออฟ', 'off', 'x', 'หยุด'].includes(lower)) return 'O';
  if (['v', 'vac', 'ลา', 'ลาพักร้อน', 'พักร้อน'].includes(lower)) return 'V';
  if (['t', 'training', 'อบรม', 'ประชุม'].includes(lower)) return 'T';

  // Latin codes are case-insensitive
  if (lower === 'or') return 'OR';
  if (lower === 'bd') return 'BD';

  // OT suffix variants: "ช ot", "ชot", "ชโอที" -> ชot
  const otMatch = code.replace(/\s+/g, '').match(/^(ช|บ|ด)(ot|โอที)$/i);
  if (otMatch) return `${otMatch[1]}ot`;

  // Plain thai duty codes
  if (['ช', 'บ', 'ด', 'O', 'V', 'T'].includes(code)) return code;
  if (['ชot', 'บot', 'ดot'].includes(code)) return code;

  // Fall back: return as-is so unknown-but-valid custom codes still import
  return code;
}

export const DEFAULT_OT_SETTINGS: OTSettings = {
  threshold: 15, // เกณฑ์มาตรฐาน 15 เวรต่อเดือน (เกินจากนี้คิดเป็นโอที หรือนับทั้งหมดขึ้นกับราคาจ้าง)
  rates: {
    // Base ช/บ/ด rates apply when OT is inferred from the threshold heuristic.
    // The explicit OT codes (ชot/บot/ดot/BD) are what the hospital forms reimburse.
    doctor: {
      'ช': 1200, 'บ': 1500, 'ด': 1800,
      'ชot': 1200, 'บot': 1500, 'ดot': 1800,
      'OR': 2000, 'BD': 800,
      'O': 0, 'V': 0, 'T': 0
    },
    nurse: {
      'ช': 600, 'บ': 700, 'ด': 800,
      'ชot': 720, 'บot': 720, 'ดot': 720, // ref: อัตราเบิกพยาบาล 720/เวร
      'OR': 900, 'BD': 400,
      'O': 0, 'V': 0, 'T': 0
    },
    assistant: {
      'ช': 350, 'บ': 400, 'ด': 450,
      'ชot': 430, 'บot': 430, 'ดot': 430, // ref: อัตราเบิกผู้ช่วยพยาบาล 430/เวร
      'OR': 500, 'BD': 200,
      'O': 0, 'V': 0, 'T': 0
    },
    room: {
      'ช': 1000, 'บ': 1200, 'ด': 1500,
      'ชot': 1000, 'บot': 1200, 'ดot': 1500,
      'OR': 1800, 'BD': 600,
      'O': 0, 'V': 0, 'T': 0
    }
  }
};

export const DEFAULT_POLICIES: PolicySettings = {
  allowAfternoonToNight: false, // ห้ามเวร บ ต่อ ด ลำดับถัดไปทันทีเพื่อความปลอดภัยของคนไข้
  banNightAfterOff: true,       // ไม่ควรขึ้นเวรดึกทันทีหลังวันหยุด (ควรเริ่มด้วย เช้า/บ่าย)
  maxHoursPerWeek: 48,          // ไม่ทำงานเกิน 48 ชม./สัปดาห์
  requireMinStaff: true,        // บังคับอัตรากำลังขั้นต่ำตามเวร
};

export const DEFAULT_COVERAGE: DailyCoverage = {
  doctor: { ch: 1, ba: 1, du: 1 },
  nurse: { ch: 2, ba: 1, du: 1 },
  assistant: { ch: 1, ba: 1, du: 1 },
};

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const THAI_DAYS_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/** English names for the official 2569 (2026) holidays (for the bilingual list). */
export const HOLIDAY_EN_2026: Record<string, string> = {
  '01-01': "New Year's Day",
  '03-03': 'Makha Bucha Day',
  '04-06': 'Chakri Memorial Day',
  '04-13': 'Songkran Festival',
  '04-14': 'Songkran Festival',
  '04-15': 'Songkran Festival',
  '05-01': 'National Labour Day',
  '05-04': 'Coronation Day',
  '05-31': 'Visakha Bucha Day',
  '06-01': 'Substitution for Visakha Bucha Day',
  '06-03': "H.M. Queen Suthida's Birthday",
  '07-28': "H.M. King Vajiralongkorn's Birthday",
  '07-29': 'Asarnha Bucha Day',
  '07-30': 'Beginning of Vassa (Khao Phansa)',
  '08-12': "Mother's Day (H.M. Queen Sirikit's Birthday)",
  '10-13': 'King Bhumibol Memorial Day',
  '10-23': 'Chulalongkorn Day',
  '12-05': "National Day / Father's Day",
  '12-07': 'Substitution for National Day',
  '12-10': 'Constitution Day',
  '12-31': "New Year's Eve",
};

export const THAI_HOLIDAYS_2026: Record<string, string> = {
  '01-01': 'วันขึ้นปีใหม่',
  '03-03': 'วันมาฆบูชา',
  '04-06': 'วันจักรี',
  '04-13': 'วันสงกรานต์',
  '04-14': 'วันสงกรานต์',
  '04-15': 'วันสงกรานต์',
  '05-01': 'วันแรงงานแห่งชาติ',
  '05-04': 'วันฉัตรมงคล',
  '05-31': 'วันวิสาขบูชา',
  '06-01': 'ชดเชยวันวิสาขบูชา',
  '06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
  '07-28': 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว (ร.10)',
  '07-29': 'วันอาสาฬหบูชา',
  '07-30': 'วันเข้าพรรษา',
  '08-12': 'วันแม่แห่งชาติ',
  '10-13': 'วันนวมินทรมหาราช (คล้ายวันสวรรคต ร.9)',
  '10-23': 'วันปิยมหาราช',
  '12-05': 'วันชาติ / วันพ่อแห่งชาติ (คล้ายวันพระบรมราชสมภพ ร.9)',
  '12-07': 'ชดเชยวันชาติ / วันพ่อแห่งชาติ',
  '12-10': 'วันรัฐธรรมนูญ',
  '12-31': 'วันสิ้นปี'
};
