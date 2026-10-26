import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAllWardsData, computeClaim, downloadFile } from '../lib/useRosterData';
import { api, type Roster, type EditWindowInfo } from '../api/client';
import { THAI_MONTHS } from '../data';
import {
  Loader2, DollarSign, Download, Landmark, Lock, LockOpen, CheckCircle2,
  AlarmClock, Settings2, Save, ShieldAlert,
} from 'lucide-react';

const OT_COLS = ['ชot', 'บot', 'ดot', 'BD', 'OR'];
/** ขั้นตอนช่วงต้นรอบ (เส้นตายการเสนออนุมัติ — ยังเป็นข้อความอ้างอิงตามระเบียบ) */
const TIMELINE_HEAD = [
  { d: 'ก่อน 25', t: 'หน่วยจัดทำบันทึกขอขึ้น + ตารางเวร' },
  { d: 'ก่อน 27', t: 'เสนอ ผอ./รองฯ อนุมัติ' },
  { d: 'วันที่ 1', t: 'การเงินเริ่มประมวลผล' },
];

const STATE_STYLE: Record<EditWindowInfo['state'], { c: string; label: string }> = {
  before: { c: 'bg-slate-100 text-slate-600 border-slate-200', label: 'ยังไม่เปิดรอบแก้ไข' },
  open: { c: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'เปิดให้แก้ไข' },
  due_soon: { c: 'bg-amber-50 text-amber-700 border-amber-200', label: 'ใกล้ครบกำหนด' },
  closed: { c: 'bg-rose-50 text-rose-700 border-rose-200', label: 'เลยกำหนดแล้ว' },
};

export default function FinanceView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { wards, employees, cells, days, loading } = useAllWardsData(year, month);
  const [filterWard, setFilterWard] = useState<number | 'all'>(wardId);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [busy, setBusy] = useState(false);
  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;
  const wardOf = (id?: number) => wards.find((w) => w.id === id)?.name ?? '';
  const scopeName = filterWard === 'all' ? 'ทุกกลุ่มงาน (รวมทั้งโรงพยาบาล)' : wardOf(filterWard as number);

  // กรอบเวลาแก้ไขข้อมูลของหน่วยที่เลือก (requirement 10.1 / 4.2)
  const [win, setWin] = useState<EditWindowInfo | null>(null);
  const [showWinCfg, setShowWinCfg] = useState(false);
  const loadWindow = useCallback(async () => {
    if (filterWard === 'all') { setWin(null); return; }
    try { setWin(await api.getEditWindow(filterWard as number, year, month)); }
    catch { setWin(null); }
  }, [filterWard, year, month]);
  useEffect(() => { loadWindow(); }, [loadWindow]);

  // finance close-month lock only for a specific ward
  useEffect(() => {
    if (filterWard === 'all') { setRoster(null); return; }
    let alive = true;
    api.getRoster(filterWard as number, year, month).then((r) => { if (alive) setRoster(r.roster); });
    return () => { alive = false; };
  }, [filterWard, year, month]);
  const financeLocked = !!roster?.financeLocked;
  const editReopened = !!roster?.editReopened;
  const toggleLock = async () => { if (!roster) return; setBusy(true); try { const r = await api.financeLock(roster.id, !financeLocked); setRoster(r); } finally { setBusy(false); } };
  // เปิดรอบให้หน่วยงานแก้ไขเป็นกรณีพิเศษ เมื่อเลยกรอบเวลาไปแล้ว (requirement 4.2)
  const toggleReopen = async () => { if (!roster) return; setBusy(true); try { const r = await api.reopenRosterEdit(roster.id, !editReopened); setRoster(r); } finally { setBusy(false); } };

  const scoped = useMemo(() => employees.filter((e) => filterWard === 'all' || e.homeWardId === filterWard), [employees, filterWard]);
  const claims = useMemo(() => scoped.map((e) => ({ ...computeClaim(e, cells, days), ward: wardOf(e.homeWardId) })).filter((c) => c.otCount > 0), [scoped, cells, days, wards]);
  const total = claims.reduce((s, c) => s + c.amount, 0);
  const totalOt = claims.reduce((s, c) => s + c.otCount, 0);
  const allMode = filterWard === 'all';

  const exportSummary = () => {
    const header = ['ลำดับ', 'ชื่อ-นามสกุล', ...(allMode ? ['กลุ่มงาน'] : []), 'ตำแหน่ง', ...OT_COLS, 'รวมเวร OT', 'ยอดเบิก (บาท)'];
    const rows = claims.map((c, i) => [i + 1, `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}`.trim(), ...(allMode ? [c.ward] : []), c.employee.positionText ?? '', ...OT_COLS.map((code) => c.byCode[code] ?? 0), c.otCount, c.amount]);
    rows.push(['', '', ...(allMode ? [''] : []), '', ...OT_COLS.map(() => ''), totalOt, total]);
    downloadFile(`สรุปเบิกOT_${allMode ? 'รวมทุกวอร์ด' : wardOf(filterWard as number)}_${monthLabel}.csv`, [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };
  const exportKTB = () => {
    const header = ['ลำดับ', 'เลขที่บัญชี', 'ชื่อบัญชี', ...(allMode ? ['กลุ่มงาน'] : []), 'จำนวนเงิน', 'อ้างอิง'];
    const rows = claims.map((c, i) => [i + 1, c.employee.bankAccount ?? '', `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}`.trim(), ...(allMode ? [c.ward] : []), c.amount.toFixed(2), `OT ${monthLabel}`]);
    downloadFile(`KTB_Corporate_${allMode ? 'รวมทุกวอร์ด' : wardOf(filterWard as number)}_${monthLabel}.csv`, [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-[#0F3575]" />การเงิน &amp; เบิกจ่าย</h2>
          <p className="text-sm text-slate-500">{scopeName} · {monthLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterWard} onChange={(e) => setFilterWard(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-2">
            <option value="all">ทุกกลุ่มงาน (รวม)</option>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button onClick={exportSummary} disabled={!claims.length} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg disabled:opacity-50"><Download className="w-4 h-4" />สรุป (CSV)</button>
          <button onClick={exportKTB} disabled={!claims.length} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg disabled:opacity-50"><Landmark className="w-4 h-4" />KTB {allMode ? 'รวม' : ''}</button>
          {!allMode && roster && <button onClick={toggleLock} disabled={busy} className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border ${financeLocked ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-700 border-slate-300'}`}>{financeLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}{financeLocked ? 'ปิดรอบแล้ว' : 'ปิดรอบเบิก'}</button>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {TIMELINE_HEAD.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1 min-w-[150px]">
              <div className="w-7 h-7 rounded-full bg-[#0F3575]/10 text-[#0F3575] grid place-items-center shrink-0"><CheckCircle2 className="w-4 h-4" /></div>
              <div><div className="text-xs font-semibold text-slate-700">{s.d}</div><div className="text-[11px] text-slate-400 leading-tight">{s.t}</div></div>
            </div>
          ))}
          {/* ขั้นตอนสุดท้ายคำนวณจากกรอบวันทำการที่ตั้งไว้รายหน่วย ไม่ใช่วันที่ตายตัว */}
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <div className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${win?.state === 'closed' ? 'bg-rose-100 text-rose-600' : win?.state === 'due_soon' ? 'bg-amber-100 text-amber-600' : 'bg-[#0F3575]/10 text-[#0F3575]'}`}>
              <AlarmClock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700">
                {win ? `ถึง ${win.deadlineDay} ${THAI_MONTHS[win.windowMonth - 1]}` : 'กรอบแก้ไข'}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {win ? `หน่วยแก้ไข/บันทึกได้ ${win.editWindowDays} วันทำการ แล้วการเงินปิดรอบ` : 'เลือกกลุ่มงานเพื่อดูกรอบเวลา'}
              </div>
            </div>
          </div>
        </div>

        {win && (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${STATE_STYLE[win.state].c}`}>{STATE_STYLE[win.state].label}</span>
            <span className="text-xs text-slate-600">{win.message}</span>
            {win.enforced
              ? <span className="text-xs px-2 py-1 rounded-full bg-[#0F3575]/10 text-[#0F3575] flex items-center gap-1"><ShieldAlert className="w-3 h-3" />บังคับตัดสิทธิ์แก้ไขจริง</span>
              : <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">แจ้งเตือนเท่านั้น (ยังไม่บังคับ)</span>}
            {editReopened && <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">เปิดรอบให้แก้ไขเป็นกรณีพิเศษ</span>}
            {/* เลยกำหนด + บังคับอยู่ = หน่วยงานบันทึกไม่ได้ การเงินเปิดรอบให้ได้ */}
            {roster && win.enforced && win.state === 'closed' && (
              <button onClick={toggleReopen} disabled={busy}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border ${editReopened ? 'text-slate-600 border-slate-300' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
                {editReopened ? <><LockOpen className="w-3.5 h-3.5" />ยกเลิกการเปิดรอบ</> : <><LockOpen className="w-3.5 h-3.5" />เปิดรอบให้แก้ไข</>}
              </button>
            )}
            <button onClick={() => setShowWinCfg((s) => !s)} className="ml-auto flex items-center gap-1 text-xs text-slate-600 border border-slate-300 px-2 py-1 rounded-lg">
              <Settings2 className="w-3.5 h-3.5" />ตั้งค่ากรอบเวลา
            </button>
          </div>
        )}

        {win && showWinCfg && (
          <EditWindowSettings win={win} onSaved={() => { setShowWinCfg(false); loadWindow(); }} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="ยอดเบิกรวม" value={`${total.toLocaleString('th-TH')} ฿`} accent />
        <Card label="จำนวนเวร OT รวม" value={`${totalOt} เวร`} />
        <Card label="ผู้มีสิทธิ์เบิก" value={`${claims.length} คน`} />
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : claims.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีรายการ OT (ลงตารางเวร + ล็อกวันทำการก่อน)</p> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
              {allMode && <th className="text-left px-3 py-2 font-medium">กลุ่มงาน</th>}
              {OT_COLS.map((c) => <th key={c} className="px-2 py-2 font-medium text-center">{c}</th>)}
              <th className="px-3 py-2 font-medium text-center">รวมเวร</th>
              <th className="px-3 py-2 font-medium text-right">ยอดเบิก (฿)</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <tr key={c.employee.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><div className="font-medium text-slate-700">{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</div><div className="text-[11px] text-slate-400">{c.employee.positionText}</div></td>
                  {allMode && <td className="px-3 py-2 text-slate-500">{c.ward}</td>}
                  {OT_COLS.map((code) => <td key={code} className="px-2 py-2 text-center text-slate-600">{c.byCode[code] ?? '—'}</td>)}
                  <td className="px-3 py-2 text-center font-medium">{c.otCount}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0F3575]">{c.amount.toLocaleString('th-TH')}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right" colSpan={allMode ? OT_COLS.length + 2 : OT_COLS.length + 1}>รวมทั้งสิ้น</td>
                <td className="px-3 py-2 text-center">{totalOt}</td>
                <td className="px-3 py-2 text-right text-[#0F3575]">{total.toLocaleString('th-TH')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-400">รูปแบบไฟล์ KTB เป็นแบบร่าง ปรับตามสเปกไฟล์นำเข้าของธนาคารได้ · โหมด "ทุกกลุ่มงาน" รวมยอดทั้งโรงพยาบาลในไฟล์เดียว</p>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value}</div></div>;
}

/**
 * ตั้งค่ากรอบเวลาแก้ไขข้อมูลของหน่วยงาน (requirement 10.1).
 * เป็น "จำนวนวันทำการ" ที่ปรับได้ (เช่น 1-3 หรือ 3-5 วัน) ไม่ใช่วันที่ตายตัว.
 */
function EditWindowSettings({ win, onSaved }: { win: EditWindowInfo; onSaved: () => void }) {
  const [days, setDays] = useState(win.editWindowDays);
  const [lead, setLead] = useState(win.alertLeadDays);
  const [enforced, setEnforced] = useState(win.enforced);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setDays(win.editWindowDays); setLead(win.alertLeadDays); setEnforced(win.enforced); }, [win]);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.updateWard(win.wardId, { editWindowDays: days, alertLeadDays: lead, editWindowEnforced: enforced });
      onSaved();
    } catch (e: any) {
      setMsg(e?.message || 'บันทึกไม่สำเร็จ');
    } finally { setBusy(false); }
  };

  const f = 'text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-full';
  return (
    <div className="border-t border-slate-200 pt-3 space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm">
          <span className="block text-slate-500 mb-1">กรอบแก้ไข (วันทำการ)</span>
          <input type="number" min={1} max={20} value={days} onChange={(e) => setDays(Number(e.target.value))} className={f} />
        </label>
        <label className="text-sm">
          <span className="block text-slate-500 mb-1">แจ้งเตือนล่วงหน้า (วันทำการ)</span>
          <input type="number" min={0} max={20} value={lead} onChange={(e) => setLead(Number(e.target.value))} className={f} />
        </label>
        <label className="text-sm flex items-end">
          <span className="flex items-center gap-2 pb-1.5">
            <input type="checkbox" checked={enforced} onChange={(e) => setEnforced(e.target.checked)} className="w-4 h-4" />
            <span className="text-slate-600">บังคับตัดสิทธิ์แก้ไขเมื่อเลยกำหนด</span>
          </span>
        </label>
      </div>
      <p className="text-[11px] text-slate-400">
        นับวันทำการจากวันที่ 1 ของเดือนถัดไป ข้ามเสาร์-อาทิตย์และวันหยุดราชการจากหน้า "วันหยุด" ·
        เมื่อเปิด "บังคับตัดสิทธิ์" หน่วยงานจะบันทึกตารางเวรของรอบที่เลยกำหนดไม่ได้ (การเงิน/แอดมินยังแก้ได้) ·
        ตั้งค่านี้แยกตามกลุ่มงาน — {win.wardName}
      </p>
      {msg && <div className="text-sm text-rose-600">{msg}</div>}
      <div className="flex justify-end">
        <button onClick={save} disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึก
        </button>
      </div>
    </div>
  );
}
