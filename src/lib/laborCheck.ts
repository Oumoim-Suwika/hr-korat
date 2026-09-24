import type { Employee } from '../api/client';
import { cellKey, type CellMap } from './useRosterData';

/**
 * Labour-standard compliance checker for a monthly roster.
 *
 * The thresholds mirror common Thai public-hospital nursing practice and the
 * Labour Protection Act principles (weekly rest, rest between shifts). They are
 * configurable so the ward can align them with its own คำสั่ง / policy.
 */
export interface LaborConfig {
  maxConsecutiveDays: number;   // max working days in a row before a day off
  minDaysOffPerMonth: number;   // minimum days off in the month
  maxOtDaysPerMonth: number;    // OT days above this = heavy-load warning
}

export const DEFAULT_LABOR_CONFIG: LaborConfig = {
  maxConsecutiveDays: 6,
  minDaysOffPerMonth: 4,
  maxOtDaysPerMonth: 12,
};

export type Severity = 'error' | 'warning';

export interface Violation {
  employeeId: number;
  name: string;
  rule: string;        // short rule label (Thai)
  severity: Severity;
  detail: string;      // human-readable explanation with day numbers
}

const OFF = new Set(['ออฟ', 'O', '', null as any, undefined as any]);
const isWork = (code?: string | null) => !!code && !OFF.has(code);
const fullName = (e: Employee) => `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}`.trim();

export function checkRoster(
  employees: Employee[],
  cells: CellMap,
  days: number[],
  config: Partial<LaborConfig> = {},
): Violation[] {
  const cfg = { ...DEFAULT_LABOR_CONFIG, ...config };
  const out: Violation[] = [];

  for (const e of employees) {
    const name = fullName(e);
    const codeAt = (d: number) => cells[cellKey(e.id, d)]?.normalCode ?? null;
    const otAt = (d: number) => cells[cellKey(e.id, d)]?.otCode ?? null;

    // Rule 1: rest between shifts — night (ด) directly followed by morning (ช)
    const nightMorning: number[] = [];
    for (let i = 0; i < days.length - 1; i++) {
      const d = days[i], nd = days[i + 1];
      if (codeAt(d) === 'ด' && codeAt(nd) === 'ช') nightMorning.push(d);
    }
    if (nightMorning.length) {
      out.push({ employeeId: e.id, name, rule: 'พักระหว่างเวรไม่พอ (ดึกติดเช้า)', severity: 'error',
        detail: `เวรดึกต่อด้วยเวรเช้าวันรุ่งขึ้น ที่วันที่ ${nightMorning.join(', ')} — ควรมีเวลาพักก่อนขึ้นเวรถัดไป` });
    }

    // Rule 2: too many consecutive working days
    let run = 0, runStart = 0; const longRuns: string[] = [];
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (isWork(codeAt(d))) { if (run === 0) runStart = d; run++; }
      else { if (run > cfg.maxConsecutiveDays) longRuns.push(`${runStart}-${days[i - 1]}`); run = 0; }
    }
    if (run > cfg.maxConsecutiveDays) longRuns.push(`${runStart}-${days[days.length - 1]}`);
    if (longRuns.length) {
      out.push({ employeeId: e.id, name, rule: `ทำงานติดต่อกันเกิน ${cfg.maxConsecutiveDays} วัน`, severity: 'error',
        detail: `ช่วงวันที่ ${longRuns.join(', ')} ทำงานติดต่อกันโดยไม่มีวันหยุด — ต้องจัดวันหยุดอย่างน้อย 1 วันต่อสัปดาห์` });
    }

    // Rule 3: minimum days off in the month
    const offDays = days.filter((d) => !isWork(codeAt(d))).length;
    if (offDays < cfg.minDaysOffPerMonth) {
      out.push({ employeeId: e.id, name, rule: 'วันหยุดน้อยกว่าเกณฑ์', severity: 'warning',
        detail: `มีวันหยุดเพียง ${offDays} วันในเดือนนี้ (เกณฑ์ขั้นต่ำ ${cfg.minDaysOffPerMonth} วัน)` });
    }

    // Rule 4: heavy OT load
    const otDays = days.filter((d) => !!otAt(d)).length;
    if (otDays > cfg.maxOtDaysPerMonth) {
      out.push({ employeeId: e.id, name, rule: 'ปริมาณ OT สูง', severity: 'warning',
        detail: `ขึ้น OT/พิเศษ ${otDays} วันในเดือนนี้ (เกินเกณฑ์เฝ้าระวัง ${cfg.maxOtDaysPerMonth} วัน) — ตรวจสอบภาระงานและความปลอดภัย` });
    }
  }

  // errors first, then by name
  return out.sort((a, b) => (a.severity === b.severity ? a.name.localeCompare(b.name, 'th') : a.severity === 'error' ? -1 : 1));
}
