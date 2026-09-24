import React, { useMemo } from 'react';
import { useRosterData, cellKey } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { CalendarHeart, Loader2, Sun, Sunset, Moon, Coffee, Plus } from 'lucide-react';

/**
 * ปฏิทินเวรของฉัน — มุมมองรายบุคคลแบบมือถือ (พร้อมฝังใน LINE OA / LIFF ภายหลัง).
 * แสดงเวรของผู้ใช้ที่ล็อกอิน รายวัน อ่านง่าย ตัวใหญ่ + ปุ่มลัดขอเวร.
 */
const SHIFT_UI: Record<string, { label: string; cls: string; Icon: any }> = {
  'ช': { label: 'เวรเช้า', cls: 'bg-amber-100 text-amber-800 border-amber-200', Icon: Sun },
  'บ': { label: 'เวรบ่าย', cls: 'bg-sky-100 text-sky-800 border-sky-200', Icon: Sunset },
  'ด': { label: 'เวรดึก', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200', Icon: Moon },
  'ออฟ': { label: 'วันหยุด', cls: 'bg-slate-100 text-slate-500 border-slate-200', Icon: Coffee },
  'V': { label: 'ลา', cls: 'bg-green-100 text-green-700 border-green-200', Icon: Coffee },
  'T': { label: 'อบรม/ไปราชการ', cls: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', Icon: Coffee },
};

export default function MyScheduleView({ employeeId, wardId, wardName, year, month, onRequest }: {
  employeeId: number | null; wardId: number; wardName: string; year: number; month: number; onRequest?: () => void;
}) {
  const { employees, cells, days, ceYear, loading } = useRosterData(wardId, year, month);
  const me = employees.find((e) => e.id === employeeId);

  const summary = useMemo(() => {
    if (!employeeId) return { work: 0, ot: 0, off: 0 };
    let work = 0, ot = 0, off = 0;
    for (const d of days) {
      const c = cells[cellKey(employeeId, d)];
      const nc = c?.normalCode;
      if (nc && nc !== 'ออฟ' && nc !== 'V' && nc !== 'T') work++; else off++;
      if (c?.otCode) ot++;
    }
    return { work, ot, off };
  }, [employeeId, cells, days]);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2"><CalendarHeart className="w-5 h-5 text-[#0F3575]" />ปฏิทินเวรของฉัน</h2>
        <p className="text-sm text-slate-500">{me ? `${me.prefix ?? ''}${me.firstName} ${me.lastName ?? ''}` : wardName} · {THAI_MONTHS[month - 1]} {year}</p>
      </div>

      {!employeeId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700 text-center">บัญชีนี้ยังไม่ได้ผูกกับรายชื่อบุคลากร — ให้ผู้ดูแลผูกบัญชีกับพนักงานเพื่อดูเวรส่วนตัว</div>
      ) : loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center"><div className="text-2xl font-bold text-[#0F3575]">{summary.work}</div><div className="text-xs text-slate-500">วันขึ้นเวร</div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center"><div className="text-2xl font-bold text-rose-500">{summary.ot}</div><div className="text-xs text-slate-500">เวร OT</div></div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-center"><div className="text-2xl font-bold text-slate-400">{summary.off}</div><div className="text-xs text-slate-500">วันหยุด</div></div>
          </div>

          {onRequest && <button onClick={onRequest} className="w-full flex items-center justify-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2.5 rounded-xl"><Plus className="w-4 h-4" />ขอลา / เปลี่ยนเวร / ขอ OT</button>}

          <div className="space-y-1.5">
            {days.map((d) => {
              const wd = new Date(ceYear, month - 1, d).getDay();
              const weekend = wd === 0 || wd === 6;
              const c = cells[cellKey(employeeId, d)];
              const nc = c?.normalCode ?? 'ออฟ';
              const ui = SHIFT_UI[nc] ?? SHIFT_UI['ออฟ'];
              const Icon = ui.Icon;
              return (
                <div key={d} className={`flex items-center gap-3 rounded-xl border p-2.5 ${weekend ? 'bg-rose-50/40' : 'bg-white'} border-slate-200`}>
                  <div className="w-12 text-center shrink-0">
                    <div className={`text-xl font-bold ${weekend ? 'text-rose-500' : 'text-slate-700'}`}>{d}</div>
                    <div className="text-[10px] text-slate-400">{['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'][wd]}</div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${ui.cls}`}><Icon className="w-4 h-4" />{ui.label}</div>
                  {c?.otCode && <span className="text-xs font-semibold bg-rose-500 text-white rounded-full px-2 py-1">OT {c.otCode}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
      <p className="text-[11px] text-slate-400 text-center">พร้อมเปิดผ่าน LINE OA (LIFF) — เชื่อมได้เมื่อได้ Channel ของโรงพยาบาล</p>
    </div>
  );
}
