import React, { useEffect, useMemo, useState } from 'react';
import { useRosterData, computeClaim, cellKey, downloadFile, baseSalaryFor } from '../lib/useRosterData';
import { api } from '../api/client';
import { THAI_MONTHS } from '../data';
import {
  computePayslip, mergeTaxConfig, DEFAULT_TAX_CONFIG, TAX_CONFIG_KEY,
  type PayrollTaxConfig, type PayslipBreakdown,
} from '../lib/thaiTax';
import Payslip from './Payslip';
import { Loader2, Wallet, Download, Info, Printer, Settings2, RotateCcw, Save } from 'lucide-react';

/**
 * เงินเดือน & ค่าตอบแทนรวม (Payroll).
 * รายได้: เงินเดือน/ค่าจ้างฐาน + OT (จากตารางเวร)
 * รายการหัก: ประกันสังคม + ภาษีหัก ณ ที่จ่าย  (requirement 11.1)
 * = ยอดรับสุทธิต่อคน พร้อมพิมพ์สลิปเงินเดือนรายบุคคล
 */
export default function PayrollView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, days, loading } = useRosterData(wardId, year, month);
  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;

  // พารามิเตอร์ภาษี/ประกันสังคม — การเงินปรับได้ (เก็บใน app_settings)
  const [cfg, setCfg] = useState<PayrollTaxConfig>(DEFAULT_TAX_CONFIG);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => {
    api.getAppSetting<Partial<PayrollTaxConfig>>(TAX_CONFIG_KEY)
      .then((v) => setCfg(mergeTaxConfig(v)))
      .catch(() => setCfg(DEFAULT_TAX_CONFIG))
      .finally(() => setCfgLoaded(true));
  }, []);

  // ใครจะถูกพิมพ์สลิป: null = ไม่พิมพ์, number = รายคน, 'all' = ทุกคนที่มียอด
  const [printTarget, setPrintTarget] = useState<number | 'all' | null>(null);

  interface Row { e: typeof employees[number]; worked: number; slip: PayslipBreakdown }
  const rows: Row[] = useMemo(() => employees.map((e) => {
    const ot = computeClaim(e, cells, days).amount;
    const worked = days.filter((d) => { const c = cells[cellKey(e.id, d)]?.normalCode; return c && c !== 'ออฟ'; }).length;
    const base = e.paymentType === 'รายเดือน'
      ? (e.baseWage ?? baseSalaryFor(e.role))          // per-person salary, else role default
      : (e.baseWage ?? 0) * worked;                    // daily/period wage × worked days
    return { e, worked, slip: computePayslip({ base, ot, employeeType: e.employeeType, cfg }) };
  }), [employees, cells, days, cfg]);

  const sum = (pick: (s: PayslipBreakdown) => number) => rows.reduce((acc, r) => acc + pick(r.slip), 0);
  const totals = {
    base: sum((s) => s.base), ot: sum((s) => s.ot), gross: sum((s) => s.gross),
    sso: sum((s) => s.sso), tax: sum((s) => s.tax), net: sum((s) => s.net),
  };

  // พิมพ์เมื่อเลือกเป้าหมายแล้ว (รอให้ DOM render สลิปก่อน)
  useEffect(() => {
    if (printTarget == null) return;
    const t = setTimeout(() => { window.print(); setPrintTarget(null); }, 60);
    return () => clearTimeout(t);
  }, [printTarget]);

  const payable = rows.filter((r) => r.slip.gross > 0);
  const toPrint = printTarget === 'all' ? payable : payable.filter((r) => r.e.id === printTarget);

  const exportCsv = () => {
    const header = ['ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'ประเภทจ้าง', 'ฐาน/เงินเดือน', 'OT', 'รวมรายได้', 'ประกันสังคม', 'ภาษีหัก ณ ที่จ่าย', 'รวมหัก', 'รับสุทธิ'];
    const body = rows.map((r, i) => [
      i + 1, `${r.e.prefix ?? ''}${r.e.firstName} ${r.e.lastName ?? ''}`.trim(), r.e.positionText ?? '', r.e.paymentType,
      r.slip.base, r.slip.ot, r.slip.gross, r.slip.sso, r.slip.tax, r.slip.totalDeductions, r.slip.net,
    ]);
    body.push(['', '', '', 'รวม', totals.base, totals.ot, totals.gross, totals.sso, totals.tax, totals.sso + totals.tax, totals.net]);
    downloadFile(`payroll_${wardName}_${monthLabel}.csv`, [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };

  // Full export ready to feed the hospital's payroll program (per-person, with
  // employee code, bank account, period, earnings and deductions).
  const exportPayrollProgram = () => {
    const period = `${year}${String(month).padStart(2, '0')}`; // งวด เช่น 256907
    const header = ['รหัสพนักงาน', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ตำแหน่ง', 'ประเภทจ้าง', 'เลขที่บัญชี', 'งวด', 'เงินเดือนฐาน', 'ค่าตอบแทน OT', 'รวมรายได้', 'ประกันสังคม', 'ภาษีหัก ณ ที่จ่าย', 'รวมจ่ายสุทธิ'];
    const body = payable.map((r) => [
      r.e.employeeCode ?? '', r.e.prefix ?? '', r.e.firstName, r.e.lastName ?? '', r.e.positionText ?? '', r.e.paymentType,
      r.e.bankAccount ?? '', period,
      r.slip.base.toFixed(2), r.slip.ot.toFixed(2), r.slip.gross.toFixed(2),
      r.slip.sso.toFixed(2), r.slip.tax.toFixed(2), r.slip.net.toFixed(2),
    ]);
    downloadFile(`ส่งเข้าโปรแกรมเงินเดือน_${wardName}_${period}.csv`, [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };

  const money = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-[#0F3575]" />เงินเดือน &amp; ค่าตอบแทนรวม (Payroll)</h2>
          <p className="text-sm text-slate-500">{wardName} · {monthLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowSettings((s) => !s)} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg"><Settings2 className="w-4 h-4" />ตั้งค่าภาษี/ประกันสังคม</button>
          <button onClick={exportCsv} disabled={!rows.length} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg disabled:opacity-50"><Download className="w-4 h-4" />สรุป (CSV)</button>
          <button onClick={() => setPrintTarget('all')} disabled={!payable.length} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg disabled:opacity-50"><Printer className="w-4 h-4" />พิมพ์สลิปทั้งหมด</button>
          <button onClick={exportPayrollProgram} disabled={!rows.length} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg disabled:opacity-50"><Download className="w-4 h-4" />ส่งเข้าโปรแกรมเงินเดือน</button>
        </div>
      </div>

      {showSettings && cfgLoaded && <TaxSettings cfg={cfg} onChange={setCfg} onClose={() => setShowSettings(false)} />}

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700 no-print">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          ยอด OT คำนวณจากตารางเวรจริง × <b>อัตราค่าตอบแทน</b> ที่การเงินตั้งไว้ · เงินเดือนฐานใช้ค่ารายบุคคล (ถ้ามี) หรือค่าตั้งต้นตามตำแหน่ง ·
          <b> ภาษีหัก ณ ที่จ่าย</b> เป็นการประมาณการตามมาตรา 50(1) ยังไม่รวมค่าลดหย่อนอื่น (คู่สมรส/บุตร/เบี้ยประกัน) ·
          <b> ประกันสังคม</b> หักเฉพาะลูกจ้าง (ข้าราชการไม่อยู่ในระบบ) · <b>การจ่ายจริง</b>ยังไม่เชื่อมบัญชีกลาง/ธนาคาร
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 no-print">
        <Card label="ฐาน/เงินเดือนรวม" value={totals.base} />
        <Card label="OT รวม" value={totals.ot} />
        <Card label="ประกันสังคมรวม" value={totals.sso} />
        <Card label="ภาษีหักรวม" value={totals.tax} />
        <Card label="ยอดรับสุทธิรวม" value={totals.net} accent />
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400 no-print"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto no-print">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
              <th className="px-3 py-2 font-medium text-center">ประเภทจ้าง</th>
              <th className="px-3 py-2 font-medium text-right">ฐาน/เงินเดือน</th>
              <th className="px-3 py-2 font-medium text-right">OT</th>
              <th className="px-3 py-2 font-medium text-right">รวมรายได้</th>
              <th className="px-3 py-2 font-medium text-right">ปกส.</th>
              <th className="px-3 py-2 font-medium text-right">ภาษี</th>
              <th className="px-3 py-2 font-medium text-right">รับสุทธิ</th>
              <th className="px-2 py-2 font-medium text-center">สลิป</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.e.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><div className="font-medium text-slate-700">{r.e.prefix}{r.e.firstName} {r.e.lastName ?? ''}</div><div className="text-[11px] text-slate-400">{r.e.positionText}</div></td>
                  <td className="px-3 py-2 text-center text-slate-500">{r.e.paymentType}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{r.slip.base ? money(r.slip.base) : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.slip.ot ? money(r.slip.ot) : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{r.slip.gross ? money(r.slip.gross) : '—'}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{r.slip.sso ? money(r.slip.sso) : '—'}</td>
                  <td className="px-3 py-2 text-right text-rose-600">{r.slip.tax ? money(r.slip.tax) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0F3575]">{r.slip.net ? money(r.slip.net) : '—'}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => setPrintTarget(r.e.id)} disabled={r.slip.gross <= 0} title="พิมพ์สลิปเงินเดือน"
                      className="p-1.5 rounded-md text-[#0F3575] hover:bg-[#0F3575]/10 disabled:opacity-30"><Printer className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right" colSpan={2}>รวมทั้งสิ้น</td>
                <td className="px-3 py-2 text-right">{money(totals.base)}</td>
                <td className="px-3 py-2 text-right">{money(totals.ot)}</td>
                <td className="px-3 py-2 text-right">{money(totals.gross)}</td>
                <td className="px-3 py-2 text-right text-rose-600">{money(totals.sso)}</td>
                <td className="px-3 py-2 text-right text-rose-600">{money(totals.tax)}</td>
                <td className="px-3 py-2 text-right text-[#0F3575]">{money(totals.net)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* สลิปสำหรับพิมพ์ — ซ่อนบนหน้าจอ แสดงเฉพาะตอนสั่งพิมพ์ */}
      <div className="print-sheet">
        {toPrint.map((r, i) => (
          <div key={r.e.id} className={i > 0 ? 'print-page-break' : undefined}>
            <Payslip employee={r.e} wardName={wardName} month={month} year={year} slip={r.slip} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** ตัวแก้พารามิเตอร์ภาษี/ประกันสังคม — บันทึกลง app_settings */
function TaxSettings({ cfg, onChange, onClose }: {
  cfg: PayrollTaxConfig; onChange: (c: PayrollTaxConfig) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<PayrollTaxConfig>(cfg);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setDraft(cfg), [cfg]);

  const num = (k: keyof PayrollTaxConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [k]: Number(e.target.value) } as PayrollTaxConfig);

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.setAppSetting(TAX_CONFIG_KEY, draft);
      onChange(draft);
      setMsg('บันทึกแล้ว — ยอดในตารางคำนวณใหม่ตามค่านี้');
    } catch (e: any) {
      setMsg(e?.message || 'บันทึกไม่สำเร็จ (ต้องเป็นสิทธิ์การเงิน/แอดมิน)');
    } finally { setBusy(false); }
  };
  const reset = () => setDraft(DEFAULT_TAX_CONFIG);

  const f = 'text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-full';
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 no-print">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">พารามิเตอร์คำนวณภาษี &amp; ประกันสังคม</h3>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">ปิด</button>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <label className="text-sm"><span className="block text-slate-500 mb-1">ปกส. อัตรา (%)</span><input type="number" step="0.1" value={draft.ssoRatePct} onChange={num('ssoRatePct')} className={f} /></label>
        <label className="text-sm"><span className="block text-slate-500 mb-1">ปกส. ฐานต่ำสุด</span><input type="number" value={draft.ssoWageFloor} onChange={num('ssoWageFloor')} className={f} /></label>
        <label className="text-sm"><span className="block text-slate-500 mb-1">ปกส. ฐานสูงสุด</span><input type="number" value={draft.ssoWageCeiling} onChange={num('ssoWageCeiling')} className={f} /></label>
        <label className="text-sm"><span className="block text-slate-500 mb-1">ปกส. เพดาน/เดือน</span><input type="number" value={draft.ssoMonthlyMax} onChange={num('ssoMonthlyMax')} className={f} /></label>

        <label className="text-sm"><span className="block text-slate-500 mb-1">หักค่าใช้จ่าย (%)</span><input type="number" value={draft.expenseDeductionPct} onChange={num('expenseDeductionPct')} className={f} /></label>
        <label className="text-sm"><span className="block text-slate-500 mb-1">เพดานค่าใช้จ่าย</span><input type="number" value={draft.expenseDeductionCap} onChange={num('expenseDeductionCap')} className={f} /></label>
        <label className="text-sm"><span className="block text-slate-500 mb-1">ลดหย่อนส่วนตัว</span><input type="number" value={draft.personalAllowance} onChange={num('personalAllowance')} className={f} /></label>
        <label className="text-sm"><span className="block text-slate-500 mb-1">จำนวนงวด/ปี</span><input type="number" value={draft.payPeriodsPerYear} onChange={num('payPeriodsPerYear')} className={f} /></label>
      </div>

      <div>
        <div className="text-xs text-slate-500 mb-1">อัตราภาษีขั้นบันได (เงินได้สุทธิ → อัตรา %)</div>
        <div className="flex flex-wrap gap-2">
          {draft.brackets.map((b, i) => (
            <div key={i} className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <span className="text-slate-400">ถึง</span>
              <span className="font-medium text-slate-600 w-20 text-right">{b.upTo == null ? 'ขึ้นไป' : b.upTo.toLocaleString('th-TH')}</span>
              <input type="number" value={b.ratePct} onChange={(e) => {
                const next = draft.brackets.map((x, j) => j === i ? { ...x, ratePct: Number(e.target.value) } : x);
                setDraft({ ...draft, brackets: next });
              }} className="w-14 border border-slate-300 rounded px-1 py-0.5 text-right" />
              <span className="text-slate-400">%</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          ค่าตั้งต้นอ้างอิงประกาศกรมสรรพากร (ใช้ตั้งแต่ปีภาษี 2560) ·
          ตัวเลขประกันสังคมเป็นค่าที่ใช้กันทั่วไป โปรดให้ฝ่ายการเงินยืนยันกับประกาศ สปส. ที่บังคับใช้อยู่ก่อนใช้งานจริง
        </p>
      </div>

      {msg && <div className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{msg}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={reset} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg"><RotateCcw className="w-4 h-4" />ใช้ค่าตั้งต้น</button>
        <button onClick={save} disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}บันทึก</button>
      </div>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}><div className="text-xs text-slate-500">{label}</div><div className={`text-lg font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value.toLocaleString('th-TH', { maximumFractionDigits: 0 })} ฿</div></div>;
}
