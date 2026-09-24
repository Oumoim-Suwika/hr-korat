import React from 'react';
import type { Employee, RosterSigner } from '../api/client';
import { THAI_MONTHS, THAI_DAYS_SHORT } from '../data';
import { thaiBahtText } from '../lib/thaiBaht';
import { toThaiDigits } from '../lib/thai';
import { cellKey, type CellMap } from '../lib/useRosterData';

const DEFAULT_DAILY_WAGE = 420; // ค่าจ้างรายวันเริ่มต้น (บาท/วัน) เมื่อไม่ได้ระบุ

/** ชุดฟอร์มตั้งเบิก "รายวัน/รายคาบ": บันทึกข้อความ + ใบสำคัญรับเงิน + ใบลงเวลา */
export default function DailyForms({
  wardName, wardPhone, month, year, ceYear, days, employees, cells, signers,
}: {
  wardName: string; wardPhone?: string; month: number; year: number; ceYear: number; days: number[];
  employees: Employee[]; cells: CellMap; signers: RosterSigner[];
}) {
  const daily = employees.filter((e) => e.paymentType === 'รายวัน' || e.paymentType === 'รายคาบ');
  const monthName = THAI_MONTHS[month - 1];
  const controller = signers.find((s) => s.signerRole === 'controller');

  const workedDays = (empId: number) => days.filter((d) => { const c = cells[cellKey(empId, d)]?.normalCode; return c && c !== 'ออฟ'; }).length;
  const wageOf = (e: Employee) => (e.baseWage || DEFAULT_DAILY_WAGE) * workedDays(e.id);
  const total = daily.reduce((s, e) => s + wageOf(e), 0);

  const paper: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: '15mm', maxWidth: '190mm', margin: '0 auto', lineHeight: 1.6 };

  if (daily.length === 0) {
    return <div className="gov-form" style={paper}><p style={{ textAlign: 'center', color: '#64748b' }}>กลุ่มงานนี้ไม่มีลูกจ้างรายวัน/รายคาบ — เพิ่มบุคลากรที่หน้า "จัดการบุคลากร" (ประเภทการจ่าย = รายวัน) เพื่อออกฟอร์มชุดนี้</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* 1) memo */}
      <div className="gov-form" style={paper}>
        <div style={{ position: 'relative', minHeight: 56, marginBottom: 2 }}>
          <img src="/kruth.png" alt="ตราครุฑ" style={{ height: 54, position: 'absolute', left: 0, top: 0 }} />
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 24, paddingTop: 12 }}>บันทึกข้อความ</div>
        </div>
        <div style={{ fontSize: 15 }}>
          <div><b>ส่วนราชการ</b>&nbsp; {wardName} โรงพยาบาลมหาราชนครราชสีมา&nbsp; โทร. {toThaiDigits(wardPhone ?? '-')}</div>
          <div><b>ที่</b>&nbsp; นม ๐๐๓๓.๑๐๑.๓/.........&nbsp;&nbsp;&nbsp;<b>วันที่</b> .................</div>
          <div><b>เรื่อง</b>&nbsp; ขออนุมัติเบิกเงินค่าจ้างลูกจ้างชั่วคราว (รายวัน)</div>
          <div><b>เรียน</b>&nbsp; ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
        </div>
        <p style={{ textIndent: '2.5em', marginTop: 12, fontSize: 15 }}>
          ตามคำสั่งโรงพยาบาลมหาราชนครราชสีมา เรื่อง การจ้างลูกจ้างชั่วคราวเงินบำรุง (รายวัน) นั้น
        </p>
        <p style={{ textIndent: '2.5em', fontSize: 15 }}>
          ในการนี้ {wardName} จึงขออนุมัติเบิกเงินค่าจ้างลูกจ้างชั่วคราว (รายวัน) ประจำเดือน {monthName} {toThaiDigits(year)} จำนวน {toThaiDigits(daily.length)} ราย ดังนี้
        </p>
        <table style={{ width: '80%', margin: '0 auto', fontSize: 14 }}>
          <tbody>
            {daily.map((e, i) => (
              <tr key={e.id}><td style={{ border: 'none' }}>{toThaiDigits(i + 1)}. {e.prefix}{e.firstName} {e.lastName ?? ''}</td><td style={{ border: 'none', textAlign: 'right' }}>{toThaiDigits(wageOf(e).toLocaleString('th-TH'))} บาท</td></tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 15, marginTop: 8 }}>รวมเป็นเงินทั้งสิ้น {toThaiDigits(total.toLocaleString('th-TH'))} บาท ({thaiBahtText(total)}) จากเงินบำรุงโรงพยาบาลมหาราชนครราชสีมา</p>
        <div style={{ textAlign: 'center', marginTop: 34, fontSize: 15 }}>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
          <div>{controller?.title ?? ''}</div>
        </div>
      </div>

      {/* 2) receipt voucher */}
      <div className="gov-form" style={paper}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, marginBottom: 10 }}>ใบสำคัญรับเงิน</div>
        <div style={{ fontSize: 14, textAlign: 'right' }}>วันที่ ..............................</div>
        <p style={{ fontSize: 15 }}>ข้าพเจ้า ................................................... ได้รับเงินค่าจ้างลูกจ้างชั่วคราว (รายวัน) ประจำเดือน {monthName} {toThaiDigits(year)}</p>
        <table style={{ fontSize: 13 }}>
          <thead><tr><th style={{ width: 30 }}>ที่</th><th>ชื่อ - นามสกุล</th><th style={{ width: 60 }}>วันทำงาน</th><th style={{ width: 90 }}>จำนวนเงิน</th><th style={{ width: 120 }}>ลายมือชื่อ</th></tr></thead>
          <tbody>
            {daily.map((e, i) => (
              <tr key={e.id}><td style={{ textAlign: 'center' }}>{toThaiDigits(i + 1)}</td><td>{e.prefix}{e.firstName} {e.lastName ?? ''}</td><td style={{ textAlign: 'center' }}>{toThaiDigits(workedDays(e.id))}</td><td style={{ textAlign: 'right' }}>{toThaiDigits(wageOf(e).toLocaleString('th-TH'))}</td><td /></tr>
            ))}
            <tr style={{ fontWeight: 700 }}><td colSpan={3} style={{ textAlign: 'right' }}>รวม</td><td style={{ textAlign: 'right' }}>{toThaiDigits(total.toLocaleString('th-TH'))}</td><td /></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 13, marginTop: 6 }}>({thaiBahtText(total)})</div>
      </div>

      {/* 3) timesheet — shows working days from the roster (fits A4 portrait, 31 days) */}
      <div className="gov-form print-fit" style={{ ...paper }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18 }}>ใบลงเวลาปฏิบัติงาน (รายวัน)</div>
        <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 8 }}>{wardName} ประจำเดือน {monthName} {toThaiDigits(year)}</div>
        <table style={{ fontSize: 10 }}>
          <thead>
            <tr><th style={{ minWidth: 110 }}>ชื่อ - นามสกุล</th>
              {days.map((d) => { const wd = new Date(ceYear, month - 1, d).getDay(); return <th key={d} style={{ width: 14, background: wd === 0 || wd === 6 ? '#eee' : undefined }}>{toThaiDigits(d)}</th>; })}
              <th style={{ width: 32 }}>รวม</th></tr>
          </thead>
          <tbody>
            {daily.map((e) => (
              <tr key={e.id}>
                <td style={{ fontSize: 11 }}>{e.prefix}{e.firstName} {e.lastName ?? ''}</td>
                {days.map((d) => { const c = cells[cellKey(e.id, d)]?.normalCode; const work = !!c && c !== 'ออฟ'; return <td key={d} style={{ textAlign: 'center', fontSize: 9, background: work ? '#dbeafe' : undefined, fontWeight: work ? 700 : undefined }}>{work ? (c === 'ช' || c === 'บ' || c === 'ด' ? c : '✓') : ''}</td>; })}
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{toThaiDigits(workedDays(e.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 30, fontSize: 13, textAlign: 'center' }}>
          <div><div>(ลงชื่อ) ..............................</div><div>ผู้ควบคุม</div></div>
          <div><div>(ลงชื่อ) ..............................</div><div>ผู้รับรอง</div></div>
        </div>
      </div>

      {/* 4) สรุปรายชื่อแนบบันทึก (form2-2) */}
      <div className="gov-form" style={{ ...paper, pageBreakBefore: 'always' }}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>รายชื่อแนบเบิกค่าจ้างลูกจ้างชั่วคราว (รายวัน) {wardName}</div>
        <table style={{ fontSize: 13 }}>
          <thead><tr><th style={{ width: 40 }}>ลำดับ</th><th>ชื่อ - สกุล</th><th>ตำแหน่ง</th><th style={{ width: 100 }}>จำนวนเงิน</th></tr></thead>
          <tbody>
            {daily.map((e, i) => (
              <tr key={e.id}><td style={{ textAlign: 'center' }}>{toThaiDigits(i + 1)}</td><td>{e.prefix}{e.firstName} {e.lastName ?? ''}</td><td style={{ fontSize: 11 }}>{e.positionText ?? ''}</td><td style={{ textAlign: 'right' }}>{toThaiDigits(wageOf(e).toLocaleString('th-TH'))}</td></tr>
            ))}
            <tr style={{ fontWeight: 700 }}><td colSpan={3} style={{ textAlign: 'right' }}>รวมเป็นเงินทั้งสิ้น</td><td style={{ textAlign: 'right' }}>{toThaiDigits(total.toLocaleString('th-TH'))}</td></tr>
          </tbody>
        </table>
        <div style={{ fontSize: 13, marginTop: 6 }}>จำนวนเงิน (ตัวอักษร) : {thaiBahtText(total)}</div>
        <div style={{ fontSize: 13 }}>ประจำเดือน {monthName} {toThaiDigits(year)} จำนวน {toThaiDigits(daily.length)} ราย</div>
        <div style={{ textAlign: 'center', marginTop: 30, fontSize: 14 }}>
          <div>(ลงชื่อ) ...............................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
          <div>{controller?.title ?? 'หัวหน้ากลุ่มงาน'}</div>
        </div>
      </div>
    </div>
  );
}
