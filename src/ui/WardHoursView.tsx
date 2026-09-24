import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { Clock, Save, Loader2, Info } from 'lucide-react';

/**
 * เวลาปฏิบัติงานต่อหอผู้ป่วย/กลุ่มงาน — ตั้งเวลาเวร ช/บ/ด แยกแต่ละหน่วย
 * (เช่น งานบริการ 08.00-16.00, สำนักงาน 08.30-16.30) แสดงผลบนตารางเวร/เอกสาร.
 * ออกแบบให้เห็นภาพชัด: มีแถบเวลา 24 ชม. + ตัวอย่างข้อความ สำหรับผู้ใช้ทุกวัย.
 */
const SHIFTS: { code: string; label: string; color: string; bar: string }[] = [
  { code: 'ช', label: 'เวรเช้า', color: 'text-amber-800', bar: '#f59e0b' },
  { code: 'บ', label: 'เวรบ่าย', color: 'text-sky-800', bar: '#0ea5e9' },
  { code: 'ด', label: 'เวรดึก', color: 'text-indigo-800', bar: '#6366f1' },
];
const DEFAULTS: Record<string, [string, string]> = { 'ช': ['08.30', '16.30'], 'บ': ['16.30', '20.30'], 'ด': ['00.00', '08.00'] };

// "08.30" -> minutes since 00:00 (supports "24.00" = 1440)
function toMin(t: string): number {
  const m = /^(\d{1,2})[.:](\d{2})$/.exec((t ?? '').trim());
  if (!m) return NaN;
  return Math.min(1440, Number(m[1]) * 60 + Number(m[2]));
}
const validTime = (t: string) => !isNaN(toMin(t));

export default function WardHoursView({ wardName, wardId, role }: { wardName: string; wardId: number; role: UserRole }) {
  const canEdit = role === 'supervisor' || role === 'admin';
  const [times, setTimes] = useState<Record<string, { startTime: string; endTime: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hydrate = (rows: { code: string; startTime: string; endTime: string }[]) => {
    const t: Record<string, { startTime: string; endTime: string }> = {};
    for (const s of SHIFTS) {
      const found = rows.find((r) => r.code === s.code);
      t[s.code] = found ? { startTime: found.startTime, endTime: found.endTime } : { startTime: DEFAULTS[s.code][0], endTime: DEFAULTS[s.code][1] };
    }
    setTimes(t);
  };

  useEffect(() => {
    setLoading(true);
    api.getWardShiftTimes(wardId).then(hydrate).finally(() => setLoading(false));
  }, [wardId]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const set = (code: string, k: 'startTime' | 'endTime', v: string) => setTimes((t) => ({ ...t, [code]: { ...t[code], [k]: v } }));

  const allValid = useMemo(() => SHIFTS.every((s) => times[s.code] && validTime(times[s.code].startTime) && validTime(times[s.code].endTime)), [times]);

  const save = async () => {
    if (!allValid) { flash('รูปแบบเวลาไม่ถูกต้อง — พิมพ์เป็น ชม.นาที เช่น 08.00'); return; }
    setSaving(true);
    try {
      await api.setWardShiftTimes(wardId, SHIFTS.map((s) => ({ code: s.code, startTime: times[s.code].startTime, endTime: times[s.code].endTime })));
      flash('บันทึกเวลาปฏิบัติงานของหน่วยนี้แล้ว — จะแสดงบนตารางเวร/เอกสารของหน่วยนี้');
    } catch (e: any) { flash(e?.message || 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-[#0F3575]" />เวลาปฏิบัติงาน · {wardName}</h2>
          <p className="text-sm text-slate-500">ตั้งเวลาเวรเช้า/บ่าย/ดึก ของหน่วยนี้ — แต่ละหอผู้ป่วย/กลุ่มงานตั้งได้ไม่เหมือนกัน</p>
        </div>
        {canEdit && <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึกเวลา</button>}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-800">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        พิมพ์เวลาเป็น <b>ชั่วโมง.นาที</b> เช่น <b>08.00</b> หรือ <b>16.30</b> (เวรดึกข้ามคืนใช้ <b>24.00</b> = เที่ยงคืน) · ระบบจะนำเวลานี้ไปแสดงบนใบลงเวลาและหลักฐานการจ่ายของหน่วยนี้
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="space-y-4">
          {SHIFTS.map((s) => {
            const v = times[s.code] ?? { startTime: '', endTime: '' };
            const a = toMin(v.startTime), b = toMin(v.endTime);
            const ok = !isNaN(a) && !isNaN(b);
            const left = ok ? (a / 1440) * 100 : 0;
            const width = ok ? (Math.max(0, b - a) / 1440) * 100 : 0;
            return (
              <div key={s.code} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    <span className={`w-9 h-9 rounded-lg grid place-items-center font-bold text-lg ${s.color}`} style={{ background: `${s.bar}22` }}>{s.code}</span>
                    <span className="font-semibold text-slate-700">{s.label}</span>
                  </div>
                  <label className="text-sm flex items-center gap-2">เริ่ม
                    <input value={v.startTime} disabled={!canEdit} onChange={(e) => set(s.code, 'startTime', e.target.value)}
                      inputMode="numeric" maxLength={5} placeholder="08.00"
                      className={`w-24 text-center text-lg border rounded-lg px-2 py-2 ${validTime(v.startTime) ? 'border-slate-300' : 'border-rose-400 bg-rose-50'}`} /></label>
                  <span className="text-slate-400">–</span>
                  <label className="text-sm flex items-center gap-2">สิ้นสุด
                    <input value={v.endTime} disabled={!canEdit} onChange={(e) => set(s.code, 'endTime', e.target.value)}
                      inputMode="numeric" maxLength={5} placeholder="16.00"
                      className={`w-24 text-center text-lg border rounded-lg px-2 py-2 ${validTime(v.endTime) ? 'border-slate-300' : 'border-rose-400 bg-rose-50'}`} /></label>
                  <span className="text-slate-500 text-sm ml-auto">ตัวอย่าง: <b className={s.color}>{s.code}</b> = {v.startTime}–{v.endTime} น.</span>
                </div>
                {/* 24-hour timeline */}
                <div className="mt-3">
                  <div className="relative h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div className="absolute inset-y-0 rounded-md" style={{ left: `${left}%`, width: `${width}%`, background: s.bar }} />
                    {[6, 12, 18].map((h) => <div key={h} className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${(h / 24) * 100}%` }} />)}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>00</span><span>06</span><span>12</span><span>18</span><span>24 น.</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-slate-400">* รหัส OT (ชot/บot/ดot) ใช้เวลาเดียวกับเวรปกติของหน่วย · เวรเสริมบ่ายดึก (BD) และเรตค่าตอบแทน ตั้งที่หน้า “อัตราค่าตอบแทน &amp; เงินเดือน”</p>
    </div>
  );
}
