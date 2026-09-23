import React, { useState } from 'react';
import { useRosterData, cellKey } from '../lib/useRosterData';
import { THAI_MONTHS, THAI_DAYS_SHORT } from '../data';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const GROUPS: { code: string; label: string; ot: string }[] = [
  { code: 'ช', label: 'เวรเช้า', ot: 'ชot' },
  { code: 'บ', label: 'เวรบ่าย', ot: 'บot' },
  { code: 'ด', label: 'เวรดึก', ot: 'ดot' },
];

export default function DailyView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, days, ceYear, loading } = useRosterData(wardId, year, month);
  const [day, setDay] = useState(1);
  const wd = new Date(ceYear, month - 1, day).getDay();

  const empName = (id: number) => { const e = employees.find((x) => x.id === id); return e ? `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}` : ''; };

  const onShift = (shiftCode: string) => employees.filter((e) => cells[cellKey(e.id, day)]?.normalCode === shiftCode);
  const onOt = () => employees.filter((e) => cells[cellKey(e.id, day)]?.otCode).map((e) => ({ e, code: cells[cellKey(e.id, day)]!.otCode! }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">เวรรายวัน · {wardName}</h2>
          <p className="text-sm text-slate-500">{THAI_MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDay((d) => Math.max(1, d - 1))} className="p-2 rounded-lg border border-slate-200"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center min-w-[90px]"><div className="text-2xl font-bold text-[#0F3575]">{day}</div><div className="text-xs text-slate-400">วัน{['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'][wd]}</div></div>
          <button onClick={() => setDay((d) => Math.min(days.length, d + 1))} className="p-2 rounded-lg border border-slate-200"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GROUPS.map((g) => {
            const people = onShift(g.code);
            return (
              <div key={g.code} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-slate-700">{g.label}</h3><span className="text-xs bg-slate-100 rounded-full px-2 py-0.5 text-slate-500">{people.length} คน</span></div>
                {people.length === 0 ? <p className="text-sm text-slate-300">—</p> : <ul className="space-y-1 text-sm text-slate-600">{people.map((e) => <li key={e.id}>{empName(e.id)}</li>)}</ul>}
              </div>
            );
          })}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-rose-700">OT / บ่ายดึก</h3><span className="text-xs bg-rose-100 rounded-full px-2 py-0.5 text-rose-600">{onOt().length} คน</span></div>
            {onOt().length === 0 ? <p className="text-sm text-rose-300">—</p> : <ul className="space-y-1 text-sm text-rose-700">{onOt().map(({ e, code }) => <li key={e.id}>{empName(e.id)} <span className="text-xs font-semibold">({code})</span></li>)}</ul>}
          </div>
        </div>
      )}
    </div>
  );
}
