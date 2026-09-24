import { useCallback, useEffect, useState } from 'react';
import { api, type Employee, type RosterSigner, type Roster } from '../api/client';
import { DEFAULT_OT_SETTINGS } from '../data';

export interface CellMap { [k: string]: { normalCode?: string | null; otCode?: string | null }; }
export const cellKey = (empId: number, day: number) => `${empId}-${day}`;

const OT_CODES = new Set(['ชot', 'บot', 'ดot', 'BD', 'OR']);

// Reimbursement/OT rate config — hydrated from the backend (rate_settings) at
// app start via applyRateSettings(), so finance can edit rates and have them
// flow to OT forms, OT earnings, reconcile, and payroll. Defaults come from
// data.ts until the server config loads.
const _rateTable: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(DEFAULT_OT_SETTINGS.rates));
const _baseSalary: Record<string, number> = { doctor: 0, nurse: 0, assistant: 0, room: 0, support: 0 };

/** Reimbursement/OT rate for a role+shiftcode (falls back to nurse rates / 0). */
export function rateFor(role: string, code: string): number {
  const table = _rateTable[role] ?? _rateTable.nurse;
  return table?.[code] ?? 0;
}

/** Monthly base salary configured for a role (0 if unset). */
export function baseSalaryFor(role: string): number {
  return _baseSalary[role] ?? 0;
}

/** Apply rate settings fetched from the backend into the in-memory table. */
export function applyRateSettings(items: { role: string; code: string; amount: number }[]): void {
  for (const it of items) {
    if (it.code === 'BASE') _baseSalary[it.role] = it.amount;
    else { (_rateTable[it.role] ||= {})[it.code] = it.amount; }
  }
}

/** OT codes and roles exposed to the finance rate-settings editor. */
export const RATE_OT_CODES = ['ชot', 'บot', 'ดot', 'BD', 'OR'] as const;
export const RATE_ROLES: [string, string][] = [
  ['doctor', 'แพทย์'], ['nurse', 'พยาบาลวิชาชีพ'], ['assistant', 'ผู้ช่วยพยาบาล/ผู้ช่วยเหลือ'], ['room', 'ห้องผ่าตัด'], ['support', 'สายสนับสนุน'],
];
/** Read the current in-memory rates as flat rows (for prefilling the editor). */
export function currentRateRows(): { role: string; code: string; amount: number }[] {
  const rows: { role: string; code: string; amount: number }[] = [];
  for (const [role] of RATE_ROLES) {
    for (const code of RATE_OT_CODES) rows.push({ role, code, amount: rateFor(role, code) });
    rows.push({ role, code: 'BASE', amount: baseSalaryFor(role) });
  }
  return rows;
}

export interface Claim {
  employee: Employee;
  otCount: number;
  amount: number;
  byCode: Record<string, number>;   // code -> count
}

/** Compute a person's OT reimbursement for the month from roster cells. */
export function computeClaim(emp: Employee, cells: CellMap, days: number[]): Claim {
  let otCount = 0, amount = 0;
  const byCode: Record<string, number> = {};
  for (const d of days) {
    const c = cells[cellKey(emp.id, d)];
    const code = c?.otCode;
    if (code && OT_CODES.has(code)) {
      otCount++;
      amount += rateFor(emp.role, code);
      byCode[code] = (byCode[code] || 0) + 1;
    }
  }
  return { employee: emp, otCount, amount, byCode };
}

/** Aggregate roster data across ALL wards for a month (for dashboard/reports). */
export function useAllWardsData(year: number, month: number) {
  const [wards, setWards] = useState<import('../api/client').Ward[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cells, setCells] = useState<CellMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ws = await api.wards();
      setWards(ws);
      const all = await api.allEmployees();
      setEmployees(all);
      const rosters = await Promise.all(ws.map((w) => api.getRoster(w.id, year, month)));
      const map: CellMap = {};
      for (const r of rosters) for (const c of r.cells) map[cellKey(c.employeeId, c.day)] = { normalCode: c.normalCode, otCode: c.otCode };
      setCells(map);
    } finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const ceYear = year - 543;
  const daysInMonth = new Date(ceYear, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  return { wards, employees, cells, days, ceYear, loading, reload: load };
}

export function useRosterData(wardId: number, year: number, month: number) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cells, setCells] = useState<CellMap>({});
  const [signers, setSigners] = useState<RosterSigner[]>([]);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, ros] = await Promise.all([api.employees(wardId), api.getRoster(wardId, year, month)]);
      setEmployees(emps);
      setRoster(ros.roster);
      setSigners(ros.signers ?? []);
      const map: CellMap = {};
      for (const c of ros.cells) map[cellKey(c.employeeId, c.day)] = { normalCode: c.normalCode, otCode: c.otCode };
      setCells(map);
    } finally { setLoading(false); }
  }, [wardId, year, month]);

  useEffect(() => { load(); }, [load]);

  const ceYear = year - 543;
  const daysInMonth = new Date(ceYear, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return { employees, cells, signers, roster, loading, ceYear, days, reload: load };
}

/** Format a numeric hour (8.3 = 08:30) as "08.30". */
export function fmtHour(h?: number | null): string {
  if (h == null || isNaN(h)) return '';
  return `${String(Math.floor(h)).padStart(2, '0')}.${String(Math.round((h % 1) * 100)).padStart(2, '0')}`;
}

/**
 * Effective ช/บ/ด display times for a ward: use the ward's own configured times
 * when present, otherwise fall back to the global shift-type times (ตั้งค่าเวร).
 */
export function effectiveWardHours(
  wardTimes: { code: string; startTime: string; endTime: string }[] | undefined,
  shiftTypes: { code: string; startHour?: number | null; endHour?: number | null }[] | undefined,
): { code: string; startTime: string; endTime: string }[] {
  return ['ช', 'บ', 'ด'].map((code) => {
    const w = wardTimes?.find((x) => x.code === code);
    if (w) return { code, startTime: w.startTime, endTime: w.endTime };
    const g = shiftTypes?.find((s) => s.code === code);
    return { code, startTime: fmtHour(g?.startHour), endTime: fmtHour(g?.endHour) };
  }).filter((x) => x.startTime && x.endTime);
}

/** Trigger a browser download of a text/CSV file (UTF-8 with BOM for Excel/Thai). */
export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
