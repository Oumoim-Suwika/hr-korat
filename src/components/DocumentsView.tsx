import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, FileText, Users, Settings, HelpCircle, Save,
  ChevronDown, CheckCircle2, Info, User, CheckSquare, Square,
  History, Trash2, RotateCcw, FolderOpen
} from 'lucide-react';
import { Personnel, OTSettings, Role, Ward } from '../types';
import { THAI_MONTHS, THAI_DAYS_SHORT, SHIFT_TYPES, REIMBURSEMENT_UNITS, personLine } from '../data';
import { thaiBahtText } from '../lib/thaiBaht';
import { computePersonClaim, otBaseCategory } from '../lib/otCalc';

interface DocumentsViewProps {
  personnel: Personnel[];
  schedule: Record<string, string>;
  otSettings: OTSettings;
  year: number;
  month: number;
  daysCount: number;
  wards?: Ward[];
  wardPersonnel?: Record<string, Personnel[]>;
  wardSchedules?: Record<string, Record<string, string>>;
  activeWardId?: string;
}

type DocTab = 'memo' | 'receipt' | 'volume' | 'schedule' | 'wage';

const STORAGE_KEY_DOCS = 'sati_docs_form_v1';
const STORAGE_KEY_DOCS_HISTORY = 'sati_docs_history_v1';

const DOC_TYPE_LABELS: Record<DocTab, string> = {
  memo: 'บันทึกข้อความ (ขอเบิก OT)',
  receipt: 'หลักฐานการจ่ายเงิน',
  volume: 'ใบแสดงปริมาณงาน',
  schedule: 'ตารางปฏิบัติงาน',
  wage: 'ค่าจ้างลูกจ้างชั่วคราว',
};

/**
 * A4 page setup per document, matching the originals in /toSATI:
 *  - บันทึกข้อความ / ใบแสดงปริมาณงาน / ค่าจ้างลูกจ้าง → A4 portrait
 *  - หลักฐานการจ่ายเงิน / ตารางปฏิบัติงาน → A4 landscape (ตัวอย่าง_ตารางเวร-ตารางเบิก.xlsx)
 * A4 = 210 × 297 mm. Margins follow standard Thai กระดาษราชการ (~1.5–1.8 cm).
 */
const PAGE_SETUP: Record<DocTab, { orientation: 'portrait' | 'landscape'; marginCss: string }> = {
  memo: { orientation: 'portrait', marginCss: '15mm 18mm' },
  receipt: { orientation: 'landscape', marginCss: '10mm' },
  volume: { orientation: 'portrait', marginCss: '15mm 18mm' },
  schedule: { orientation: 'landscape', marginCss: '10mm' },
  wage: { orientation: 'portrait', marginCss: '15mm 18mm' },
};

/** A saved form kept as history, categorized by dept / month / type / unit. */
interface DocHistoryEntry {
  id: string;
  savedAt: string;
  docType: DocTab;
  deptId: string;
  deptName: string;
  line: string;        // หน่วย (สายงาน)
  unitPrefix: string;  // เลขหนังสือ/หน่วยเบิก
  month: number;
  year: number;
  subject: string;
  amount: number;
  form: Record<string, any>;
}

export default function DocumentsView({
  personnel,
  schedule,
  otSettings,
  year,
  month,
  daysCount,
  wards = [],
  wardPersonnel,
  wardSchedules,
  activeWardId = ''
}: DocumentsViewProps) {
  const [activeDoc, setActiveDoc] = useState<DocTab>('memo');
  // Department (กลุ่มงาน/วอร์ด) selection — defaults to the active ward
  const [selectedDept, setSelectedDept] = useState<string>(activeWardId);
  // Wage sub-form: daily vs periodic
  const [wageMode, setWageMode] = useState<'รายวัน' | 'รายคาบ'>('รายวัน');

  // Resolve the department's personnel & schedule (fall back to props for single-ward use)
  const deptPersonnel = (wardPersonnel && wardPersonnel[selectedDept]) || personnel;
  const deptSchedule = (wardSchedules && wardSchedules[selectedDept]) || schedule;
  const selectedWard = wards.find(w => w.id === selectedDept);
  const pageSetup = PAGE_SETUP[activeDoc];
  const isLandscape = pageSetup.orientation === 'landscape';
  
  // Document configurations (Editable fields)
  const [docRefPrefix, setDocRefPrefix] = useState('นม 0033.103/');
  const [docRefNumber, setDocRefNumber] = useState('123');
  const [docPhone, setDocPhone] = useState('32077');
  const [subDepartment, setSubDepartment] = useState('กลุ่มงานการเงิน (U01)');
  
  // Determine standard dates
  const nextMonthNum = month === 12 ? 1 : month + 1;
  const nextYearNum = month === 12 ? year + 1 : year;
  const [docDate, setDocDate] = useState(`9 ${THAI_MONTHS[nextMonthNum - 1]} ${nextYearNum}`);
  
  const [memoSubject, setMemoSubject] = useState('ขออนุมัติเบิกค่าตอบแทนการปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ (จุดเก็บเงิน ER)');
  const [memoHeadName, setMemoHeadName] = useState('นางสาววรรณทิพย์ รีพล');
  const [memoHeadPosition, setMemoHeadPosition] = useState('นักวิชาการเงินและบัญชีชำนาญการพิเศษ');
  const [memoHeadTitle, setMemoHeadTitle] = useState('หัวหน้ากลุ่มงานการเงิน');
  
  const [memoApproverName, setMemoApproverName] = useState('นางนฤมล ศรีสรรพ์');
  const [memoApproverPosition, setMemoApproverPosition] = useState('รองผู้อำนวยการฝ่ายบริหาร');
  const [memoApproverTitle, setMemoApproverTitle] = useState('ปฏิบัติราชการแทน ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา');
  
  const [showApprovalBox, setShowApprovalBox] = useState(true);
  const [showDraftBorder, setShowDraftBorder] = useState(true);

  // Saved-form feedback + guard so the department auto-sync doesn't clobber a loaded form on mount
  const [formSavedMsg, setFormSavedMsg] = useState('');
  const deptSyncInit = useRef(false);

  // Saved-form history (categorized by งาน/เดือน/ประเภท/หน่วย)
  const [history, setHistory] = useState<DocHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [hFilterDept, setHFilterDept] = useState('all');
  const [hFilterMonth, setHFilterMonth] = useState('all');
  const [hFilterType, setHFilterType] = useState('all');
  const [hFilterUnit, setHFilterUnit] = useState('all');

  // Personnel selection for Individual Volume Log
  const activeStaff = deptPersonnel.filter(p => p.active);
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string>(activeStaff[0]?.id || '');
  
  // Custom manual work logs per person per day
  const [manualWorkLogs, setManualWorkLogs] = useState<Record<string, { job: string; volume: string }>>({});

  // Sync selected personnel if list changes
  useEffect(() => {
    if (activeStaff.length > 0 && !activeStaff.some(p => p.id === selectedPersonnelId)) {
      setSelectedPersonnelId(activeStaff[0].id);
    }
  }, [deptPersonnel]);

  // Load a previously saved form (once, on mount) — before dept auto-sync can run
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOCS);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.docRefPrefix !== undefined) setDocRefPrefix(d.docRefPrefix);
      if (d.docRefNumber !== undefined) setDocRefNumber(d.docRefNumber);
      if (d.docPhone !== undefined) setDocPhone(d.docPhone);
      if (d.subDepartment !== undefined) setSubDepartment(d.subDepartment);
      if (d.docDate !== undefined) setDocDate(d.docDate);
      if (d.memoSubject !== undefined) setMemoSubject(d.memoSubject);
      if (d.memoHeadName !== undefined) setMemoHeadName(d.memoHeadName);
      if (d.memoHeadPosition !== undefined) setMemoHeadPosition(d.memoHeadPosition);
      if (d.memoHeadTitle !== undefined) setMemoHeadTitle(d.memoHeadTitle);
      if (d.memoApproverName !== undefined) setMemoApproverName(d.memoApproverName);
      if (d.memoApproverPosition !== undefined) setMemoApproverPosition(d.memoApproverPosition);
      if (d.memoApproverTitle !== undefined) setMemoApproverTitle(d.memoApproverTitle);
      if (typeof d.showApprovalBox === 'boolean') setShowApprovalBox(d.showApprovalBox);
      if (typeof d.showDraftBorder === 'boolean') setShowDraftBorder(d.showDraftBorder);
      if (d.manualWorkLogs) setManualWorkLogs(d.manualWorkLogs);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // Load saved-form history (once, on mount)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOCS_HISTORY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  // When switching department, sync doc header (name + หน่วยเบิก prefix).
  // Skips the very first run so a loaded/saved form is not overwritten on mount.
  useEffect(() => {
    if (!deptSyncInit.current) {
      deptSyncInit.current = true;
      return;
    }
    if (!selectedWard) return;
    setSubDepartment(selectedWard.name);
    setDocPhone(selectedWard.phone || docPhone);
    // Pick reimbursement unit from the dominant line of the department
    const lines = deptPersonnel.map(p => personLine(p));
    const dominant = lines.sort((a, b) =>
      lines.filter(l => l === b).length - lines.filter(l => l === a).length
    )[0] || 'สนับสนุน';
    setDocRefPrefix(REIMBURSEMENT_UNITS[dominant].prefix);
  }, [selectedDept]);

  // Compile calculations for memo and tables via the shared OT engine (matches forms)
  const rows = activeStaff.map(p => {
    const claim = computePersonClaim(p, deptSchedule, otSettings, daysCount);
    return {
      personnel: p,
      stats: { ช: 0, บ: 0, ด: 0, OR: 0, BD: 0 },
      totalShifts: claim.totalWorkShifts,
      totalValue: claim.totalValue,
      otCount: claim.otCount,
      otPayable: claim.otPayable,
      otByCategory: claim.otByCategory,
      otDays: claim.otDays,
      hasExplicitOT: claim.hasExplicitOT,
    };
  }).sort((a, b) => a.personnel.order - b.personnel.order);

  // Grand totals across all selected personnel
  const totalShiftsSum = rows.reduce((acc, r) => acc + r.totalShifts, 0);
  const totalOtCountSum = rows.reduce((acc, r) => acc + r.otCount, 0);
  const totalOtPayableSum = rows.reduce((acc, r) => acc + r.otPayable, 0);
  const bahtTextApproved = thaiBahtText(totalOtPayableSum);

  // Temporary-employee wage rows (รายวัน / รายคาบ) for the wage document
  const wageRows = deptPersonnel
    .filter(p => p.active && (p.paymentType || 'รายเดือน') === wageMode)
    .map(p => {
      const claim = computePersonClaim(p, deptSchedule, otSettings, daysCount);
      return { personnel: p, amount: claim.netEarnings, claim };
    })
    .sort((a, b) => a.personnel.order - b.personnel.order);
  const wageTotal = wageRows.reduce((s, r) => s + r.amount, 0);
  const wageTotalText = thaiBahtText(wageTotal);
  const wageOrderNo = wageMode === 'รายวัน' ? '662/2568' : '558/2567';

  const handlePrint = () => {
    window.print();
  };

  // Snapshot of all editable form fields (for save + history)
  const currentFormSnapshot = () => ({
    docRefPrefix, docRefNumber, docPhone, subDepartment, docDate,
    memoSubject, memoHeadName, memoHeadPosition, memoHeadTitle,
    memoApproverName, memoApproverPosition, memoApproverTitle,
    showApprovalBox, showDraftBorder, manualWorkLogs,
    selectedDept, activeDoc, wageMode, selectedPersonnelId,
  });

  // Dominant reimbursement line (หน่วย) of the current department
  const dominantLine = (() => {
    const lines = deptPersonnel.map(p => personLine(p));
    return lines.sort((a, b) =>
      lines.filter(l => l === b).length - lines.filter(l => l === a).length
    )[0] || 'สนับสนุน';
  })();

  // Persist current form + append a categorized history entry
  const handleSaveForm = () => {
    try {
      const snapshot = currentFormSnapshot();
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(snapshot));

      const subject =
        activeDoc === 'memo' ? memoSubject
        : activeDoc === 'wage' ? `ค่าจ้างลูกจ้างชั่วคราว (${wageMode})`
        : activeDoc === 'volume' ? `ปริมาณงาน: ${selectedPerson?.name || '-'}`
        : DOC_TYPE_LABELS[activeDoc];

      const amount =
        activeDoc === 'wage' ? wageTotal
        : (activeDoc === 'memo' || activeDoc === 'receipt') ? totalOtPayableSum
        : 0;

      const entry: DocHistoryEntry = {
        id: Math.random().toString(36).slice(2, 11),
        savedAt: new Date().toLocaleString('th-TH'),
        docType: activeDoc,
        deptId: selectedDept,
        deptName: subDepartment,
        line: dominantLine,
        unitPrefix: docRefPrefix,
        month,
        year,
        subject,
        amount,
        form: snapshot,
      };

      const updated = [entry, ...history].slice(0, 200); // cap history size
      setHistory(updated);
      localStorage.setItem(STORAGE_KEY_DOCS_HISTORY, JSON.stringify(updated));

      setFormSavedMsg('บันทึกฟอร์มและจัดเก็บเป็นประวัติแล้ว ✓');
    } catch {
      setFormSavedMsg('บันทึกไม่สำเร็จ (พื้นที่จัดเก็บเต็ม)');
    }
    setTimeout(() => setFormSavedMsg(''), 3500);
  };

  // Restore a history entry back into the editor
  const handleLoadHistory = (entry: DocHistoryEntry) => {
    const f = entry.form || {};
    if (f.docRefPrefix !== undefined) setDocRefPrefix(f.docRefPrefix);
    if (f.docRefNumber !== undefined) setDocRefNumber(f.docRefNumber);
    if (f.docPhone !== undefined) setDocPhone(f.docPhone);
    if (f.subDepartment !== undefined) setSubDepartment(f.subDepartment);
    if (f.docDate !== undefined) setDocDate(f.docDate);
    if (f.memoSubject !== undefined) setMemoSubject(f.memoSubject);
    if (f.memoHeadName !== undefined) setMemoHeadName(f.memoHeadName);
    if (f.memoHeadPosition !== undefined) setMemoHeadPosition(f.memoHeadPosition);
    if (f.memoHeadTitle !== undefined) setMemoHeadTitle(f.memoHeadTitle);
    if (f.memoApproverName !== undefined) setMemoApproverName(f.memoApproverName);
    if (f.memoApproverPosition !== undefined) setMemoApproverPosition(f.memoApproverPosition);
    if (f.memoApproverTitle !== undefined) setMemoApproverTitle(f.memoApproverTitle);
    if (typeof f.showApprovalBox === 'boolean') setShowApprovalBox(f.showApprovalBox);
    if (typeof f.showDraftBorder === 'boolean') setShowDraftBorder(f.showDraftBorder);
    if (f.manualWorkLogs) setManualWorkLogs(f.manualWorkLogs);
    if (f.selectedDept !== undefined) setSelectedDept(f.selectedDept);
    if (f.wageMode) setWageMode(f.wageMode);
    if (f.selectedPersonnelId) setSelectedPersonnelId(f.selectedPersonnelId);
    setActiveDoc(entry.docType);
    setShowHistory(false);
    setFormSavedMsg(`โหลดฟอร์มจากประวัติ (${entry.savedAt}) แล้ว — ตรวจสอบเดือน/ปีให้ตรงก่อนพิมพ์`);
    setTimeout(() => setFormSavedMsg(''), 4000);
  };

  const handleDeleteHistory = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem(STORAGE_KEY_DOCS_HISTORY, JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    if (confirm('ต้องการลบประวัติฟอร์มที่บันทึกทั้งหมดหรือไม่?')) {
      setHistory([]);
      localStorage.removeItem(STORAGE_KEY_DOCS_HISTORY);
    }
  };

  // Apply history filters (งาน / เดือน / ประเภท / หน่วย)
  const filteredHistory = history.filter(h =>
    (hFilterDept === 'all' || h.deptId === hFilterDept) &&
    (hFilterMonth === 'all' || h.month === Number(hFilterMonth)) &&
    (hFilterType === 'all' || h.docType === hFilterType) &&
    (hFilterUnit === 'all' || h.line === hFilterUnit)
  );

  const getDayOfWeek = (day: number) => {
    return new Date(year - 543, month - 1, day).getDay();
  };

  const getDayOfWeekText = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[getDayOfWeek(day)];
  };

  // Helper: Get sensible default work log description based on shift type
  const getDefaultWorkLogJob = (shift: string, p: Personnel) => {
    if (p.role === 'doctor') {
      if (shift === 'ช') return 'ตรวจรักษาและประเมินผู้ป่วยนอกเวลาราชการเวรเช้า';
      if (shift === 'บ') return 'เตรียมและตรวจดูแลผู้ป่วยในตึกฉุกเฉินเวรบ่าย';
      if (shift === 'ด') return 'รักษาดูแลผู้ป่วยฉุกเฉินและอุบัติเหตุนอกเวลาราชการเวรดึก';
      if (shift === 'OR') return 'ปฏิบัติหน้าที่แพทย์ผ่าตัดเร่งด่วนทางคลินิก (OR Standby)';
      return 'ปฏิบัติหน้าที่คลินิกนอกเวลา';
    } else if (p.role === 'nurse') {
      if (shift === 'ช') return 'บริการการพยาบาลผู้ป่วยและส่งต่อเคสเวรเช้า';
      if (shift === 'บ') return 'ดูแลจัดทำหัตถการส่งยาและสารน้ำแก่ผู้ป่วยนอกเวลาเวรบ่าย';
      if (shift === 'ด') return 'เฝ้าระวังผู้ป่วยวิกฤตและเตรียมอุปกรณ์ช่วยชีวิตเวรดึก';
      if (shift === 'BD') return 'สนับสนุนพยาบาลคัดกรองและรับชำระค่ารักษาพิเศษนอกเวลา';
      return 'พยาบาลดูแลผู้ป่วยนอกเวลาราชการ';
    } else if (p.role === 'assistant') {
      if (shift === 'ช') return 'ช่วยเหลือผู้ป่วย พลิกตัว เคลื่อนย้าย และจัดระเบียบตึกเวรเช้า';
      if (shift === 'บ') return 'ดูแลทำความสะอาดเตียง พลัดเปลี่ยนผ้าปู และคอยดูแลสุขอนามัยเวรบ่าย';
      if (shift === 'ด') return 'อำนวยความสะดวกเคสฉุกเฉินและสนับสนุนทีมแพทย์พยาบาลเวรดึก';
      return 'ผู้ช่วยพยาบาลดูแลคนไข้นอกเวลา';
    }
    return 'ปฏิบัติงานห้องผ่าตัด/งานสารสนเทศนอกเวลาประจำกะ';
  };

  const selectedPerson = activeStaff.find(p => p.id === selectedPersonnelId);

  // Generate date list of worked OT shifts for selected personnel
  const workedOtDays: number[] = [];
  if (selectedPerson) {
    for (let d = 1; d <= daysCount; d++) {
      const shift = deptSchedule[`${selectedPerson.id}-${d}`];
      if (shift && shift !== 'O' && shift !== 'V' && shift !== 'T') {
        workedOtDays.push(d);
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Per-document A4 page setup for printing (matches the toSATI originals) */}
      <style>{`@media print {
        @page { size: A4 ${pageSetup.orientation}; margin: ${pageSetup.marginCss}; }
        .sati-doc-sheet { width: auto !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; }
      }`}</style>

      {/* Tab Control Bar (Visible on screen only) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs no-print premium-card">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sati-azure/5 text-sati-azure rounded-xl border border-sati-azure/10 shadow-3xs">
            <FileText className="w-5 h-5 text-sati-azure" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 tracking-tight font-display">ระบบฟอร์มตั้งเบิกและเอกสารราชการ (Reimbursement Docs)</h2>
            <p className="text-[11px] text-slate-400 font-medium">สร้างบันทึกข้อความขออนุมัติ, หลักฐานการรับจ่ายเงิน, และปริมาณงานรายวัน พร้อมสั่งพิมพ์มาตรฐานโรงพยาบาลมหาราช</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* History toggle */}
          <button
            onClick={() => setShowHistory(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
              showHistory
                ? 'bg-sati-space text-white border-sati-space'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            ประวัติฟอร์ม ({history.length})
          </button>

          {/* Tab switchers */}
          <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/40">
          <button
            onClick={() => setActiveDoc('memo')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeDoc === 'memo' 
                ? 'bg-white text-sati-azure shadow-xs border border-slate-200/25' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            1. บันทึกข้อความ (Memo)
          </button>
          <button
            onClick={() => setActiveDoc('receipt')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeDoc === 'receipt' 
                ? 'bg-white text-sati-azure shadow-xs border border-slate-200/25' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            2. หลักฐานการจ่ายเงิน
          </button>
          <button
            onClick={() => setActiveDoc('volume')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeDoc === 'volume' 
                ? 'bg-white text-sati-azure shadow-xs border border-slate-200/25' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            3. ใบแสดงปริมาณงาน
          </button>
          <button
            onClick={() => setActiveDoc('schedule')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeDoc === 'schedule'
                ? 'bg-white text-sati-azure shadow-xs border border-slate-200/25'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            4. ตารางปฏิบัติงาน
          </button>
          <button
            onClick={() => setActiveDoc('wage')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeDoc === 'wage'
                ? 'bg-white text-sati-azure shadow-xs border border-slate-200/25'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            5. ค่าจ้างลูกจ้าง
          </button>
          </div>
        </div>
      </div>

      {/* Saved-form History (categorized by งาน / เดือน / ประเภท / หน่วย) */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3 no-print">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-sati-azure" />
              ประวัติฟอร์มที่บันทึก ({filteredHistory.length}/{history.length})
            </h3>
            {history.length > 0 && (
              <button onClick={handleClearHistory} className="text-[10px] text-rose-600 hover:underline font-bold flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> ล้างประวัติทั้งหมด
              </button>
            )}
          </div>

          {/* Filters: แยกตามงาน / เดือน / ประเภท / หน่วย */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">งาน / กลุ่มงาน</label>
              <select value={hFilterDept} onChange={e => setHFilterDept(e.target.value)} className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700">
                <option value="all">ทุกกลุ่มงาน</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">เดือน</label>
              <select value={hFilterMonth} onChange={e => setHFilterMonth(e.target.value)} className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700">
                <option value="all">ทุกเดือน</option>
                {THAI_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">ประเภทเอกสาร</label>
              <select value={hFilterType} onChange={e => setHFilterType(e.target.value)} className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700">
                <option value="all">ทุกประเภท</option>
                {(Object.keys(DOC_TYPE_LABELS) as DocTab[]).map(t => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">หน่วย / สายงาน</label>
              <select value={hFilterUnit} onChange={e => setHFilterUnit(e.target.value)} className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700">
                <option value="all">ทุกหน่วย</option>
                <option value="แพทย์">สายแพทย์</option>
                <option value="พยาบาล">สายการพยาบาล</option>
                <option value="สนับสนุน">สายงานสนับสนุน</option>
              </select>
            </div>
          </div>

          {/* History table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-2 px-2">วันที่บันทึก</th>
                  <th className="py-2 px-2">ประเภท</th>
                  <th className="py-2 px-2">งาน / กลุ่มงาน</th>
                  <th className="py-2 px-2">หน่วย / เลขหนังสือ</th>
                  <th className="py-2 px-2 text-center">เดือน/ปี</th>
                  <th className="py-2 px-2">เรื่อง</th>
                  <th className="py-2 px-2 text-right">ยอดเงิน</th>
                  <th className="py-2 px-2 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length > 0 ? filteredHistory.map(h => (
                  <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-slate-500 text-[9px] whitespace-nowrap">{h.savedAt}</td>
                    <td className="py-2 px-2">
                      <span className="inline-block bg-sati-azure/5 text-sati-azure border border-sati-azure/10 px-1.5 py-0.5 rounded font-bold text-[9px]">
                        {DOC_TYPE_LABELS[h.docType]}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-semibold text-slate-700 max-w-[160px] truncate" title={h.deptName}>{h.deptName}</td>
                    <td className="py-2 px-2 text-slate-600">
                      <div className="font-bold">{h.line}</div>
                      <div className="text-[8px] text-slate-400 font-mono">{h.unitPrefix}</div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-600 whitespace-nowrap">{THAI_MONTHS[h.month - 1]?.slice(0, 3)} {h.year}</td>
                    <td className="py-2 px-2 text-slate-600 max-w-[200px] truncate" title={h.subject}>{h.subject}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">{h.amount > 0 ? `${h.amount.toLocaleString()} ฿` : '-'}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleLoadHistory(h)} title="โหลดฟอร์มนี้กลับมา" className="p-1 rounded text-sati-azure hover:bg-sati-azure/10 cursor-pointer">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteHistory(h.id)} title="ลบรายการนี้" className="p-1 rounded text-rose-500 hover:bg-rose-50 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <FolderOpen className="w-7 h-7 mx-auto mb-1 opacity-40" />
                      <span className="text-[11px]">{history.length === 0 ? 'ยังไม่มีประวัติฟอร์มที่บันทึก — กด "บันทึกฟอร์ม" ในหน้าแก้ไขเพื่อจัดเก็บ' : 'ไม่พบประวัติตามตัวกรองที่เลือก'}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400">
            กด <RotateCcw className="w-3 h-3 inline" /> เพื่อโหลดฟอร์มกลับมาแก้ไข/พิมพ์ · ประวัติถูกจัดเก็บในเครื่องนี้ (localStorage)
          </p>
        </div>
      )}

      {/* Editor & Customizer Layout — left panel hidden during print, document prints */}
      <div className={`grid grid-cols-1 lg:grid-cols-4 gap-6 items-start ${showHistory ? 'hidden' : ''}`}>
        {/* Left Side: Customization Sidebar */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4 no-print">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Settings className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">ปรับแต่งข้อมูลในเอกสาร</h3>
          </div>

          {/* Form field inputs */}
          <div className="space-y-3.5">
            {wards.length > 0 && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">เลือกกลุ่มงาน/วอร์ด (ดึงข้อมูลอัตโนมัติ)</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-sati-azure/30 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-bold text-sati-space"
                >
                  {wards.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-1">เปลี่ยนกลุ่มงานเพื่อดึงบุคลากรและตารางเวรของแผนกนั้นมาออกเอกสารโดยอัตโนมัติ</p>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">กลุ่มงาน/ฝ่าย/ส่วนราชการ (แสดงบนเอกสาร)</label>
              <input 
                type="text" 
                value={subDepartment}
                onChange={(e) => setSubDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ที่เลขหนังสือ</label>
                <input 
                  type="text" 
                  value={docRefPrefix}
                  onChange={(e) => setDocRefPrefix(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">เลขที่ออก</label>
                <input 
                  type="text" 
                  value={docRefNumber}
                  onChange={(e) => setDocRefNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">วันที่ออกหนังสือ</label>
                <input 
                  type="text" 
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">เบอร์ภายในโทร.</label>
                <input 
                  type="text" 
                  value={docPhone}
                  onChange={(e) => setDocPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-mono"
                />
              </div>
            </div>

            {activeDoc === 'memo' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">เรื่องที่ขอเบิก</label>
                  <textarea 
                    value={memoSubject}
                    onChange={(e) => setMemoSubject(e.target.value)}
                    rows={2}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium"
                  />
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="block text-[10px] font-bold text-slate-800 uppercase mb-2">ลงนามผู้เสนอเรื่อง (Control Box)</span>
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="ชื่อ-นามสกุล"
                      value={memoHeadName}
                      onChange={(e) => setMemoHeadName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded font-bold focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    />
                    <input 
                      type="text" 
                      placeholder="ตำแหน่งทางวิชาชีพ"
                      value={memoHeadPosition}
                      onChange={(e) => setMemoHeadPosition(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    />
                    <input 
                      type="text" 
                      placeholder="หัวหน้ากลุ่มงาน..."
                      value={memoHeadTitle}
                      onChange={(e) => setMemoHeadTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="block text-[10px] font-bold text-slate-800 uppercase mb-2">ลงนามรองผู้อำนวยการ (Approver)</span>
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="ชื่อ-นามสกุล"
                      value={memoApproverName}
                      onChange={(e) => setMemoApproverName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded font-bold focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    />
                    <input 
                      type="text" 
                      placeholder="เช่น รองผู้อำนวยการฝ่ายบริหาร"
                      value={memoApproverPosition}
                      onChange={(e) => setMemoApproverPosition(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    />
                    <input 
                      type="text" 
                      placeholder="ปฏิบัติราชการแทน..."
                      value={memoApproverTitle}
                      onChange={(e) => setMemoApproverTitle(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input 
                      type="checkbox" 
                      checked={showApprovalBox} 
                      onChange={(e) => setShowApprovalBox(e.target.checked)}
                      className="rounded border-slate-300 text-sati-azure focus:ring-sati-azure"
                    />
                    แสดงกล่อง "เว้นสำหรับอนุมัติ"
                  </label>
                  <p className="text-[10px] text-slate-400 pl-6 leading-normal">
                    *กล่องคำวินิจฉัยของผู้บริหารที่ต้องลบออกก่อนสั่งพิมพ์ (มีหมายเหตุสีแดงระบุในต้นฉบับจริง)
                  </p>
                </div>
              </>
            )}

            {activeDoc === 'volume' && (
              <>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">เลือกผู้ปฏิบัติงาน</label>
                  <select 
                    value={selectedPersonnelId}
                    onChange={(e) => setSelectedPersonnelId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-bold text-slate-700"
                  >
                    {activeStaff.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                    ))}
                  </select>
                </div>

                {selectedPerson && workedOtDays.length > 0 ? (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="block text-[10px] font-bold text-slate-800 uppercase">แก้ไขลักษณะงานรายวัน ({workedOtDays.length} วัน)</span>
                      <button 
                        onClick={() => {
                          const updated = { ...manualWorkLogs };
                          workedOtDays.forEach(day => {
                            const shift = deptSchedule[`${selectedPerson.id}-${day}`];
                            const defaultJob = getDefaultWorkLogJob(shift, selectedPerson);
                            updated[`${selectedPerson.id}-${day}`] = { job: defaultJob, volume: '1 เวร' };
                          });
                          setManualWorkLogs(updated);
                        }}
                        className="text-[9px] text-sati-azure font-bold hover:underline"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {workedOtDays.map(day => {
                        const shift = deptSchedule[`${selectedPerson.id}-${day}`];
                        const logKey = `${selectedPerson.id}-${day}`;
                        const logVal = manualWorkLogs[logKey] || { 
                          job: getDefaultWorkLogJob(shift, selectedPerson), 
                          volume: '1 เวร' 
                        };

                        return (
                          <div key={day} className="p-2 bg-slate-50 border border-slate-200/50 rounded text-[11px] space-y-1">
                            <div className="flex justify-between font-bold text-slate-700 font-mono text-[10px]">
                              <span>วันที่ {day} (กะ: {shift})</span>
                            </div>
                            <input 
                              type="text"
                              value={logVal.job}
                              onChange={(e) => {
                                setManualWorkLogs({
                                  ...manualWorkLogs,
                                  [logKey]: { ...logVal, job: e.target.value }
                                });
                              }}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px]"
                              placeholder="เช่น ตรวจคนไข้นอกเวลา"
                            />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400">ปริมาณ:</span>
                              <input 
                                type="text"
                                value={logVal.volume}
                                onChange={(e) => {
                                  setManualWorkLogs({
                                    ...manualWorkLogs,
                                    [logKey]: { ...logVal, volume: e.target.value }
                                  });
                                }}
                                className="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-center"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-600 bg-amber-50 p-2 rounded">
                    บุคลากรท่านนี้ไม่มีเวรขึ้นในเดือนที่เลือก
                  </p>
                )}
              </>
            )}

            {activeDoc === 'wage' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ประเภทค่าจ้างลูกจ้างชั่วคราว</label>
                <div className="flex gap-1.5">
                  {(['รายวัน', 'รายคาบ'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setWageMode(m)}
                      className={`flex-1 px-2 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                        wageMode === m ? 'bg-sati-azure text-white border-sati-azure' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5 leading-normal">
                  ระบบดึงเฉพาะลูกจ้างที่ตั้งค่ารูปแบบจ่าย <b>{wageMode}</b> ในกลุ่มงานที่เลือก แล้วคำนวณจำนวนเงิน = อัตราจ้าง × จำนวนเวรที่ปฏิบัติ (บวก OT ถ้ามี)
                </p>
              </div>
            )}

            <div className="border-t border-slate-100 pt-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                <input 
                  type="checkbox" 
                  checked={showDraftBorder} 
                  onChange={(e) => setShowDraftBorder(e.target.checked)}
                  className="rounded border-slate-300 text-sati-azure focus:ring-sati-azure"
                />
                ตีกรอบหน้าจำลองเอกสาร
              </label>
              <p className="text-[9px] text-slate-400">
                แสดงขอบกรอบเพื่อเล็งระยะจัดหน้ากระดาษ A4 (ขอบกรอบจะไม่แสดงเมื่อกดสั่งพิมพ์จริง)
              </p>
            </div>

            {/* Save + Print Actions */}
            <div className="space-y-2">
              {formSavedMsg && (
                <div className="text-[11px] font-bold text-success bg-success/10 border border-success/20 rounded-lg px-3 py-1.5 text-center animate-fade-in">
                  {formSavedMsg}
                </div>
              )}
              <button
                onClick={handleSaveForm}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white border border-sati-azure/30 text-sati-azure hover:bg-sati-azure/5 font-black text-xs cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" />
                บันทึกฟอร์ม (Save)
              </button>
              <button
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sati-azure hover:bg-sati-azure/90 text-white font-black text-xs shadow-sm shadow-sati-azure/20 cursor-pointer transition-all"
              >
                <Printer className="w-4 h-4" />
                พิมพ์เอกสาร / บันทึก PDF (Print A4)
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: A4 Document Sheet Preview (prints) */}
        <div className="lg:col-span-3 space-y-4 print-target">
          <div className="bg-slate-100 p-2 rounded-lg border border-slate-200 flex items-center gap-2 text-[10px] text-slate-500 no-print">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>เคล็ดลับ: ระบบจะซ่อนปุ่มและเมนูด้านซ้ายเมื่อสั่งพิมพ์ คุณสามารถกด Ctrl+P หรือคลิกปุ่มพิมพ์เพื่อส่งออกเป็น PDF ทันที</span>
          </div>

          {/* Document container — sized to A4 per the original (portrait / landscape) */}
          <div className="overflow-x-auto py-2">
            <div
              className={`sati-doc-sheet bg-white text-black font-serif mx-auto select-text ${
                showDraftBorder ? 'shadow-md border border-slate-300' : 'shadow-sm border border-slate-100'
              }`}
              style={{
                width: isLandscape ? '297mm' : '210mm',
                minHeight: isLandscape ? '210mm' : '297mm',
                padding: isLandscape ? '10mm' : '15mm 18mm',
              }}
            >
              {/* DOCUMENT 1: MEMORANDUM OF APPROVAL (บันทึกข้อความ) */}
              {activeDoc === 'memo' && (
                <div className="space-y-6 text-[14px] leading-relaxed relative print-p-0">
                  {/* Garuda Emblem and Header Title */}
                  <div className="flex items-start justify-between">
                    <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                      <img src="/garuda.png" alt="ตราครุฑ" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 text-center pr-16 mt-2">
                      <h1 className="text-2xl font-bold tracking-widest text-center" style={{ fontFamily: 'THSarabunNew, "Sarabun", sans-serif' }}>บันทึกข้อความ</h1>
                    </div>
                  </div>

                  {/* Top metadata grid */}
                  <div className="border-b-2 border-black pb-2 space-y-2 text-[15px]" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                    <div className="flex">
                      <span className="font-bold flex-shrink-0 pr-1">ส่วนราชการ</span>
                      <span className="flex-1 border-b border-dotted border-slate-400 pl-1">{subDepartment} โรงพยาบาลมหาราชนครราชสีมา โทร. {docPhone}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex">
                        <span className="font-bold flex-shrink-0 pr-1">ที่</span>
                        <span className="flex-1 border-b border-dotted border-slate-400 pl-1">{docRefPrefix}{docRefNumber}</span>
                      </div>
                      <div className="flex">
                        <span className="font-bold flex-shrink-0 pr-1">วันที่</span>
                        <span className="flex-1 border-b border-dotted border-slate-400 pl-1">{docDate}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <span className="font-bold flex-shrink-0 pr-1">เรื่อง</span>
                      <span className="flex-1 border-b border-dotted border-slate-400 font-bold pl-1">{memoSubject}</span>
                    </div>
                  </div>

                  {/* Body Text */}
                  <div className="space-y-4 pt-3 text-[15px]" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                    <div>เรียน ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
                    
                    <p className="indent-12 text-justify">
                      ตามบันทึกข้อความที่ <span className="font-bold">{docRefPrefix}...</span> ลงวันที่ <span className="font-bold">... กันยายน {year}</span> {subDepartment} 
                      ได้ขออนุมัติขึ้นปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ เดือน <span className="font-bold">{THAI_MONTHS[month - 1]} {year}</span> เพื่อรับชำระเงินค่ารักษาพยาบาลประจำจุดบริการความละเอียดแจ้งแล้วนั้น
                    </p>

                    <p className="indent-12 text-justify">
                      ในการนี้ การปฏิบัติงานนอกเวลาราชการดังกล่าวได้เสร็จสิ้นเรียบร้อยแล้ว {subDepartment} จึงขออนุมัติเบิกปฏิบัติงานนอกเวลาราชการและวันหยุดราชการ ประจำเดือน <span className="font-bold">{THAI_MONTHS[month - 1]} {year}</span> เป็นจำนวนเงินทั้งสิ้น <span className="font-bold underline">{totalOtPayableSum.toLocaleString()} บาท ({bahtTextApproved})</span> จากเงินบำรุงโรงพยาบาลมหาราชนครราชสีมา รายละเอียดตามเอกสารเบิกจ่ายค่าตอบแทนและตารางเวรที่แนบมาพร้อมนี้
                    </p>

                    <p className="indent-12">
                      จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ
                    </p>
                  </div>

                  {/* Signatures block */}
                  <div className="pt-8 grid grid-cols-2 gap-4 text-[15px]" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                    <div></div>
                    <div className="text-center space-y-1.5">
                      <div className="h-8"></div>
                      <div>ลงชื่อ..............................................................หัวหน้าผู้ควบคุม</div>
                      <div>( {memoHeadName} )</div>
                      <div className="text-slate-600 font-bold text-xs">{memoHeadPosition}</div>
                      <div className="text-slate-500 font-bold text-xs">{memoHeadTitle}</div>
                    </div>
                  </div>

                  <div className="pt-4 grid grid-cols-2 gap-4 text-[15px]" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                    <div className="text-center space-y-1.5 border border-dashed border-slate-300 p-3 rounded bg-slate-50/50 print:border-none print:bg-white print:p-0">
                      <div className="text-[11px] font-bold text-rose-600 mb-1 no-print">ผ่านความคิดเห็น/การตรวจสอบ</div>
                      <div className="h-6"></div>
                      <div>ลงชื่อ..............................................................ผู้ตรวจสอบ</div>
                      <div>( นางนฤมล ศรีสรรพ์ )</div>
                      <div className="text-slate-500 font-bold text-xs">รองผู้อำนวยการฝ่ายบริหาร</div>
                    </div>
                    <div className="text-center space-y-1.5">
                      <div className="h-8"></div>
                      <div>ลงชื่อ..............................................................ผู้อนุมัติ</div>
                      <div>( {memoApproverName} )</div>
                      <div className="text-slate-600 font-bold text-xs">{memoApproverPosition}</div>
                      <div className="text-slate-500 font-bold text-xs">{memoApproverTitle}</div>
                    </div>
                  </div>

                  {/* Option approval instructions box */}
                  {showApprovalBox && (
                    <div className="border border-red-400 p-4 rounded text-xs bg-red-50/30 text-red-900 mt-12 space-y-1 relative print:hidden">
                      <span className="absolute top-1.5 right-2 font-mono font-bold bg-red-200 text-red-800 px-1 rounded scale-90">เว้นสําหรับอนุมัติ</span>
                      <b className="font-bold block">บันทึกคำสั่งและกล่องประทับตราอนุมัติ (ลบกล่องนี้ก่อน Print):</b>
                      <p className="leading-relaxed">
                        * ส่วนที่อนุมัติโดยผู้อำนวยการฯ ไม่ต้องพิมพ์ ให้ลบออกได้เลยตามหมายเหตุสีแดงในเอกสารต้นฉบับจริง
                      </p>
                      <button 
                        onClick={() => setShowApprovalBox(false)}
                        className="text-xs text-indigo-600 font-bold hover:underline mt-1 block"
                      >
                        [✕ คลิกด่วนเพื่อลบช่องนี้ก่อน Print]
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENT 2: PAYROLL EVIDENCE FOR SHIFT/OT WORKERS (หลักฐานการรับเงิน) */}
              {activeDoc === 'receipt' && (
                <div className="space-y-4 text-[11px] leading-normal print-p-0" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                  {/* Header text */}
                  <div className="text-center space-y-1">
                    <h2 className="text-base font-bold">หลักฐานการจ่ายเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ</h2>
                    <p className="text-[11px] text-slate-700">
                      ส่วนราชการ <span className="font-bold">{subDepartment}</span> โรงพยาบาลมหาราชนครราชสีมา ประจำเดือน <span className="font-bold">{THAI_MONTHS[month - 1]} พ.ศ. {year}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      เบิกตามฎีกา...............................................................................................วันที่................เดือน....................................พ.ศ......................
                    </p>
                  </div>

                  {/* Evidence table: per-person OT with day codes and per-category counts */}
                  <div className="overflow-x-auto border border-black">
                    <table className="w-full text-left border-collapse text-[9px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-black text-center font-bold">
                          <th className="py-1 px-1 border-r border-black w-6">ที่</th>
                          <th className="py-1 px-1 border-r border-black w-24">ชื่อ - สกุล / รหัส</th>
                          <th className="py-1 px-1 border-r border-black w-20">ตำแหน่ง</th>
                          <th className="py-1 px-1 border-r border-black w-12">อัตราเบิก</th>
                          <th className="py-1 px-1 border-r border-black w-14">วันที่ปฏิบัติงานนอกเวลาราชการ</th>
                          <th className="py-1 px-1 border-r border-black w-7">ด</th>
                          <th className="py-1 px-1 border-r border-black w-7">ช</th>
                          <th className="py-1 px-1 border-r border-black w-7">บ</th>
                          <th className="py-1 px-1 border-r border-black w-7">BD</th>
                          <th className="py-1 px-1 border-r border-black w-9">รวมเวร</th>
                          <th className="py-1 px-1 border-r border-black w-16">จำนวนเงิน</th>
                          <th className="py-1 px-1 border-r border-black w-14">วดป. ที่รับเงิน</th>
                          <th className="py-1 px-1 w-20">ลายมือชื่อผู้รับเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, idx) => {
                          const p = r.personnel;

                          // Day codes for this worker (OT days only when explicit, else all worked)
                          const daysText: string[] = [];
                          if (r.hasExplicitOT) {
                            r.otDays.forEach(o => daysText.push(`${o.day}(${o.code})`));
                          } else {
                            for (let d = 1; d <= daysCount; d++) {
                              const shift = deptSchedule[`${p.id}-${d}`];
                              if (shift && shift !== 'O' && shift !== 'V' && shift !== 'T') {
                                daysText.push(`${d}(${shift})`);
                              }
                            }
                          }

                          // Effective per-shift rate (avg of paid OT) for the อัตราเบิก column
                          const effRate = r.otCount > 0 ? Math.round(r.otPayable / r.otCount) : 0;
                          const cat = r.otByCategory;

                          return (
                            <tr key={p.id} className="border-b border-slate-300 hover:bg-slate-50">
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono">{idx + 1}</td>
                              <td className="py-1.5 px-1.5 border-r border-black font-bold">
                                <div className="truncate max-w-[120px]">{p.name}</div>
                                <div className="text-[8px] text-slate-500 font-mono">({p.id})</div>
                              </td>
                              <td className="py-1.5 px-1 border-r border-black text-slate-700 truncate max-w-[90px]" title={p.position}>
                                {p.position.split(' ')[0]}
                              </td>
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono">
                                {effRate.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-1 border-r border-black text-[8px] font-mono whitespace-normal max-w-[200px] leading-tight">
                                {daysText.join(', ') || 'ไม่มีข้อมูลขึ้นเวร'}
                              </td>
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono">{cat['ด'] || '-'}</td>
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono">{cat['ช'] || '-'}</td>
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono">{cat['บ'] || '-'}</td>
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono">{cat['BD'] || '-'}</td>
                              <td className="py-1.5 px-1 text-center border-r border-black font-mono font-bold">
                                {r.otCount}
                              </td>
                              <td className="py-1.5 px-1.5 text-right border-r border-black font-mono font-bold">
                                {r.otPayable.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-1 border-r border-black text-slate-400 text-center font-mono text-[8px]">
                                ... / ... / ...
                              </td>
                              <td className="py-1.5 px-1 text-center font-mono text-slate-300">
                                ( ลายเซ็น )
                              </td>
                            </tr>
                          );
                        })}

                        {/* Grand Total Row */}
                        <tr className="bg-slate-50 font-bold border-t border-black text-[10px]">
                          <td colSpan={9} className="py-2 px-2 text-right font-black">รวมเป็นเงิน:</td>
                          <td className="py-2 px-1 text-center font-mono font-black">{totalOtCountSum}</td>
                          <td className="py-2 px-1.5 text-right font-mono font-black text-emerald-800">
                            {totalOtPayableSum.toLocaleString()}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Total in words line */}
                  <div className="flex items-center gap-2 text-[11px] pt-1">
                    <span className="font-bold">รวมจ่ายเงินทั้งสิ้น</span>
                    <span className="font-bold underline font-mono">{totalOtPayableSum.toLocaleString()}</span>
                    <span>บาท</span>
                    <span className="font-bold">จำนวนเงิน (ตัวอักษร)</span>
                    <span className="flex-1 border-b border-dotted border-slate-400 font-bold text-center">({bahtTextApproved})</span>
                  </div>

                  {/* Certification statement */}
                  <div className="pt-3 text-center text-[11px] leading-relaxed">
                    <p>ขอรับรองว่าผู้ที่รับเงินค่าตอบแทนการปฏิบัติงานนอกเวลาราชการดังกล่าว ได้ปฏิบัติงานนอกเวลาราชการจริง</p>
                  </div>

                  {/* Signatures for Receipt Proof */}
                  <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[11px]">
                    <div className="space-y-1">
                      <div className="h-6"></div>
                      <div>ลงชื่อ.............................................หัวหน้าผู้ควบคุม</div>
                      <div>( {memoHeadName} )</div>
                      <div className="text-[10px] text-slate-500 font-bold">{memoHeadTitle}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="h-6"></div>
                      <div>ลงชื่อ.............................................ผู้จ่ายเงิน</div>
                      <div>( ............................................. )</div>
                      <div className="text-[10px] text-slate-500">เจ้าพนักงานการเงินและบัญชี</div>
                    </div>
                  </div>

                  {/* Pass-through approver (ผ่านรองฯ) */}
                  <div className="pt-4 grid grid-cols-2 gap-8 text-center text-[11px]">
                    <div className="space-y-1">
                      <div className="text-[10px] text-slate-500 text-left pl-4">ผ่านรองฯ</div>
                      <div>ลงชื่อ.............................................</div>
                      <div>( {memoApproverName} )</div>
                      <div className="text-[10px] text-slate-500 font-bold">{memoApproverPosition}</div>
                    </div>
                    <div></div>
                  </div>
                </div>
              )}

              {/* DOCUMENT 3: INDIVIDUAL WORK VOLUME REPORT (ใบแสดงปริมาณงานรายวัน) */}
              {activeDoc === 'volume' && (
                <div className="space-y-4 text-[12px] leading-normal print-p-0" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                  {/* Title of Document */}
                  <div className="text-center space-y-1 border-b border-black pb-3">
                    <h2 className="text-base font-bold">ใบแสดงปริมาณงานนอกเวลาราชการ</h2>
                    <p className="text-[11px]">
                      ประจำเดือน <span className="font-bold">{THAI_MONTHS[month - 1]} พ.ศ. {year}</span>
                    </p>
                    {selectedPerson ? (
                      <p className="text-[12px]">
                        ของ <span className="font-bold underline">{selectedPerson.name}</span> &nbsp;&nbsp;&nbsp;&nbsp; ตำแหน่ง <span className="font-bold underline">{selectedPerson.position}</span>
                      </p>
                    ) : (
                      <p className="text-rose-500">กรุณาเลือกผู้ปฏิบัติงานในเมนูด้านซ้ายเพื่อสร้างรายงาน</p>
                    )}
                  </div>

                  {/* Volume Table */}
                  <table className="w-full text-left border-collapse border border-black text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-black text-center font-bold">
                        <th className="py-1.5 px-2 border-r border-black w-28">วัน เดือน ปี</th>
                        <th className="py-1.5 px-4 border-r border-black">งานที่ปฏิบัติโดยย่อ</th>
                        <th className="py-1.5 px-2 border-r border-black w-24 text-center">ปริมาณงาน</th>
                        <th className="py-1.5 px-2 w-20 text-center">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPerson && workedOtDays.length > 0 ? (
                        workedOtDays.map((day) => {
                          const shift = deptSchedule[`${selectedPerson.id}-${day}`];
                          const logKey = `${selectedPerson.id}-${day}`;
                          const logVal = manualWorkLogs[logKey] || {
                            job: getDefaultWorkLogJob(shift, selectedPerson),
                            volume: '1 เวร'
                          };

                          return (
                            <tr key={day} className="border-b border-slate-300">
                              <td className="py-2 px-2 border-r border-black font-mono text-[10px]">
                                {getDayOfWeekText(day)}, {day} {THAI_MONTHS[month - 1]}
                              </td>
                              <td className="py-2 px-4 border-r border-black text-slate-800">
                                {logVal.job}
                              </td>
                              <td className="py-2 px-2 border-r border-black text-center font-mono">
                                {logVal.volume}
                              </td>
                              <td className="py-2 px-2 text-center text-slate-400 text-[10px]">
                                ปฏิบัติงานจริง
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-400 italic">
                            ไม่มีข้อมูลเวรปฏิบัติหน้าที่นอกเวลาราชการของบุคคลนี้ในตารางเวรหลัก
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Signatures for Individual work statement */}
                  {selectedPerson && (
                    <div className="pt-10 grid grid-cols-2 gap-8 text-center text-[12px] leading-relaxed">
                      <div className="space-y-1">
                        <div className="h-8"></div>
                        <div>ลงชื่อ..............................................................ผู้ปฏิบัติงาน</div>
                        <div>( {selectedPerson.name} )</div>
                        <div className="text-[10px] text-slate-500 font-bold">{selectedPerson.position.split(' ')[0]}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-8"></div>
                        <div>ลงชื่อ..............................................................หัวหน้าผู้ควบคุม</div>
                        <div>( {memoHeadName} )</div>
                        <div className="text-[10px] text-slate-500 font-bold">{memoHeadPosition}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENT 4: DUTY SCHEDULE (ตารางปฏิบัติงาน) */}
              {activeDoc === 'schedule' && (
                <div className="space-y-3 text-[10px] leading-normal print-p-0" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                  <div className="text-center space-y-0.5">
                    <h2 className="text-sm font-bold">ตารางปฏิบัติงาน ประจำเดือน {THAI_MONTHS[month - 1]} {year}</h2>
                    <p className="text-[11px] font-bold">{subDepartment} โรงพยาบาลมหาราชนครราชสีมา</p>
                  </div>

                  <div className="overflow-x-auto border border-black">
                    <table className="w-full border-collapse text-[8px]">
                      <thead>
                        <tr className="bg-slate-100 text-center font-bold border-b border-black">
                          <th className="border-r border-black px-0.5 py-1 w-5">ที่</th>
                          <th className="border-r border-black px-1 py-1 text-left w-28">ชื่อ - นามสกุล</th>
                          <th className="border-r border-black px-1 py-1 w-16">ตำแหน่ง</th>
                          {Array.from({ length: daysCount }, (_, i) => {
                            const day = i + 1;
                            const dow = new Date(year - 543, month - 1, day).getDay();
                            const isWE = dow === 0 || dow === 6;
                            return (
                              <th key={day} className={`border-r border-black px-0 py-1 w-4 font-mono ${isWE ? 'bg-rose-50 text-rose-700' : ''}`}>
                                <div>{day}</div>
                                <div className="font-normal text-[7px]">{THAI_DAYS_SHORT[dow]}</div>
                              </th>
                            );
                          })}
                          <th className="px-1 py-1 w-10">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeStaff.length > 0 ? activeStaff.map((p, idx) => (
                          <tr key={p.id} className="border-b border-slate-300">
                            <td className="border-r border-black text-center font-mono">{idx + 1}</td>
                            <td className="border-r border-black px-1 font-bold truncate max-w-[110px]" title={p.name}>{p.name}</td>
                            <td className="border-r border-black px-1 truncate max-w-[64px]" title={p.position}>{p.position.split(' ')[0]}</td>
                            {Array.from({ length: daysCount }, (_, i) => {
                              const day = i + 1;
                              const code = deptSchedule[`${p.id}-${day}`];
                              const st = SHIFT_TYPES.find(s => s.code === code);
                              const isOT = !!st?.isOT;
                              return (
                                <td key={day} className={`border-r border-black text-center font-mono ${isOT ? 'font-bold text-rose-700' : code && code !== 'O' ? 'text-slate-800' : 'text-slate-300'}`}>
                                  {code && code !== 'O' ? code : ''}
                                </td>
                              );
                            })}
                            <td></td>
                          </tr>
                        )) : (
                          <tr><td colSpan={daysCount + 4} className="py-6 text-center text-slate-400 italic">ไม่มีข้อมูลบุคลากรในกลุ่มงานนี้</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[9px] pt-1">
                    <span className="font-bold">หมายเหตุ:</span>
                    <span><b>ช</b> ปฏิบัติงานในเวลา 08:00-16:00</span>
                    <span><b>บ</b> 16:00-24:00</span>
                    <span><b>ด</b> 00:00-08:00</span>
                    <span className="text-rose-700"><b>ชot/บot/ดot</b> ปฏิบัติงานนอกเวลาราชการ/วันหยุด (เบิก OT)</span>
                    <span className="text-rose-700"><b>BD</b> เวรเสริมบ่ายดึก 16:30-20:30</span>
                    <span><b>ว่าง</b> = ออฟ/วันหยุด</span>
                  </div>

                  {/* Signatures */}
                  <div className="pt-8 grid grid-cols-2 gap-8 text-center text-[11px]">
                    <div className="space-y-1">
                      <div>(ลงชื่อ)..............................................หัวหน้าผู้ควบคุม</div>
                      <div>( {memoHeadName} )</div>
                      <div className="text-[10px] text-slate-500 font-bold">{memoHeadTitle}</div>
                    </div>
                    <div className="space-y-1">
                      <div>(ลงชื่อ)..............................................ผู้อนุมัติ</div>
                      <div>( {memoApproverName} )</div>
                      <div className="text-[10px] text-slate-500 font-bold">{memoApproverPosition}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCUMENT 5: TEMPORARY EMPLOYEE WAGE (ค่าจ้างลูกจ้างชั่วคราว รายวัน/รายคาบ) */}
              {activeDoc === 'wage' && (
                <div className="space-y-6 text-[14px] leading-relaxed print-p-0" style={{ fontFamily: '"Sarabun", sans-serif' }}>
                  {/* Memo header */}
                  <div className="flex items-start justify-between">
                    <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                      <img src="/garuda.png" alt="ตราครุฑ" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 text-center pr-16 mt-2">
                      <h1 className="text-2xl font-bold tracking-widest">บันทึกข้อความ</h1>
                    </div>
                  </div>

                  <div className="border-b-2 border-black pb-2 space-y-2 text-[15px]">
                    <div className="flex">
                      <span className="font-bold flex-shrink-0 pr-1">ส่วนราชการ</span>
                      <span className="flex-1 border-b border-dotted border-slate-400 pl-1">{subDepartment} โรงพยาบาลมหาราชนครราชสีมา โทร. {docPhone}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex">
                        <span className="font-bold flex-shrink-0 pr-1">ที่</span>
                        <span className="flex-1 border-b border-dotted border-slate-400 pl-1">{docRefPrefix}{docRefNumber}</span>
                      </div>
                      <div className="flex">
                        <span className="font-bold flex-shrink-0 pr-1">วันที่</span>
                        <span className="flex-1 border-b border-dotted border-slate-400 pl-1">{docDate}</span>
                      </div>
                    </div>
                    <div className="flex">
                      <span className="font-bold flex-shrink-0 pr-1">เรื่อง</span>
                      <span className="flex-1 border-b border-dotted border-slate-400 font-bold pl-1">ขออนุมัติเบิกเงินค่าจ้างลูกจ้างชั่วคราว ({wageMode})</span>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2 text-[15px]">
                    <div>เรียน ผู้อำนวยการโรงพยาบาลมหาราชนครราชสีมา</div>
                    <p className="indent-12 text-justify">
                      ตามคำสั่งโรงพยาบาลมหาราชนครราชสีมา ที่ <span className="font-bold">{wageOrderNo}</span> เรื่อง การจ้างลูกจ้างชั่วคราวเงินบำรุง ({wageMode}) นั้น
                    </p>
                    <p className="indent-12 text-justify">
                      ในการนี้ <span className="font-bold">{subDepartment}</span> จึงขออนุมัติเบิกเงินค่าจ้างลูกจ้างชั่วคราว ({wageMode}) ประจำเดือน <span className="font-bold">{THAI_MONTHS[month - 1]} {year}</span> จำนวน <span className="font-bold">{wageRows.length}</span> ราย เป็นจำนวนเงินทั้งสิ้น <span className="font-bold underline">{wageTotal.toLocaleString()} บาท ({wageTotalText})</span> จากเงินบำรุงโรงพยาบาลมหาราชนครราชสีมา ทั้งนี้ ได้แนบเอกสารเพื่อเป็นหลักฐานในการเบิกจ่ายมาพร้อมนี้แล้ว
                    </p>
                    <p className="indent-12">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
                  </div>

                  <div className="pt-4 grid grid-cols-2 gap-4 text-[15px]">
                    <div></div>
                    <div className="text-center space-y-1">
                      <div className="h-8"></div>
                      <div>ลงชื่อ..............................................</div>
                      <div>( {memoHeadName} )</div>
                      <div className="text-slate-600 font-bold text-xs">{memoHeadPosition}</div>
                      <div className="text-slate-500 font-bold text-xs">{memoHeadTitle}</div>
                    </div>
                  </div>

                  {/* Attachment: name-list of temporary employees (form2-2) */}
                  <div className="pt-6 border-t-2 border-dashed border-slate-300 space-y-3">
                    <div className="text-center space-y-0.5">
                      <h2 className="text-base font-bold">รายชื่อแนบเบิกค่าจ้างลูกจ้างชั่วคราว ({wageMode})</h2>
                      <p className="text-[12px] font-bold">{subDepartment}</p>
                      <p className="text-[11px]">ประจำเดือน {THAI_MONTHS[month - 1]} {year} &nbsp; จำนวน {wageRows.length} ราย</p>
                    </div>

                    <table className="w-full border-collapse border border-black text-[12px]">
                      <thead>
                        <tr className="bg-slate-50 text-center font-bold border-b border-black">
                          <th className="border-r border-black py-1.5 px-2 w-12">ลำดับ</th>
                          <th className="border-r border-black py-1.5 px-2 text-left">ชื่อ - สกุล</th>
                          <th className="border-r border-black py-1.5 px-2 text-left w-48">ตำแหน่ง</th>
                          <th className="py-1.5 px-2 w-28 text-right">จำนวนเงิน (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wageRows.length > 0 ? wageRows.map((r, idx) => (
                          <tr key={r.personnel.id} className="border-b border-slate-300">
                            <td className="border-r border-black text-center py-1.5 font-mono">{idx + 1}</td>
                            <td className="border-r border-black px-2 py-1.5 font-bold">{r.personnel.name}</td>
                            <td className="border-r border-black px-2 py-1.5">{r.personnel.position}</td>
                            <td className="px-2 py-1.5 text-right font-mono font-bold">{r.amount.toLocaleString()}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                              ไม่มีลูกจ้างชั่วคราว ({wageMode}) ในกลุ่มงานนี้ — ตั้งค่ารูปแบบจ่ายที่เมนู "บุคลากร"
                            </td>
                          </tr>
                        )}
                        <tr className="bg-slate-50 font-bold border-t border-black">
                          <td colSpan={3} className="text-right px-2 py-2 font-black">รวมเป็นเงินทั้งสิ้น</td>
                          <td className="px-2 py-2 text-right font-mono font-black text-emerald-800">{wageTotal.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="font-bold">จำนวนเงิน (ตัวอักษร)</span>
                      <span className="flex-1 border-b border-dotted border-slate-400 text-center font-bold">({wageTotalText})</span>
                    </div>

                    <div className="pt-8 flex justify-end text-center text-[12px]">
                      <div className="space-y-1">
                        <div>ลงชื่อ..............................................</div>
                        <div>( {memoHeadName} )</div>
                        <div className="text-[11px] text-slate-500 font-bold">{memoHeadPosition}</div>
                        <div className="text-[11px] text-slate-500 font-bold">{memoHeadTitle}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
