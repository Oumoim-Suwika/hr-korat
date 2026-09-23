import React, { useEffect, useState } from 'react';
import { api, type ShiftType } from '../api/client';
import { Clock, Loader2 } from 'lucide-react';

export default function ShiftSettingsView() {
  const [rows, setRows] = useState<ShiftType[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.shiftTypes().then(setRows).finally(() => setLoading(false)); }, []);

  const fmt = (h?: number | null) => (h == null ? '—' : `${String(Math.floor(h)).padStart(2, '0')}.${String(Math.round((h % 1) * 100)).padStart(2, '0')}`);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-[#0F3575]" />ตั้งค่าเวร &amp; ประเภทกะ</h2>
        <p className="text-sm text-slate-500">รหัสกะ ช่วงเวลา และประเภท (OT/ปกติ) — ใช้ทั้งการจัดเวรและคำนวณค่าตอบแทน</p>
      </div>
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">รหัส</th>
              <th className="text-left px-3 py-2 font-medium">ชื่อ</th>
              <th className="px-3 py-2 font-medium text-center">เริ่ม</th>
              <th className="px-3 py-2 font-medium text-center">สิ้นสุด</th>
              <th className="px-3 py-2 font-medium text-center">ชม.</th>
              <th className="px-3 py-2 font-medium text-center">ประเภท</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.code} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><span className="font-mono font-semibold">{s.code}</span></td>
                  <td className="px-3 py-2 text-slate-600">{s.name}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{fmt(s.isWork ? (s as any).startHour : null)}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{fmt(s.isWork ? (s as any).endHour : null)}</td>
                  <td className="px-3 py-2 text-center text-slate-500">{s.hours || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {s.isOt ? <span className="text-xs bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">OT</span>
                      : s.isWork ? <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">ปกติ</span>
                      : <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">หยุด/ลา</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">กฎการจัดเวรระดับ Admin (ห้ามบ่ายต่อดึก / ดึกต่อเช้า, ชั่วโมงสูงสุด-ต่ำสุดต่อสัปดาห์) ตั้งได้ที่หน้า "ตั้งค่า"</p>
    </div>
  );
}
