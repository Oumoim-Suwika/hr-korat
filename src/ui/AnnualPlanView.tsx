import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { CalendarRange, Plus, Trash2, Save, RotateCcw, Info, Send, CheckCircle2 } from 'lucide-react';

/**
 * Annual Order Setup + Mid-Year Adjustment — a yearly manpower/budget worksheet
 * per ward. This is a PLANNING tool (stored locally per ward/year); it is not
 * wired to payroll disbursement. It captures the approved establishment
 * (กรอบอัตราตามคำสั่ง), a mid-year adjustment, current filled posts, the gap,
 * and an annual budget estimate.
 */
interface PlanRow {
  id: string;
  position: string;
  approved: number;      // กรอบอัตราตามคำสั่ง (ต้นปี)
  midYear: number;       // ปรับกลางปี (+/-)
  filled: number;        // บรรจุแล้ว
  wagePerMonth: number;  // เงินเดือน/คน/เดือน (บาท)
}

const DEFAULT_ROWS: Omit<PlanRow, 'id'>[] = [
  { position: 'พยาบาลวิชาชีพ (RN)', approved: 0, midYear: 0, filled: 0, wagePerMonth: 0 },
  { position: 'ผู้ช่วยพยาบาล (PN)', approved: 0, midYear: 0, filled: 0, wagePerMonth: 0 },
  { position: 'พนักงานช่วยเหลือ (NA)', approved: 0, midYear: 0, filled: 0, wagePerMonth: 0 },
  { position: 'ลูกจ้างชั่วคราว (รายวัน)', approved: 0, midYear: 0, filled: 0, wagePerMonth: 0 },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const baht = (n: number) => n.toLocaleString('th-TH');

export default function AnnualPlanView({ wardName, wardId, year, role }: {
  wardName: string; wardId: number; year: number; role: UserRole;
}) {
  const storeKey = `annualplan_${wardId}_${year}`;
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [status, setStatus] = useState<'draft' | 'pending' | 'approved'>('draft');
  const [approvedAt, setApprovedAt] = useState<string | null>(null);
  const [actualCount, setActualCount] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canEdit = role === 'supervisor' || role === 'admin';
  const canApprove = role === 'admin';         // ผู้บริหาร
  const canSubmit = role === 'supervisor' || role === 'admin';

  const persist = (nextRows: PlanRow[], st: typeof status, appAt: string | null) =>
    localStorage.setItem(storeKey, JSON.stringify({ rows: nextRows, meta: { status: st, approvedAt: appAt } }));

  useEffect(() => {
    const raw = localStorage.getItem(storeKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) { setRows(parsed); setStatus('draft'); setApprovedAt(null); return; } // legacy
        setRows(parsed.rows ?? []); setStatus(parsed.meta?.status ?? 'draft'); setApprovedAt(parsed.meta?.approvedAt ?? null); return;
      } catch { /* fall through */ }
    }
    setRows(DEFAULT_ROWS.map((r) => ({ ...r, id: uid() }))); setStatus('draft'); setApprovedAt(null);
  }, [storeKey]);

  useEffect(() => { api.employees(wardId).then((e) => setActualCount(e.length)).catch(() => setActualCount(null)); }, [wardId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };
  // Editing after submission/approval reverts to draft (requires re-approval).
  const editRows = (updater: (rs: PlanRow[]) => PlanRow[]) => setRows((rs) => { const next = updater(rs); if (status !== 'draft') { setStatus('draft'); setApprovedAt(null); } return next; });
  const patch = (id: string, p: Partial<PlanRow>) => editRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const addRow = () => editRows((rs) => [...rs, { id: uid(), position: '', approved: 0, midYear: 0, filled: 0, wagePerMonth: 0 }]);
  const removeRow = (id: string) => editRows((rs) => rs.filter((r) => r.id !== id));
  const save = () => { persist(rows, status, approvedAt); flash('บันทึกแผนกำลังคนรายปีแล้ว (จัดเก็บในเครื่อง)'); };
  const reset = () => { localStorage.removeItem(storeKey); setRows(DEFAULT_ROWS.map((r) => ({ ...r, id: uid() }))); setStatus('draft'); setApprovedAt(null); flash('รีเซ็ตเป็นค่าเริ่มต้นแล้ว'); };
  const submit = () => { setStatus('pending'); persist(rows, 'pending', null); flash('เสนอผู้บริหารพิจารณาอนุมัติแล้ว'); };
  const approve = () => { const at = new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }); setStatus('approved'); setApprovedAt(at); persist(rows, 'approved', at); flash('ผู้บริหารอนุมัติแผนกำลังคนแล้ว'); };

  const statusBadge = () => {
    if (status === 'approved') return <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">อนุมัติโดยผู้บริหารแล้ว{approvedAt ? ` · ${approvedAt}` : ''}</span>;
    if (status === 'pending') return <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">รอผู้บริหารอนุมัติ</span>;
    return <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">ฉบับร่าง</span>;
  };

  const totals = useMemo(() => rows.reduce((acc, r) => {
    const eff = r.approved + r.midYear;
    acc.approved += r.approved; acc.midYear += r.midYear; acc.effective += eff;
    acc.filled += r.filled; acc.gap += eff - r.filled; acc.budget += eff * r.wagePerMonth * 12;
    return acc;
  }, { approved: 0, midYear: 0, effective: 0, filled: 0, gap: 0, budget: 0 }), [rows]);

  const inp = 'w-full text-sm text-right border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CalendarRange className="w-5 h-5 text-[#0F3575]" />แผนกำลังคน &amp; งบประมาณรายปี · {wardName}</h2>
          <p className="text-sm text-slate-500">ปีงบประมาณ {year} · กรอบอัตราตามคำสั่ง (Annual Order) และการปรับกลางปี (Mid-Year Adjustment) &nbsp;{statusBadge()}</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg"><RotateCcw className="w-4 h-4" />รีเซ็ต</button>
            <button onClick={addRow} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"><Plus className="w-4 h-4" />เพิ่มตำแหน่ง</button>
            <button onClick={save} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"><Save className="w-4 h-4" />บันทึกแผน</button>
            {canSubmit && status !== 'approved' && <button onClick={submit} disabled={status === 'pending'} className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg disabled:opacity-50"><Send className="w-4 h-4" />เสนอผู้บริหาร</button>}
            {canApprove && status !== 'approved' && <button onClick={approve} className="flex items-center gap-1.5 text-sm text-white bg-emerald-600 px-3 py-2 rounded-lg"><CheckCircle2 className="w-4 h-4" />อนุมัติแผน (ผู้บริหาร)</button>}
          </div>
        )}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <Info className="w-3.5 h-3.5 shrink-0" />
        บุคลากรจริงในวอร์ดขณะนี้: <b className="text-[#0F3575]">{actualCount ?? '—'}</b> คน · ใช้อ้างอิงเทียบกับกรอบอัตรา — แผนนี้เป็นเครื่องมือวางแผน ยังไม่ผูกกับการจ่ายเงินจริง
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">ตำแหน่ง / ระดับ</th>
              <th className="px-3 py-2 font-medium text-center">กรอบ (คำสั่ง)</th>
              <th className="px-3 py-2 font-medium text-center">ปรับกลางปี</th>
              <th className="px-3 py-2 font-medium text-center">กรอบสุทธิ</th>
              <th className="px-3 py-2 font-medium text-center">บรรจุแล้ว</th>
              <th className="px-3 py-2 font-medium text-center">ขาด/เกิน</th>
              <th className="px-3 py-2 font-medium text-center">เงินเดือน/คน/ด.</th>
              <th className="px-3 py-2 font-medium text-center">งบประมาณ/ปี</th>
              {canEdit && <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const eff = r.approved + r.midYear;
              const gap = eff - r.filled;
              const budget = eff * r.wagePerMonth * 12;
              return (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <input value={r.position} disabled={!canEdit} onChange={(e) => patch(r.id, { position: e.target.value })}
                      placeholder="ชื่อตำแหน่ง" className="w-full text-sm border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                  </td>
                  <td className="px-3 py-2"><input type="number" min={0} disabled={!canEdit} value={r.approved} onChange={(e) => patch(r.id, { approved: Number(e.target.value) })} className={inp} /></td>
                  <td className="px-3 py-2"><input type="number" disabled={!canEdit} value={r.midYear} onChange={(e) => patch(r.id, { midYear: Number(e.target.value) })} className={inp} /></td>
                  <td className="px-3 py-2 text-center font-semibold text-slate-700">{eff}</td>
                  <td className="px-3 py-2"><input type="number" min={0} disabled={!canEdit} value={r.filled} onChange={(e) => patch(r.id, { filled: Number(e.target.value) })} className={inp} /></td>
                  <td className={`px-3 py-2 text-center font-semibold ${gap > 0 ? 'text-rose-600' : gap < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{gap > 0 ? `ขาด ${gap}` : gap < 0 ? `เกิน ${-gap}` : 'พอดี'}</td>
                  <td className="px-3 py-2"><input type="number" min={0} disabled={!canEdit} value={r.wagePerMonth} onChange={(e) => patch(r.id, { wagePerMonth: Number(e.target.value) })} className={inp} /></td>
                  <td className="px-3 py-2 text-right text-slate-700">{baht(budget)}</td>
                  {canEdit && <td className="px-2 py-2 text-center"><button onClick={() => removeRow(r.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button></td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#0F3575]/5 font-semibold text-[#0F3575]">
              <td className="px-3 py-2">รวมทั้งสิ้น</td>
              <td className="px-3 py-2 text-center">{totals.approved}</td>
              <td className="px-3 py-2 text-center">{totals.midYear}</td>
              <td className="px-3 py-2 text-center">{totals.effective}</td>
              <td className="px-3 py-2 text-center">{totals.filled}</td>
              <td className="px-3 py-2 text-center">{totals.gap > 0 ? `ขาด ${totals.gap}` : totals.gap < 0 ? `เกิน ${-totals.gap}` : 'พอดี'}</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right">{baht(totals.budget)} บาท</td>
              {canEdit && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
