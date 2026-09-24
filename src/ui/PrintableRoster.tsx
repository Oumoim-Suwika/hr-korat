import React from 'react';
import type { Employee, RosterSigner } from '../api/client';
import { THAI_MONTHS, THAI_DAYS_SHORT } from '../data';
import { toThaiDigits } from '../lib/thai';

interface CellMap { [k: string]: { normalCode?: string | null; otCode?: string | null }; }
const key = (empId: number, day: number) => `${empId}-${day}`;

/**
 * Government "ตารางปฏิบัติงาน / หลักฐานการจ่ายเงิน" form for Maharat Korat.
 * Two rows per person: top = OT codes (BD/ชot...), bottom = normal (ช/ออฟ).
 * Rendered hidden on screen; shown only when printing (see .print-sheet CSS).
 * Print via window.print() -> "Save as PDF".
 */
export default function PrintableRoster({
  wardName, month, year, ceYear, days, employees, cells, signers, note,
}: {
  wardName: string; month: number; year: number; ceYear: number; days: number[];
  employees: Employee[]; cells: CellMap; signers: RosterSigner[]; note?: string | null;
}) {
  const controller = signers.find((s) => s.signerRole === 'controller');
  const approver = signers.find((s) => s.signerRole === 'approver');

  return (
    <div className="gov-form print-landscape" style={{ fontSize: 11, padding: '4mm' }}>
      {/* Header with ตราครุฑ */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <img src="/kruth.png" alt="ตราครุฑ" style={{ height: 46, margin: '0 auto 2px' }} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          ตารางปฏิบัติงาน ประจำเดือน {THAI_MONTHS[month - 1]} {toThaiDigits(year)}
        </div>
        <div style={{ fontSize: 13 }}>{wardName} โรงพยาบาลมหาราชนครราชสีมา</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 22 }}>ที่</th>
            <th style={{ minWidth: 120 }}>ชื่อ - นามสกุล</th>
            <th style={{ minWidth: 90 }}>ตำแหน่ง</th>
            {days.map((d) => {
              const wd = new Date(ceYear, month - 1, d).getDay();
              return (
                <th key={d} style={{ width: 15, textAlign: 'center', background: wd === 0 || wd === 6 ? '#eee' : undefined }}>
                  <div>{toThaiDigits(d)}</div><div style={{ fontSize: 8 }}>{THAI_DAYS_SHORT[wd]}</div>
                </th>
              );
            })}
            <th style={{ minWidth: 40 }}>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => (
            <React.Fragment key={emp.id}>
              {/* OT row (top) */}
              <tr>
                <td rowSpan={2} style={{ textAlign: 'center' }}>{i + 1}</td>
                <td rowSpan={2}>{emp.prefix}{emp.firstName} {emp.lastName ?? ''}</td>
                <td rowSpan={2} style={{ fontSize: 9 }}>{emp.positionText ?? ''}</td>
                {days.map((d) => {
                  const c = cells[key(emp.id, d)];
                  return <td key={d} style={{ textAlign: 'center', height: 13, fontSize: 8, fontWeight: 700 }}>{c?.otCode ?? ''}</td>;
                })}
                <td rowSpan={2} />
              </tr>
              {/* normal row (bottom) */}
              <tr>
                {days.map((d) => {
                  const c = cells[key(emp.id, d)];
                  return <td key={d} style={{ textAlign: 'center', height: 13, fontSize: 9 }}>{c?.normalCode ?? ''}</td>;
                })}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{ marginTop: 4, fontSize: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span><b>ช</b> = ปฏิบัติงานวันทำการในเวลาราชการ 08.30-16.30 น.</span>
        <span><b>BD</b> = ปฏิบัติงานนอกเวลาราชการ (บ่ายดึก) 16.30-20.30 น.</span>
        <span><b>ชot</b> = ปฏิบัติงานวันหยุดราชการ 08.30-16.30 น.</span>
        <span><b>ออฟ</b> = วันหยุด</span>
      </div>
      {note && <div style={{ marginTop: 2, fontSize: 10 }}>หมายเหตุ : {note}</div>}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 26, fontSize: 11, textAlign: 'center' }}>
        <div>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {controller?.name ?? '.........................................'} )</div>
        </div>
        <div>
          <div>(ลงชื่อ) ..................................................</div>
          <div>( {approver?.name ?? '.........................................'} )</div>
        </div>
      </div>
    </div>
  );
}
