import { Personnel, OTSettings, ShiftType } from '../types';
import { SHIFT_TYPES } from '../data';

const NON_WORK = new Set(['O', 'V', 'T']);

const OT_CODES = new Set(SHIFT_TYPES.filter(s => s.isOT).map(s => s.code));

/** Map an OT shift code to the base category used on the reimbursement forms. */
export function otBaseCategory(code: string): string {
  if (code === 'ชot') return 'ช';
  if (code === 'บot') return 'บ';
  if (code === 'ดot') return 'ด';
  return code; // BD, OR, or already-base
}

export interface PersonClaim {
  /** counts per raw shift code that appears */
  stats: Record<string, number>;
  /** total worked shifts (excludes O/V/T) */
  totalWorkShifts: number;
  /** every worked shift code, in day order */
  workedShifts: string[];
  /** the shift codes counted as OT (explicit OT codes, or the heuristic overflow) */
  otShiftCodes: string[];
  /** OT counts grouped by base category (ช/บ/ด/BD/OR) — for the evidence form */
  otByCategory: Record<string, number>;
  /** days (1-based) that had an OT shift, with the code */
  otDays: { day: number; code: string }[];
  otCount: number;
  otPayable: number;
  /** value of ALL worked shifts at their rate (reference only) */
  totalValue: number;
  /** daily-wage base earnings (0 for monthly staff) */
  baseEarnings: number;
  /** baseEarnings + otPayable */
  netEarnings: number;
  /** true when the person has explicit OT-tagged shifts (ชot/บot/ดot/BD/OR) */
  hasExplicitOT: boolean;
  paymentMode: string;
  baseWageRate: number;
  employeeType: string;
}

/**
 * Compute a person's OT / wage claim for a month.
 *
 * OT logic mirrors the hospital "หลักฐานการจ่ายเงิน" forms:
 *  - If the schedule uses explicit OT codes (ชot/บot/ดot/BD/OR), OT payable is
 *    the exact sum of those shifts.
 *  - Otherwise it falls back to the threshold heuristic (worked shifts beyond
 *    the standard monthly threshold, valued at the highest rates first).
 */
export function computePersonClaim(
  person: Personnel,
  schedule: Record<string, string>,
  otSettings: OTSettings,
  daysCount: number
): PersonClaim {
  const getRate = (code: string): number => {
    if (person.customRates && person.customRates[code] !== undefined) {
      return person.customRates[code];
    }
    return otSettings.rates[person.role]?.[code] ?? 0;
  };

  const stats: Record<string, number> = {};
  const workedShifts: string[] = [];
  const explicitOtDays: { day: number; code: string }[] = [];
  let totalValue = 0;

  for (let d = 1; d <= daysCount; d++) {
    const code = schedule[`${person.id}-${d}`];
    if (!code) continue;
    stats[code] = (stats[code] || 0) + 1;
    if (!NON_WORK.has(code)) {
      workedShifts.push(code);
      totalValue += getRate(code);
      if (OT_CODES.has(code)) {
        explicitOtDays.push({ day: d, code });
      }
    }
  }

  const totalWorkShifts = workedShifts.length;
  const hasExplicitOT = explicitOtDays.length > 0;

  let otShiftCodes: string[] = [];
  let otDays: { day: number; code: string }[] = [];
  let otPayable = 0;

  if (hasExplicitOT) {
    otDays = explicitOtDays;
    otShiftCodes = explicitOtDays.map(o => o.code);
    otPayable = otShiftCodes.reduce((sum, c) => sum + getRate(c), 0);
  } else {
    // Heuristic fallback: shifts beyond the monthly threshold count as OT.
    const threshold = person.role === 'room' ? 0 : otSettings.threshold;
    if (totalWorkShifts > threshold) {
      const otCount = totalWorkShifts - threshold;
      // Pay the highest-rate shifts as OT (Maximized Benefits).
      const sorted = [...workedShifts].sort((a, b) => getRate(b) - getRate(a));
      otShiftCodes = sorted.slice(0, otCount);
      otPayable = otShiftCodes.reduce((sum, c) => sum + getRate(c), 0);
    } else if (threshold === 0) {
      otShiftCodes = [...workedShifts];
      otPayable = totalValue;
    }
  }

  const otCount = otShiftCodes.length;

  const otByCategory: Record<string, number> = {};
  otShiftCodes.forEach(c => {
    const cat = otBaseCategory(c);
    otByCategory[cat] = (otByCategory[cat] || 0) + 1;
  });

  const paymentMode = person.paymentType || 'รายเดือน';
  const baseWageRate = person.baseWage || 0;
  const normalShifts = Math.max(0, totalWorkShifts - otCount);
  // Daily & periodic staff earn a base wage per worked (non-OT) shift; monthly = salary (out of scope here)
  const baseEarnings = paymentMode === 'รายวัน' || paymentMode === 'รายคาบ' ? normalShifts * baseWageRate : 0;
  const netEarnings = baseEarnings + otPayable;

  return {
    stats,
    totalWorkShifts,
    workedShifts,
    otShiftCodes,
    otByCategory,
    otDays,
    otCount,
    otPayable,
    totalValue,
    baseEarnings,
    netEarnings,
    hasExplicitOT,
    paymentMode,
    baseWageRate,
    employeeType: person.employeeType || 'ข้าราชการ',
  };
}

/** Convenience: the ShiftType record for a code (or undefined). */
export function shiftTypeOf(code: string, shiftTypes: ShiftType[] = SHIFT_TYPES) {
  return shiftTypes.find(s => s.code === code);
}
