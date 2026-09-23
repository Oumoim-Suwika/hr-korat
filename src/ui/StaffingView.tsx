import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { Users2, Save, Loader2 } from 'lucide-react';

const LEVELS = ['หัวหน้าเวร', 'พยาบาลวิชาชีพ (RN)', 'ผู้ช่วยพยาบาล (PN)', 'พนักงานช่วยเหลือ (NA)'];
const SHIFTS = [{ code: 'ช', label: 'เช้า' }, { code: 'บ', label: 'บ่าย' }, { code: 'ด', label: 'ดึก' }];

export default function StaffingView({ wardName, wardId, role }: { wardName: string; wardId: number; role: UserRole }) {
  const [grid, setGrid] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const canEdit = role === 'supervisor' || role === 'admin';
  const key = (lv: string, sc: string) => `${lv}|${sc}`;

  useEffect(() => {
    setLoading(true);
    api.getStaffing(wardId).then((items) => {
      const g: Record<string, number> = {};
      for (const it of items) g[key(it.level, it.shiftCode)] = it.count;
      setGrid(g);
    }).finally(() => setLoading(false));
  }, [wardId]);

  const save = async () => {
    const items = LEVELS.flatMap((lv) => SHIFTS.map((s) => ({ level: lv, shiftCode: s.code, count: grid[key(lv, s.code)] ?? 0 })));
    await api.setStaffing(wardId, items);
    setToast('บันทึกจำนวนคนตามตำแหน่งแล้ว'); setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users2 className="w-5 h-5 text-[#0F3575]" />ความต้องการพนักงาน · {wardName}</h2>
          <p className="text-sm text-slate-500">กำหนดจำนวนคนขั้นต่ำต่อเวร ตามตำแหน่ง/ระดับ (ตามคำสั่งของวอร์ด)</p>
        </div>
        {canEdit && <button onClick={save} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Save className="w-4 h-4" />บันทึก</button>}
      </div>
      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ตำแหน่ง / ระดับ</th>
              {SHIFTS.map((s) => <th key={s.code} className="px-3 py-2 font-medium text-center">{s.label} ({s.code})</th>)}
              <th className="px-3 py-2 font-medium text-center">รวม/วัน</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {LEVELS.map((lv) => {
                const rowTotal = SHIFTS.reduce((s, sh) => s + (grid[key(lv, sh.code)] ?? 0), 0);
                return (
                  <tr key={lv}>
                    <td className="px-3 py-2 text-slate-600">{lv}</td>
                    {SHIFTS.map((s) => (
                      <td key={s.code} className="px-3 py-2 text-center">
                        <input type="number" min={0} disabled={!canEdit} value={grid[key(lv, s.code)] ?? 0}
                          onChange={(e) => setGrid({ ...grid, [key(lv, s.code)]: Number(e.target.value) })}
                          className="w-14 text-center border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50" />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold text-[#0F3575]">{rowTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
