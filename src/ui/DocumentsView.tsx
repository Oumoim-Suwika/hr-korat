import React from 'react';
import { useRosterData } from '../lib/useRosterData';
import PrintableRoster from './PrintableRoster';
import ClaimDocuments from './ClaimDocuments';
import { FileText, Printer, Loader2 } from 'lucide-react';

/**
 * ฟอร์มตั้งเบิก — the CONNECTED reimbursement packet, auto-filled from the roster:
 *   ตารางเวร  →  บันทึกข้อความขอเบิก  →  หลักฐานการจ่ายเงิน  →  (ยอด → KTB ในหน้าการเงิน)
 * On-screen preview + print (browser → Save as PDF). Daily vs OT forms are
 * kept separate per staff feedback.
 */
export default function DocumentsView({ wardName, wardPhone, wardId, year, month }: {
  wardName: string; wardPhone?: string; wardId: number; year: number; month: number;
}) {
  const { employees, cells, signers, days, ceYear, roster, loading } = useRosterData(wardId, year, month);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-[#0F3575]" />ชุดเอกสารเบิกจ่าย (ตราครุฑ)</h2>
          <p className="text-sm text-slate-500">{wardName} · เอกสารเชื่อมจากตารางเวรจริง กด "พิมพ์" แล้ว Save as PDF</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e]"><Printer className="w-4 h-4" />พิมพ์ทั้งชุด (PDF)</button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          {/* on-screen preview of the connected documents */}
          <div className="no-print bg-slate-100 rounded-xl p-4 overflow-auto">
            <ClaimDocuments wardName={wardName} wardPhone={wardPhone} month={month} year={year}
              employees={employees} cells={cells} days={days} signers={signers} />
          </div>

          {/* print packet: memo + payment evidence + schedule (each its own page) */}
          <div className="print-sheet gov-form">
            <div style={{ pageBreakAfter: 'always' }}>
              <ClaimDocuments wardName={wardName} wardPhone={wardPhone} month={month} year={year}
                employees={employees} cells={cells} days={days} signers={signers} />
            </div>
            <PrintableRoster wardName={wardName} month={month} year={year} ceYear={ceYear} days={days}
              employees={employees} cells={cells} signers={signers} note={roster?.note ?? null} />
          </div>
        </>
      )}
    </div>
  );
}
