import React, { useMemo, useState } from 'react';
import { computeClaim, useAllWardsData, cellKey } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import {
  Users, Activity, Scale, CalendarCheck, Loader2, CalendarPlus, Calendar, Send, FileText, BarChart3, ChevronRight,
} from 'lucide-react';

const ROLE_TH: Record<string, { label: string; color: string }> = {
  doctor: { label: 'แพทย์', color: '#0F3575' },
  nurse: { label: 'พยาบาลวิชาชีพ', color: '#266BFF' },
  assistant: { label: 'ผู้ช่วยพยาบาล', color: '#14B8A6' },
  room: { label: 'ห้องผ่าตัด', color: '#7C5CFF' },
  support: { label: 'สายสนับสนุน', color: '#F59E0B' },
};

function fairnessScore(counts: number[]): number {
  const xs = counts.filter((n) => n > 0);
  if (xs.length < 2) return 100;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (mean === 0) return 100;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return Math.max(0, Math.min(100, Math.round(100 * (1 - sd / mean))));
}

export default function DashboardView({ year, month, userName, onNav }: { year: number; month: number; userName?: string; onNav?: (tab: string) => void }) {
  const { wards, employees, cells, days, loading } = useAllWardsData(year, month);
  const [filterWard, setFilterWard] = useState<number | 'all'>('all');

  const scoped = useMemo(() => employees.filter((e) => filterWard === 'all' || e.homeWardId === filterWard), [employees, filterWard]);
  const claims = useMemo(() => scoped.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0), [scoped, cells, days]);
  const otTotal = claims.reduce((s, c) => s + c.amount, 0);
  const otShifts = claims.reduce((s, c) => s + c.otCount, 0);

  const worked = (id: number) => days.some((d) => { const c = cells[cellKey(id, d)]; return (c?.normalCode && c.normalCode !== 'ออฟ') || c?.otCode || c?.otCode2; });
  const scheduled = useMemo(() => scoped.filter((e) => worked(e.id)).length, [scoped, cells, days]);
  const schedPct = scoped.length ? Math.round((scheduled / scoped.length) * 100) : 0;
  const fairness = useMemo(() => fairnessScore(claims.map((c) => c.otCount)), [claims]);

  const byRole = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of scoped) c[e.role] = (c[e.role] ?? 0) + 1;
    return Object.entries(ROLE_TH).map(([k, v]) => ({ ...v, key: k, count: c[k] ?? 0 })).filter((r) => r.count > 0);
  }, [scoped]);
  const roleMax = Math.max(1, ...byRole.map((r) => r.count));

  const perWard = useMemo(() => wards.map((w) => {
    const emps = employees.filter((e) => e.homeWardId === w.id);
    const cs = emps.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0);
    return { ward: w, staff: emps.length, otPeople: cs.length, otTotal: cs.reduce((s, c) => s + c.amount, 0) };
  }), [wards, employees, cells, days]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const wardName = filterWard === 'all' ? 'ทุกกลุ่มงาน' : wards.find((w) => w.id === filterWard)?.name ?? '';

  return (
    <div className="space-y-5">
      {/* greeting header */}
      <div className="rounded-2xl luxury-header-gradient text-white p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{greet}{userName ? ` · ${userName}` : ''}</h2>
            <span className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">DEMO</span>
          </div>
          <p className="text-sm text-white/70 mt-0.5">ภาพรวมการจัดเวรและค่าตอบแทน ประจำเดือน {THAI_MONTHS[month - 1]} {year}</p>
        </div>
        <button onClick={() => onNav?.('schedule')} className="flex items-center gap-1.5 text-sm font-medium bg-[#F97316] hover:bg-[#ea6a0c] text-white px-4 py-2.5 rounded-xl shadow-lg">
          <CalendarPlus className="w-4 h-4" />สร้าง/จัดตารางเวร {THAI_MONTHS[month - 1]}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-slate-500">แสดงข้อมูล: <b className="text-slate-700">{wardName}</b></div>
        <select value={filterWard} onChange={(e) => setFilterWard(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
          <option value="all">ทุกกลุ่มงาน (รวม)</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} label="บุคลากรทั้งหมด" value={`${scoped.length}`} unit="คน" tone="ink" />
            <Kpi icon={CalendarCheck} label="จัดเวรแล้ว" value={`${scheduled}`} unit={`/ ${scoped.length} คน`} tone="blue" />
            <Kpi icon={Activity} label="อัตราการจัดเวร" value={`${schedPct}%`} unit="ของบุคลากร" tone={schedPct >= 80 ? 'green' : 'amber'} />
            <Kpi icon={Scale} label="คะแนนความยุติธรรม" value={`${fairness}`} unit="/ 100" tone={fairness >= 80 ? 'green' : 'amber'} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* staff by level/line */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-1">
              <h3 className="font-semibold text-slate-700 mb-3">บุคลากรแยกตามสาย</h3>
              {byRole.length === 0 ? <p className="text-sm text-slate-400">—</p> : (
                <div className="space-y-2.5">
                  {byRole.map((r) => (
                    <div key={r.key}>
                      <div className="flex justify-between text-xs mb-1"><span className="text-slate-600">{r.label}</span><b className="text-slate-700">{r.count}</b></div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(r.count / roleMax) * 100}%`, background: r.color }} /></div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-sm">
                <span className="text-slate-500">ยอด OT เดือนนี้</span>
                <b className="text-[#0F3575]">{otTotal.toLocaleString('th-TH')} ฿ · {otShifts} เวร</b>
              </div>
            </div>

            {/* per-ward summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
              <h3 className="font-semibold text-slate-700 mb-3">สรุปตามกลุ่มงาน</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-500"><tr>
                    <th className="text-left px-2 py-1.5 font-medium">กลุ่มงาน</th>
                    <th className="px-2 py-1.5 font-medium text-center">บุคลากร</th>
                    <th className="px-2 py-1.5 font-medium text-center">มี OT</th>
                    <th className="px-2 py-1.5 font-medium text-right">ยอด OT (฿)</th>
                    <th className="w-6" />
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {perWard.map((r) => (
                      <tr key={r.ward.id} className="hover:bg-slate-50/60 cursor-pointer" onClick={() => setFilterWard(r.ward.id)}>
                        <td className="px-2 py-1.5 text-slate-700">{r.ward.name}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500">{r.staff}</td>
                        <td className="px-2 py-1.5 text-center text-slate-500">{r.otPeople}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-[#0F3575]">{r.otTotal.toLocaleString('th-TH')}</td>
                        <td className="text-slate-300"><ChevronRight className="w-4 h-4" /></td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-2 py-1.5 text-right" colSpan={3}>รวมทั้งโรงพยาบาล</td>
                      <td className="px-2 py-1.5 text-right text-[#0F3575]">{perWard.reduce((s, r) => s + r.otTotal, 0).toLocaleString('th-TH')}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* top OT + quick actions */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 lg:col-span-2">
              <h3 className="font-semibold text-slate-700 mb-3">OT รายบุคคลสูงสุด</h3>
              {claims.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มี OT</p> : (
                <ul className="space-y-2">
                  {claims.slice().sort((a, b) => b.amount - a.amount).slice(0, 6).map((c) => (
                    <li key={c.employee.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate">{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''} <span className="text-[11px] text-slate-400">({c.employee.positionText})</span></span>
                      <span className="text-slate-400 shrink-0 ml-2">{c.otCount} เวร · <b className="text-[#0F3575]">{c.amount.toLocaleString('th-TH')}฿</b></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">ทางลัด</h3>
              <div className="grid grid-cols-2 gap-2">
                <QuickBtn icon={Calendar} label="ตารางเวร" onClick={() => onNav?.('schedule')} />
                <QuickBtn icon={Send} label="คำขอ" onClick={() => onNav?.('ot')} />
                <QuickBtn icon={FileText} label="ฟอร์มเบิก" onClick={() => onNav?.('documents')} />
                <QuickBtn icon={BarChart3} label="รายงาน" onClick={() => onNav?.('reports')} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, unit, tone }: any) {
  const tones: Record<string, string> = { ink: 'text-slate-800', blue: 'text-[#266BFF]', green: 'text-emerald-600', amber: 'text-amber-600' };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Icon className="w-4 h-4" />{label}</div>
      <div className={`text-2xl font-bold ${tones[tone] ?? 'text-slate-800'}`}>{value} <span className="text-xs font-normal text-slate-400">{unit}</span></div>
    </div>
  );
}

function QuickBtn({ icon: Icon, label, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 hover:border-[#266BFF]/40 hover:bg-[#266BFF]/5 transition text-slate-600 hover:text-[#0F3575]">
      <Icon className="w-5 h-5" /><span className="text-xs font-medium">{label}</span>
    </button>
  );
}
