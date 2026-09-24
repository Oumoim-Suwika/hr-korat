import React from 'react';
import type { Employee, RosterSigner } from '../api/client';
import { THAI_MONTHS, REIMBURSEMENT_UNITS } from '../data';
import { thaiBahtText } from '../lib/thaiBaht';
import { toThaiDigits } from '../lib/thai';
import { rateFor, cellKey, type CellMap } from '../lib/useRosterData';

// OT (holiday/shift) codes vs บ่ายดึก are reimbursed on SEPARATE forms (staff feedback).
const OT_CODES = ['ชot', 'บot', 'ดot', 'OR'];
const BD_CODES = ['BD'];

export type ClaimVariant = 'ot' | 'bd';
export interface MemoEdits { subject?: string; body1?: string; body2?: string; }

export function lineForWard(employees: Employee[]): keyof typeof REIMBURSEMENT_UNITS {
  const c: Record<string, number> = {};
  for (const e of employees) { const l = e.line ?? 'สนับสนุน'; c[l] = (c[l] ?? 0) + 1; }
  return (Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'สนับสนุน') as any;
}

function todayThai(): string { const d = new Date(); return toThaiDigits(`${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`); }

interface RowClaim { employee: Employee; count: number; amount: number; byCode: Record<string, number>; }
function claimsFor(employees: Employee[], cells: CellMap, days: number[], codes: string[]): RowClaim[] {
  return employees.map((e) => {
    const byCode: Record<string, number> = {}; let count = 0, amount = 0;
    for (const d of days) {
      const code = cells[cellKey(e.id, d)]?.otCode;
      if (code && codes.includes(code)) { byCode[code] = (byCode[code] || 0) + 1; count++; amount += rateFor(e.role, code); }
    }
    return { employee: e, count, amount, byCode };
  }).filter((c) => c.count > 0);
}

export function defaultMemo(wardName: string, month: number, year: number, claimsCount: number, total: number, line: keyof typeof REIMBURSEMENT_UNITS, variant: ClaimVariant = 'ot'): MemoEdits {
  const unit = REIMBURSEMENT_UNITS[line];
  const m = THAI_MONTHS[month - 1]; const y = toThaiDigits(year);
  const bd = variant === 'bd';
  const kind = bd ? 'เวรบ่าย-ดึก' : 'นอกเวลาราชการและวันหยุดราชการ';
  const timeText = bd ? 'เวลา ๒๔.๐๐-๐๘.๐๐ น. และ ๑๖.๐๐-๒๔.๐๐ น.' : unit.timeText;
  return {
    subject: bd ? 'ขออนุมัติเบิกค่าตอบแทนการปฏิบัติงานเวรบ่าย-ดึก' : 'ขออนุมัติเบิกค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ',
    body1: `ตามที่ ${wardName} ได้ขออนุมัติขึ้นปฏิบัติงาน${kind} (${unit.label}) ${timeText} ประจำเดือน ${m} ${y} ความละเอียดแจ้งแล้วนั้น`,
    body2: `ในการนี้ การปฏิบัติงานดังกล่าวได้เสร็จสิ้นเรียบร้อยแล้ว ${wardName} จึงขออนุมัติเบิกค่าตอบแทนการปฏิบัติงาน${kind} ประจำเดือน ${m} ${y} จำนวน ${toThaiDigits(claimsCount)} ราย เป็นจำนวนเงินทั้งสิ้น ${toThaiDigits(total.toLocaleString('th-TH'))} บาท (${thaiBahtText(total)}) จากเงินบำรุงโรงพยาบาลมหาราชนครราชสีมา รายละเอียดตามหลักฐานการจ่ายเงินที่แนบมาพร้อมนี้`,
  };
}

export default function ClaimDocuments({
  wardName, wardPhone, month, year, employees, cells, days, signers, edits, variant = 'ot',
}: {
  wardName: string; wardPhone?: string; month: number; year: number;
  employees: Employee[]; cells: CellMap; days: number[]; signers: RosterSigner[]; edits?: MemoEdits; variant?: ClaimVariant;
}) {
  const cols = variant === 'bd' ? BD_CODES : OT_CODES;
  const claims = claimsFor(employees, cells, days, cols);
  const total = claims.reduce((s, c) => s + c.amount, 0);
  const monthName = THAI_MONTHS[month - 1];
  const line = lineForWard(employees);
  const unit = REIMBURSEMENT_UNITS[line];
  const memo = { ...defaultMemo(wardName, month, year, claims.length, total, line, variant), ...(edits ?? {}) };
  const controller = signers.find((s) => s.signerRole === 'controller');
  const approver = signers.find((s) => s.signerRole === 'approver');
  const evidenceTitle = variant === 'bd'
    ? 'หลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานเวรบ่าย-ดึก'
    : 'หลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ';

  const paper: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '15mm', maxWidth: '190mm', margin: '0 auto', lineHeight: 1.6 };

  return (
    <div className="space-y-6">
      {/* Memo */}
      <div className="gov-form" style={paper}>
        <div style={{ position: 'relative', minHeight: 56, marginBottom: 2 }}>
          <img src="/kruth.png" alt="ตราครุฑ" style={{ height: 54, position: 'absolute', left: 0, top: 0 }} />
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 24, paddingTop: 12 }}>บันทึกข้อความ</div>
        </div>
        <div style={{ fontSize: 15 }}>
          <div><b>ส่วนราชการ</b>&nbsp; {wardName} โรงพยาบาลมหาราชนครราชสีมา&nbsp; โทร. {toThaiDigits(wardPhone ?? '-')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span><b>ที่</b>&nbsp; {unit.prefix}.........</span><span><b>วันที่</b>&nbsp; {todayThai()}</span></div>
          <div><b>เรื่อง</b>&nbsp; {memo.subject}</div>
          <div style={{ marginTop: 4 }}><b>เรียน</b>&nbsp; ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
        </div>
        <p style={{ textIndent: '2.5em', marginTop: 12, fontSize: 15, whiteSpace: 'pre-wrap' }}>{memo.body1}</p>
        <p style={{ textIndent: '2.5em', fontSize: 15, whiteSpace: 'pre-wrap' }}>{memo.body2}</p>
        <p style={{ textIndent: '2.5em', fontSize: 15 }}>จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
        <div style={{ textAlign: 'center', marginTop: 40, fontSize: 15 }}>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
        </div>
      </div>

      {/* Payment evidence */}
      <div className="gov-form" style={paper}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>{evidenceTitle}</div>
        <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 10 }}>{wardName} โรงพยาบาลมหาราชนครราชสีมา ประจำเดือน {monthName} {toThaiDigits(year)}</div>
        <table style={{ fontSize: 13 }}>
          <thead><tr>
            <th style={{ width: 30 }}>ที่</th><th>ชื่อ - นามสกุล</th><th>ตำแหน่ง</th>
            {cols.map((c) => <th key={c} style={{ width: 40 }}>{c}</th>)}
            <th style={{ width: 80 }}>จำนวนเงิน</th><th style={{ width: 120 }}>ลายมือชื่อผู้รับเงิน</th>
          </tr></thead>
          <tbody>
            {claims.map((c, i) => (
              <tr key={c.employee.id}>
                <td style={{ textAlign: 'center' }}>{toThaiDigits(i + 1)}</td>
                <td>{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</td>
                <td style={{ fontSize: 11 }}>{c.employee.positionText ?? ''}</td>
                {cols.map((code) => <td key={code} style={{ textAlign: 'center' }}>{c.byCode[code] ? toThaiDigits(c.byCode[code]) : ''}</td>)}
                <td style={{ textAlign: 'right' }}>{toThaiDigits(c.amount.toLocaleString('th-TH'))}</td><td />
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}><td colSpan={3 + cols.length} style={{ textAlign: 'right' }}>รวมเป็นเงินทั้งสิ้น</td><td style={{ textAlign: 'right' }}>{toThaiDigits(total.toLocaleString('th-TH'))}</td><td /></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 13, marginTop: 6 }}>({thaiBahtText(total)})</div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 36, fontSize: 14, textAlign: 'center' }}>
          <div><div>(ลงชื่อ) ....................................</div><div>( {controller?.name ?? '...........................'} )</div></div>
          <div><div>(ลงชื่อ) ....................................</div><div>( {approver?.name ?? '...........................'} )</div></div>
        </div>
      </div>

      {/* ใบแนบปริมาณงาน (breakdown by code × rate) */}
      <div className="gov-form" style={{ ...paper, pageBreakBefore: 'always' }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>ใบแนบปริมาณงาน{variant === 'bd' ? 'เวรบ่าย-ดึก' : 'การปฏิบัติงานนอกเวลาราชการ'}</div>
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
      </div>

      {/* ใบลงเวลาปฏิบัติงาน (แยก OT / บ่ายดึก) — fits A4 portrait */}
      <div className="gov-form print-fit" style={{ ...paper, pageBreakBefore: 'always' }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>ใบลงเวลาปฏิบัติงาน{variant === 'bd' ? 'เวรบ่าย-ดึก' : 'นอกเวลาราชการและวันหยุดราชการ'}</div>
        <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 8 }}>{wardName} ประจำเดือน {monthName} {toThaiDigits(year)}</div>
        <table style={{ fontSize: 10 }}>
          <thead><tr><th style={{ minWidth: 120 }}>ชื่อ - นามสกุล</th>
            {days.map((d) => { const wd = new Date(year - 543, month - 1, d).getDay(); return <th key={d} style={{ width: 14, background: wd === 0 || wd === 6 ? '#eee' : undefined }}>{toThaiDigits(d)}</th>; })}
            <th style={{ width: 30 }}>รวม</th></tr></thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.employee.id}>
                <td style={{ fontSize: 11 }}>{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</td>
                {days.map((d) => { const code = cells[cellKey(c.employee.id, d)]?.otCode; const hit = !!code && cols.includes(code); return <td key={d} style={{ textAlign: 'center', fontSize: 8, background: hit ? '#fde2e4' : undefined, fontWeight: hit ? 700 : undefined }}>{hit ? code : ''}</td>; })}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{toThaiDigits(c.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 24, fontSize: 13, textAlign: 'center' }}>
          <div><div>(ลงชื่อ) ..............................</div><div>( {controller?.name ?? '...........................'} )</div></div>
          <div><div>(ลงชื่อ) ..............................</div><div>( {approver?.name ?? '...........................'} )</div></div>
        </div>
      </div>
    </div>
  );
}
