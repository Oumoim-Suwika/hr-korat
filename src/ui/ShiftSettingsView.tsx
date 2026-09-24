import React, { useEffect, useState } from 'react';
import { api, type ShiftType } from '../api/client';
import type { UserRole } from '../api/client';
import { Clock, Save, Loader2 } from 'lucide-react';

/**
 * ตั้งค่าเวร & ประเภทกะ — แก้ชื่อ/เวลาเริ่ม-สิ้นสุด/ชั่วโมง ของแต่ละกะได้เอง.
 * เวลาเก็บแบบ ชม.นาที (เช่น 08.30). ประเภท (OT/ปกติ/หยุด) คงไว้เพื่อไม่ให้กระทบ
 * ตรรกะการคิด OT — ปรับได้โดย Admin ที่ระดับฐานข้อมูลหากจำเป็น.
 */
// numeric (8.3 = 08:30) -> "08.30"
const toText = (h?: number | null) => (h == null ? '' : `${String(Math.floor(h)).padStart(2, '0')}.${String(Math.round((h % 1) * 100)).padStart(2, '0')}`);
// "08.30" / "08:30" -> 8.30 (HH + MM/100). blank -> null
function toNum(t: string): number | null {
  const s = (t ?? '').trim();
  if (!s) return null;
  const m = /^(\d{1,2})[.:](\d{2})$/.exec(s);
  if (m) return Number(m[1]) + Number(m[2]) / 100;
  if (/^\d{1,2}$/.test(s)) return Number(s);
  return NaN as any;
}
const mins = (h?: number | null) => (h == null ? null : Math.floor(h) * 60 + Math.round((h % 1) * 100));

interface Row { code: string; name: string; start: string; end: string; hours: number; rate: number; levels: string; isOt: boolean; isWork: boolean; category?: string | null; sortOrder: number; }

export default function ShiftSettingsView({ role }: { role: UserRole }) {
  const canEdit = role === 'supervisor' || role === 'admin';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    api.shiftTypes().then((sts) => setRows(sts.map((s: ShiftType) => ({
      code: s.code, name: s.name, start: toText((s as any).startHour), end: toText((s as any).endHour),
      hours: s.hours, rate: (s as any).rate ?? 0, levels: (s as any).levels ?? '', isOt: s.isOt, isWork: s.isWork, category: (s as any).category ?? null, sortOrder: s.sortOrder,
    })))).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const patch = (code: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.code === code ? { ...r, ...p } : r)));

  const save = async () => {
    // validate times of working rows
    for (const r of rows) {
      if (!r.isWork) continue;
      const a = toNum(r.start), b = toNum(r.end);
      if (a == null || b == null || isNaN(Number(a)) || isNaN(Number(b))) {
        flash(`เวลาไม่ถูกต้องที่กะ "${r.code}" — พิมพ์เป็น ชม.นาที เช่น 08.30`); return;
      }
    }
    setSaving(true);
    try {
      for (const r of rows) {
        await api.upsertShiftType({
          code: r.code, name: r.name, hours: Number(r.hours) || 0,
          startHour: r.isWork ? toNum(r.start) : null, endHour: r.isWork ? toNum(r.end) : null,
          rate: Number(r.rate) || 0, levels: r.levels || null,
          isOt: r.isOt, isWork: r.isWork, category: r.category ?? null, sortOrder: r.sortOrder,
        } as any);
      }
      flash('บันทึกเวลากะทั้งหมดแล้ว — มีผลกับการจัดเวรและการแสดงผลเอกสาร');
      load();
    } catch (e: any) { flash(e?.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  const inp = 'text-center border rounded px-2 py-1.5 text-sm border-slate-300 disabled:bg-slate-50';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-[#0F3575]" />ตั้งค่าเวร &amp; ประเภทกะ</h2>
          <p className="text-sm text-slate-500">แก้ชื่อ/เวลาของแต่ละกะได้เอง (เวลาแบบ ชม.นาที เช่น 08.30) — เป็นค่ากลางของทั้งระบบ · เวลาเฉพาะหน่วยตั้งที่ “เวลาปฏิบัติงาน (ต่อหน่วย)”</p>
        </div>
        {canEdit && <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึกทั้งหมด</button>}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">รหัส</th>
              <th className="text-left px-3 py-2 font-medium">ชื่อกะ</th>
              <th className="px-3 py-2 font-medium text-center">เริ่ม</th>
              <th className="px-3 py-2 font-medium text-center">สิ้นสุด</th>
              <th className="px-3 py-2 font-medium text-center">ชม.</th>
              <th className="px-3 py-2 font-medium text-center">ค่าตอบแทน (บาท)</th>
              <th className="px-3 py-2 font-medium text-center">ระดับที่ใช้</th>
              <th className="px-3 py-2 font-medium text-center">ช่วงเวลา (24 ชม.)</th>
              <th className="px-3 py-2 font-medium text-center">ประเภท</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const a = mins(toNum(r.start)), b = mins(toNum(r.end));
                const ok = r.isWork && a != null && b != null && !isNaN(a) && !isNaN(b);
                const left = ok ? (a! / 1440) * 100 : 0;
                const width = ok ? (Math.max(0, b! - a!) / 1440) * 100 : 0;
                const barColor = r.isOt ? '#e11d48' : r.isWork ? '#0F3575' : '#cbd5e1';
                return (
                  <tr key={r.code} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2"><span className="font-mono font-semibold">{r.code}</span></td>
                    <td className="px-3 py-2"><input value={r.name} disabled={!canEdit} onChange={(e) => patch(r.code, { name: e.target.value })} className={`${inp} text-left w-full min-w-[180px]`} /></td>
                    <td className="px-3 py-2 text-center">{r.isWork ? <input value={r.start} disabled={!canEdit} onChange={(e) => patch(r.code, { start: e.target.value })} maxLength={5} placeholder="08.00" className={`${inp} w-20`} /> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2 text-center">{r.isWork ? <input value={r.end} disabled={!canEdit} onChange={(e) => patch(r.code, { end: e.target.value })} maxLength={5} placeholder="16.00" className={`${inp} w-20`} /> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2 text-center"><input type="number" min={0} step={0.5} value={r.hours} disabled={!canEdit} onChange={(e) => patch(r.code, { hours: Number(e.target.value) })} className={`${inp} w-16`} /></td>
                    <td className="px-3 py-2 text-center">{r.isWork ? <input type="number" min={0} value={r.rate} disabled={!canEdit} onChange={(e) => patch(r.code, { rate: Number(e.target.value) })} className={`${inp} w-24`} title="0 = ใช้เรตตามตำแหน่ง" /> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-3 py-2 text-center"><input value={r.levels} disabled={!canEdit} onChange={(e) => patch(r.code, { levels: e.target.value })} placeholder="L,M,S,S2" className={`${inp} w-28`} /></td>
                    <td className="px-3 py-2" style={{ minWidth: 160 }}>
                      {r.isWork ? (
                        <div className="relative h-4 bg-slate-100 rounded">
                          <div className="absolute inset-y-0 rounded" style={{ left: `${left}%`, width: `${width}%`, background: barColor }} />
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.isOt ? <span className="text-xs bg-rose-100 text-rose-700 rounded-full px-2 py-0.5">OT</span>
                        : r.isWork ? <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">ปกติ</span>
                        : <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">หยุด/ลา</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-400">* <b>ค่าตอบแทน (บาท)</b> = เรตต่อเวรของกะนั้น ใช้เหมือนกันทุกคน · ใส่ <b>0</b> = ใช้เรตตามตำแหน่งจากหน้า “อัตราค่าตอบแทน &amp; เงินเดือน” · การเปลี่ยนประเภท (ปกติ/OT) ล็อกไว้เพื่อไม่ให้กระทบการคิดเงิน</p>
    </div>
  );
}
