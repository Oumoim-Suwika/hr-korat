/**
 * กรอบเวลาแก้ไขข้อมูลของหน่วยงาน (requirement 10.1 / 4.2 / 10.2).
 *
 * เดิมระบบใช้วันที่ตายตัว ("ถึงวันที่ 5") เป็นเพียงข้อความบนหน้าจอ ไม่มีการ
 * บังคับจริง. ตาม requirement ต้องเปลี่ยนเป็น "จำนวนวันทำการ" ที่ปรับได้
 * รายหน่วยงาน (เช่น 1-3 หรือ 3-5 วันทำการ) นับจากวันที่ 1 ของเดือนถัดไป
 * (วันที่การเงินเริ่มประมวลผล) โดยข้ามเสาร์-อาทิตย์และวันหยุดราชการ.
 *
 * ตรรกะทั้งหมดอยู่ที่ server ที่เดียว แล้วส่งผลลัพธ์ให้ frontend ใช้ เพื่อไม่ให้
 * การคำนวณบังคับสิทธิ์ (ฝั่ง server) กับที่แสดงผล/แจ้งเตือน (ฝั่ง client) คลาดกัน.
 */

/** ปีพุทธศักราช -> คริสต์ศักราช */
export const toCE = (beYear: number): number => beYear - 543;

/** เดือนถัดไปของรอบ (รอบ ธ.ค. -> ม.ค. ปีถัดไป) */
export function nextPeriod(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * หาวันทำการลำดับที่ n ของเดือน (1-based) โดยข้ามเสาร์-อาทิตย์และวันหยุด.
 * คืน null ถ้าเดือนนั้นมีวันทำการไม่ถึง n วัน (ผู้เรียกจะ fallback เป็นวันสุดท้าย).
 *
 * @param beYear  ปี พ.ศ.
 * @param month   เดือน 1-12
 * @param n       ลำดับวันทำการที่ต้องการ
 * @param holidayMMDD  เซ็ตของวันหยุดรูปแบบ 'MM-DD' ของปีนั้น
 */
export function nthWorkingDay(beYear: number, month: number, n: number, holidayMMDD: Set<string>): number | null {
  if (n <= 0) return null;
  const ce = toCE(beYear);
  const daysInMonth = new Date(ce, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(ce, month - 1, day).getDay();
    if (dow === 0 || dow === 6) continue;                               // เสาร์-อาทิตย์
    const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (holidayMMDD.has(key)) continue;                                  // วันหยุดราชการ
    count++;
    if (count === n) return day;
  }
  return null;
}

/** นับจำนวนวันทำการระหว่างสองวันของเดือนเดียวกัน (รวมปลายทาง) */
export function workingDaysBetween(beYear: number, month: number, fromDay: number, toDay: number, holidayMMDD: Set<string>): number {
  if (toDay < fromDay) return 0;
  const ce = toCE(beYear);
  let count = 0;
  for (let day = fromDay; day <= toDay; day++) {
    const dow = new Date(ce, month - 1, day).getDay();
    if (dow === 0 || dow === 6) continue;
    const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (holidayMMDD.has(key)) continue;
    count++;
  }
  return count;
}

export type EditWindowState = 'before' | 'open' | 'due_soon' | 'closed';

export interface EditWindowInfo {
  wardId: number;
  wardName: string;
  /** รอบข้อมูลที่กรอบเวลานี้คุม */
  year: number;
  month: number;
  /** จำนวนวันทำการที่ตั้งไว้สำหรับหน่วยนี้ */
  editWindowDays: number;
  /** แจ้งเตือนล่วงหน้ากี่วันทำการ */
  alertLeadDays: number;
  /** บังคับตัดสิทธิ์แก้ไขจริงหรือไม่ */
  enforced: boolean;
  /** เดือนที่ใช้แก้ไข (เดือนถัดไปของรอบ) */
  windowYear: number;
  windowMonth: number;
  /** วันสุดท้ายที่แก้ไขได้ (วันที่ของ windowMonth) */
  deadlineDay: number;
  /** วันสุดท้ายในรูป ISO (ค.ศ.) เพื่อให้ frontend จัดรูปแบบได้ */
  deadlineISO: string;
  /** วันทำการที่เหลือจนถึงกำหนด (0 = วันนี้วันสุดท้าย, ติดลบ = เลยกำหนด) */
  workingDaysLeft: number;
  state: EditWindowState;
  /** ข้อความสรุปพร้อมแสดงผล */
  message: string;
}

/**
 * ประเมินสถานะกรอบเวลาแก้ไขของหน่วยงานหนึ่ง เทียบกับ "วันนี้".
 *
 * @param now  วันเวลาปัจจุบัน (ค.ศ.) — รับเข้ามาเพื่อให้ทดสอบได้
 */
export function evaluateEditWindow(args: {
  wardId: number;
  wardName: string;
  year: number;
  month: number;
  editWindowDays: number;
  alertLeadDays: number;
  enforced: boolean;
  holidayMMDD: Set<string>;
  now: Date;
}): EditWindowInfo {
  const { wardId, wardName, year, month, editWindowDays, alertLeadDays, enforced, holidayMMDD, now } = args;
  const win = nextPeriod(year, month);
  const winCE = toCE(win.year);
  const daysInWin = new Date(winCE, win.month, 0).getDate();
  // วันสุดท้ายที่แก้ไขได้ = วันทำการลำดับที่ N ของเดือนถัดไป
  const deadlineDay = nthWorkingDay(win.year, win.month, editWindowDays, holidayMMDD) ?? daysInWin;
  const deadline = new Date(winCE, win.month - 1, deadlineDay);
  const windowStart = new Date(winCE, win.month - 1, 1);

  // เทียบแบบ "วัน" ตัดเวลาออก เพื่อไม่ให้ชั่วโมงทำให้ผลเปลี่ยน
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let state: EditWindowState;
  let workingDaysLeft: number;

  if (today < windowStart) {
    // ยังไม่ถึงรอบแก้ไข (การเงินยังไม่เริ่มประมวลผล)
    state = 'before';
    workingDaysLeft = workingDaysBetween(win.year, win.month, 1, deadlineDay, holidayMMDD);
  } else if (today > deadline) {
    state = 'closed';
    workingDaysLeft = -1;
  } else {
    // อยู่ในกรอบ: นับวันทำการจากวันนี้ถึงกำหนด (รวมวันนี้) แล้วลบ 1
    // เพื่อให้ "0" หมายถึงวันนี้เป็นวันสุดท้าย
    const sameMonth = today.getMonth() === win.month - 1 && today.getFullYear() === winCE;
    const fromDay = sameMonth ? today.getDate() : 1;
    workingDaysLeft = Math.max(0, workingDaysBetween(win.year, win.month, fromDay, deadlineDay, holidayMMDD) - 1);
    state = workingDaysLeft <= alertLeadDays ? 'due_soon' : 'open';
  }

  const periodLabel = `${THAI_MONTHS[month - 1]} ${year}`;
  const deadlineLabel = `${deadlineDay} ${THAI_MONTHS[win.month - 1]} ${win.year}`;
  const message =
    state === 'before' ? `รอบ ${periodLabel} เปิดให้แก้ไข 1 ${THAI_MONTHS[win.month - 1]} — ปิด ${deadlineLabel}`
    : state === 'closed' ? `เลยกำหนดแก้ไขรอบ ${periodLabel} แล้ว (ปิด ${deadlineLabel})`
    : workingDaysLeft === 0 ? `วันนี้เป็นวันสุดท้ายที่แก้ไขรอบ ${periodLabel} ได้ (ปิด ${deadlineLabel})`
    : `เหลือ ${workingDaysLeft} วันทำการ ก่อนปิดแก้ไขรอบ ${periodLabel} (ปิด ${deadlineLabel})`;

  return {
    wardId, wardName, year, month,
    editWindowDays, alertLeadDays, enforced,
    windowYear: win.year, windowMonth: win.month,
    deadlineDay,
    deadlineISO: `${winCE}-${String(win.month).padStart(2, '0')}-${String(deadlineDay).padStart(2, '0')}`,
    workingDaysLeft, state, message,
  };
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
