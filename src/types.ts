export type Role = 'doctor' | 'nurse' | 'assistant' | 'room';

/** Reimbursement line — determines the OT memo template & หน่วยเบิก (doc number). */
export type StaffLine = 'แพทย์' | 'พยาบาล' | 'สนับสนุน';

export type EmployeeType =
  | 'ข้าราชการ'
  | 'พนักงานราชการ'
  | 'ลูกจ้างประจำ'
  | 'ลูกจ้างชั่วคราว (รายวัน)'
  | 'ลูกจ้างชั่วคราว (รายคาบ)'
  | 'พนักงานกระทรวง';

export type PaymentType = 'รายเดือน' | 'รายวัน' | 'รายคาบ';

export interface Personnel {
  id: string;
  name: string;
  role: Role;
  position: string;
  active: boolean;
  order: number;
  employeeType?: EmployeeType;
  paymentType?: PaymentType;
  baseWage?: number; // Base wage per day / period / month
  customRates?: Record<string, number>; // shiftCode -> rate (overrides default role rate)
  /** Reimbursement line (สายงาน) — defaults from role if unset. */
  line?: StaffLine;
  /** หน่วยเบิก / เลขที่หนังสือ prefix — defaults from line if unset. */
  unit?: string;
}

export interface ShiftType {
  code: string;
  name: string;
  hours: number;
  bgClass: string;
  textClass: string;
  startHour: number; // e.g. 8.00 (08:00)
  endHour: number;   // e.g. 16.00 (16:00)
  /**
   * True when this shift is an out-of-hours / holiday shift that is directly
   * reimbursable as OT (e.g. ชot, บot, ดot, BD in the hospital forms).
   * When a person has any isOT shifts, OT payable is the sum of those shifts
   * (matching the government "หลักฐานการจ่ายเงิน" evidence forms) instead of
   * the threshold-based heuristic.
   */
  isOT?: boolean;
}

export interface OTSettings {
  threshold: number; // monthly shift threshold before counting as OT (or standard rate counts as OT)
  rates: Record<Role, Record<string, number>>; // role -> shiftCode -> rate (THB)
}

export interface PolicySettings {
  allowAfternoonToNight: boolean; // allow afternoon then night next day
  banNightAfterOff: boolean; // prevent night shift right after day off
  maxHoursPerWeek: number; // max working hours per week (standard 48)
  requireMinStaff: boolean; // validate minimum staffing coverage
}

export interface DailyCoverage {
  doctor: { ch: number; ba: number; du: number };
  nurse: { ch: number; ba: number; du: number };
  assistant: { ch: number; ba: number; du: number };
}

export interface Ward {
  id: string;
  name: string;
  building: string;
  phone: string;
}

export interface ChangeLog {
  id: string;
  timestamp: string;
  wardId: string;
  wardName: string;
  personnelId: string;
  personnelName: string;
  day: number;
  oldShift: string | null;
  newShift: string | null;
  note: string;
}

