import React, { useMemo, useState } from 'react';
import { useRosterData } from '../lib/useRosterData';
import { checkRoster, DEFAULT_LABOR_CONFIG, type LaborConfig } from '../lib/laborCheck';
import { THAI_MONTHS } from '../data';
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Loader2, SlidersHorizontal } from 'lucide-react';

export default function ComplianceView({ wardName, wardId, year, month }: {
  wardName: string; wardId: number; year: number; month: number;
}) {
  const { employees, cells, days, loading } = useRosterData(wardId, year, month);
  const [cfg, setCfg] = useState<LaborConfig>(DEFAULT_LABOR_CONFIG);
  const [showCfg, setShowCfg] = useState(false);

  const violations = useMemo(() => checkRoster(employees, cells, days, cfg), [employees, cells, days, cfg]);
  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warning');
  const affected = new Set(violations.map((v) => v.employeeId)).size;

  const num = 'w-16 text-center border border-slate-200 rounded px-2 py-1 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#0F3575]" />ตรวจสอบการปฏิบัติตามกฎหมายแรงงาน · {wardName}</h2>
          <p className="text-sm text-slate-500">ประจำเดือน {THAI_MONTHS[month - 1]} {year} · ตรวจเวลาพักระหว่างเวร วันทำงานติดต่อกัน วันหยุด และภาระ OT</p>
        </div>
        <button onClick={() => setShowCfg((s) => !s)} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"><SlidersHorizontal className="w-4 h-4" />ตั้งเกณฑ์</button>
      </div>

      {showCfg && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">ทำงานติดต่อกันไม่เกิน (วัน)
            <input type="number" min={1} className={num} value={cfg.maxConsecutiveDays} onChange={(e) => setCfg({ ...cfg, maxConsecutiveDays: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2">วันหยุดขั้นต่ำ/เดือน
            <input type="number" min={0} className={num} value={cfg.minDaysOffPerMonth} onChange={(e) => setCfg({ ...cfg, minDaysOffPerMonth: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2">เฝ้าระวัง OT เกิน (วัน/เดือน)
            <input type="number" min={0} className={num} value={cfg.maxOtDaysPerMonth} onChange={(e) => setCfg({ ...cfg, maxOtDaysPerMonth: Number(e.target.value) })} /></label>
        </div>
      )}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-4"><div className="text-xs text-slate-500">ต้องแก้ไข (ผิดเกณฑ์)</div><div className="text-2xl font-bold text-rose-600">{errors.length}</div></div>
            <div className="bg-white border border-slate-200 rounded-lg p-4"><div className="text-xs text-slate-500">ควรเฝ้าระวัง</div><div className="text-2xl font-bold text-amber-600">{warnings.length}</div></div>
            <div className="bg-white border border-slate-200 rounded-lg p-4"><div className="text-xs text-slate-500">บุคลากรที่เกี่ยวข้อง</div><div className="text-2xl font-bold text-[#0F3575]">{affected} คน</div></div>
          </div>

          {violations.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" /><div><div className="font-semibold">ผ่านทุกเกณฑ์</div><div className="text-sm">ตารางเวรเดือนนี้ไม่พบการฝ่าฝืนเกณฑ์ที่ตั้งไว้</div></div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
              {violations.map((v, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  {v.severity === 'error'
                    ? <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{v.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${v.severity === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{v.rule}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">{v.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-400">* เกณฑ์อ้างอิงแนวปฏิบัติพยาบาลภาครัฐและหลักการ พ.ร.บ.คุ้มครองแรงงาน (วันหยุดประจำสัปดาห์ / เวลาพักระหว่างเวร) ปรับได้ที่ปุ่ม "ตั้งเกณฑ์"</p>
        </>
      )}
    </div>
  );
}
