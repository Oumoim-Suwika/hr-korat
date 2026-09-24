import React from 'react';
import type { Employee, RosterSigner } from '../api/client';
import { THAI_MONTHS, REIMBURSEMENT_UNITS } from '../data';
import { toThaiDigits } from '../lib/thai';
import { lineForWard } from './ClaimDocuments';

/**
 * บันทึกข้อความ "ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ"
 * (ฟอร์มขอขึ้น — เสนอก่อนขึ้นปฏิบัติงานเดือนถัดไป) ตามเทมเพลต toSATI แยกตามสายงาน.
 */
export default function RequestToWork({ wardName, wardPhone, month, year, employees, signers }: {
  wardName: string; wardPhone?: string; month: number; year: number; employees: Employee[]; signers: RosterSigner[];
}) {
  const line = lineForWard(employees);
  const unit = REIMBURSEMENT_UNITS[line];
  const m = THAI_MONTHS[month - 1];
  const y = toThaiDigits(year);
  const isNursing = line === 'พยาบาล';
  const controller = signers.find((s) => s.signerRole === 'controller');
  const approver = signers.find((s) => s.signerRole === 'approver');

  const paper: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '18mm 16mm', maxWidth: 800, margin: '0 auto', lineHeight: 1.7 };

  const body1 = isNursing
    ? `ด้วย ${wardName} ${unit.label} ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ตามคำสั่งโรงพยาบาลมหาราชนครราชสีมา ที่ ๙๙๙/${y} ลงวันที่ ๙ ${m} ${y} เพื่อให้บริการผู้ป่วยตลอด ๒๔ ชั่วโมง`
    : `ด้วย ${wardName} ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ตามคำสั่งโรงพยาบาลมหาราชนครราชสีมา ที่ ๙๙๙/${y} ลงวันที่ ๙ ${m} ${y} โดยมีภาระงานนอกเวลาราชการเพื่อให้บริการประชาชนอย่างต่อเนื่อง`;
  const body2 = `ในการนี้ ${wardName} จึงขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ${unit.timeText} ในวันทำการและวันหยุดราชการ ประจำเดือน ${m} ${y} รายละเอียดตามตารางเวรที่แนบมาพร้อมนี้`;

  return (
    <div className="gov-form" style={paper}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 26, marginBottom: 8 }}>บันทึกข้อความ</div>
      <div style={{ fontSize: 15 }}>
        <div><b>ส่วนราชการ</b>&nbsp; {wardName}{isNursing ? ' กลุ่มภารกิจด้านการพยาบาล' : ' โรงพยาบาลมหาราชนครราชสีมา'}&nbsp; โทร. {toThaiDigits(wardPhone ?? '-')}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><b>ที่</b>&nbsp; {unit.prefix}.........</span>
          <span><b>วันที่</b>&nbsp; .........................</span>
        </div>
        <div><b>เรื่อง</b>&nbsp; ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ</div>
        <div style={{ marginTop: 4 }}><b>เรียน</b>&nbsp; ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
      </div>
      <p style={{ textIndent: '2.5em', marginTop: 12, fontSize: 15 }}>{body1}</p>
      <p style={{ textIndent: '2.5em', fontSize: 15 }}>{body2}</p>
      <p style={{ textIndent: '2.5em', fontSize: 15 }}>จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>

      {isNursing ? (
        <div style={{ marginTop: 30, fontSize: 15, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div><div>(ลงชื่อ) ..................................................</div><div>( {controller?.name ?? '.........................................'} )</div><div>{controller?.title ?? 'หัวหน้าหอผู้ป่วย'}</div></div>
          <div><div>(ลงชื่อ) ..................................................</div><div>( ......................................... )</div><div>หัวหน้ากลุ่มงานการพยาบาล</div></div>
          <div><div>(ลงชื่อ) ..................................................</div><div>( {approver?.name ?? '.........................................'} )</div><div>{approver?.title ?? 'หัวหน้าพยาบาล'}</div></div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 15 }}>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
          <div>{controller?.title ?? 'หัวหน้ากลุ่มงาน'}</div>
        </div>
      )}
    </div>
  );
}
