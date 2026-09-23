import React from 'react';
import { useRosterData, computeClaim } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, BarChart3 } from 'lucide-react';

export default function ReportsView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, days, loading } = useRosterData(wardId, year, month);
  const claims = employees.map((e) => computeClaim(e, cells, days));
  const withOt = claims.filter((c) => c.otCount > 0);

  const perPerson = withOt.map((c) => ({ name: `${c.employee.firstName}`, เวร: c.otCount, เงิน: c.amount }))
    .sort((a, b) => b.เงิน - a.เงิน).slice(0, 12);

  const byCode: Record<string, number> = {};
  for (const c of claims) for (const [code, n] of Object.entries(c.byCode)) byCode[code] = (byCode[code] || 0) + (n as number);
  const codeData = Object.entries(byCode).map(([name, value]) => ({ name, value }));

  const total = withOt.reduce((s, c) => s + c.amount, 0);
  const COLORS = ['#0F3575', '#2563eb', '#0891b2', '#e11d48', '#059669'];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#0F3575]" />รายงาน &amp; วิเคราะห์ · {wardName}</h2>
        <p className="text-sm text-slate-500">{THAI_MONTHS[month - 1]} {year} · การกระจายเวรและค่าตอบแทน (ความเป็นธรรม)</p>
      </div>
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="ยอด OT รวม" value={`${total.toLocaleString('th-TH')} ฿`} />
            <Stat label="ผู้มี OT" value={`${withOt.length} คน`} />
            <Stat label="เวร OT รวม" value={`${withOt.reduce((s, c) => s + c.otCount, 0)}`} />
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-700 mb-3">ค่าตอบแทน OT ต่อคน (เกลี่ยความเป็นธรรม)</h3>
            {perPerson.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={perPerson}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="เงิน" radius={[4, 4, 0, 0]}>{perPerson.map((_, i) => <Cell key={i} fill="#0F3575" />)}</Bar></BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-700 mb-3">จำนวนเวรตามรหัส OT</h3>
            {codeData.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={codeData}><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{codeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="text-xl font-bold text-slate-800">{value}</div></div>;
}
