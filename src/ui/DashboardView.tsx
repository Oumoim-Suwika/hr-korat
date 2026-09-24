import React, { useMemo, useState } from 'react';
import { computeClaim, useAllWardsData, cellKey } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { Users, DollarSign, Activity, Building2, Loader2 } from 'lucide-react';

export default function DashboardView({ year, month }: { year: number; month: number }) {
  const { wards, employees, cells, days, loading } = useAllWardsData(year, month);
  const [filterWard, setFilterWard] = useState<number | 'all'>('all');

  const scoped = useMemo(() => employees.filter((e) => filterWard === 'all' || e.homeWardId === filterWard), [employees, filterWard]);
  const claims = scoped.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0);
  const otTotal = claims.reduce((s, c) => s + c.amount, 0);
  const otShifts = claims.reduce((s, c) => s + c.otCount, 0);

  // per-ward breakdown
  const perWard = useMemo(() => wards.map((w) => {
    const emps = employees.filter((e) => e.homeWardId === w.id);
    const cs = emps.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0);
    return { ward: w, staff: emps.length, otPeople: cs.length, otTotal: cs.reduce((s, c) => s + c.amount, 0) };
  }), [wards, employees, cells, days]);

  const wardName = filterWard === 'all' ? 'ทุกกลุ่มงาน' : wards.find((w) => w.id === filterWard)?.name ?? '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">แดชบอร์ดภาพรวม · {wardName}</h2>
          <p className="text-sm text-slate-500">ประจำเดือน {THAI_MONTHS[month - 1]} {year}</p>
        </div>
        <select value={filterWard} onChange={(e) => setFilterWard(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
          <option value="all">ทุกกลุ่มงาน (รวม)</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={Building2} label="กลุ่มงาน" value={`${filterWard === 'all' ? wards.length : 1}`} />
            <Stat icon={Users} label="บุคลากร" value={`${scoped.length} คน`} />
            <Stat icon={Activity} label="เวร OT รวม" value={`${otShifts} เวร`} />
            <Stat icon={DollarSign} label="ยอด OT เดือนนี้" value={`${otTotal.toLocaleString('th-TH')} ฿`} accent />
          </div>

          {filterWard === 'all' && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">สรุปตามกลุ่มงาน</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500"><tr>
                    <th className="text-left px-2 py-1.5 font-medium">กลุ่มงาน</th>
                    <th className="px-2 py-1.5 font-medium text-center">บุคลากร</th>
                    <th className="px-2 py-1.5 font-medium text-center">มี OT</th>
                    <th className="px-2 py-1.5 font-medium text-right">ยอด OT (฿)</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {perWard.map((r) => (
                      <tr key={r.ward.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setFilterWard(r.ward.id)}>
                        <td className="px-2 py-1.5 text-slate-700">{r.ward.name}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500">{r.staff}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500">{r.otPeople}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-[#0F3575]">{r.otTotal.toLocaleString('th-TH')}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-2 py-1.5 text-right" colSpan={3}>รวมทั้งโรงพยาบาล</td>
                      <td className="px-2 py-1.5 text-right text-[#0F3575]">{perWard.reduce((s, r) => s + r.otTotal, 0).toLocaleString('th-TH')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="font-semibold text-slate-700 mb-3">OT รายบุคคลสูงสุด ({wardName})</h3>
            {claims.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มี OT</p> : (
              <ul className="space-y-2">
                {claims.slice().sort((a, b) => b.amount - a.amount).slice(0, 8).map((c) => (
                  <li key={c.employee.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 truncate">{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''} <span className="text-[11px] text-slate-400">({c.employee.positionText})</span></span>
                    <span className="text-slate-400">{c.otCount} เวร · <b className="text-[#0F3575]">{c.amount.toLocaleString('th-TH')}฿</b></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Icon className="w-4 h-4" />{label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}
