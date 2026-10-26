import React from 'react';
import type { Employee } from '../api/client';
import { THAI_MONTHS } from '../data';
import { toThaiDigits } from '../lib/thai';
import { thaiBahtText } from '../lib/thaiBaht';
import type { PayslipBreakdown } from '../lib/thaiTax';

/**
 * สลิปเงินเดือนรายบุคคล พร้อมรายการหักภาษี ณ ที่จ่าย และประกันสังคม
 * (requirement 11.1 — ตกลงเพิ่มในที่ประชุมกับโรงพยาบาล 24/9).
 *
 * จัดรูปแบบเป็นเอกสารราชการ (ตราครุฑ, เลขไทย) ให้เข้าชุดกับฟอร์มตั้งเบิกอื่น
 * พิมพ์ผ่าน window.print() -> บันทึกเป็น PDF.
 */

const fmt = (n: number): string =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** จำนวนเงินเป็นเลขไทยตามแบบเอกสารราชการ */
const bahtTH = (n: number): string => toThaiDigits(fmt(n));

export default function Payslip({ employee, wardName, month, year, slip, compact = false }: {
  employee: Employee;
  wardName: string;
  month: number;
  year: number;
  slip: PayslipBreakdown;
  /** compact = พิมพ์หลายคนต่อหน้า (ไม่ขึ้นหน้าใหม่, ขอบกระดาษแคบลง) */
  compact?: boolean;
}) {
  const fullName = `${employee.prefix ?? ''}${employee.firstName} ${employee.lastName ?? ''}`.trim();
  const monthLabel = `${THAI_MONTHS[month - 1]} ${toThaiDigits(year)}`;
  const paper: React.CSSProperties = {
    background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
    padding: compact ? '8mm' : '14mm', maxWidth: '190mm', margin: '0 auto', lineHeight: 1.5,
  };

  const Row = ({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) => (
    <tr>
      <td style={{ padding: '2px 6px', paddingLeft: indent ? 24 : 6, fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: '2px 6px', textAlign: 'right', fontWeight: bold ? 700 : 400, whiteSpace: 'nowrap' }}>{value}</td>
    </tr>
  );

  return (
    <div className="gov-form" style={paper}>
      {/* หัวเอกสาร */}
      <div style={{ position: 'relative', minHeight: 50, marginBottom: 4 }}>
        <img src="/kruth.png" alt="ตราครุฑ" style={{ height: 46, position: 'absolute', left: 0, top: 0 }} />
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 20, paddingTop: 8 }}>สลิปเงินเดือน</div>
        <div style={{ textAlign: 'center', fontSize: 13 }}>โรงพยาบาลมหาราชนครราชสีมา</div>
      </div>

      {/* ข้อมูลผู้รับเงิน */}
      <table style={{ marginBottom: 8, fontSize: 14 }}>
        <tbody>
          <tr>
            <td style={{ padding: '2px 6px', width: '18%' }}><b>ชื่อ-นามสกุล</b></td>
            <td style={{ padding: '2px 6px' }}>{fullName}</td>
            <td style={{ padding: '2px 6px', width: '14%' }}><b>งวดเดือน</b></td>
            <td style={{ padding: '2px 6px', width: '22%' }}>{monthLabel}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 6px' }}><b>ตำแหน่ง</b></td>
            <td style={{ padding: '2px 6px' }}>{employee.positionText ?? '-'}</td>
            <td style={{ padding: '2px 6px' }}><b>กลุ่มงาน</b></td>
            <td style={{ padding: '2px 6px' }}>{wardName}</td>
          </tr>
          <tr>
            <td style={{ padding: '2px 6px' }}><b>ประเภทการจ้าง</b></td>
            <td style={{ padding: '2px 6px' }}>{employee.employeeType ?? employee.paymentType}</td>
            <td style={{ padding: '2px 6px' }}><b>รหัสพนักงาน</b></td>
            <td style={{ padding: '2px 6px' }}>{employee.employeeCode ? toThaiDigits(employee.employeeCode) : '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* รายได้ / รายการหัก */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <table style={{ fontSize: 14, flex: 1 }}>
          <thead>
            <tr><th colSpan={2} style={{ padding: '3px 6px', background: '#f1f5f9' }}>รายได้</th></tr>
          </thead>
          <tbody>
            <Row label="เงินเดือน / ค่าจ้าง" value={bahtTH(slip.base)} />
            <Row label="ค่าตอบแทนนอกเวลาราชการ (OT)" value={bahtTH(slip.ot)} />
            <Row label="รวมรายได้" value={bahtTH(slip.gross)} bold />
          </tbody>
        </table>

        <table style={{ fontSize: 14, flex: 1 }}>
          <thead>
            <tr><th colSpan={2} style={{ padding: '3px 6px', background: '#f1f5f9' }}>รายการหัก</th></tr>
          </thead>
          <tbody>
            <Row
              label={slip.detail.ssoApplied ? 'เงินสมทบประกันสังคม' : 'ประกันสังคม (ไม่อยู่ในระบบ)'}
              value={bahtTH(slip.sso)}
            />
            <Row label="ภาษีเงินได้หัก ณ ที่จ่าย" value={bahtTH(slip.tax)} />
            <Row label="รวมรายการหัก" value={bahtTH(slip.totalDeductions)} bold />
          </tbody>
        </table>
      </div>

      {/* ยอดรับสุทธิ */}
      <table style={{ fontSize: 15, marginTop: 8 }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 6px', fontWeight: 700, width: '30%' }}>ยอดรับสุทธิ</td>
            <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, width: '20%' }}>{bahtTH(slip.net)}</td>
            <td style={{ padding: '4px 6px' }}>({thaiBahtText(slip.net)})</td>
          </tr>
        </tbody>
      </table>

      {/* ที่มาของภาษี — ให้ตรวจสอบย้อนกลับได้ */}
      <div style={{ fontSize: 10, marginTop: 6, lineHeight: 1.45 }}>
        <b>วิธีคำนวณภาษีหัก ณ ที่จ่าย</b> (ประมาณการตามมาตรา ๕๐(๑) ประมวลรัษฎากร)
        : เงินได้ประมาณทั้งปี {bahtTH(slip.detail.annualGross)}
        {' '}− ค่าใช้จ่าย {bahtTH(slip.detail.expenseDeduction)}
        {' '}− ลดหย่อนส่วนตัว {bahtTH(slip.detail.personalAllowance)}
        {slip.detail.annualSso > 0 ? ` − ประกันสังคมทั้งปี ${bahtTH(slip.detail.annualSso)}` : ''}
        {' '}= เงินได้สุทธิ {bahtTH(slip.detail.annualNetIncome)}
        {' '}→ ภาษีทั้งปี {bahtTH(slip.detail.annualTax)} เฉลี่ยเป็นรายเดือน {bahtTH(slip.tax)}
        <div style={{ marginTop: 2 }}>
          หมายเหตุ : ยังไม่รวมค่าลดหย่อนอื่น (คู่สมรส / บุตร / เบี้ยประกัน / กองทุน ฯลฯ)
          จึงเป็นการประมาณการเพื่อหัก ณ ที่จ่าย ไม่ใช่ภาระภาษีสุดท้าย
        </div>
      </div>

      {/* ช่องลงชื่อ — ตาม requirement ข้อ 7.2 ให้เหลือเฉพาะ "(ลงชื่อ)" และวงเล็บเปล่า */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: compact ? 16 : 30, fontSize: 14, textAlign: 'center' }}>
        <div><div>(ลงชื่อ) ....................................</div><div>( ........................... )</div></div>
        <div><div>(ลงชื่อ) ....................................</div><div>( ........................... )</div></div>
      </div>
    </div>
  );
}
