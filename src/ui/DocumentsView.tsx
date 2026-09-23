import React from 'react';
import { useRosterData } from '../lib/useRosterData';
import PrintableRoster from './PrintableRoster';
import { FileText, Printer, Loader2 } from 'lucide-react';

/**
 * ฟอร์มตั้งเบิก — per staff feedback, daily-wage and OT/afternoon-night forms
 * are kept separate. This page groups the official documents and lets the user
 * print the ตราครุฑ "หลักฐานการจ่ายเงิน / ตารางเวร" (browser -> Save as PDF).
 */
export default function DocumentsView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, signers, days, ceYear, roster, loading } = useRosterData(wardId, year, month);

  const forms = [
    { group: 'ฟอร์มตั้งเบิก OT / บ่ายดึก', items: [
      'บันทึกข้อความ ขอเบิกเงิน OT',
      'บันทึกข้อความ ขอเบิกเงิน บ่ายดึก (แยกจาก OT)',
      'หลักฐานการจ่ายเงิน (ตารางสรุปเวรที่ขึ้นทำงาน)',
      'ตารางเวรที่เคลียร์แล้ว (ผ่านเปลี่ยนเวร/ลา/อบรม) พร้อมช่องเซ็นรับรอง',
    ]},
    { group: 'ฟอร์มตั้งเบิก รายวัน', items: [
      'บันทึกข้อความ ขอเบิกค่าจ้าง (รายวัน)',
      'ใบสำคัญรับเงิน',
      'ใบลงเวลาทำงาน (แสดงวันทำการจากตารางเวร)',
      'คำสั่งจ้าง (HR อัปโหลด)',
    ]},
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-[#0F3575]" />ฟอร์มตั้งเบิกและเอกสารราชการ</h2>
          <p className="text-sm text-slate-500">{wardName} · ออกเอกสารตราครุฑ สำหรับเสนอผู้บริหารและตั้งเบิก</p>
        </div>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e]"><Printer className="w-4 h-4" />พิมพ์ตารางเวร / หลักฐานการจ่าย (PDF)</button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {forms.map((f) => (
            <div key={f.group} className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="font-semibold text-slate-700 mb-2">{f.group}</h3>
              <ul className="space-y-1.5">
                {f.items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-sm text-slate-600">
                    <FileText className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />{it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400">
        ฟอนต์เอกสาร: TH Sarabun (ตามระเบียบ). กด "พิมพ์" แล้วเลือก "Save as PDF" เพื่อได้ไฟล์ตราครุฑสำหรับเสนอ/ตั้งเบิก
      </p>

      {/* Hidden on screen; printed via window.print() */}
      <PrintableRoster
        wardName={wardName} month={month} year={year} ceYear={ceYear} days={days}
        employees={employees} cells={cells} signers={signers} note={roster?.note ?? null}
      />
    </div>
  );
}
