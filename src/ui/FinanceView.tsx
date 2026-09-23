import React, { useMemo } from 'react';
import { useRosterData, computeClaim, downloadFile } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { Loader2, DollarSign, Download, Landmark } from 'lucide-react';

const OT_COLS = ['ชot', 'บot', 'ดot', 'BD', 'OR'];

export default function FinanceView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, days, loading, roster } = useRosterData(wardId, year, month);

  const claims = useMemo(
    () => employees.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0),
    [employees, cells, days],
  );
  const total = claims.reduce((s, c) => s + c.amount, 0);
  const totalOt = claims.reduce((s, c) => s + c.otCount, 0);

  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;

  const exportSummary = () => {
    const header = ['ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', ...OT_COLS, 'รวมเวร OT', 'ยอดเบิก (บาท)'];
    const rows = claims.map((c, i) => [
      i + 1,
      `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}`.trim(),
      c.employee.positionText ?? '',
      ...OT_COLS.map((code) => c.byCode[code] ?? 0),
      c.otCount,
      c.amount,
    ]);
    rows.push(['', '', '', ...OT_COLS.map(() => ''), totalOt, total]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`สรุปเบิกOT_${wardName}_${monthLabel}.csv`, csv);
  };

  // KTB Corporate bulk-payment style file (draft layout — adjust to bank spec).
  const exportKTB = () => {
    const header = ['ลำดับ', 'เลขที่บัญชี', 'ชื่อบัญชี', 'จำนวนเงิน', 'อ้างอิง'];
    const rows = claims.map((c, i) => [
      i + 1,
      c.employee.bankAccount ?? '',
      `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}`.trim(),
      c.amount.toFixed(2),
      `OT ${monthLabel}`,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadFile(`KTB_Corporate_${wardName}_${monthLabel}.csv`, csv);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><DollarSign className="w-5 h-5 text-[#0F3575]" />การเงิน &amp; เบิกจ่าย</h2>
          <p className="text-sm text-slate-500">{wardName} · {monthLabel}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportSummary} disabled={!claims.length} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"><Download className="w-4 h-4" />สรุป (CSV)</button>
          <button onClick={exportKTB} disabled={!claims.length} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e] disabled:opacity-50"><Landmark className="w-4 h-4" />ไฟล์จ่าย KTB</button>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card label="ยอดเบิกรวม" value={`${total.toLocaleString('th-TH')} ฿`} accent />
        <Card label="จำนวนเวร OT รวม" value={`${totalOt} เวร`} />
        <Card label="ผู้มีสิทธิ์เบิก" value={`${claims.length} คน`} />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : claims.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีรายการ OT ในเดือนนี้ (ลงตารางเวร + ล็อกวันทำการก่อน)</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
                {OT_COLS.map((c) => <th key={c} className="px-2 py-2 font-medium text-center">{c}</th>)}
                <th className="px-3 py-2 font-medium text-center">รวมเวร</th>
                <th className="px-3 py-2 font-medium text-right">ยอดเบิก (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <tr key={c.employee.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-700">{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</div>
                    <div className="text-[11px] text-slate-400">{c.employee.positionText}</div>
                  </td>
                  {OT_COLS.map((code) => <td key={code} className="px-2 py-2 text-center text-slate-600">{c.byCode[code] ?? '—'}</td>)}
                  <td className="px-3 py-2 text-center font-medium">{c.otCount}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0F3575]">{c.amount.toLocaleString('th-TH')}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right" colSpan={OT_COLS.length + 1}>รวมทั้งสิ้น</td>
                <td className="px-3 py-2 text-center">{totalOt}</td>
                <td className="px-3 py-2 text-right text-[#0F3575]">{total.toLocaleString('th-TH')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {roster?.status !== 'approved' && claims.length > 0 && (
        <p className="text-xs text-amber-600">* ตารางเวรยังไม่ได้รับอนุมัติ — ตัวเลขนี้เป็นการประมาณจากร่างตาราง</p>
      )}
      <p className="text-[11px] text-slate-400">หมายเหตุ: รูปแบบไฟล์ KTB เป็นแบบร่าง ปรับให้ตรงสเปกไฟล์นำเข้าของธนาคารได้ (เลขบัญชีดึงจากข้อมูลบุคลากร)</p>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}
