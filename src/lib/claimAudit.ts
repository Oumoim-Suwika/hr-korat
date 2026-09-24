import type { Employee, RequestItem } from '../api/client';
import { cellKey, type CellMap } from './useRosterData';

/**
 * AI ตรวจสอบเงื่อนไข "ขอขึ้น ↔ ลงเวร/ขอเบิก" ให้ตรงกัน.
 * เทียบสิ่งที่ขออนุมัติไว้ (คำขอขึ้น OT / ขึ้นเวรเพิ่ม / เปลี่ยนเวร ที่อนุมัติแล้ว)
 * กับเวรที่ลงจริงในตารางเวร (ที่จะใช้เบิก) — แจ้งเตือนทั้งคนจัดเวรและการเงิน.
 *
 * ตัวอย่างที่จับได้: ขอขึ้น "บ" แต่ในตาราง/เบิกเป็น "ช" → เตือน.
 */
export type ClaimIssueKind = 'mismatch' | 'not_scheduled';

export interface ClaimIssue {
  employeeId: number;
  name: string;
  day: number;
  kind: ClaimIssueKind;
  requested: string;
  actual: string | null;
  detail: string;
}

const fullName = (e: Employee) => `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}`.trim();
const REQ_TYPES = new Set(['ot', 'shift_add', 'shift_change']);

export function auditRequestVsClaim(
  employees: Employee[],
  cells: CellMap,
  days: number[],
  requests: RequestItem[],
): ClaimIssue[] {
  const out: ClaimIssue[] = [];
  for (const e of employees) {
    const name = fullName(e);
    // requested code per day (อนุมัติแล้ว และมีรหัสเวรปลายทาง)
    const reqByDay = new Map<number, string>();
    for (const r of requests) {
      if (r.employeeId === e.id && REQ_TYPES.has(r.type) && r.status === 'approved' && r.day && r.toCode) {
        reqByDay.set(r.day, r.toCode);
      }
    }
    for (const [day, requested] of reqByDay) {
      if (!days.includes(day)) continue;
      const c = cells[cellKey(e.id, day)];
      const otc = c?.otCode ?? null;
      const otc2 = c?.otCode2 ?? null;
      const nc = c?.normalCode ?? null;
      if (!otc && !otc2 && (!nc || nc === 'ออฟ')) {
        out.push({ employeeId: e.id, name, day, kind: 'not_scheduled', requested, actual: null, detail: `ขอขึ้น "${requested}" แต่ยังไม่ได้ลงเวรในตาราง (วันที่ ${day})` });
      } else if (requested !== otc && requested !== otc2 && requested !== nc) {
        const actual = otc ?? otc2 ?? nc;
        out.push({ employeeId: e.id, name, day, kind: 'mismatch', requested, actual, detail: `ขอขึ้น "${requested}" แต่ลง/เบิกเป็น "${actual}" (วันที่ ${day})` });
      }
    }
  }
  return out.sort((a, b) => (a.name.localeCompare(b.name, 'th') || a.day - b.day));
}
