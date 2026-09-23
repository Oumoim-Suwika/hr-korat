import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Employee, type RequestItem, ApiError } from '../api/client';
import type { UserRole } from '../api/client';
import { THAI_MONTHS } from '../data';
import { Send, Check, X, Loader2, Plus } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  leave: 'ขอลา',
  shift_change: 'ขอเปลี่ยนเวร',
  ot: 'ขอขึ้น OT',
  shift_add: 'ขอขึ้นเวรเพิ่ม',
};
const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  pending: { t: 'รออนุมัติ', c: 'bg-amber-100 text-amber-700' },
  approved: { t: 'อนุมัติแล้ว', c: 'bg-emerald-100 text-emerald-700' },
  rejected: { t: 'ไม่อนุมัติ', c: 'bg-rose-100 text-rose-700' },
  cancelled: { t: 'ยกเลิก', c: 'bg-slate-100 text-slate-500' },
};

interface Props {
  role: UserRole;
  wardId: number;
  year: number;
  month: number;
  myEmployeeId: number | null;
  filterType?: string;
  title?: string;
}

export default function RequestsView({ role, wardId, year, month, myEmployeeId, filterType, title }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const isStaff = role === 'staff';
  const canDecide = role === 'supervisor' || role === 'finance' || role === 'admin';

  const showToast = (kind: 'ok' | 'err', msg: string) => { setToast({ kind, msg }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, reqs] = await Promise.all([api.employees(wardId), api.getRequests(wardId, year, month)]);
      setEmployees(emps);
      setRequests(reqs);
    } catch (e: any) { showToast('err', e?.message || 'โหลดไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, [wardId, year, month]);

  useEffect(() => { load(); }, [load]);

  const empName = (id: number) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}` : `#${id}`;
  };

  const decide = async (id: number, decision: 'approved' | 'rejected') => {
    try { await api.decideRequest(id, decision); showToast('ok', decision === 'approved' ? 'อนุมัติแล้ว' : 'ไม่อนุมัติแล้ว'); load(); }
    catch (e: any) { showToast('err', e?.message || 'ไม่สำเร็จ'); }
  };

  const visible = useMemo(() => {
    let list = requests;
    if (filterType) list = list.filter((r) => r.type === filterType);
    if (isStaff && myEmployeeId) list = list.filter((r) => r.employeeId === myEmployeeId);
    return list;
  }, [requests, isStaff, myEmployeeId, filterType]);

  const pending = visible.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title ?? 'คำขอ'} · {THAI_MONTHS[month - 1]} {year}</h2>
          <p className="text-sm text-slate-500">{isStaff ? 'คำขอของคุณ' : `ทั้งหมด ${visible.length} รายการ · รออนุมัติ ${pending.length}`}</p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e]">
          <Plus className="w-4 h-4" />สร้างคำขอ
        </button>
      </div>

      {toast && <div className={`text-sm rounded-lg px-3 py-2 ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{toast.msg}</div>}

      {showForm && (
        <RequestForm
          employees={employees} wardId={wardId} year={year} month={month}
          fixedEmployeeId={isStaff ? myEmployeeId : null}
          defaultType={(filterType as any) || 'leave'}
          onDone={(msg) => { setShowForm(false); showToast('ok', msg); load(); }}
          onError={(msg) => showToast('err', msg)}
        />
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีคำขอ</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {visible.map((r) => {
            const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-700">{TYPE_LABEL[r.type] ?? r.type}</span>
                    <span className="text-sm text-slate-500">{empName(r.employeeId)}</span>
                    {r.day && <span className="text-xs text-slate-400">วันที่ {r.day}{r.toDay ? `-${r.toDay}` : ''}</span>}
                    {(r.fromCode || r.toCode) && <span className="text-xs text-slate-400">{r.fromCode ?? '—'} → {r.toCode ?? '—'}</span>}
                  </div>
                  {r.reason && <div className="text-xs text-slate-400 mt-0.5 truncate">{r.reason}</div>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${st.c}`}>{st.t}</span>
                {canDecide && r.status === 'pending' && (
                  <div className="flex gap-1">
                    <button onClick={() => decide(r.id, 'approved')} title="อนุมัติ" className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check className="w-4 h-4" /></button>
                    <button onClick={() => decide(r.id, 'rejected')} title="ไม่อนุมัติ" className="p-1.5 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestForm({ employees, wardId, year, month, fixedEmployeeId, defaultType, onDone, onError }: {
  employees: Employee[]; wardId: number; year: number; month: number;
  fixedEmployeeId: number | null; defaultType?: 'leave' | 'shift_change' | 'ot' | 'shift_add';
  onDone: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [type, setType] = useState<'leave' | 'shift_change' | 'ot' | 'shift_add'>(defaultType ?? 'leave');
  const [employeeId, setEmployeeId] = useState<number | null>(fixedEmployeeId ?? employees[0]?.id ?? null);
  const [day, setDay] = useState<number>(1);
  const [toDay, setToDay] = useState<number | ''>('');
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { onError('ยังไม่ได้เลือกบุคลากร'); return; }
    setBusy(true);
    try {
      await api.createRequest({
        type, employeeId, wardId, year, month, day,
        toDay: toDay === '' ? null : Number(toDay),
        fromCode: fromCode || null, toCode: toCode || null, reason: reason || null,
      });
      onDone('ส่งคำขอแล้ว');
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'duplicate_ot') onError(err.message);
      else if (err instanceof ApiError && err.code === 'calendar_not_locked') onError(err.message);
      else onError(err?.message || 'ส่งคำขอไม่สำเร็จ');
    } finally { setBusy(false); }
  };

  const field = 'text-sm border border-slate-300 rounded-lg px-3 py-2 w-full';
  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-4 grid sm:grid-cols-2 gap-3">
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">ประเภท</span>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={field}>
          <option value="leave">ขอลา</option>
          <option value="shift_change">ขอเปลี่ยนเวร</option>
          <option value="ot">ขอขึ้น OT</option>
          <option value="shift_add">ขอขึ้นเวรเพิ่ม</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">บุคลากร</span>
        <select value={employeeId ?? ''} onChange={(e) => setEmployeeId(Number(e.target.value))} className={field} disabled={fixedEmployeeId != null}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.prefix}{e.firstName} {e.lastName ?? ''}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">วันที่</span>
        <input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} className={field} />
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">ถึงวันที่ (ถ้าลาหลายวัน)</span>
        <input type="number" min={1} max={31} value={toDay} onChange={(e) => setToDay(e.target.value === '' ? '' : Number(e.target.value))} className={field} />
      </label>
      {type === 'shift_change' && (
        <>
          <label className="text-sm"><span className="block text-slate-500 mb-1">เวรเดิม</span><input value={fromCode} onChange={(e) => setFromCode(e.target.value)} placeholder="เช่น ช" className={field} /></label>
          <label className="text-sm"><span className="block text-slate-500 mb-1">เวรใหม่</span><input value={toCode} onChange={(e) => setToCode(e.target.value)} placeholder="เช่น บ" className={field} /></label>
        </>
      )}
      {type === 'ot' && (
        <label className="text-sm"><span className="block text-slate-500 mb-1">รหัส OT</span><input value={toCode} onChange={(e) => setToCode(e.target.value)} placeholder="เช่น BD / ชot" className={field} /></label>
      )}
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-500 mb-1">เหตุผล</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={field} placeholder="รายละเอียดเพิ่มเติม" />
      </label>
      <div className="sm:col-span-2 flex justify-end">
        <button type="submit" disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg hover:bg-[#0c2a5e] disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}ส่งคำขอ
        </button>
      </div>
    </form>
  );
}
