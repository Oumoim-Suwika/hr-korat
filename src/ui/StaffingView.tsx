import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { Users2, Save, Loader2, Info } from 'lucide-react';

/**
 * ความต้องการพนักงาน — กำหนดจำนวนที่ต้องการต่อเวร × ระดับ (L/M/S/S2) ต่อแต่ละวอร์ด.
 * เก็บใน staffing_requirements (level = L/M/S/S2, shiftCode = ช/บ/ด).
 */
const SHIFTS = [
  { code: 'ช', label: 'เวรเช้า', cls: 'bg-amber-50 text-amber-700' },
  { code: 'บ', label: 'เวรบ่าย', cls: 'bg-sky-50 text-sky-700' },
  { code: 'ด', label: 'เวรดึก', cls: 'bg-indigo-50 text-indigo-700' },
];
const LEVELS: { code: string; name: string }[] = [
  { code: 'L', name: 'ระดับสูง / หัวหน้าเวร' },
  { code: 'M', name: 'ชำนาญการ' },
  { code: 'S', name: 'ปฏิบัติการ' },
  { code: 'S2', name: 'ผู้ช่วย / สนับสนุน' },
];

export default function StaffingView({ wardName, wardId, role }: { wardName: string; wardId: number; role: UserRole }) {
  const [grid, setGrid] = useState<Record<string, number>>({});
  const [actual, setActual] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const canEdit = role === 'supervisor' || role === 'admin';
  const key = (lv: string, sc: string) => `${lv}|${sc}`;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getStaffing(wardId), api.employees(wardId)]).then(([items, emps]) => {
      const g: Record<string, number> = {};
      for (const it of items) g[key(it.level, it.shiftCode)] = it.count;
      setGrid(g); setActual(emps.length);
    }).finally(() => setLoading(false));
  }, [wardId]);

  const set = (lv: string, sc: string, v: number) => setGrid((g) => ({ ...g, [key(lv, sc)]: Math.max(0, v) }));
  const colTotal = (lv: string) => SHIFTS.reduce((s, sh) => s + (grid[key(lv, sh.code)] ?? 0), 0);
  const rowTotal = (sc: string) => LEVELS.reduce((s, lv) => s + (grid[key(lv.code, sc)] ?? 0), 0);
  const grand = useMemo(() => LEVELS.reduce((s, lv) => s + colTotal(lv.code), 0), [grid]);

  const save = async () => {
    setSaving(true);
    try {
      const items = LEVELS.flatMap((lv) => SHIFTS.map((s) => ({ level: lv.code, shiftCode: s.code, count: grid[key(lv.code, s.code)] ?? 0 })));
      await api.setStaffing(wardId, items);
      flash('บันทึกความต้องการพนักงานแล้ว — ใช้กับ AI จัดเวร');
    } catch (e: any) { flash(e?.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const num = 'w-16 text-center border border-slate-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-slate-50';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users2 className="w-5 h-5 text-[#0F3575]" />ความต้องการพนักงาน · {wardName}</h2>
          <p className="text-sm text-slate-500">กำหนดจำนวนที่ต้องการต่อเวร แยกตามระดับ (L / M / S / S2) — ต่อแต่ละวอร์ด</p>
        </div>
        {canEdit && <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึก</button>}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">รวมที่ต้องการ/วัน</div><div className="text-2xl font-bold text-[#0F3575]">{grand}</div><div className="text-xs text-slate-400">อัตรากำลังต่อวัน</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">บุคลากรจริงในวอร์ด</div><div className="text-2xl font-bold text-slate-800">{actual ?? '—'}</div><div className="text-xs text-slate-400">คน</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 hidden lg:block"><div className="text-xs text-slate-500">เวร</div><div className="text-2xl font-bold text-slate-800">{SHIFTS.length}</div><div className="text-xs text-slate-400">เช้า / บ่าย / ดึก</div></div>
      </div>

      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        ระดับ: <b>L</b>=ระดับสูง/หัวหน้าเวร · <b>M</b>=ชำนาญการ · <b>S</b>=ปฏิบัติการ · <b>S2</b>=ผู้ช่วย/สนับสนุน · ตัวเลข = จำนวนคนขั้นต่ำที่ต้องมีในเวรนั้น
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-4 py-3 font-medium">เวร</th>
              {LEVELS.map((lv) => <th key={lv.code} className="px-3 py-3 font-medium text-center" title={lv.name}><span className="inline-block px-2 py-0.5 rounded-full bg-[#0F3575]/10 text-[#0F3575] text-xs font-bold">{lv.code}</span></th>)}
              <th className="px-3 py-3 font-medium text-center">รวม/เวร</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {SHIFTS.map((sh) => (
                <tr key={sh.code} className="hover:bg-slate-50/40">
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg font-medium ${sh.cls}`}><b>{sh.code}</b> {sh.label}</span></td>
                  {LEVELS.map((lv) => (
                    <td key={lv.code} className="px-3 py-3 text-center">
                      <input type="number" min={0} disabled={!canEdit} value={grid[key(lv.code, sh.code)] ?? 0} onChange={(e) => set(lv.code, sh.code, Number(e.target.value))} className={num} />
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-semibold text-[#0F3575]">{rowTotal(sh.code)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#0F3575]/5 font-semibold text-[#0F3575]">
                <td className="px-4 py-2.5">รวมตามระดับ</td>
                {LEVELS.map((lv) => <td key={lv.code} className="px-3 py-2.5 text-center">{colTotal(lv.code)}</td>)}
                <td className="px-3 py-2.5 text-center">{grand}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">* ยอดรวมต่อเวรใช้เป็นเป้าหมายให้ “AI จัดเวรอัตโนมัติ” จัดกำลังคนให้ครบ และใช้เตือนเมื่อกำลังคนไม่พอ</p>
    </div>
  );
}
