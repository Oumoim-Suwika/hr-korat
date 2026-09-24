import React, { useMemo, useState, useEffect } from 'react';
import { useRosterData } from '../lib/useRosterData';
import { checkRoster, DEFAULT_LABOR_CONFIG, type LaborConfig } from '../lib/laborCheck';
import { api } from '../api/client';
import { THAI_MONTHS } from '../data';
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, Loader2, SlidersHorizontal, Building2 } from 'lucide-react';

interface CrossUnit { empId: number; name: string; day: number; detail: string; severity: 'error' | 'warning'; }

export default function ComplianceView({ wardName, wardId, year, month }: {
  wardName: string; wardId: number; year: number; month: number;
}) {
  const { employees, cells, days, loading } = useRosterData(wardId, year, month);
  const [cfg, setCfg] = useState<LaborConfig>(DEFAULT_LABOR_CONFIG);
  const [showCfg, setShowCfg] = useState(false);

  // Cross-unit conflict check (ตรวจซ้ำซ้อนข้ามหน่วยงาน): a person working in >1
  // ward on the same day. Two normal shifts = real conflict (error); a normal +
  // OT/external help across wards = allowed, shown as info (warning).
  const [crossUnit, setCrossUnit] = useState<CrossUnit[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ws, all] = await Promise.all([api.wards(), api.allEmployees()]);
        const nameOf = (id: number) => { const e = all.find((x) => x.id === id); return e ? `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}`.trim() : `#${id}`; };
        const rosters = await Promise.all(ws.map((w) => api.getRoster(w.id, year, month).then((r) => ({ name: w.name, cells: r.cells })).catch(() => ({ name: w.name, cells: [] as any[] }))));
        const map = new Map<string, { ward: string; normal: boolean }[]>();
        for (const r of rosters) for (const c of r.cells) {
          const working = !!(c.normalCode && c.normalCode !== 'ออฟ');
          if (!working && !c.otCode) continue;
          const k = `${c.employeeId}-${c.day}`;
          const arr = map.get(k) ?? []; arr.push({ ward: r.name, normal: working }); map.set(k, arr);
        }
        const out: CrossUnit[] = [];
        for (const [k, arr] of map) {
          const wards = Array.from(new Set(arr.map((a) => a.ward)));
          if (wards.length < 2) continue;
          const [empId, day] = k.split('-').map(Number);
          const bothNormal = arr.filter((a) => a.normal).length > 1;
          out.push({ empId, name: nameOf(empId), day, severity: bothNormal ? 'error' : 'warning',
            detail: `วันที่ ${day} ปฏิบัติงานข้ามหน่วย (${wards.join(' + ')})${bothNormal ? ' — เวรปกติซ้ำซ้อน ต้องแก้ไข' : ' — เป็น OT/ช่วยข้ามหน่วย (อนุญาต)'}` });
        }
        if (alive) setCrossUnit(out.sort((a, b) => a.day - b.day));
      } catch { if (alive) setCrossUnit([]); }
    })();
    return () => { alive = false; };
  }, [year, month]);

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
          {/* Cross-unit conflict check (ตรวจซ้ำซ้อนข้ามหน่วยงาน — ทั้งโรงพยาบาล) */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-[#0F3575]" />ตรวจซ้ำซ้อนข้ามหน่วยงาน (ทั้งโรงพยาบาล)</h3>
            {crossUnit.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />ไม่พบการลงเวรปกติซ้ำซ้อนข้ามหน่วยงานในเดือนนี้</div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {crossUnit.map((x, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    {x.severity === 'error'
                      ? <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />}
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700">{x.name}</span>
                      <div className="text-sm text-slate-500 mt-0.5">{x.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">* เกณฑ์อ้างอิงแนวปฏิบัติพยาบาลภาครัฐและหลักการ พ.ร.บ.คุ้มครองแรงงาน (วันหยุดประจำสัปดาห์ / เวลาพักระหว่างเวร) ปรับได้ที่ปุ่ม "ตั้งเกณฑ์"</p>
        </>
      )}
    </div>
  );
}
