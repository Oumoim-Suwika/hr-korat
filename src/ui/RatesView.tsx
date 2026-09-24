import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { applyRateSettings, RATE_OT_CODES, RATE_ROLES, rateFor, baseSalaryFor } from '../lib/useRosterData';
import { Coins, Save, Loader2, RotateCcw, Info } from 'lucide-react';

/**
 * อัตราค่าตอบแทน & เงินเดือน (Finance rate configuration).
 * Finance/admin set the OT rate per role × OT code and the monthly base salary
 * per role. Saved to the backend and applied in-memory, so the numbers flow to
 * OT reimbursement forms, OT earnings, ตรวจสอบเวร↔เบิก, and Payroll.
 */
const OT_LABEL: Record<string, string> = { 'ชot': 'ช OT/วันหยุด', 'บot': 'บ OT', 'ดot': 'ด OT', 'BD': 'บ่ายดึก (BD)', 'OR': 'ห้องผ่าตัด (OR)' };

export default function RatesView({ role }: { role: UserRole }) {
  const canEdit = role === 'finance' || role === 'admin';
  const [grid, setGrid] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const key = (r: string, c: string) => `${r}|${c}`;

  const hydrate = () => {
    const g: Record<string, number> = {};
    for (const [r] of RATE_ROLES) {
      for (const c of RATE_OT_CODES) g[key(r, c)] = rateFor(r, c);
      g[key(r, 'BASE')] = baseSalaryFor(r);
    }
    setGrid(g);
  };

  useEffect(() => {
    setLoading(true);
    api.getRateSettings().then((items) => { applyRateSettings(items); hydrate(); }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2800); };
  const set = (r: string, c: string, v: number) => setGrid((g) => ({ ...g, [key(r, c)]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const items: { role: string; code: string; amount: number }[] = [];
      for (const [r] of RATE_ROLES) {
        for (const c of RATE_OT_CODES) items.push({ role: r, code: c, amount: Number(grid[key(r, c)]) || 0 });
        items.push({ role: r, code: 'BASE', amount: Number(grid[key(r, 'BASE')]) || 0 });
      }
      await api.setRateSettings(items);
      applyRateSettings(items); // apply immediately so other pages recompute on next open
      flash('บันทึกอัตราค่าตอบแทนแล้ว — มีผลกับฟอร์มเบิก OT และ Payroll ทันที');
    } catch (e: any) { flash(e?.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const num = 'w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm disabled:bg-slate-50';
  const monthlyOtExample = useMemo(() => {
    // illustrative: a nurse doing 4 BD + 3 ชot in a month
    const bd = (grid[key('nurse', 'BD')] ?? 0) * 4;
    const ch = (grid[key('nurse', 'ชot')] ?? 0) * 3;
    return bd + ch;
  }, [grid]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Coins className="w-5 h-5 text-[#0F3575]" />อัตราค่าตอบแทน &amp; เงินเดือน</h2>
          <p className="text-sm text-slate-500">ตั้งเรต OT ต่อเวร (แยกตามตำแหน่ง) และเงินเดือนฐานต่อเดือน — เชื่อมกับฟอร์มเบิก OT และ Payroll</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={hydrate} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg"><RotateCcw className="w-4 h-4" />คืนค่าที่บันทึกไว้</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึกอัตรา</button>
          </div>
        )}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        เรต OT ต่อเวร ใช้คำนวณ “จำนวนเงิน” ในหลักฐานการจ่าย/ใบแนบ และยอด OT ใน Payroll โดยอัตโนมัติ · เงินเดือนฐานใช้เป็นค่าตั้งต้นของบุคลากรรายเดือนที่ยังไม่ระบุเงินเดือนรายบุคคล
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">ตำแหน่ง / สาย</th>
                {RATE_OT_CODES.map((c) => <th key={c} className="px-3 py-2 font-medium text-center">{OT_LABEL[c] ?? c}<div className="text-[10px] text-slate-400">บาท/เวร</div></th>)}
                <th className="px-3 py-2 font-medium text-center bg-[#0F3575]/5">เงินเดือนฐาน<div className="text-[10px] text-slate-400">บาท/เดือน</div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {RATE_ROLES.map(([r, label]) => (
                <tr key={r}>
                  <td className="px-3 py-2 text-slate-600 font-medium">{label}</td>
                  {RATE_OT_CODES.map((c) => (
                    <td key={c} className="px-3 py-2 text-center">
                      <input type="number" min={0} disabled={!canEdit} value={grid[key(r, c)] ?? 0}
                        onChange={(e) => set(r, c, Number(e.target.value))} className={num} />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center bg-[#0F3575]/5">
                    <input type="number" min={0} disabled={!canEdit} value={grid[key(r, 'BASE')] ?? 0}
                      onChange={(e) => set(r, 'BASE', Number(e.target.value))} className={num} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-slate-500">ตัวอย่างการคำนวณ: พยาบาลขึ้น BD ๔ เวร + ชot ๓ เวร/เดือน = <b className="text-[#0F3575]">{monthlyOtExample.toLocaleString('th-TH')} บาท</b> (อัปเดตตามเรตด้านบน)</div>
    </div>
  );
}
