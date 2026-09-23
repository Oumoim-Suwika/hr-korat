import React from 'react';
import type { Employee, RosterSigner } from '../api/client';
import { THAI_MONTHS, REIMBURSEMENT_UNITS } from '../data';
import { thaiBahtText } from '../lib/thaiBaht';
import { computeClaim, type CellMap } from '../lib/useRosterData';

const OT_COLS = ['ชot', 'บot', 'ดot', 'BD', 'OR'];

function todayThai(): string {
  const d = new Date();
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * Connected reimbursement document packet, auto-filled from the roster:
 *   1) บันทึกข้อความ ขออนุมัติเบิกค่าตอบแทน OT   (memo, amount in Thai words)
 *   2) หลักฐานการจ่ายเงิน                          (payment evidence table)
 * Doc number prefix + out-of-hours time text derive from the unit's สายงาน.
 */
export default function ClaimDocuments({
  wardName, wardPhone, month, year, employees, cells, days, signers,
}: {
  wardName: string; wardPhone?: string; month: number; year: number;
  employees: Employee[]; cells: CellMap; days: number[]; signers: RosterSigner[];
}) {
  const claims = employees.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0);
  const total = claims.reduce((s, c) => s + c.amount, 0);
  const monthName = THAI_MONTHS[month - 1];

  // Reimbursement line for this unit (majority of staff), for doc number + time text.
  const lineCount: Record<string, number> = {};
  for (const e of employees) { const l = e.line ?? 'สนับสนุน'; lineCount[l] = (lineCount[l] ?? 0) + 1; }
  const line = (Object.entries(lineCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'สนับสนุน') as keyof typeof REIMBURSEMENT_UNITS;
  const unit = REIMBURSEMENT_UNITS[line];

  const controller = signers.find((s) => s.signerRole === 'controller');
  const approver = signers.find((s) => s.signerRole === 'approver');

  const paperStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
    padding: '18mm 16mm', maxWidth: 800, margin: '0 auto', lineHeight: 1.7,
  };

  return (
    <div className="space-y-6">
      {/* ---- Memo (บันทึกข้อความ ขอเบิก OT) ---- */}
      <div className="gov-form" style={paperStyle}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 26, marginBottom: 8 }}>บันทึกข้อความ</div>
        <div style={{ fontSize: 15 }}>
          <div><b>ส่วนราชการ</b>&nbsp; {wardName} โรงพยาบาลมหาราชนครราชสีมา&nbsp; โทร. {wardPhone ?? '-'}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><b>ที่</b>&nbsp; {unit.prefix}.........</span>
            <span><b>วันที่</b>&nbsp; {todayThai()}</span>
          </div>
          <div><b>เรื่อง</b>&nbsp; ขออนุมัติเบิกค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ</div>
          <div style={{ marginTop: 4 }}><b>เรียน</b>&nbsp; ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
        </div>
        <p style={{ textIndent: '2.5em', marginTop: 12, fontSize: 15 }}>
          ตามที่ {wardName} ได้ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ({unit.label})
          เวลา {unit.timeText} ประจำเดือน {monthName} {year} ความละเอียดแจ้งแล้วนั้น
        </p>
        <p style={{ textIndent: '2.5em', fontSize: 15 }}>
          ในการนี้ การปฏิบัติงานดังกล่าวได้เสร็จสิ้นเรียบร้อยแล้ว {wardName} จึงขออนุมัติเบิกค่าตอบแทน
          การปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ประจำเดือน {monthName} {year} จำนวน {claims.length} ราย
          เป็นจำนวนเงินทั้งสิ้น <b>{total.toLocaleString('th-TH')}</b> บาท ({thaiBahtText(total)})
          จากเงินบำรุงโรงพยาบาลมหาราชนครราชสีมา รายละเอียดตามหลักฐานการจ่ายเงินที่แนบมาพร้อมนี้
        </p>
        <p style={{ textIndent: '2.5em', fontSize: 15 }}>จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 15 }}>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
          <div>{controller?.title ?? 'หัวหน้าผู้ควบคุม'}</div>
        </div>
      </div>

      {/* ---- Payment evidence (หลักฐานการจ่ายเงิน) ---- */}
      <div className="gov-form" style={paperStyle}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>หลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ</div>
        <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 10 }}>{wardName} โรงพยาบาลมหาราชนครราชสีมา ประจำเดือน {monthName} {year}</div>
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>ที่</th>
              <th>ชื่อ - นามสกุล</th>
              <th>ตำแหน่ง</th>
              {OT_COLS.map((c) => <th key={c} style={{ width: 34 }}>{c}</th>)}
              <th style={{ width: 80 }}>จำนวนเงิน</th>
              <th style={{ width: 120 }}>ลายมือชื่อผู้รับเงิน</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c, i) => (
              <tr key={c.employee.id}>
                <td style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</td>
                <td style={{ fontSize: 11 }}>{c.employee.positionText ?? ''}</td>
                {OT_COLS.map((code) => <td key={code} style={{ textAlign: 'center' }}>{c.byCode[code] ?? ''}</td>)}
                <td style={{ textAlign: 'right' }}>{c.amount.toLocaleString('th-TH')}</td>
                <td />
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={3 + OT_COLS.length} style={{ textAlign: 'right' }}>รวมเป็นเงินทั้งสิ้น</td>
              <td style={{ textAlign: 'right' }}>{total.toLocaleString('th-TH')}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 13, marginTop: 6 }}>({thaiBahtText(total)})</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 36, fontSize: 14, textAlign: 'center' }}>
          <div>
            <div>(ลงชื่อ) ....................................</div>
            <div>( {controller?.name ?? '...............................'} )</div>
            <div>{controller?.title ?? 'หัวหน้าผู้ควบคุม'}</div>
          </div>
          <div>
            <div>(ลงชื่อ) ....................................</div>
            <div>( {approver?.name ?? '...............................'} )</div>
            <div>{approver?.title ?? 'ผู้อนุมัติ'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
