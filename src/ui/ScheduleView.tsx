import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  api, type Ward, type Employee, type ShiftType, type WorkingCalendar,
  type RosterCell, type Roster, type RosterSigner, ApiError,
} from '../api/client';
import { SHIFT_TYPES as SHIFT_META, THAI_MONTHS, THAI_DAYS_SHORT } from '../data';
import type { UserRole } from '../api/client';
import { Lock, LockOpen, Save, Send, CheckCircle2, Eraser, Loader2, Users } from 'lucide-react';

const META = Object.fromEntries(SHIFT_META.map((s) => [s.code, s]));
const NORMAL_BRUSH = ['ช', 'บ', 'ด', 'ออฟ'];
const OT_BRUSH = ['ชot', 'บot', 'ดot', 'BD', 'OR'];

function metaFor(code?: string | null) {
  if (!code) return null;
  if (code === 'ออฟ') return { bgClass: 'bg-slate-100', textClass: 'text-slate-500', name: 'วันหยุด' };
  return (META as any)[code] ?? { bgClass: 'bg-slate-100', textClass: 'text-slate-700', name: code };
}

type CellMap = Record<string, { normalCode?: string | null; otCode?: string | null }>;
const key = (empId: number, day: number) => `${empId}-${day}`;

interface Props {
  role: UserRole;
  wards: Ward[];
  wardId: number;
  year: number;
  month: number;
}

export default function ScheduleView({ role, wards, wardId, year, month }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [cells, setCells] = useState<CellMap>({});
  const [roster, setRoster] = useState<Roster | null>(null);
  const [calendar, setCalendar] = useState<WorkingCalendar | null>(null);
  const [signers, setSigners] = useState<RosterSigner[]>([]);
  const [brush, setBrush] = useState<string>('ช');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [workingDaysInput, setWorkingDaysInput] = useState(0);

  const canEdit = role === 'supervisor' || role === 'admin';
  const canLock = role === 'supervisor' || role === 'finance' || role === 'admin';
  const canApprove = role === 'finance' || role === 'admin';
  const locked = !!calendar?.locked;

  const ceYear = year - 543;
  const daysInMonth = useMemo(() => new Date(ceYear, month, 0).getDate(), [ceYear, month]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, sts, cal, ros] = await Promise.all([
        api.employees(wardId),
        api.shiftTypes(),
        api.getWorkingCalendar(wardId, year, month),
        api.getRoster(wardId, year, month),
      ]);
      setEmployees(emps);
      setShiftTypes(sts);
      setCalendar(cal);
      setWorkingDaysInput(cal?.workingDays ?? 0);
      setRoster(ros.roster);
      setSigners(ros.signers ?? []);
      const map: CellMap = {};
      for (const c of ros.cells) map[key(c.employeeId, c.day)] = { normalCode: c.normalCode, otCode: c.otCode };
      setCells(map);
    } catch (e: any) {
      showToast('err', e?.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [wardId, year, month]);

  useEffect(() => { load(); }, [load]);

  const paint = (empId: number, day: number) => {
    if (!canEdit) return;
    const k = key(empId, day);
    setCells((prev) => {
      const cur = { ...(prev[k] ?? {}) };
      if (brush === 'ERASE') { return { ...prev, [k]: {} }; }
      const isOt = (META as any)[brush]?.isOt || OT_BRUSH.includes(brush);
      if (isOt) cur.otCode = cur.otCode === brush ? null : brush;
      else cur.normalCode = cur.normalCode === brush ? null : brush;
      return { ...prev, [k]: cur };
    });
  };

  const buildCells = (): RosterCell[] => {
    const out: RosterCell[] = [];
    for (const emp of employees) {
      for (const day of days) {
        const c = cells[key(emp.id, day)];
        if (c && (c.normalCode || c.otCode)) {
          out.push({ employeeId: emp.id, day, normalCode: c.normalCode ?? null, otCode: c.otCode ?? null });
        }
      }
    }
    return out;
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.saveRoster({ wardId, year, month, note: roster?.note ?? null, signers, cells: buildCells() });
      setRoster(res.roster);
      showToast('ok', `บันทึกแล้ว (${res.savedCells} ช่อง)`);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'calendar_not_locked') showToast('err', e.message);
      else showToast('err', e?.message || 'บันทึกไม่สำเร็จ');
    } finally { setSaving(false); }
  };

  const lockCalendar = async (lock: boolean) => {
    try {
      const cal = await api.setWorkingCalendar(wardId, year, month, workingDaysInput, lock);
      setCalendar(cal);
      showToast('ok', lock ? `ล็อกวันทำการแล้ว (${cal.workingDays} วัน)` : 'ปลดล็อกแล้ว');
    } catch (e: any) { showToast('err', e?.message || 'ไม่สำเร็จ'); }
  };

  const submit = async () => {
    if (!roster) return;
    try { const r = await api.submitRoster(roster.id); setRoster(r.roster); showToast('ok', 'ส่งขออนุมัติแล้ว'); }
    catch (e: any) { showToast('err', e?.message || 'ไม่สำเร็จ'); }
  };
  const approve = async () => {
    if (!roster) return;
    try { const r = await api.approveRoster(roster.id); setRoster(r.roster); showToast('ok', 'อนุมัติแล้ว'); }
    catch (e: any) { showToast('err', e?.message || 'ไม่สำเร็จ'); }
  };

  // manpower per day (count of ช/บ/ด)
  const manpower = useMemo(() => {
    const perDay: Record<number, { ch: number; ba: number; du: number }> = {};
    for (const day of days) {
      let ch = 0, ba = 0, du = 0;
      for (const emp of employees) {
        const c = cells[key(emp.id, day)];
        if (c?.normalCode === 'ช') ch++;
        else if (c?.normalCode === 'บ') ba++;
        else if (c?.normalCode === 'ด') du++;
      }
      perDay[day] = { ch, ba, du };
    }
    return perDay;
  }, [cells, employees, days]);

  const personTotals = (empId: number) => {
    let work = 0, ot = 0;
    for (const day of days) {
      const c = cells[key(empId, day)];
      if (!c) continue;
      if (c.normalCode && metaFor(c.normalCode)?.name && c.normalCode !== 'ออฟ' && (META as any)[c.normalCode]?.isWork !== false) work++;
      if (c.otCode) ot++;
    }
    return { work, ot };
  };

  const statusBadge = () => {
    const s = roster?.status;
    if (s === 'approved') return <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">อนุมัติแล้ว</span>;
    if (s === 'pending_approval') return <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">รออนุมัติ</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">ฉบับร่าง</span>;
  };

  const wardName = wards.find((w) => w.id === wardId)?.name ?? '';

  return (
    <div className="space-y-4">
      {/* header controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">ตารางเวร · {wardName}</h2>
          <p className="text-sm text-slate-500">ประจำเดือน {THAI_MONTHS[month - 1]} {year} &nbsp;{statusBadge()}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* working days lock */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="text-sm text-slate-500">วันทำการ</span>
            <input type="number" min={0} max={31} value={workingDaysInput} disabled={!canLock || locked}
              onChange={(e) => setWorkingDaysInput(Number(e.target.value))}
              className="w-14 text-sm border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
            {canLock && (locked
              ? <button onClick={() => lockCalendar(false)} className="flex items-center gap-1 text-xs text-amber-700"><Lock className="w-3.5 h-3.5" />ล็อกอยู่</button>
              : <button onClick={() => lockCalendar(true)} className="flex items-center gap-1 text-xs text-white bg-[#0F3575] px-2 py-1 rounded"><LockOpen className="w-3.5 h-3.5" />ล็อก</button>
            )}
          </div>
          {canEdit && <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e] disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึก</button>}
          {canEdit && roster && roster.status === 'draft' && <button onClick={submit} className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg"><Send className="w-4 h-4" />ส่งอนุมัติ</button>}
          {canApprove && roster && roster.status === 'pending_approval' && <button onClick={approve} className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg"><CheckCircle2 className="w-4 h-4" />อนุมัติ</button>}
        </div>
      </div>

      {/* brush palette */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-3">
          <span className="text-xs text-slate-500 mr-1">เวรปกติ:</span>
          {NORMAL_BRUSH.map((code) => (
            <React.Fragment key={code}><BrushBtn code={code} active={brush === code} onClick={() => setBrush(code)} /></React.Fragment>
          ))}
          <span className="text-xs text-slate-500 mx-1">OT/พิเศษ:</span>
          {OT_BRUSH.map((code) => (
            <React.Fragment key={code}><BrushBtn code={code} active={brush === code} disabled={!locked} onClick={() => setBrush(code)} /></React.Fragment>
          ))}
          <button onClick={() => setBrush('ERASE')} className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded border ${brush === 'ERASE' ? 'bg-slate-800 text-white border-slate-800' : 'border-slate-200 text-slate-600'}`}><Eraser className="w-3.5 h-3.5" />ลบ</button>
          {!locked && <span className="text-xs text-rose-500">* ต้องล็อกวันทำการก่อน จึงจะลง OT ได้</span>}
        </div>
      )}

      {toast && <div className={`text-sm rounded-lg px-3 py-2 ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{toast.msg}</div>}

      {/* grid */}
      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 bg-slate-50 z-10 px-3 py-2 text-left font-semibold text-slate-600 min-w-[180px] border-b border-slate-200">ชื่อ - ตำแหน่ง</th>
                {days.map((d) => {
                  const wd = new Date(ceYear, month - 1, d).getDay();
                  const weekend = wd === 0 || wd === 6;
                  return <th key={d} className={`px-1 py-1 border-b border-l border-slate-100 text-center font-medium ${weekend ? 'bg-rose-50 text-rose-500' : 'text-slate-500'}`} style={{ minWidth: 30 }}>
                    <div>{d}</div><div className="text-[10px]">{THAI_DAYS_SHORT[wd]}</div>
                  </th>;
                })}
                <th className="px-2 py-2 border-b border-l border-slate-200 text-center font-semibold text-slate-600">รวม</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const t = personTotals(emp.id);
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/50">
                    <td className="sticky left-0 bg-white z-10 px-3 py-1.5 border-b border-slate-100 align-top">
                      <div className="font-medium text-slate-700">{emp.prefix}{emp.firstName} {emp.lastName ?? ''}</div>
                      <div className="text-[11px] text-slate-400">{emp.positionText}</div>
                    </td>
                    {days.map((d) => {
                      const c = cells[key(emp.id, d)];
                      const nm = metaFor(c?.normalCode);
                      const ot = metaFor(c?.otCode);
                      return (
                        <td key={d} onClick={() => paint(emp.id, d)}
                          className={`border-b border-l border-slate-100 text-center p-0 ${canEdit ? 'cursor-pointer' : ''}`} style={{ height: 34 }}>
                          <div className="flex flex-col items-stretch justify-center h-full leading-none">
                            {c?.otCode && <div className={`text-[10px] font-semibold ${ot?.bgClass} ${ot?.textClass}`}>{c.otCode}</div>}
                            <div className={`text-[11px] py-0.5 ${nm?.bgClass ?? ''} ${nm?.textClass ?? 'text-slate-300'}`}>{c?.normalCode ?? ''}</div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-slate-200 text-center px-2">
                      <div className="text-slate-700 font-semibold">{t.work}</div>
                      {t.ot > 0 && <div className="text-[10px] text-rose-500">OT {t.ot}</div>}
                    </td>
                  </tr>
                );
              })}
              {/* manpower rows */}
              {(['ch', 'ba', 'du'] as const).map((k2, i) => (
                <tr key={k2} className="bg-slate-50/60">
                  <td className="sticky left-0 bg-slate-50 z-10 px-3 py-1 border-t border-slate-200 text-[11px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{['เช้า', 'บ่าย', 'ดึก'][i]}</span>
                  </td>
                  {days.map((d) => (
                    <td key={d} className="border-t border-l border-slate-100 text-center text-[11px] text-slate-500">{(manpower[d] as any)[k2] || ''}</td>
                  ))}
                  <td className="border-t border-l border-slate-200" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {employees.length === 0 && !loading && <p className="text-sm text-slate-400 text-center py-6">ยังไม่มีบุคลากรในกลุ่มงานนี้</p>}
    </div>
  );
}

function BrushBtn({ code, active, disabled, onClick }: { code: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  const m = metaFor(code);
  return (
    <button onClick={onClick} disabled={disabled}
      className={`text-xs px-2.5 py-1.5 rounded border font-medium transition ${active ? 'ring-2 ring-[#0F3575] border-[#0F3575]' : 'border-slate-200'} ${m?.bgClass} ${m?.textClass} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {code}
    </button>
  );
}
