import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { THAI_HOLIDAYS_2026, HOLIDAY_EN_2026, THAI_MONTHS, THAI_DAYS_FULL } from '../data';
import { CalendarDays, Plus, Trash2, Loader2, DownloadCloud, CheckCircle2, X } from 'lucide-react';

interface Holiday { id: number; date: string; name: string; }

export default function HolidaysView({ year, role }: { year: number; role: UserRole }) {
  const ceYear = year - 543;
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [nd, setNd] = useState({ date: '', name: '' });
  const canEdit = role === 'supervisor' || role === 'admin';
  const canAutoImport = year === 2569;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const load = () => { setLoading(true); api.getHolidays(year).then(setRows).finally(() => setLoading(false)); };
  useEffect(load, [year]);

  const importDefaults = async () => {
    setBusy(true);
    try {
      let added = 0;
      for (const [date, name] of Object.entries(THAI_HOLIDAYS_2026)) {
        if (!rows.some((r) => r.date === date)) { await api.addHoliday({ year, date, name }); added++; }
      }
      flash(added ? `ซิงค์วันหยุดราชการ ${year} แล้ว ${added} วัน` : `วันหยุด ${year} ครบแล้ว`);
      load();
    } finally { setBusy(false); }
  };
  const add = async () => { if (!nd.date || !nd.name) return; await api.addHoliday({ year, ...nd }); setNd({ date: '', name: '' }); setShowAdd(false); load(); };
  const del = async (id: number) => { await api.deleteHoliday(id); load(); };

  // today (for past/upcoming) — compare within the selected BE year
  const now = new Date();
  const isPast = (date: string) => {
    const [mm, dd] = date.split('-').map(Number);
    return new Date(ceYear, mm - 1, dd) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  const pastCount = useMemo(() => rows.filter((r) => isPast(r.date)).length, [rows]);

  // group by month
  const byMonth = useMemo(() => {
    const g: Record<number, Holiday[]> = {};
    for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
      const m = Number(r.date.split('-')[0]);
      (g[m] ??= []).push(r);
    }
    return g;
  }, [rows]);
  const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b);

  const weekdayThai = (date: string) => { const [mm, dd] = date.split('-').map(Number); return THAI_DAYS_FULL[new Date(ceYear, mm - 1, dd).getDay()]; };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-[#0F3575]" />ปฏิทินวันหยุด</h2>
          <p className="text-sm text-slate-500">จัดการวันหยุดราชการสำหรับการคำนวณเวร ชot / ค่าตอบแทนวันหยุด</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={importDefaults} disabled={busy || !canAutoImport} title={canAutoImport ? '' : 'มีชุดข้อมูลอัตโนมัติเฉพาะปี 2569'} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}ซิงค์วันหยุดไทย</button>
            <button onClick={() => setShowAdd((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#F97316] px-3 py-2 rounded-lg hover:bg-[#ea6a0c]"><Plus className="w-4 h-4" />เพิ่มวันหยุด</button>
          </div>
        )}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500 mb-1">ปีงบประมาณ</div><div className="text-2xl font-bold text-[#0F3575]">{year}</div><div className="text-xs text-slate-400">ค.ศ. {ceYear}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500 mb-1">วันหยุดทั้งหมด</div><div className="text-2xl font-bold text-slate-800">{rows.length}</div><div className="text-xs text-slate-400">วัน</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500 mb-1">ที่ผ่านมาแล้ว</div><div className="text-2xl font-bold text-slate-800">{pastCount}</div><div className="text-xs text-slate-400">เหลือ {rows.length - pastCount} วัน</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500 mb-1">สถานะ</div><div className={`text-lg font-bold flex items-center gap-1 ${rows.length ? 'text-emerald-600' : 'text-amber-600'}`}>{rows.length ? <><CheckCircle2 className="w-4 h-4" />พร้อมใช้งาน</> : 'ยังไม่ได้นำเข้า'}</div></div>
      </div>

      {showAdd && canEdit && (
        <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap gap-2 items-end">
          <label className="text-sm"><span className="block text-slate-500 text-xs mb-1">วันที่ (MM-DD)</span><input placeholder="12-05" value={nd.date} onChange={(e) => setNd({ ...nd, date: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-28" /></label>
          <label className="text-sm flex-1 min-w-[180px]"><span className="block text-slate-500 text-xs mb-1">ชื่อวันหยุด</span><input value={nd.name} onChange={(e) => setNd({ ...nd, name: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm w-full" /></label>
          <button onClick={add} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Plus className="w-4 h-4" />บันทึก</button>
          <button onClick={() => setShowAdd(false)} className="p-2 text-slate-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* holidays grouped by month */}
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : rows.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีข้อมูลวันหยุด — กด "ซิงค์วันหยุดไทย"</p> : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><div className="font-semibold text-slate-800">วันหยุดในปี {year}</div><div className="text-xs text-slate-400">จัดกลุ่มตามเดือน · เลขวันที่และวันในสัปดาห์ตามปฏิทินราชการ</div></div>
          {months.map((m) => (
            <div key={m}>
              <div className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">{THAI_MONTHS[m - 1]}</div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {byMonth[m].map((h) => {
                    const [, dd] = h.date.split('-');
                    const past = isPast(h.date);
                    return (
                      <tr key={h.id} className={`hover:bg-slate-50/60 ${past ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-2.5 w-44"><span className="text-slate-500">{weekdayThai(h.date)} </span><b className="text-slate-800">{Number(dd)} {THAI_MONTHS[m - 1].slice(0, 3)}</b></td>
                        <td className="px-4 py-2.5 text-slate-700">{h.name}</td>
                        <td className="px-4 py-2.5 text-slate-400 hidden sm:table-cell">{HOLIDAY_EN_2026[h.date] ?? ''}</td>
                        <td className="px-4 py-2.5 text-right w-16">{canEdit && <button onClick={() => del(h.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"><Trash2 className="w-4 h-4" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
