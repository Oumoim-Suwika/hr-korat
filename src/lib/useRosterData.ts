import { useCallback, useEffect, useState } from 'react';
import { api, type Employee, type RosterSigner, type Roster } from '../api/client';
import { DEFAULT_OT_SETTINGS } from '../data';

export interface CellMap { [k: string]: { normalCode?: string | null; otCode?: string | null }; }
export const cellKey = (empId: number, day: number) => `${empId}-${day}`;

const OT_CODES = new Set(['ชot', 'บot', 'ดot', 'BD', 'OR']);

/** Reimbursement rate for a role+shiftcode (falls back to nurse rates / 0). */
export function rateFor(role: string, code: string): number {
  const rates: any = DEFAULT_OT_SETTINGS.rates;
  const table = rates[role] ?? rates.nurse;
  return table?.[code] ?? 0;
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

/** Trigger a browser download of a text/CSV file (UTF-8 with BOM for Excel/Thai). */
export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
