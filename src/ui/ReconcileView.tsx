import React, { useEffect, useMemo, useState } from 'react';
import { useAllWardsData, computeClaim, cellKey } from '../lib/useRosterData';
import { auditRequestVsClaim } from '../lib/claimAudit';
import { api, type RequestItem, type WorkingCalendar } from '../api/client';
import { THAI_MONTHS } from '../data';
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';

/**
 * ตรวจสอบ ตารางเวร ↔ ตารางเบิก (หลักฐานการจ่าย) — จอกระทบยอดสำหรับการเงิน
 * ไล่ตรวจแต่ละคน: เวร OT ที่ลงไว้ vs ยอดที่จะเบิก + ธงเตือน
 *   • ปฏิทินวันทำการยังไม่ล็อก   • วันลา(อนุมัติ)ชนวัน OT   • คำขอค้างพิจารณา
 */
export default function ReconcileView({ wardId, year, month }: { wardId: number; year: number; month: number }) {
  const { wards, employees, cells, days, loading } = useAllWardsData(year, month);
  const [filterWard, setFilterWard] = useState<number | 'all'>(wardId);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [cals, setCals] = useState<Record<number, WorkingCalendar | null>>({});
  const [busy, setBusy] = useState(false);

  const scopeWardIds = useMemo(() => filterWard === 'all' ? wards.map((w) => w.id) : [filterWard as number], [filterWard, wards]);

  useEffect(() => {
    if (!scopeWardIds.length) return;
    let alive = true;
    setBusy(true);
    Promise.all([
      Promise.all(scopeWardIds.map((wid) => api.getRequests(wid, year, month))),
      Promise.all(scopeWardIds.map((wid) => api.getWorkingCalendar(wid, year, month))),
    ]).then(([reqLists, calList]) => {
      if (!alive) return;
      setRequests(reqLists.flat());
      const cmap: Record<number, WorkingCalendar | null> = {};
      scopeWardIds.forEach((wid, i) => { cmap[wid] = calList[i]; });
      setCals(cmap);
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [scopeWardIds.join(','), year, month]);

  const wardOf = (id?: number) => wards.find((w) => w.id === id)?.name ?? '';
  const scoped = useMemo(() => employees.filter((e) => filterWard === 'all' || e.homeWardId === filterWard), [employees, filterWard]);

  const rows = useMemo(() => scoped.map((e) => {
    const claim = computeClaim(e, cells, days);
    const otDays = days.filter((d) => { const c = cells[cellKey(e.id, d)]; return c?.otCode || c?.otCode2; });
    // approved leave days for this employee
    const leaveDays = new Set<number>();
    for (const r of requests) {
      if (r.employeeId === e.id && r.type === 'leave' && r.status === 'approved' && r.day) {
        const to = r.toDay ?? r.day;
        for (let d = r.day; d <= to; d++) leaveDays.add(d);
      }
    }
    const conflicts = otDays.filter((d) => leaveDays.has(d));
    const pending = requests.filter((r) => r.employeeId === e.id && r.status === 'pending').length;
    const wardLocked = !!cals[e.homeWardId ?? -1]?.locked;
    const flags: string[] = [];
    if (claim.otCount > 0 && !wardLocked) flags.push('ปฏิทินยังไม่ล็อก');
    if (conflicts.length) flags.push(`OT ชนวันลา (วันที่ ${conflicts.join(', ')})`);
    if (pending) flags.push(`คำขอค้าง ${pending} รายการ`);
    return { e, claim, otCount: claim.otCount, amount: claim.amount, flags };
  }).filter((r) => r.otCount > 0 || r.flags.length), [scoped, cells, days, requests, cals]);

  const claimIssues = useMemo(() => auditRequestVsClaim(scoped, cells, days, requests), [scoped, cells, days, requests]);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalOt = rows.reduce((s, r) => s + r.otCount, 0);
  const flagged = rows.filter((r) => r.flags.length).length;
  const scopeName = filterWard === 'all' ? 'ทุกกลุ่มงาน' : wardOf(filterWard as number);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#0F3575]" />ตรวจสอบ ตารางเวร ↔ ตารางเบิก</h2>
          <p className="text-sm text-slate-500">{scopeName} · {THAI_MONTHS[month - 1]} {year} · กระทบยอดก่อนอนุมัติจ่าย</p>
        </div>
        <select value={filterWard} onChange={(e) => setFilterWard(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
          <option value="all">ทุกกลุ่มงาน (รวม)</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="ตารางเวร (เวร OT)" value={`${totalOt} เวร`} />
        <Card label="ตารางเบิก (ยอด)" value={`${totalAmount.toLocaleString('th-TH')} ฿`} />
        <Card label="ต้องตรวจสอบ" value={`${flagged} คน`} warn={flagged > 0} />
        <Card label="สถานะ" value={flagged === 0 ? 'ผ่าน ✓' : 'พบข้อทักท้วง'} accent={flagged === 0} warn={flagged > 0} />
      </div>

      {loading || busy ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : rows.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ไม่มีรายการ OT ให้ตรวจสอบ</p> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
              {filterWard === 'all' && <th className="text-left px-3 py-2 font-medium">กลุ่มงาน</th>}
              <th className="px-3 py-2 font-medium text-center">เวร OT (ตารางเวร)</th>
              <th className="px-3 py-2 font-medium text-right">ยอดเบิก (ตารางเบิก)</th>
              <th className="px-3 py-2 font-medium text-left">ผลตรวจสอบ</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.e.id} className={r.flags.length ? 'bg-amber-50/40' : ''}>
                  <td className="px-3 py-2"><div className="font-medium text-slate-700">{r.e.prefix}{r.e.firstName} {r.e.lastName ?? ''}</div><div className="text-[11px] text-slate-400">{r.e.positionText}</div></td>
                  {filterWard === 'all' && <td className="px-3 py-2 text-slate-500">{wardOf(r.e.homeWardId)}</td>}
                  <td className="px-3 py-2 text-center">{r.otCount}</td>
                  <td className="px-3 py-2 text-right font-medium text-[#0F3575]">{r.amount.toLocaleString('th-TH')}</td>
                  <td className="px-3 py-2">
                    {r.flags.length === 0
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-4 h-4" />ตรงกัน</span>
                      : <div className="space-y-0.5">{r.flags.map((f, i) => <div key={i} className="inline-flex items-center gap-1 text-amber-700 text-xs mr-2"><AlertTriangle className="w-3.5 h-3.5" />{f}</div>)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* AI check: ขอขึ้น ↔ ขอเบิก mismatch (for finance) */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4 text-amber-500" />AI ตรวจสอบ: “ขอขึ้น” ตรงกับ “ขอเบิก” หรือไม่</h3>
        {claimIssues.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />ทุกรายการที่ขอขึ้นตรงกับที่ลงเวร/ขอเบิก</div>
        ) : (
          <div className="bg-white border border-amber-200 rounded-lg divide-y divide-amber-100">
            {claimIssues.map((it, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm"><b className="text-slate-700">{it.name}</b> <span className="text-amber-800">— {it.detail}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 flex items-center gap-1"><Lock className="w-3 h-3" />ยอด "ตารางเบิก" คำนวณจากเวร OT ในตารางเวรโดยตรง — ธงเตือนช่วยให้การเงินตรวจก่อนอนุมัติจ่าย (วันลาชนเวร, ปฏิทินยังไม่ล็อก, คำขอค้าง)</p>
    </div>
  );
}

function Card({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return <div className={`rounded-xl border p-4 ${warn ? 'border-amber-300 bg-amber-50' : accent ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${warn ? 'text-amber-700' : accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</div></div>;
}
