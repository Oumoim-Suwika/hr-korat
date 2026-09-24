import React, { useEffect, useMemo, useState } from 'react';
import { useAllWardsData, computeClaim, downloadFile } from '../lib/useRosterData';
import { api, type Roster } from '../api/client';
import { THAI_MONTHS } from '../data';
import { Loader2, DollarSign, Download, Landmark, Lock, LockOpen, CheckCircle2 } from 'lucide-react';

const OT_COLS = ['ชot', 'บot', 'ดot', 'BD', 'OR'];
const TIMELINE = [
  { d: 'ก่อน 25', t: 'หน่วยจัดทำบันทึกขอขึ้น + ตารางเวร' },
  { d: 'ก่อน 27', t: 'เสนอ ผอ./รองฯ อนุมัติ' },
  { d: 'วันที่ 1', t: 'การเงินเริ่มประมวลผล' },
  { d: 'ถึงวันที่ 5', t: 'หน่วยแก้ไข/บันทึกได้ แล้วการเงินปิดรอบ' },
];

export default function FinanceView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { wards, employees, cells, days, loading } = useAllWardsData(year, month);
  const [filterWard, setFilterWard] = useState<number | 'all'>(wardId);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [busy, setBusy] = useState(false);
  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;
  const wardOf = (id?: number) => wards.find((w) => w.id === id)?.name ?? '';
  const scopeName = filterWard === 'all' ? 'ทุกกลุ่มงาน (รวมทั้งโรงพยาบาล)' : wardOf(filterWard as number);

  // finance close-month lock only for a specific ward
  useEffect(() => {
    if (filterWard === 'all') { setRoster(null); return; }
    let alive = true;
    api.getRoster(filterWard as number, year, month).then((r) => { if (alive) setRoster(r.roster); });
    return () => { alive = false; };
  }, [filterWard, year, month]);
  const financeLocked = !!(roster as any)?.financeLocked;
  const toggleLock = async () => { if (!roster) return; setBusy(true); try { const r = await api.financeLock(roster.id, !financeLocked); setRoster(r); } finally { setBusy(false); } };

  const scoped = useMemo(() => employees.filter((e) => filterWard === 'all' || e.homeWardId === filterWard), [employees, filterWard]);
  const claims = useMemo(() => scoped.map((e) => ({ ...computeClaim(e, cells, days), ward: wardOf(e.homeWardId) })).filter((c) => c.otCount > 0), [scoped, cells, days, wards]);
  const total = claims.reduce((s, c) => s + c.amount, 0);
  const totalOt = claims.reduce((s, c) => s + c.otCount, 0);
  const allMode = filterWard === 'all';

  const exportSummary = () => {
    const header = ['ลำดับ', 'ชื่อ-นามสกุล', ...(allMode ? ['กลุ่มงาน'] : []), 'ตำแหน่ง', ...OT_COLS, 'รวมเวร OT', 'ยอดเบิก (บาท)'];
    const rows = claims.map((c, i) => [i + 1, `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}`.trim(), ...(allMode ? [c.ward] : []), c.employee.positionText ?? '', ...OT_COLS.map((code) => c.byCode[code] ?? 0), c.otCount, c.amount]);
    rows.push(['', '', ...(allMode ? [''] : []), '', ...OT_COLS.map(() => ''), totalOt, total]);
    downloadFile(`สรุปเบิกOT_${allMode ? 'รวมทุกวอร์ด' : wardOf(filterWard as number)}_${monthLabel}.csv`, [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };
  const exportKTB = () => {
    const header = ['ลำดับ', 'เลขที่บัญชี', 'ชื่อบัญชี', ...(allMode ? ['กลุ่มงาน'] : []), 'จำนวนเงิน', 'อ้างอิง'];
    const rows = claims.map((c, i) => [i + 1, c.employee.bankAccount ?? '', `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}`.trim(), ...(allMode ? [c.ward] : []), c.amount.toFixed(2), `OT ${monthLabel}`]);
    downloadFile(`KTB_Corporate_${allMode ? 'รวมทุกวอร์ด' : wardOf(filterWard as number)}_${monthLabel}.csv`, [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-[#0F3575]" />การเงิน &amp; เบิกจ่าย</h2>
          <p className="text-sm text-slate-500">{scopeName} · {monthLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterWard} onChange={(e) => setFilterWard(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-2">
            <option value="all">ทุกกลุ่มงาน (รวม)</option>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button onClick={exportSummary} disabled={!claims.length} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg disabled:opacity-50"><Download className="w-4 h-4" />สรุป (CSV)</button>
          <button onClick={exportKTB} disabled={!claims.length} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg disabled:opacity-50"><Landmark className="w-4 h-4" />KTB {allMode ? 'รวม' : ''}</button>
          {!allMode && roster && <button onClick={toggleLock} disabled={busy} className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border ${financeLocked ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-700 border-slate-300'}`}>{financeLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}{financeLocked ? 'ปิดรอบแล้ว' : 'ปิดรอบเบิก'}</button>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2">
        {TIMELINE.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1 min-w-[150px]">
            <div className="w-7 h-7 rounded-full bg-[#0F3575]/10 text-[#0F3575] grid place-items-center shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
            <div><div className="text-xs font-semibold text-slate-700">{s.d}</div><div className="text-[11px] text-slate-400 leading-tight">{s.t}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="ยอดเบิกรวม" value={`${total.toLocaleString('th-TH')} ฿`} accent />
        <Card label="จำนวนเวร OT รวม" value={`${totalOt} เวร`} />
        <Card label="ผู้มีสิทธิ์เบิก" value={`${claims.length} คน`} />
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : claims.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีรายการ OT (ลงตารางเวร + ล็อกวันทำการก่อน)</p> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
              {allMode && <th className="text-left px-3 py-2 font-medium">กลุ่มงาน</th>}
              {OT_COLS.map((c) => <th key={c} className="px-2 py-2 font-medium text-center">{c}</th>)}
              <th className="px-3 py-2 font-medium text-center">รวมเวร</th>
              <th className="px-3 py-2 font-medium text-right">ยอดเบิก (฿)</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <tr key={c.employee.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><div className="font-medium text-slate-700">{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</div><div className="text-[11px] text-slate-400">{c.employee.positionText}</div></td>
                  {allMode && <td className="px-3 py-2 text-slate-500">{c.ward}</td>}
                  {OT_COLS.map((code) => <td key={code} className="px-2 py-2 text-center text-slate-600">{c.byCode[code] ?? '—'}</td>)}
                  <td className="px-3 py-2 text-center font-medium">{c.otCount}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0F3575]">{c.amount.toLocaleString('th-TH')}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right" colSpan={allMode ? OT_COLS.length + 2 : OT_COLS.length + 1}>รวมทั้งสิ้น</td>
                <td className="px-3 py-2 text-center">{totalOt}</td>
                <td className="px-3 py-2 text-right text-[#0F3575]">{total.toLocaleString('th-TH')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">รูปแบบไฟล์ KTB เป็นแบบร่าง ปรับตามสเปกไฟล์นำเข้าของธนาคารได้ · โหมด "ทุกกลุ่มงาน" รวมยอดทั้งโรงพยาบาลในไฟล์เดียว</p>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value}</div></div>;
}
