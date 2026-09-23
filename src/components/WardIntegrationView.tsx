import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Clipboard, CheckCircle2, AlertCircle, 
  History, Eye, UserPlus, Calendar, Check, ArrowRight, ShieldCheck, Info
} from 'lucide-react';
import { Personnel, Ward, ChangeLog } from '../types';
import { SHIFT_TYPES, normalizeShiftCode } from '../data';

/** Parse a single CSV line honoring double-quoted fields (which may contain commas). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

interface WardIntegrationViewProps {
  activeWard: Ward;
  wards: Ward[];
  onChangeWard: (wardId: string) => void;
  personnel: Personnel[];
  onImportPersonnel: (newStaff: Omit<Personnel, 'id' | 'order'>[]) => void;
  schedule: Record<string, string>;
  approvedSchedule: Record<string, string>;
  onImportSchedule: (imported: Record<string, string>) => void;
  onApproveSchedule: () => void;
  onSubmitActualSchedule: () => void;
  approvalStatus: 'draft' | 'pending_approval' | 'approved';
  changeLogs: ChangeLog[];
  onClearLogs: () => void;
  daysCount: number;
}

export default function WardIntegrationView({
  activeWard,
  wards,
  onChangeWard,
  personnel,
  onImportPersonnel,
  schedule,
  approvedSchedule,
  onImportSchedule,
  onApproveSchedule,
  onSubmitActualSchedule,
  approvalStatus,
  changeLogs,
  onClearLogs,
  daysCount
}: WardIntegrationViewProps) {
  const [subTab, setSubTab] = useState<'workflow' | 'import_staff' | 'import_schedule' | 'logs'>('workflow');
  
  // Import Personnel States
  const [personnelPasteText, setPersonnelPasteText] = useState('');
  const [personnelImportMessage, setPersonnelImportMessage] = useState<string | null>(null);
  const personnelFileInputRef = useRef<HTMLInputElement>(null);

  // Import Schedule States
  const [schedulePasteText, setSchedulePasteText] = useState('');
  const [scheduleImportMessage, setScheduleImportMessage] = useState<string | null>(null);
  const scheduleFileInputRef = useRef<HTMLInputElement>(null);

  // Parse Personnel CSV Text
  const parsePersonnelCSV = (text: string) => {
    try {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return;

      const parsed: Omit<Personnel, 'id' | 'order'>[] = [];
      let startIdx = 0;

      // Check if first line contains header labels
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('name') || firstLine.includes('ชื่อ') || firstLine.includes('role') || firstLine.includes('บทบาท')) {
        startIdx = 1; // skip header
      }

      for (let i = startIdx; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]);
        if (parts.length < 3) continue;

        const name = parts[0];
        let roleInput = parts[1].toLowerCase();
        const position = parts[2];
        const active = parts[3] ? parts[3].toLowerCase() !== 'false' : true;

        // Map role string
        let role: 'doctor' | 'nurse' | 'assistant' | 'room' = 'nurse';
        if (roleInput.includes('doc') || roleInput.includes('แพทย์')) role = 'doctor';
        else if (roleInput.includes('nurse') || roleInput.includes('พยาบาล')) role = 'nurse';
        else if (roleInput.includes('assist') || roleInput.includes('ผู้ช่วย')) role = 'assistant';
        else if (roleInput.includes('room') || roleInput.includes('ห้อง') || roleInput.includes('or')) role = 'room';

        // Optional category columns: [4]=ประเภทการจ้าง [5]=รูปแบบจ่าย [6]=อัตราจ้าง [7]=สายงาน
        const empRaw = (parts[4] || '').trim();
        const payRaw = (parts[5] || '').trim();
        const wageRaw = (parts[6] || '').replace(/[,฿\s]/g, '');
        const lineRaw = (parts[7] || '').trim();

        let paymentType: 'รายเดือน' | 'รายวัน' | 'รายคาบ' | undefined;
        if (payRaw.includes('วัน')) paymentType = 'รายวัน';
        else if (payRaw.includes('คาบ')) paymentType = 'รายคาบ';
        else if (payRaw.includes('เดือน')) paymentType = 'รายเดือน';

        let line: 'แพทย์' | 'พยาบาล' | 'สนับสนุน' | undefined;
        if (lineRaw.includes('แพทย์')) line = 'แพทย์';
        else if (lineRaw.includes('พยาบาล')) line = 'พยาบาล';
        else if (lineRaw.includes('สนับสนุน') || lineRaw.includes('support')) line = 'สนับสนุน';

        const employeeType = empRaw || undefined;
        const baseWage = wageRaw ? Math.max(0, parseInt(wageRaw, 10) || 0) : undefined;

        parsed.push({
          name,
          role,
          position,
          active,
          ...(employeeType ? { employeeType: employeeType as any } : {}),
          ...(paymentType ? { paymentType } : {}),
          ...(baseWage !== undefined ? { baseWage } : {}),
          ...(line ? { line } : {}),
        });
      }

      if (parsed.length > 0) {
        onImportPersonnel(parsed);
        setPersonnelImportMessage(`นำเข้าข้อมูลบุคลากรจำนวน ${parsed.length} รายการเสร็จสมบูรณ์เรียบร้อย!`);
        setPersonnelPasteText('');
      } else {
        setPersonnelImportMessage('ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบฟอร์แมต CSV');
      }
    } catch (e) {
      setPersonnelImportMessage('เกิดข้อผิดพลาดในการนำเข้าไฟล์ กรุณาตรวจสอบข้อมูล');
    }
  };

  // Parse Schedule CSV Text
  const parseScheduleCSV = (text: string) => {
    try {
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return;

      const importedSchedule: Record<string, string> = {};
      let successCount = 0;

      const validCodes = new Set(SHIFT_TYPES.map(s => s.code));

      // Format: <ID or Name>, Day1, Day2, ... DayN
      // The identifier may sit in any of the first columns (hospital exports pad
      // extra columns), and day codes may include OT variants (ชot/บot/ดot/BD)
      // or Thai "ออฟ". A quoted-CSV parser + code normalizer handles both.
      lines.forEach(line => {
        const parts = parseCsvLine(line);
        if (parts.length < 2) return;

        // Find which leading column matches a known person, and where day cells start.
        let matchedStaff: Personnel | undefined;
        let dayOffset = 1;
        for (let c = 0; c < Math.min(4, parts.length); c++) {
          const token = parts[c];
          if (!token) continue;
          const found = personnel.find(p => p.id === token || p.name === token);
          if (found) {
            matchedStaff = found;
            dayOffset = c + 1;
            break;
          }
        }
        if (!matchedStaff) return;

        for (let d = 1; d <= daysCount; d++) {
          const raw = parts[dayOffset + d - 1];
          const code = normalizeShiftCode(raw ?? '');
          if (code && validCodes.has(code)) {
            importedSchedule[`${matchedStaff.id}-${d}`] = code;
            successCount++;
          }
        }
      });

      if (successCount > 0) {
        onImportSchedule(importedSchedule);
        setScheduleImportMessage(`นำเข้ากะทำงานของเจ้าหน้าที่ รวมทั้งสิ้น ${successCount} รายการเข้าสู่ตารางสำเร็จ!`);
        setSchedulePasteText('');
      } else {
        setScheduleImportMessage('ไม่พบรหัสเจ้าหน้าที่หรือข้อมูลตารางเวรที่ตรงกัน กรุณาตรวจสอบ ID/ชื่อ');
      }
    } catch (e) {
      setScheduleImportMessage('เกิดข้อผิดพลาดในการประมวลผลตารางเวร');
    }
  };

  // File Readers
  const handlePersonnelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parsePersonnelCSV(text);
    };
    reader.readAsText(file);
  };

  const handleScheduleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      parseScheduleCSV(text);
    };
    reader.readAsText(file);
  };

  // Compare Approved Schedule vs Actual Current Schedule
  const getScheduleMismatches = () => {
    const mismatches: {
      staffId: string;
      staffName: string;
      position: string;
      day: number;
      approved: string | null;
      actual: string | null;
    }[] = [];

    if (!approvedSchedule || Object.keys(approvedSchedule).length === 0) {
      return [];
    }

    personnel.forEach(staff => {
      for (let day = 1; day <= daysCount; day++) {
        const cellKey = `${staff.id}-${day}`;
        const appShift = approvedSchedule[cellKey] || null;
        const actShift = schedule[cellKey] || null;

        if (appShift !== actShift) {
          mismatches.push({
            staffId: staff.id,
            staffName: staff.name,
            position: staff.position,
            day,
            approved: appShift,
            actual: actShift
          });
        }
      }
    });

    return mismatches;
  };

  const mismatches = getScheduleMismatches();
  const hasMismatches = mismatches.length > 0;

  return (
    <div className="space-y-6">
      {/* Ward Selector and Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <span className="text-[10px] text-sati-azure font-extrabold uppercase tracking-widest block">ระบบจัดการข้อมูลความร่วมมือระหว่างวอร์ด (Inter-Ward Workspace)</span>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-slate-800">กลุ่มงาน/อาคารปฏิบัติการ:</h2>
            <select
              value={activeWard.id}
              onChange={(e) => onChangeWard(e.target.value)}
              className="bg-sati-azure/5 border border-sati-azure/20 text-sati-space text-xs font-black py-1 px-3 rounded hover:bg-sati-azure/10 transition-colors focus:outline-none cursor-pointer"
            >
              {wards.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.building})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubTab('workflow')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              subTab === 'workflow'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            📋 นำส่งอนุมัติ & ตรวจไม่ตรง
          </button>
          <button
            onClick={() => setSubTab('import_staff')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              subTab === 'import_staff'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            👥 นำเข้ารายชื่อ (Excel)
          </button>
          <button
            onClick={() => setSubTab('import_schedule')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              subTab === 'import_schedule'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            📅 นำเข้าตารางเวร
          </button>
          <button
            onClick={() => setSubTab('logs')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              subTab === 'logs'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🔎 Log เปลี่ยนแปลง ({changeLogs.length})
          </button>
        </div>
      </div>

      {/* Main SubTab Contents */}
      {subTab === 'workflow' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Submittals Control Panel */}
          <div className="lg:col-span-4 bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-sati-azure" />
                <span>ขั้นตอนการส่งอนุมัติเวร (Ward Workflow)</span>
              </h3>
            </div>

            {/* Current Ward Status Card */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500">สถานะปัจจุบันของวอร์ด:</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                  approvalStatus === 'approved' 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : approvalStatus === 'pending_approval'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                }`}>
                  {approvalStatus === 'approved' ? 'อนุมัติเรียบร้อย' : approvalStatus === 'pending_approval' ? 'ส่งขออนุมัติแล้ว' : 'แบบร่าง (Draft)'}
                </span>
              </div>

              <div className="text-[10px] text-slate-400 space-y-1">
                <p>• <b>ร่างเวร:</b> จัดและปรับปรุงกะทำงานได้อิสระ</p>
                <p>• <b>ส่งอนุมัติ:</b> ตรึงร่างไว้เป็นฐานข้อมูลเปรียบเทียบมาตรฐาน</p>
                <p>• <b>เวรจริง:</b> เมื่อจัดเสร็จ สั่งล็อคตารางเพื่อป้องกันผู้จัดอื่นๆ เขียนทับ</p>
              </div>
            </div>

            {/* Workflow Buttons */}
            <div className="space-y-2.5">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold block">ขั้นตอนที่ 1: ตรึงร่างขอส่งอนุมัติ</span>
                <button
                  onClick={onApproveSchedule}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sati-azure text-white hover:bg-sati-azure/90 font-extrabold rounded text-xs shadow-xs transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>ขอส่งอนุมัติเวร (Snapshot Standard)</span>
                </button>
              </div>

              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-slate-500 font-bold block">ขั้นตอนที่ 2: ล็อคนำส่งเวรจริงปฏิบัติงาน</span>
                <button
                  onClick={onSubmitActualSchedule}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-extrabold rounded text-xs shadow-xs transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>นำส่งเวรจริง (Final Submit & Lock)</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-150/80 flex gap-2">
              <Info className="w-3.5 h-3.5 text-sati-azure flex-shrink-0 mt-0.5" />
              <div className="text-[9px] text-slate-500 leading-normal">
                <b>ข้อมูลติดต่อวอร์ด:</b> เบอร์ภายใน {activeWard.phone} อาคาร {activeWard.building}. สำหรับช่วยเหลือการย้ายเวรกรุณาติดต่อส่วนประสานงานกลาง
              </div>
            </div>
          </div>

          {/* Mismatch warnings list */}
          <div className="lg:col-span-8 bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>ตรวจสอบความขัดแย้งกับเวรที่ได้รับการอนุมัติ (Mismatch Audit Panel)</span>
              </h3>
              
              <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                hasMismatches ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {hasMismatches ? `ตรวจพบจุดไม่ตรงกัน ${mismatches.length} จุด` : 'ข้อมูลตรงตามอนุมัติ 100%'}
              </span>
            </div>

            {hasMismatches ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-950 text-xs rounded-lg flex gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block">คำเตือน: ตารางเวรจริงปัจจุบันมีจุดที่ได้รับการปรับแก้ไม่ตรงตามที่ขอส่งอนุมัติไว้!</span>
                    <span className="text-[11px] text-rose-800 leading-normal block mt-1">
                      เพื่อการจ่ายค่าจ้างและ OT ที่ถูกต้อง กรุณาตรวจสอบหรือขอส่งอนุมัติเวรฉบับปรับปรุงเพิ่มเติม หากการเปลี่ยนแปลงนี้เกิดจากการย้ายสลับกะกระทันหัน
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-150 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="py-2 px-3 text-center w-12">วันที่</th>
                        <th className="py-2 px-3">รายชื่อบุคลากร</th>
                        <th className="py-2 px-2">ตำแหน่ง</th>
                        <th className="py-2 px-3 text-center w-28">เวรขออนุมัติเดิม</th>
                        <th className="py-2 px-3 text-center w-28">เวรจริงปัจจุบัน</th>
                        <th className="py-2 px-2 text-center w-20">ความต่าง</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mismatches.map((m, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 font-medium">
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">{m.day}</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{m.staffName}</td>
                          <td className="py-2 px-2">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/50">
                              {m.position}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {m.approved ? (
                              <span className="px-2 py-0.5 rounded font-black bg-sati-azure/5 text-sati-azure border border-sati-azure/20">
                                เวร {m.approved}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">ไม่มีเวร (·)</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {m.actual ? (
                              <span className="px-2 py-0.5 rounded font-black bg-rose-50 text-rose-700 border border-rose-100">
                                เวร {m.actual}
                              </span>
                            ) : (
                              <span className="text-rose-500 font-bold">ลบเวร (·)</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                              เปลี่ยนเวร
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <span className="text-xs font-bold block text-slate-700">ไม่มีความเบี่ยงเบนของตารางเวรจริง!</span>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  ตารางเวรจริงทั้งหมดสอดคล้องสมบูรณ์และได้รับการรับรองตามมาตรฐานเวรที่ส่งขออนุมัติ ปลอดภัยต่อการตรวจสอบงบประมาณและค่าตอบแทน
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'import_staff' && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-emerald-500" />
              <span>นำเข้าข้อมูลบุคลากรรายบุคคลและรายกลุ่ม (Import Personnel via Excel/CSV)</span>
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            รองรับการอัพโหลดไฟล์ <b>CSV</b> หรือการคัดลอกจาก <b>Excel</b> แล้ววางข้อมูลลงในช่องพิมพ์ด้านล่าง เพื่อความสะดวกในการกรอกรายชื่อแพทย์/พยาบาล/ผู้ช่วย ครั้งละหลายสิบคน
          </p>

          {personnelImportMessage && (
            <div className="p-3 bg-sati-azure/5 border border-sati-azure/20 text-sati-space font-bold text-xs rounded flex items-center justify-between">
              <span>{personnelImportMessage}</span>
              <button onClick={() => setPersonnelImportMessage(null)} className="text-[10px] text-sati-azure hover:underline">ปิด</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Method: Paste Text */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-extrabold text-slate-700 block">วิธีที่ 1: วางข้อความแบบตาราง (Copy & Paste Text CSV)</span>
              <textarea
                rows={7}
                placeholder="ชื่อ, บทบาท(doctor|nurse|assistant|room), ตำแหน่ง, ทำงาน(true|false), ประเภทการจ้าง, รูปแบบจ่าย(รายเดือน|รายวัน|รายคาบ), อัตราจ้าง, สายงาน(แพทย์|พยาบาล|สนับสนุน)&#10;นพ.กรวิทย์ วังแก้ว,doctor,อายุรแพทย์หัวใจ,true,ข้าราชการ,รายเดือน,,แพทย์&#10;นางสาวการเงิน มหาราช,nurse,จพ.การเงิน,true,ลูกจ้างชั่วคราว (รายวัน),รายวัน,420,สนับสนุน"
                value={personnelPasteText}
                onChange={(e) => setPersonnelPasteText(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded p-2.5 font-mono text-xs focus:ring-1 focus:ring-sati-azure focus:outline-none"
              />
              <button
                onClick={() => parsePersonnelCSV(personnelPasteText)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded text-xs font-bold shadow-xs cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                ประมวลผลข้อความเพื่อนำเข้า
              </button>
            </div>

            {/* Right Method: Upload File */}
            <div className="border border-dashed border-slate-200 hover:border-sati-azure/50 rounded-lg p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3 transition-all">
              <Upload className="w-8 h-8 text-slate-400" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700 block">วิธีที่ 2: อัพโหลดไฟล์ CSV (Excel Export)</span>
                <span className="text-[10px] text-slate-400 block max-w-xs">ลากและวางไฟล์ CSV ของคุณที่นี่ หรือกดปุ่มด้านล่างเพื่อเลือกไฟล์จากคอมพิวเตอร์ของคุณ</span>
              </div>

              <input
                type="file"
                accept=".csv"
                ref={personnelFileInputRef}
                onChange={handlePersonnelFileChange}
                className="hidden"
              />
              <button
                onClick={() => personnelFileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded text-xs font-bold text-sati-azure bg-sati-azure/5 hover:bg-sati-azure/10 border border-sati-azure/20 shadow-2xs cursor-pointer"
              >
                เลือกไฟล์ CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === 'import_schedule' && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-sati-azure" />
              <span>นำเข้าตารางกะการขึ้นเวร (Import Duty Schedule via Excel/CSV)</span>
            </h3>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            คุณสามารถจัดเตรียมไฟล์เวรจาก Excel โดยกำหนดคอลัมน์แรกให้ระบุ <b>รหัสเจ้าหน้าที่ (เช่น DOC001) หรือชื่อเต็ม</b> และคอลัมน์ถัดไปเป็นรหัสกะเวรรายวันเรียงลำดับตั้งแต่วันที่ 1 ถึง {daysCount} — รองรับรหัส <b>ช บ ด</b>, รหัส OT <b className="text-rose-600">ชot บot ดot BD</b>, และ <b>ออฟ</b> (วันหยุด) โดยระบบจะแปลงให้อัตโนมัติ
          </p>

          {scheduleImportMessage && (
            <div className="p-3 bg-sati-azure/5 border border-sati-azure/20 text-sati-space font-bold text-xs rounded flex items-center justify-between">
              <span>{scheduleImportMessage}</span>
              <button onClick={() => setScheduleImportMessage(null)} className="text-[10px] text-sati-azure hover:underline">ปิด</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Method: Paste Text */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-extrabold text-slate-700 block">วิธีที่ 1: วางข้อความแบบแถว (Copy & Paste CSV Rows)</span>
              <textarea
                rows={7}
                placeholder="รหัส/ชื่อแพทย์, วันที่1, วันที่2, วันที่3, วันที่4, วันที่5...&#10;DOC001,ช,บ,ด,O,ช,ช,บ,ด,O&#10;RN001,บ,ด,O,ช,บ,ด,O,ช,บ"
                value={schedulePasteText}
                onChange={(e) => setSchedulePasteText(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded p-2.5 font-mono text-xs focus:ring-1 focus:ring-sati-azure focus:outline-none"
              />
              <button
                onClick={() => parseScheduleCSV(schedulePasteText)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded text-xs font-bold shadow-xs cursor-pointer"
              >
                <Clipboard className="w-3.5 h-3.5" />
                ประมวลผลข้อความเพื่อบันทึกตารางเวร
              </button>
            </div>

            {/* Right Method: Upload File */}
            <div className="border border-dashed border-slate-200 hover:border-sati-azure/50 rounded-lg p-6 bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-3 transition-all">
              <Upload className="w-8 h-8 text-slate-400" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700 block">วิธีที่ 2: อัพโหลดไฟล์ CSV ตารางเวร</span>
                <span className="text-[10px] text-slate-400 block max-w-xs">สนับสนุนไฟล์ตารางเวร .csv ที่แยกแยะข้อมูลด้วยเครื่องหมายจุลภาค (,) มีจำนวนคอลัมน์เทียบเท่าจำนวนวันของเดือน</span>
              </div>

              <input
                type="file"
                accept=".csv"
                ref={scheduleFileInputRef}
                onChange={handleScheduleFileChange}
                className="hidden"
              />
              <button
                onClick={() => scheduleFileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded text-xs font-bold text-sati-azure bg-sati-azure/5 hover:bg-sati-azure/10 border border-sati-azure/20 shadow-2xs cursor-pointer"
              >
                เลือกไฟล์ตารางเวร CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {subTab === 'logs' && (
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-2xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-sati-azure" />
              <span>บันทึกปูมประวัติประวัติการปรับเปลี่ยนเวรย้อนหลัง (Audit Log Change History)</span>
            </h3>

            <button
              onClick={onClearLogs}
              className="text-[10px] text-rose-600 hover:underline font-bold"
            >
              ล้างประวัติ Log ทั้งหมด
            </button>
          </div>

          {changeLogs.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {changeLogs.map(log => (
                <div 
                  key={log.id} 
                  className="p-3 bg-slate-50 border border-slate-200/60 rounded-lg hover:bg-slate-50/80 transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black bg-sati-azure/5 border border-sati-azure/20 text-sati-azure">
                        {log.wardName}
                      </span>
                      <span className="font-bold text-slate-800">
                        {log.personnelName} (วันที่ {log.day})
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {log.timestamp}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <span className="font-semibold text-slate-500">การเปลี่ยนแปลง:</span>
                      <span className="font-bold text-slate-500">{log.oldShift || 'ไม่มี'}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-black text-sati-azure">{log.newShift || 'ลบกะออก'}</span>
                      {log.note && <span className="text-[10px] text-slate-400 italic">({log.note})</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <span className="text-xs font-bold block text-slate-700">ไม่มีประวัติการเปลี่ยนแปลงกะเวร</span>
              <p className="text-[10px] text-slate-400">ระบบตรวจตราความถูกต้องบันทึก log อัตโนมัติเมื่อหัวหน้างานหรือแพทย์เจ้าของไข้สลับเวรกิจกรรม</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
