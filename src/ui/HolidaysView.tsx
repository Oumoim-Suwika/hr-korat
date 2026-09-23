import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { THAI_HOLIDAYS_2026, THAI_MONTHS } from '../data';
import { CalendarDays, Plus, Trash2, Loader2, DownloadCloud } from 'lucide-react';

export default function HolidaysView({ year, role }: { year: number; role: UserRole }) {
  const ceYear = year - 543;
  const [rows, setRows] = useState<{ id: number; date: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [nd, setNd] = useState({ date: '', name: '' });
  const canEdit = role === 'supervisor' || role === 'admin';

  const load = () => { setLoading(true); api.getHolidays(year).then(setRows).finally(() => setLoading(false)); };
  useEffect(load, [year]);

  const importDefaults = async () => {
    for (const [date, name] of Object.entries(THAI_HOLIDAYS_2026)) {
      if (!rows.some((r) => r.date === date)) await api.addHoliday({ year, date, name });
    }
    load();
  };
  const add = async () => { if (!nd.date || !nd.name) return; await api.addHoliday({ year, ...nd }); setNd({ date: '', name: '' }); load(); };
  const del = async (id: number) => { await api.deleteHoliday(id); load(); };

  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#0F3575]" />ปฏิทินวันหยุด {year} ({ceYear})</h2>
          <p className="text-sm text-slate-500">ใช้กำหนดวันหยุดราชการ สำหรับคำนวณเวร ชot / ค่าตอบแทนวันหยุด</p>
        </div>
        {canEdit && <button onClick={importDefaults} className="flex items-center gap-1.5 text-sm text-[#0F3575] border border-[#0F3575]/30 px-3 py-2 rounded-lg"><DownloadCloud className="w-4 h-4" />นำเข้าวันหยุดราชการ</button>}
      </div>

      {canEdit && (
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-2 items-end">
          <label className="text-sm"><span className="block text-slate-500 text-xs mb-1">วันที่ (MM-DD)</span><input placeholder="12-05" value={nd.date} onChange={(e) => setNd({ ...nd, date: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-28" /></label>
          <label className="text-sm flex-1 min-w-[180px]"><span className="block text-slate-500 text-xs mb-1">ชื่อวันหยุด</span><input value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-full" /></label>
          <button onClick={add} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Plus className="w-4 h-4" />เพิ่ม</button>
        </div>
      )}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : sorted.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีข้อมูลวันหยุด — กด "นำเข้าวันหยุดราชการ"</p> : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {sorted.map((h) => {
            const [mm, dd] = h.date.split('-');
            return (
              <div key={h.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="text-center w-14"><div className="text-lg font-bold text-[#0F3575]">{Number(dd)}</div><div className="text-[11px] text-slate-400">{THAI_MONTHS[Number(mm) - 1]?.slice(0, 3)}</div></div>
                <div className="flex-1 text-sm text-slate-700">{h.name}</div>
                {canEdit && <button onClick={() => del(h.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
