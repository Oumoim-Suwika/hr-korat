import React, { useMemo } from 'react';
import { useRosterData, computeClaim, cellKey, downloadFile, baseSalaryFor } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { Loader2, Wallet, Download, Info } from 'lucide-react';

/**
 * เงินเดือน & ค่าตอบแทนรวม (Payroll) — หน้าพรีวิว.
 * รวม: เงินเดือน/ค่าจ้างฐาน + OT (จากตารางเวร) = ยอดรับสุทธิต่อคน
 * NOTE: ยังไม่เชื่อมระบบจ่ายเงินเดือนจริง/บัญชี — เป็นการประมาณเพื่อแสดงภาพรวม
 */
export default function PayrollView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, days, loading } = useRosterData(wardId, year, month);
  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;

  const rows = useMemo(() => employees.map((e) => {
    const ot = computeClaim(e, cells, days).amount;
    const worked = days.filter((d) => { const c = cells[cellKey(e.id, d)]?.normalCode; return c && c !== 'ออฟ'; }).length;
    const base = e.paymentType === 'รายเดือน'
      ? (e.baseWage ?? baseSalaryFor(e.role))          // per-person salary, else role default
      : (e.baseWage ?? 0) * worked;                    // daily/period wage × worked days
    return { e, base, ot, worked, net: base + ot };
  }), [employees, cells, days]);

  const sum = (k: 'base' | 'ot' | 'net') => rows.reduce((s, r) => s + r[k], 0);

  const exportCsv = () => {
    const header = ['ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'ประเภทจ้าง', 'ฐาน/เงินเดือน', 'OT', 'รวมรับสุทธิ'];
    const body = rows.map((r, i) => [i + 1, `${r.e.prefix ?? ''}${r.e.firstName} ${r.e.lastName ?? ''}`.trim(), r.e.positionText ?? '', r.e.paymentType, r.base, r.ot, r.net]);
    body.push(['', '', '', 'รวม', sum('base'), sum('ot'), sum('net')]);
    downloadFile(`payroll_${wardName}_${monthLabel}.csv`, [header, ...body].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-[#0F3575]" />เงินเดือน & ค่าตอบแทนรวม (Payroll)</h2>
          <p className="text-sm text-slate-500">{wardName} · {monthLabel}</p>
        </div>
        <button onClick={exportCsv} disabled={!rows.length} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg disabled:opacity-50"><Download className="w-4 h-4" />ดาวน์โหลดสรุป (CSV)</button>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-700">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>ยอด OT คำนวณจากตารางเวรจริง × <b>อัตราค่าตอบแทน</b> ที่การเงินตั้งไว้ · เงินเดือนฐานใช้ค่ารายบุคคล (ถ้ามี) หรือค่าตั้งต้นตามตำแหน่งจากหน้า “อัตราค่าตอบแทน &amp; เงินเดือน” · <b>การจ่ายจริง</b>ยังไม่เชื่อมบัญชีกลาง/ธนาคาร</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card label="ฐาน/เงินเดือนรวม" value={sum('base')} />
        <Card label="OT รวม" value={sum('ot')} />
        <Card label="ยอดรับสุทธิรวม" value={sum('net')} accent />
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
              <th className="px-3 py-2 font-medium text-center">ประเภทจ้าง</th>
              <th className="px-3 py-2 font-medium text-right">ฐาน/เงินเดือน</th>
              <th className="px-3 py-2 font-medium text-right">OT</th>
              <th className="px-3 py-2 font-medium text-right">รวมรับสุทธิ</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.e.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2"><div className="font-medium text-slate-700">{r.e.prefix}{r.e.firstName} {r.e.lastName ?? ''}</div><div className="text-[11px] text-slate-400">{r.e.positionText}</div></td>
                  <td className="px-3 py-2 text-center text-slate-500">{r.e.paymentType}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{r.base ? r.base.toLocaleString('th-TH') : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.ot ? r.ot.toLocaleString('th-TH') : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0F3575]">{r.net ? r.net.toLocaleString('th-TH') : '—'}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-right" colSpan={2}>รวมทั้งสิ้น</td>
                <td className="px-3 py-2 text-right">{sum('base').toLocaleString('th-TH')}</td>
                <td className="px-3 py-2 text-right">{sum('ot').toLocaleString('th-TH')}</td>
                <td className="px-3 py-2 text-right text-[#0F3575]">{sum('net').toLocaleString('th-TH')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value.toLocaleString('th-TH')} ฿</div></div>;
}
