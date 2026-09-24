import React from 'react';
import type { Employee, RosterSigner } from '../api/client';
import { THAI_MONTHS, REIMBURSEMENT_UNITS } from '../data';
import { thaiBahtText } from '../lib/thaiBaht';
import { toThaiDigits } from '../lib/thai';
import { computeClaim, rateFor, type CellMap } from '../lib/useRosterData';

const OT_COLS = ['ชot', 'บot', 'ดot', 'BD', 'OR'];

function todayThai(): string {
  const d = new Date();
  return toThaiDigits(`${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`);
}

export interface MemoEdits { subject?: string; body1?: string; body2?: string; }

export function defaultMemo(wardName: string, month: number, year: number, claimsCount: number, total: number, line: keyof typeof REIMBURSEMENT_UNITS): MemoEdits {
  const unit = REIMBURSEMENT_UNITS[line];
  const m = THAI_MONTHS[month - 1];
  const y = toThaiDigits(year);
  return {
    subject: 'ขออนุมัติเบิกค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ',
    body1: `ตามที่ ${wardName} ได้ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ (${unit.label}) เวลา ${unit.timeText} ประจำเดือน ${m} ${y} ความละเอียดแจ้งแล้วนั้น`,
    body2: `ในการนี้ การปฏิบัติงานดังกล่าวได้เสร็จสิ้นเรียบร้อยแล้ว ${wardName} จึงขออนุมัติเบิกค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ประจำเดือน ${m} ${y} จำนวน ${toThaiDigits(claimsCount)} ราย เป็นจำนวนเงินทั้งสิ้น ${toThaiDigits(total.toLocaleString('th-TH'))} บาท (${thaiBahtText(total)}) จากเงินบำรุงโรงพยาบาลมหาราชนครราชสีมา รายละเอียดตามหลักฐานการจ่ายเงินที่แนบมาพร้อมนี้`,
  };
}

export function lineForWard(employees: Employee[]): keyof typeof REIMBURSEMENT_UNITS {
  const c: Record<string, number> = {};
  for (const e of employees) { const l = e.line ?? 'สนับสนุน'; c[l] = (c[l] ?? 0) + 1; }
  return (Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'สนับสนุน') as any;
}

export default function ClaimDocuments({
  wardName, wardPhone, month, year, employees, cells, days, signers, edits,
}: {
  wardName: string; wardPhone?: string; month: number; year: number;
  employees: Employee[]; cells: CellMap; days: number[]; signers: RosterSigner[]; edits?: MemoEdits;
}) {
  const claims = employees.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0);
  const total = claims.reduce((s, c) => s + c.amount, 0);
  const monthName = THAI_MONTHS[month - 1];
  const line = lineForWard(employees);
  const unit = REIMBURSEMENT_UNITS[line];
  const memo = { ...defaultMemo(wardName, month, year, claims.length, total, line), ...(edits ?? {}) };

  const controller = signers.find((s) => s.signerRole === 'controller');
  const approver = signers.find((s) => s.signerRole === 'approver');

  const paper: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '18mm 16mm', maxWidth: 800, margin: '0 auto', lineHeight: 1.7 };

  return (
    <div className="space-y-6">
      {/* Memo */}
      <div className="gov-form" style={paper}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 26, marginBottom: 8 }}>บันทึกข้อความ</div>
        <div style={{ fontSize: 15 }}>
          <div><b>ส่วนราชการ</b>&nbsp; {wardName} โรงพยาบาลมหาราชนครราชสีมา&nbsp; โทร. {toThaiDigits(wardPhone ?? '-')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><b>ที่</b>&nbsp; {unit.prefix}.........</span>
            <span><b>วันที่</b>&nbsp; {todayThai()}</span>
          </div>
          <div><b>เรื่อง</b>&nbsp; {memo.subject}</div>
          <div style={{ marginTop: 4 }}><b>เรียน</b>&nbsp; ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
        </div>
        <p style={{ textIndent: '2.5em', marginTop: 12, fontSize: 15, whiteSpace: 'pre-wrap' }}>{memo.body1}</p>
        <p style={{ textIndent: '2.5em', fontSize: 15, whiteSpace: 'pre-wrap' }}>{memo.body2}</p>
        <p style={{ textIndent: '2.5em', fontSize: 15 }}>จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 15 }}>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
          <div>{controller?.title ?? ''}</div>
        </div>
      </div>

      {/* Payment evidence */}
      <div className="gov-form" style={paper}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>หลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ</div>
        <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 10 }}>{wardName} โรงพยาบาลมหาราชนครราชสีมา ประจำเดือน {monthName} {toThaiDigits(year)}</div>
        <table style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 30 }}>ที่</th><th>ชื่อ - นามสกุล</th><th>ตำแหน่ง</th>
              {OT_COLS.map((c) => <th key={c} style={{ width: 34 }}>{c}</th>)}
              <th style={{ width: 80 }}>จำนวนเงิน</th><th style={{ width: 120 }}>ลายมือชื่อผู้รับเงิน</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c, i) => (
              <tr key={c.employee.id}>
                <td style={{ textAlign: 'center' }}>{toThaiDigits(i + 1)}</td>
                <td>{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</td>
                <td style={{ fontSize: 11 }}>{c.employee.positionText ?? ''}</td>
                {OT_COLS.map((code) => <td key={code} style={{ textAlign: 'center' }}>{c.byCode[code] ? toThaiDigits(c.byCode[code]) : ''}</td>)}
                <td style={{ textAlign: 'right' }}>{toThaiDigits(c.amount.toLocaleString('th-TH'))}</td>
                <td />
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={3 + OT_COLS.length} style={{ textAlign: 'right' }}>รวมเป็นเงินทั้งสิ้น</td>
              <td style={{ textAlign: 'right' }}>{toThaiDigits(total.toLocaleString('th-TH'))}</td><td />
            </tr>
          </tbody>
        </table>
        <div style={{ fontSize: 13, marginTop: 6 }}>({thaiBahtText(total)})</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 36, fontSize: 14, textAlign: 'center' }}>
          <div><div>(ลงชื่อ) ....................................</div><div>( {controller?.name ?? '...........................'} )</div><div>{controller?.title ?? ''}</div></div>
          <div><div>(ลงชื่อ) ....................................</div><div>( {approver?.name ?? '...........................'} )</div><div>{approver?.title ?? ''}</div></div>
        </div>
      </div>

      {/* ใบแนบปริมาณงานเบิก OT (breakdown by code × rate) */}
      <div className="gov-form" style={{ ...paper, pageBreakBefore: 'always' }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>ใบแนบปริมาณงานการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ</div>
        <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 10 }}>{wardName} ประจำเดือน {monthName} {toThaiDigits(year)}</div>
        <table style={{ fontSize: 13 }}>
          <thead><tr><th style={{ width: 30 }}>ที่</th><th>ชื่อ - นามสกุล</th><th>รหัสเวร</th><th style={{ width: 50 }}>จำนวน(เวร)</th><th style={{ width: 70 }}>อัตรา(บาท)</th><th style={{ width: 80 }}>รวม(บาท)</th></tr></thead>
          <tbody>
            {claims.flatMap((c, i) => Object.entries(c.byCode).map(([code, n], j) => {
              const rate = rateFor(c.employee.role, code);
              return (
                <tr key={`${c.employee.id}-${code}`}>
                  <td style={{ textAlign: 'center' }}>{j === 0 ? toThaiDigits(i + 1) : ''}</td>
                  <td>{j === 0 ? `${c.employee.prefix ?? ''}${c.employee.firstName} ${c.employee.lastName ?? ''}` : ''}</td>
                  <td style={{ textAlign: 'center' }}>{code}</td>
                  <td style={{ textAlign: 'center' }}>{toThaiDigits(n as number)}</td>
                  <td style={{ textAlign: 'right' }}>{toThaiDigits(rate.toLocaleString('th-TH'))}</td>
                  <td style={{ textAlign: 'right' }}>{toThaiDigits(((n as number) * rate).toLocaleString('th-TH'))}</td>
                </tr>
              );
            }))}
            <tr style={{ fontWeight: 700 }}><td colSpan={5} style={{ textAlign: 'right' }}>รวมทั้งสิ้น</td><td style={{ textAlign: 'right' }}>{toThaiDigits(total.toLocaleString('th-TH'))}</td></tr>
          </tbody>
        </table>
        <div style={{ textAlign: 'center', marginTop: 30, fontSize: 14 }}>
          <div>(ลงชื่อ) ....................................</div>
          <div>( {controller?.name ?? '...........................'} )</div>
          <div>{controller?.title ?? 'ผู้จัดทำ'}</div>
        </div>
      </div>
    </div>
  );
}
