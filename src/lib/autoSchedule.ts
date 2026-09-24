import type { Employee } from '../api/client';
import { cellKey, type CellMap } from './useRosterData';

/**
 * Level-aware auto-scheduler ("AI จัดเวร").
 * Fills every shift (ช/บ/ด) with the required headcount FOR EACH LEVEL (L/M/S/S2)
 * defined in "ความต้องการพนักงาน", matching each employee's own level. Respects
 * rest-after-night, no บ→ด, max consecutive days, and balances workload.
 * Returns a coverage report (which shift/level fell short) — explainable, not a black box.
 */
export const NORMAL_SHIFTS = ['ช', 'บ', 'ด'] as const;
export type NormalShift = (typeof NORMAL_SHIFTS)[number];
export const LEVELS = ['L', 'M', 'S', 'S2'] as const;

// Roles that rotate across ช/บ/ด. Others (แพทย์/ธุรการ/สนับสนุน) get an office pattern.
const ROTATING_ROLES = new Set(['nurse', 'assistant', 'room']);

export interface StaffingItem { level: string; shiftCode: string; count: number; }
export interface ScheduleConfig { maxConsecutive: number; }
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = { maxConsecutive: 6 };

export interface CoverageIssue { day: number; shift: NormalShift; level: string; needed: number; assigned: number; }
export interface ScheduleResult {
  cells: CellMap;
  perShiftNeed: Record<NormalShift, number>;                        // total per shift
  perShiftLevelNeed: Record<NormalShift, Record<string, number>>;   // per shift × level
  issues: CoverageIssue[];
  workload: { employeeId: number; name: string; workDays: number; offDays: number }[];
  usedFallbackNeed: boolean;
}

const fullName = (e: Employee) => `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}`.trim();

/** Employee level — explicit e.level, else inferred from position/role. */
export function levelOf(e: Employee): string {
  if (e.level && (LEVELS as readonly string[]).includes(e.level)) return e.level;
  const p = e.positionText ?? '';
  if (/หัวหน้า|ชำนาญการพิเศษ|อาวุโส/.test(p) || e.role === 'doctor') return 'L';
  if (/ชำนาญการ/.test(p)) return 'M';
  if (/ผู้ช่วย|ช่วยเหลือ|พนักงาน/.test(p) || e.role === 'assistant' || e.role === 'room') return 'S2';
  return 'S';
}

interface State { emp: Employee; level: string; consec: number; last: string | null; work: number; off: number; }

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

  // need[shift][level] = count
  const need: Record<NormalShift, Record<string, number>> = { ช: {}, บ: {}, ด: {} };
  let total = 0;
  for (const it of staffing) {
    if ((NORMAL_SHIFTS as readonly string[]).includes(it.shiftCode)) {
      need[it.shiftCode as NormalShift][it.level] = (need[it.shiftCode as NormalShift][it.level] ?? 0) + (Number(it.count) || 0);
      total += Number(it.count) || 0;
    }
  }

  const rotating = employees.filter((e) => ROTATING_ROLES.has(e.role));
  const office = employees.filter((e) => !ROTATING_ROLES.has(e.role));

  // Fallback (no staffing configured): one pseudo-level '*' with ~1/3 split;
  // everyone matches '*'.
  const usedFallbackNeed = total === 0;
  if (usedFallbackNeed) {
    const n = rotating.length;
    need.ช = { '*': Math.max(1, Math.round(n * 0.34)) };
    need.บ = { '*': Math.max(1, Math.round(n * 0.33)) };
    need.ด = { '*': Math.max(1, Math.round(n * 0.33)) };
  }
  const matchesLevel = (e: Employee, level: string) => level === '*' || levelOf(e) === level;

  const cells: CellMap = {};
  for (const e of employees) for (const d of days) {   // preserve existing OT (both segments)
    const ex = existing[cellKey(e.id, d)];
    if (ex?.otCode || ex?.otCode2) cells[cellKey(e.id, d)] = { otCode: ex.otCode ?? null, otCode2: ex.otCode2 ?? null };
  }

  const st = new Map<number, State>();
  for (const e of rotating) st.set(e.id, { emp: e, level: levelOf(e), consec: 0, last: null, work: 0, off: 0 });

  const issues: CoverageIssue[] = [];
  const setCell = (empId: number, day: number, code: string) => {
    const k = cellKey(empId, day);
    cells[k] = { ...(cells[k] ?? {}), normalCode: code };
  };
  const fair = (a: Employee, b: Employee) => { const sa = st.get(a.id)!, sb = st.get(b.id)!; return sa.work !== sb.work ? sa.work - sb.work : sb.off - sa.off; };

  for (const d of days) {
    const wd = new Date(ceYear, month - 1, d).getDay();
    const weekend = wd === 0 || wd === 6;
    for (const e of office) setCell(e.id, d, weekend ? 'ออฟ' : 'ช');

    const assignedToday = new Set<number>();
    for (const shift of ['ด', 'บ', 'ช'] as NormalShift[]) {
      for (const level of Object.keys(need[shift])) {
        const want = need[shift][level];
        if (want <= 0) continue;
        const eligible = rotating.filter((e) => {
          if (assignedToday.has(e.id)) return false;
          const s = st.get(e.id)!;
          if (s.last === 'ด') return false;                 // rest after night
          if (s.last === 'บ' && shift === 'ด') return false; // no afternoon→night
          if (s.consec >= cfg.maxConsecutive) return false;
          return matchesLevel(e, level);
        }).sort(fair);
        const chosen = eligible.slice(0, want);
        for (const e of chosen) {
          setCell(e.id, d, shift); assignedToday.add(e.id);
          const s = st.get(e.id)!; s.consec += 1; s.last = shift; s.work += 1;
        }
        if (chosen.length < want) issues.push({ day: d, shift, level, needed: want, assigned: chosen.length });
      }
    }
    for (const e of rotating) if (!assignedToday.has(e.id)) { setCell(e.id, d, 'ออฟ'); const s = st.get(e.id)!; s.consec = 0; s.last = 'ออฟ'; s.off += 1; }
  }

  const perShiftNeed: Record<NormalShift, number> = { ช: 0, บ: 0, ด: 0 };
  for (const s of NORMAL_SHIFTS) perShiftNeed[s] = Object.values(need[s]).reduce((a, b) => a + b, 0);

  const workload = rotating
    .map((e) => { const s = st.get(e.id)!; return { employeeId: e.id, name: fullName(e), workDays: s.work, offDays: s.off }; })
    .sort((a, b) => b.workDays - a.workDays);

  return { cells, perShiftNeed, perShiftLevelNeed: need, issues, workload, usedFallbackNeed };
}
