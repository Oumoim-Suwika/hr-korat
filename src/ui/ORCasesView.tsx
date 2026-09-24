import React, { useEffect, useMemo, useState } from 'react';
import { api, type Employee } from '../api/client';
import type { UserRole } from '../api/client';
import { THAI_MONTHS } from '../data';
import { Stethoscope, Plus, Trash2, Save, Loader2, Settings2, X } from 'lucide-react';

/**
 * หัตถการห้องผ่าตัด (OR) — ค่าตอบแทนตามเคส/ชั่วโมง แยกตามบทบาท
 * (แพทย์ผ่าตัด/วิสัญญี/พยาบาล/ผู้ช่วย) + เงินเพิ่มเมื่อผ่าเกินชั่วโมงที่กำหนด.
 * หมอ/เจ้าหน้าที่ OR บันทึกเคสเองได้ ระบบคำนวณเงินให้อัตโนมัติ.
 */
const SLOTS: [string, string][] = [['doctor', 'แพทย์ผ่าตัด'], ['anesthetist', 'วิสัญญี'], ['nurse', 'พยาบาล'], ['assistant', 'ผู้ช่วย']];
const slotLabel = (s: string) => SLOTS.find(([k]) => k === s)?.[1] ?? s;
const baht = (n: number) => n.toLocaleString('th-TH');

interface Proc { id: number; name: string; mode: 'case' | 'hour'; roleRates: Record<string, number>; otThresholdHours: number; otBonusPerHour: number; }

function payout(proc: Proc | undefined, hours: number, slot: string): number {
  if (!proc) return 0;
  const base = proc.mode === 'case' ? (proc.roleRates[slot] || 0) : (proc.roleRates[slot] || 0) * hours;
  const ot = hours > proc.otThresholdHours ? (hours - proc.otThresholdHours) * proc.otBonusPerHour : 0;
  return base + ot;
}

export default function ORCasesView({ wardName, wardId, year, month, role }: {
  wardName: string; wardId: number; year: number; month: number; role: UserRole;
}) {
  const canEditProc = role === 'supervisor' || role === 'finance' || role === 'admin';
  const [procs, setProcs] = useState<Proc[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showCfg, setShowCfg] = useState(false);
  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const load = () => {
    setLoading(true);
    Promise.all([api.getOrProcedures(), api.getOrCases(wardId, year, month), api.employees(wardId)])
      .then(([p, c, e]) => { setProcs(p); setCases(c); setEmps(e); }).finally(() => setLoading(false));
  };
  useEffect(load, [wardId, year, month]);

  const procById = (id?: number | null) => procs.find((p) => p.id === id);

  // ---- new case form ----
  const [day, setDay] = useState(1);
  const [procId, setProcId] = useState<number | ''>('');
  const [hours, setHours] = useState(2);
  const [parts, setParts] = useState<{ employeeId: number; slot: string }[]>([]);
  const addPart = () => setParts((p) => [...p, { employeeId: emps[0]?.id ?? 0, slot: 'doctor' }]);
  const proc = procById(procId === '' ? undefined : Number(procId));

  const saveCase = async () => {
    if (procId === '' || !parts.length) { flash('เลือกหัตถการและเพิ่มผู้ร่วมผ่าตัดอย่างน้อย 1 คน'); return; }
    const participants = parts.filter((p) => p.employeeId).map((p) => ({ employeeId: p.employeeId, name: (() => { const e = emps.find((x) => x.id === p.employeeId); return e ? `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}`.trim() : `#${p.employeeId}`; })(), slot: p.slot }));
    await api.createOrCase({ wardId, year, month, day, procedureId: Number(procId), procedureName: proc?.name ?? null, hours, participants });
    setParts([]); flash('บันทึกเคสผ่าตัดแล้ว'); load();
  };
  const delCase = async (id: number) => { await api.deleteOrCase(id); load(); };

  const monthTotal = useMemo(() => cases.reduce((s, cs) => {
    const p = procById(cs.procedureId);
    return s + (cs.participants ?? []).reduce((a: number, pt: any) => a + payout(p, cs.hours, pt.slot), 0);
  }, 0), [cases, procs]);

  const inp = 'border border-slate-300 rounded px-2 py-1.5 text-sm';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Stethoscope className="w-5 h-5 text-[#0F3575]" />ค่าตอบแทนหัตถการห้องผ่าตัด · {wardName}</h2>
          <p className="text-sm text-slate-500">{monthLabel} · เหมาเคส/เหมาชั่วโมง แยกตามบทบาท + เงินเพิ่มเมื่อเกินชั่วโมง</p>
        </div>
        {canEditProc && <button onClick={() => setShowCfg((s) => !s)} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"><Settings2 className="w-4 h-4" />ตั้งค่าหัตถการ &amp; อัตรา</button>}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      {/* ---- procedure config ---- */}
      {showCfg && canEditProc && <ProcConfig procs={procs} onChange={load} flash={flash} />}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          {/* ---- new case form ---- */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="font-semibold text-slate-700">บันทึกเคสผ่าตัด</div>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-sm">วันที่<br /><input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} className={`${inp} w-20`} /></label>
              <label className="text-sm">หัตถการ<br />
                <select value={procId} onChange={(e) => setProcId(e.target.value === '' ? '' : Number(e.target.value))} className={`${inp} min-w-[220px]`}>
                  <option value="">— เลือกหัตถการ —</option>
                  {procs.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mode === 'case' ? 'เหมาเคส' : 'เหมาชั่วโมง'})</option>)}
                </select></label>
              <label className="text-sm">ชั่วโมง<br /><input type="number" min={0} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} className={`${inp} w-24`} /></label>
              {proc && proc.otBonusPerHour > 0 && <span className="text-xs text-slate-500">เกิน {proc.otThresholdHours} ชม. +{baht(proc.otBonusPerHour)}/ชม.</span>}
            </div>

            <div className="space-y-2">
              {parts.map((pt, i) => {
                const amt = payout(proc, hours, pt.slot);
                return (
                  <div key={i} className="flex flex-wrap gap-2 items-center">
                    <select value={pt.employeeId} onChange={(e) => setParts((ps) => ps.map((x, j) => j === i ? { ...x, employeeId: Number(e.target.value) } : x))} className={`${inp} min-w-[200px]`}>
                      {emps.map((e) => <option key={e.id} value={e.id}>{e.prefix}{e.firstName} {e.lastName ?? ''}</option>)}
                    </select>
                    <select value={pt.slot} onChange={(e) => setParts((ps) => ps.map((x, j) => j === i ? { ...x, slot: e.target.value } : x))} className={inp}>
                      {SLOTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <span className="text-sm text-[#0F3575] font-medium w-24 text-right">{baht(amt)} ฿</span>
                    <button onClick={() => setParts((ps) => ps.filter((_, j) => j !== i))} className="text-rose-400"><X className="w-4 h-4" /></button>
                  </div>
                );
              })}
              <button onClick={addPart} disabled={!emps.length} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg"><Plus className="w-4 h-4" />เพิ่มผู้ร่วมผ่าตัด</button>
            </div>
            <div className="flex justify-end">
              <button onClick={saveCase} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg"><Save className="w-4 h-4" />บันทึกเคส</button>
            </div>
          </div>

          {/* ---- cases list ---- */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">เคสผ่าตัดเดือนนี้ ({cases.length})</h3>
            <div className="text-sm">รวมค่าตอบแทน: <b className="text-[#0F3575]">{baht(monthTotal)} บาท</b></div>
          </div>
          {cases.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีเคส</p> : (
            <div className="space-y-3">
              {cases.map((cs) => {
                const p = procById(cs.procedureId);
                const caseTotal = (cs.participants ?? []).reduce((a: number, pt: any) => a + payout(p, cs.hours, pt.slot), 0);
                return (
                  <div key={cs.id} className="bg-white border border-slate-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm"><b className="text-slate-700">วันที่ {cs.day}</b> · {cs.procedureName ?? p?.name ?? '—'} · {cs.hours} ชม.</div>
                      <div className="flex items-center gap-3"><span className="text-sm font-semibold text-[#0F3575]">{baht(caseTotal)} ฿</span>{(role !== 'staff') && <button onClick={() => delCase(cs.id)} className="text-rose-400"><Trash2 className="w-4 h-4" /></button>}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      {(cs.participants ?? []).map((pt: any, i: number) => (
                        <span key={i}>{slotLabel(pt.slot)}: {pt.name} — <b>{baht(payout(p, cs.hours, pt.slot))}</b></span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      <p className="text-xs text-slate-400">* ยอดนี้เป็นค่าตอบแทนหัตถการ แยกจาก OT เวรปกติ · รวมเข้าสรุปจ่ายได้ที่หน้าเงินเดือน/การเงิน (เชื่อมเพิ่มได้)</p>
    </div>
  );
}

// ---- procedure config sub-component ----
function ProcConfig({ procs, onChange, flash }: { procs: Proc[]; onChange: () => void; flash: (m: string) => void }) {
  const blank = { name: '', mode: 'case' as 'case' | 'hour', roleRates: { doctor: 0, anesthetist: 0, nurse: 0, assistant: 0 }, otThresholdHours: 0, otBonusPerHour: 0 };
  const [form, setForm] = useState<any>(blank);
  const inp = 'border border-slate-300 rounded px-2 py-1.5 text-sm';
  const save = async () => { if (!form.name) { flash('ใส่ชื่อหัตถการ'); return; } await api.saveOrProcedure(form); setForm(blank); flash('บันทึกหัตถการแล้ว'); onChange(); };
  const edit = (p: Proc) => setForm({ id: p.id, name: p.name, mode: p.mode, roleRates: { doctor: 0, anesthetist: 0, nurse: 0, assistant: 0, ...p.roleRates }, otThresholdHours: p.otThresholdHours, otBonusPerHour: p.otBonusPerHour });
  const del = async (id: number) => { await api.deleteOrProcedure(id); onChange(); };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="font-semibold text-slate-700">ตั้งค่าหัตถการ &amp; อัตราค่าตอบแทน</div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-slate-500"><tr>
            <th className="text-left px-3 py-2 font-medium">หัตถการ</th><th className="px-2 py-2 font-medium">โหมด</th>
            {SLOTS.map(([, v]) => <th key={v} className="px-2 py-2 font-medium text-center">{v}</th>)}
            <th className="px-2 py-2 font-medium text-center">เกิน(ชม.)</th><th className="px-2 py-2 font-medium text-center">+บาท/ชม.</th><th />
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {procs.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-slate-700">{p.name}</td>
                <td className="px-2 py-2 text-center text-xs">{p.mode === 'case' ? 'เหมาเคส' : 'เหมาชั่วโมง'}</td>
                {SLOTS.map(([k]) => <td key={k} className="px-2 py-2 text-center">{baht(p.roleRates[k] || 0)}</td>)}
                <td className="px-2 py-2 text-center">{p.otThresholdHours}</td>
                <td className="px-2 py-2 text-center">{baht(p.otBonusPerHour)}</td>
                <td className="px-2 py-2 text-center whitespace-nowrap"><button onClick={() => edit(p)} className="text-[#0F3575] text-xs mr-2">แก้</button><button onClick={() => del(p.id)} className="text-rose-400"><Trash2 className="w-3.5 h-3.5 inline" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* add/edit form */}
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">ชื่อหัตถการ<br /><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inp} min-w-[200px]`} placeholder="เช่น ผ่าตัดใหญ่" /></label>
        <label className="text-sm">โหมด<br /><select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inp}><option value="case">เหมาเคส</option><option value="hour">เหมาชั่วโมง</option></select></label>
        {SLOTS.map(([k, v]) => (
          <label key={k} className="text-sm">{v}<br /><input type="number" min={0} value={form.roleRates[k] ?? 0} onChange={(e) => setForm({ ...form, roleRates: { ...form.roleRates, [k]: Number(e.target.value) } })} className={`${inp} w-24`} /></label>
        ))}
        <label className="text-sm">เกิน (ชม.)<br /><input type="number" min={0} step={0.5} value={form.otThresholdHours} onChange={(e) => setForm({ ...form, otThresholdHours: Number(e.target.value) })} className={`${inp} w-20`} /></label>
        <label className="text-sm">+บาท/ชม.<br /><input type="number" min={0} value={form.otBonusPerHour} onChange={(e) => setForm({ ...form, otBonusPerHour: Number(e.target.value) })} className={`${inp} w-24`} /></label>
        <button onClick={save} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Save className="w-4 h-4" />{form.id ? 'อัปเดต' : 'เพิ่ม'}</button>
        {form.id && <button onClick={() => setForm(blank)} className="text-sm text-slate-500 px-2">ยกเลิก</button>}
      </div>
    </div>
  );
}
