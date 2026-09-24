import type { Employee } from '../api/client';
import { cellKey, type CellMap } from './useRosterData';

/**
 * Seniority- and staffing-aware auto-scheduler ("AI จัดเวร").
 *
 * Goal: produce a starting draft that satisfies, as far as possible:
 *  - per-shift headcount from "ความต้องการพนักงาน" (StaffingView)
 *  - at least `seniorPerShift` senior staff on every ช/บ/ด
 *  - rest after a night shift (ด → ออฟ next day)
 *  - no afternoon→night back-to-back (บ → ด)
 *  - no more than `maxConsecutive` working days in a row
 *  - fair distribution of workload
 *
 * It is deterministic and explainable (greedy with priority ordering) — not a
 * black box — and always returns a coverage report so the supervisor can see
 * exactly where the requirement could not be met and fix it by hand.
 */

export const NORMAL_SHIFTS = ['ช', 'บ', 'ด'] as const;
export type NormalShift = (typeof NORMAL_SHIFTS)[number];

// Roles that rotate across ช/บ/ด. Others (แพทย์/ธุรการ/สนับสนุน) get an office
// pattern (weekday ช, weekend ออฟ) which the user can adjust.
const ROTATING_ROLES = new Set(['nurse', 'assistant', 'room']);

export interface StaffingItem { level: string; shiftCode: string; count: number; }

export interface ScheduleConfig {
  seniorYears: number;       // tenure (years) at/above which someone counts as senior
  seniorPerShift: number;    // required seniors per shift
  maxConsecutive: number;    // max consecutive working days
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  seniorYears: 3,
  seniorPerShift: 1,
  maxConsecutive: 6,
};

export interface CoverageIssue {
  day: number;
  shift: NormalShift;
  needed: number;
  assigned: number;
  seniorNeeded: number;
  seniorAssigned: number;
}

export interface ScheduleResult {
  cells: CellMap;                       // new normalCodes (existing OT codes preserved)
  perShiftNeed: Record<NormalShift, number>;
  issues: CoverageIssue[];              // shifts that fell short (headcount or senior)
  workload: { employeeId: number; name: string; workDays: number; offDays: number }[];
  usedFallbackNeed: boolean;            // true when staffing wasn't configured
}

function tenureYears(startDate?: string | null): number {
  if (!startDate) return 0;
  const s = new Date(startDate);
  if (isNaN(+s)) return 0;
  return (Date.now() - s.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function isSenior(e: Employee, cfg: ScheduleConfig): boolean {
  const pos = e.positionText ?? '';
  if (/หัวหน้า|ชำนาญการ|อาวุโส/.test(pos)) return true;
  return tenureYears(e.startDate) >= cfg.seniorYears;
}

const fullName = (e: Employee) => `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}`.trim();

/** Total headcount required per shift = sum over levels of staffing counts. */
export function perShiftNeedFromStaffing(staffing: StaffingItem[]): Record<NormalShift, number> {
  const need: Record<NormalShift, number> = { ช: 0, บ: 0, ด: 0 };
  for (const it of staffing) {
    if ((NORMAL_SHIFTS as readonly string[]).includes(it.shiftCode)) {
      need[it.shiftCode as NormalShift] += Number(it.count) || 0;
    }
  }
  return need;
}

interface State {
  emp: Employee;
  senior: boolean;
  rotating: boolean;
  consec: number;         // consecutive working days ending yesterday
  last: string | null;    // yesterday's normal code
  work: number;
  off: number;
}

export function autoSchedule(
  employees: Employee[],
  existing: CellMap,
  days: number[],
  ceYear: number,
  month: number,
  staffing: StaffingItem[],
  config: Partial<ScheduleConfig> = {},
): ScheduleResult {
  const cfg = { ...DEFAULT_SCHEDULE_CONFIG, ...config };
  let need = perShiftNeedFromStaffing(staffing);
  const totalNeed = need.ช + need.บ + need.ด;

  const rotating = employees.filter((e) => ROTATING_ROLES.has(e.role));
  const office = employees.filter((e) => !ROTATING_ROLES.has(e.role));

  // Fallback when staffing isn't configured: spread rotating staff so everyone
  // is used (~1/3 per shift, weighted toward day shift).
  const usedFallbackNeed = totalNeed === 0;
  if (usedFallbackNeed) {
    const n = rotating.length;
    need = {
      ช: Math.max(1, Math.round(n * 0.34)),
      บ: Math.max(1, Math.round(n * 0.33)),
      ด: Math.max(1, Math.round(n * 0.33)),
    };
  }

  const cells: CellMap = {};
  // preserve existing OT codes
  for (const e of employees) for (const d of days) {
    const ot = existing[cellKey(e.id, d)]?.otCode ?? null;
    if (ot) cells[cellKey(e.id, d)] = { otCode: ot };
  }

  const st = new Map<number, State>();
  for (const e of rotating) st.set(e.id, { emp: e, senior: isSenior(e, cfg), rotating: true, consec: 0, last: null, work: 0, off: 0 });

  const issues: CoverageIssue[] = [];

  const setCell = (empId: number, day: number, code: string) => {
    const k = cellKey(empId, day);
    cells[k] = { ...(cells[k] ?? {}), normalCode: code };
  };

  for (const d of days) {
    // office staff: weekday ช, weekend ออฟ
    const wd = new Date(ceYear, month - 1, d).getDay();
    const weekend = wd === 0 || wd === 6;
    for (const e of office) setCell(e.id, d, weekend ? 'ออฟ' : 'ช');

    const assignedToday = new Set<number>();

    // Assign hardest shift first: night, then afternoon, then morning.
    for (const shift of ['ด', 'บ', 'ช'] as NormalShift[]) {
      const want = need[shift];
      if (want <= 0) continue;

      const eligible = rotating.filter((e) => {
        if (assignedToday.has(e.id)) return false;
        const s = st.get(e.id)!;
        if (s.last === 'ด') return false;                 // must rest after night
        if (s.last === 'บ' && shift === 'ด') return false; // no afternoon→night
        if (s.consec >= cfg.maxConsecutive) return false;  // enforce weekly rest
        return true;
      });

      // priority: (need senior?) seniors first, then least worked, then most rested
      const sortByFairness = (a: Employee, b: Employee) => {
        const sa = st.get(a.id)!, sb = st.get(b.id)!;
        if (sa.work !== sb.work) return sa.work - sb.work;
        return sb.off - sa.off;
      };
      const seniors = eligible.filter((e) => st.get(e.id)!.senior).sort(sortByFairness);
      const juniors = eligible.filter((e) => !st.get(e.id)!.senior).sort(sortByFairness);

      const chosen: Employee[] = [];
      // guarantee senior coverage first
      for (let i = 0; i < cfg.seniorPerShift && seniors.length; i++) chosen.push(seniors.shift()!);
      // fill remaining by fairness across the rest
      const rest = [...seniors, ...juniors].sort(sortByFairness);
      while (chosen.length < want && rest.length) chosen.push(rest.shift()!);

      for (const e of chosen) {
        setCell(e.id, d, shift);
        assignedToday.add(e.id);
        const s = st.get(e.id)!; s.consec += 1; s.last = shift; s.work += 1;
      }

      const seniorAssigned = chosen.filter((e) => st.get(e.id)!.senior).length;
      if (chosen.length < want || seniorAssigned < cfg.seniorPerShift) {
        issues.push({ day: d, shift, needed: want, assigned: chosen.length, seniorNeeded: cfg.seniorPerShift, seniorAssigned });
      }
    }

    // everyone else rests
    for (const e of rotating) {
      if (!assignedToday.has(e.id)) {
        setCell(e.id, d, 'ออฟ');
        const s = st.get(e.id)!; s.consec = 0; s.last = 'ออฟ'; s.off += 1;
      }
    }
  }

  const workload = rotating
    .map((e) => { const s = st.get(e.id)!; return { employeeId: e.id, name: fullName(e), workDays: s.work, offDays: s.off }; })
    .sort((a, b) => b.workDays - a.workDays);

  return { cells, perShiftNeed: need, issues, workload, usedFallbackNeed };
}
