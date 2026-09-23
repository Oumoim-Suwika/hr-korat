import React, { useState } from 'react';
import { 
  DollarSign, Settings, Search, FileSpreadsheet, FileText, CheckCircle, Calculator, Info, Printer,
  Filter, Building, Layers, Shield, User, Users, Clipboard, RefreshCw, AlertTriangle
} from 'lucide-react';
import { Personnel, OTSettings, Role, Ward, EmployeeType, PaymentType } from '../types';
import { THAI_MONTHS } from '../data';
import { computePersonClaim } from '../lib/otCalc';

interface FinanceViewProps {
  personnel: Personnel[];
  schedule: Record<string, string>;
  otSettings: OTSettings;
  onUpdateOTSettings: (settings: OTSettings) => void;
  year: number;
  month: number;
  daysCount: number;
  // Expanded Multi-ward props
  wardPersonnel?: Record<string, Personnel[]>;
  wardSchedules?: Record<string, Record<string, string>>;
  activeWardId?: string;
  wards?: Ward[];
  onUpdateWardPersonnel?: (updated: Record<string, Personnel[]>) => void;
}

export default function FinanceView({
  personnel,
  schedule,
  otSettings,
  onUpdateOTSettings,
  year,
  month,
  daysCount,
  wardPersonnel,
  wardSchedules,
  activeWardId = 'U01',
  wards = [],
  onUpdateWardPersonnel
}: FinanceViewProps) {
  // Tabs for Pricing configuration
  const [pricingTab, setPricingTab] = useState<'default' | 'individual'>('default');
  const [activeSettingsTab, setActiveSettingsTab] = useState<Role>('doctor');
  
  // State for Individual Override Editor
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [overrideSuccess, setOverrideSuccess] = useState<string>('');
  const [indEmployeeType, setIndEmployeeType] = useState<EmployeeType>('ข้าราชการ');
  const [indPaymentType, setIndPaymentType] = useState<PaymentType>('รายเดือน');
  const [indBaseWage, setIndBaseWage] = useState<number>(0);
  const [enableCustomRates, setEnableCustomRates] = useState<boolean>(false);
  const [indRates, setIndRates] = useState<Record<string, number>>({
    'ช': 0, 'บ': 0, 'ด': 0, 'OR': 0, 'BD': 0
  });

  // Filtering State for Audit Report
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('all');
  const [selectedBuildingFilter, setSelectedBuildingFilter] = useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | Role>('all');
  const [selectedEmpTypeFilter, setSelectedEmpTypeFilter] = useState<string>('all');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('all');

  // Role labels
  const roleLabels: Record<Role, string> = {
    doctor: 'แพทย์',
    nurse: 'พยาบาลวิชาชีพ',
    assistant: 'ผู้ช่วยพยาบาล',
    room: 'ห้องผ่าตัด'
  };

  const shiftLabels: Record<string, string> = {
    'ช': 'เวรเช้า (ช)',
    'บ': 'เวรบ่าย (บ)',
    'ด': 'เวรดึก (ด)',
    'OR': 'เวรผ่าตัด (OR)',
    'BD': 'เวรเสริมพิเศษ (BD)',
  };

  // Fallbacks to ensure zero-crash
  const effectiveWards = wards.length > 0 ? wards : [
    { id: activeWardId, name: 'กลุ่มงานปัจจุบัน', building: 'ตึกการปฏิบัติงาน', phone: '-' }
  ];

  const effectiveWardPersonnel = wardPersonnel || {
    [activeWardId]: personnel
  };

  const effectiveWardSchedules = wardSchedules || {
    [activeWardId]: schedule
  };

  // List of unique buildings for filtering
  const buildingsList = Array.from(new Set(effectiveWards.map(w => w.building).filter(Boolean)));

  // List of all active employees from all wards
  const allActiveEmployees = Object.entries(effectiveWardPersonnel).flatMap(([wardId, staffList]) => {
    const wardObj = effectiveWards.find(w => w.id === wardId);
    return staffList.map(p => ({
      ...p,
      wardId,
      wardName: wardObj?.name || wardId,
      building: wardObj?.building || 'ไม่ระบุ'
    }));
  });

  // Handling standard rate inputs change
  const handleRateChange = (role: Role, shiftCode: string, value: number) => {
    const updatedRates = { ...otSettings.rates };
    if (!updatedRates[role]) {
      updatedRates[role] = {};
    }
    updatedRates[role][shiftCode] = value;
    onUpdateOTSettings({
      ...otSettings,
      rates: updatedRates
    });
  };

  // Handling threshold change
  const handleThresholdChange = (value: number) => {
    onUpdateOTSettings({
      ...otSettings,
      threshold: value
    });
  };

  // Fill override form when employee is selected
  const handleSelectPersonForOverride = (pId: string) => {
    setSelectedPersonId(pId);
    if (!pId) return;

    // Find person
    const found = allActiveEmployees.find(e => e.id === pId);
    if (found) {
      setIndEmployeeType(found.employeeType || 'ข้าราชการ');
      setIndPaymentType(found.paymentType || 'รายเดือน');
      setIndBaseWage(found.baseWage || 0);
      
      const hasCustom = !!found.customRates && Object.keys(found.customRates).length > 0;
      setEnableCustomRates(hasCustom);
      
      const defaultRoleRates = otSettings.rates[found.role] || {};
      const ratesObj = {
        'ช': found.customRates?.['ช'] ?? defaultRoleRates['ช'] ?? 0,
        'บ': found.customRates?.['บ'] ?? defaultRoleRates['บ'] ?? 0,
        'ด': found.customRates?.['ด'] ?? defaultRoleRates['ด'] ?? 0,
        'OR': found.customRates?.['OR'] ?? defaultRoleRates['OR'] ?? 0,
        'BD': found.customRates?.['BD'] ?? defaultRoleRates['BD'] ?? 0,
      };
      setIndRates(ratesObj);
    }
  };

  // Save override settings
  const handleSaveIndividualOverride = () => {
    if (!selectedPersonId || !onUpdateWardPersonnel || !wardPersonnel) {
      return;
    }

    const found = allActiveEmployees.find(e => e.id === selectedPersonId);
    if (!found) return;

    const targetWardId = found.wardId;
    const currentStaffList = wardPersonnel[targetWardId] || [];

    const updatedStaffList = currentStaffList.map(p => {
      if (p.id === selectedPersonId) {
        return {
          ...p,
          employeeType: indEmployeeType,
          paymentType: indPaymentType,
          baseWage: indBaseWage,
          customRates: enableCustomRates ? indRates : undefined
        };
      }
      return p;
    });

    onUpdateWardPersonnel({
      ...wardPersonnel,
      [targetWardId]: updatedStaffList
    });

    setOverrideSuccess(`บันทึกค่าจ้างเฉพาะบุคคลของ ${found.name} เรียบร้อยแล้ว! ✨`);
    setTimeout(() => setOverrideSuccess(''), 4000);
  };

  // Calculate stats for a single person using the shared OT engine (matches forms)
  const calculateClaimsForPerson = (p: any) => {
    const wardSched = effectiveWardSchedules[p.wardId] || {};
    const claim = computePersonClaim(p as Personnel, wardSched, otSettings, daysCount);

    // Sum shift-code counts back into the display buckets (ot variants roll up)
    const s = { ช: 0, บ: 0, ด: 0, OR: 0, BD: 0, O: 0, V: 0, T: 0 };
    Object.entries(claim.stats).forEach(([code, count]) => {
      if (code === 'ชot') s['ช'] += count;
      else if (code === 'บot') s['บ'] += count;
      else if (code === 'ดot') s['ด'] += count;
      else if (s[code as keyof typeof s] !== undefined) s[code as keyof typeof s] += count;
    });

    return {
      stats: s,
      totalShifts: claim.totalWorkShifts,
      totalValue: claim.totalValue,
      otCount: claim.otCount,
      otPayable: claim.otPayable,
      otByCategory: claim.otByCategory,
      hasExplicitOT: claim.hasExplicitOT,
      baseEarnings: claim.baseEarnings,
      netEarnings: claim.netEarnings,
      paymentMode: claim.paymentMode,
      baseWageRate: claim.baseWageRate,
      employeeType: claim.employeeType,
      wardId: p.wardId,
      wardName: p.wardName,
      building: p.building
    };
  };

  // Compile full report list with multiple filters
  const financeRows = allActiveEmployees
    .map(p => {
      const claims = calculateClaimsForPerson(p);
      return {
        personnel: p,
        ...claims
      };
    })
    .filter(row => {
      // 1. Text Search (Name, ID, Position)
      const matchText = row.personnel.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        row.personnel.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        row.personnel.position.toLowerCase().includes(searchTerm.toLowerCase());
      
      // 2. Ward filter
      const matchWard = selectedWardFilter === 'all' || row.wardId === selectedWardFilter;
      
      // 3. Building filter
      const matchBuilding = selectedBuildingFilter === 'all' || row.building === selectedBuildingFilter;
      
      // 4. Position/Role Category filter
      const matchRole = selectedRoleFilter === 'all' || row.personnel.role === selectedRoleFilter;
      
      // 5. Employee type (ข้าราชการ, พกส, etc)
      const matchEmpType = selectedEmpTypeFilter === 'all' || row.employeeType === selectedEmpTypeFilter;

      // 6. Payment type (รายวัน, รายเดือน)
      const matchPayment = selectedPaymentFilter === 'all' || row.paymentMode === selectedPaymentFilter;

      return matchText && matchWard && matchBuilding && matchRole && matchEmpType && matchPayment;
    })
    .sort((a, b) => a.personnel.name.localeCompare(b.personnel.name));

  // Compute Grand Totals for current selection
  const grandTotalShifts = financeRows.reduce((sum, row) => sum + row.totalShifts, 0);
  const grandTotalOTCount = financeRows.reduce((sum, row) => sum + row.otCount, 0);
  const grandTotalBaseEarnings = financeRows.reduce((sum, row) => sum + row.baseEarnings, 0);
  const grandTotalOTPayable = financeRows.reduce((sum, row) => sum + row.otPayable, 0);
  const grandTotalNetEarnings = financeRows.reduce((sum, row) => sum + row.netEarnings, 0);

  // Split budget by Employee Type for visual progress bar
  const budgetByType = financeRows.reduce((acc, row) => {
    const type = row.employeeType;
    acc[type] = (acc[type] || 0) + row.netEarnings;
    return acc;
  }, {} as Record<string, number>);

  // Split budget by Ward
  const budgetByWard = financeRows.reduce((acc, row) => {
    const name = row.wardName;
    acc[name] = (acc[name] || 0) + row.netEarnings;
    return acc;
  }, {} as Record<string, number>);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: Dynamic Rates Configurator with Toggleable Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Pricing Panel */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2 space-y-4 premium-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sati-azure/5 text-sati-azure rounded-lg border border-sati-azure/10 shadow-2xs">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-display">ตั้งค่าอัตราและค่าจ้างต่อกะ (OT & Wages Setup)</h3>
                <p className="text-[10px] text-slate-400">กำหนดราคากลางรายคาบ หรือตั้งค่าจ้างแบบรายวัน/รายเดือน และโอทีรายบุคคล</p>
              </div>
            </div>

            {/* Config Mode Switch */}
            <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-center border border-slate-200/40">
              <button
                onClick={() => setPricingTab('default')}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  pricingTab === 'default'
                    ? 'bg-white text-sati-azure shadow-sm border border-slate-200/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                อัตรากลางแยกตำแหน่ง
              </button>
              <button
                onClick={() => {
                  setPricingTab('individual');
                  // Auto select first active person if none selected
                  if (!selectedPersonId && allActiveEmployees.length > 0) {
                    handleSelectPersonForOverride(allActiveEmployees[0].id);
                  }
                }}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer ${
                  pricingTab === 'individual'
                    ? 'bg-white text-sati-azure shadow-sm border border-slate-200/20'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ตั้งค่ารายกะและลูกจ้างปัจจุบัน
              </button>
            </div>
          </div>

          {/* TAB 1: DEFAULT GENERAL RATES */}
          {pricingTab === 'default' && (
            <div className="space-y-3 animate-fade-in">
              {/* Threshold control */}
              <div className="bg-slate-50 p-2.5 rounded-md flex items-center justify-between border border-slate-200/60">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-500" />
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">เกณฑ์เวรพื้นฐานปกติก่อนคิด OT (Standard Threshold)</label>
                    <p className="text-[9px] text-slate-400">ระบุจำนวนเวรปกติขั้นต่ำต่อเดือนที่ไม่นับเป็น OT (เศษที่เกินเกณฑ์จะจ่ายเป็นเงิน OT อัตโนมัติ)</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <input 
                    type="number" 
                    value={otSettings.threshold}
                    onChange={(e) => handleThresholdChange(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 px-2 py-1 font-mono font-bold text-center border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-sati-azure"
                    min="0"
                    max="30"
                  />
                  <span className="text-[10px] text-slate-600 font-bold">เวร/เดือน</span>
                </div>
              </div>

              {/* Role selector tabs */}
              <div className="border-b border-slate-100">
                <nav className="flex gap-1 -mb-px">
                  {(['doctor', 'nurse', 'assistant', 'room'] as Role[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setActiveSettingsTab(r)}
                      className={`py-1 px-2.5 border-b-2 text-[10px] font-bold cursor-pointer transition-all ${
                        activeSettingsTab === r
                          ? 'border-sati-azure text-sati-azure'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {roleLabels[r]}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Standard pricing inputs list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {Object.keys(shiftLabels).map((shiftCode) => {
                  const currentRate = otSettings.rates[activeSettingsTab]?.[shiftCode] || 0;
                  return (
                    <div key={shiftCode} className="flex items-center justify-between p-2 border border-slate-200/50 rounded hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-700">{shiftLabels[shiftCode]}</span>
                        <span className="text-[8px] text-slate-400">ค่าจ้างกลางของ {roleLabels[activeSettingsTab]}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input 
                          type="number"
                          value={currentRate}
                          onChange={(e) => handleRateChange(activeSettingsTab, shiftCode, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-0.5 font-mono font-bold text-right border border-slate-300 rounded text-[11px] bg-white focus:outline-none"
                          min="0"
                        />
                        <span className="text-[9px] text-slate-400 font-bold">฿</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INDIVIDUAL OVERRIDES & EMPLOYEE STATUS */}
          {pricingTab === 'individual' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Employee Dropdown */}
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">เลือกผู้ปฏิบัติงานในโรงพยาบาล</label>
                  <select
                    value={selectedPersonId}
                    onChange={(e) => handleSelectPersonForOverride(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] border border-slate-300 rounded bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sati-azure"
                  >
                    <option value="">-- เลือกเจ้าหน้าที่ --</option>
                    {allActiveEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        [{emp.wardId}] {emp.name} ({roleLabels[emp.role]})
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-400 mt-1">สามารถเลือกปรับแต่งรายคนเพื่อรองรับพนักงานรายวัน รายเดือน หรือระบุโอทีพิเศษ</p>
                </div>

                {/* 2. Employment Properties */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-150">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">ประเภทการจ้าง</label>
                    <select
                      value={indEmployeeType}
                      onChange={(e) => setIndEmployeeType(e.target.value as any)}
                      className="w-full px-1.5 py-1 text-[10px] border border-slate-300 rounded bg-white text-slate-800 font-bold"
                    >
                      <option value="ข้าราชการ">ข้าราชการ</option>
                      <option value="พนักงานราชการ">พนักงานราชการ</option>
                      <option value="ลูกจ้างประจำ">ลูกจ้างประจำ</option>
                      <option value="พนักงานกระทรวง">พนักงานกระทรวง</option>
                      <option value="ลูกจ้างชั่วคราว (รายวัน)">ลูกจ้างชั่วคราว (รายวัน)</option>
                      <option value="ลูกจ้างชั่วคราว (รายคาบ)">ลูกจ้างชั่วคราว (รายคาบ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">รูปแบบจ่ายค่าตอบแทน</label>
                    <select
                      value={indPaymentType}
                      onChange={(e) => setIndPaymentType(e.target.value as any)}
                      className="w-full px-1.5 py-1 text-[10px] border border-slate-300 rounded bg-white text-slate-800 font-bold"
                    >
                      <option value="รายเดือน">รายเดือน (Salary + OT)</option>
                      <option value="รายวัน">รายวัน (Daily Wage + OT)</option>
                      <option value="รายคาบ">รายคาบ (Periodic Wage + OT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">เงินเดือน / อัตราจ้างปกติ (฿)</label>
                    <input
                      type="number"
                      value={indBaseWage || ''}
                      onChange={(e) => setIndBaseWage(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-1.5 py-1 text-[10px] border border-slate-300 rounded bg-white font-mono font-bold text-right"
                      placeholder="เช่น 15000 หรือ 500/วัน"
                    />
                  </div>
                </div>
              </div>

              {selectedPersonId && (
                <div className="border-t border-slate-100 pt-2.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="enableCustomRates"
                        checked={enableCustomRates}
                        onChange={(e) => setEnableCustomRates(e.target.checked)}
                        className="w-3.5 h-3.5 text-sati-azure rounded focus:ring-sati-azure cursor-pointer"
                      />
                      <label htmlFor="enableCustomRates" className="text-[11px] font-extrabold text-slate-700 cursor-pointer">
                        เปิดใช้งานอัตราเวรพิเศษโอทีเฉพาะบุคคล (Enable Custom OT Override)
                      </label>
                    </div>
                    {overrideSuccess && (
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 animate-pulse">
                        {overrideSuccess}
                      </span>
                    )}
                  </div>

                  {enableCustomRates && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-sati-azure/5 p-2.5 rounded-lg border border-sati-azure/10">
                      {Object.keys(shiftLabels).map(shiftCode => (
                        <div key={shiftCode} className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold text-slate-600 font-mono text-center bg-white rounded py-0.5 border border-slate-100">
                            {shiftLabels[shiftCode].replace('เวร', '')}
                          </span>
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="number"
                              value={indRates[shiftCode] || 0}
                              onChange={(e) => setIndRates({
                                ...indRates,
                                [shiftCode]: Math.max(0, parseInt(e.target.value) || 0)
                              })}
                              className="w-full px-1.5 py-0.5 text-center text-[11px] font-bold font-mono border border-sati-azure/20 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure bg-white"
                              min="0"
                            />
                            <span className="text-[9px] text-indigo-400 font-medium">฿</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveIndividualOverride}
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-extrabold text-white bg-indigo-600 hover:opacity-95 rounded shadow-xs cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      บันทึกอัตราและข้อมูลสัญญาเฉพาะบุคคล
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Consolidated Budget Widget */}
        <div className="bg-slate-900 text-white p-3.5 rounded-lg border border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">รายงานเบิกจ่ายและงบประมาณ</h3>
              </div>
              <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-1.5 py-0.5 rounded-full uppercase">
                {THAI_MONTHS[month - 1]} {year}
              </span>
            </div>

            {/* Quick Indicators */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-800/50 p-1.5 rounded border border-slate-800">
                <span className="text-[8px] text-slate-400 font-medium uppercase block">พนักงานในตารางตรวจสอบ</span>
                <span className="text-sm font-black font-mono text-indigo-300">{financeRows.length} ราย</span>
              </div>
              <div className="bg-slate-800/50 p-1.5 rounded border border-slate-800">
                <span className="text-[8px] text-slate-400 font-medium uppercase block">รวมเวรโอที (OT Shifts)</span>
                <span className="text-sm font-black font-mono text-rose-300">{grandTotalOTCount} กะ</span>
              </div>
            </div>

            {/* Contract Type Budget Split */}
            <div className="space-y-2 border-t border-slate-800 pt-2.5">
              <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">สัดส่วนค่าใช้จ่ายตามประเภทสัญญาการจ้าง</span>
              <div className="space-y-1.5">
                {['ข้าราชการ', 'พนักงานกระทรวง', 'พนักงานราชการ', 'ลูกจ้างประจำ', 'ลูกจ้างชั่วคราว (รายวัน)', 'ลูกจ้างชั่วคราว (รายคาบ)'].map(type => {
                  const amt = budgetByType[type] || 0;
                  const pct = grandTotalNetEarnings > 0 ? (amt / grandTotalNetEarnings) * 100 : 0;
                  if (amt === 0) return null;
                  return (
                    <div key={type} className="text-[9px]">
                      <div className="flex justify-between text-slate-300">
                        <span>{type}</span>
                        <span className="font-mono font-bold text-slate-100">{amt.toLocaleString()} ฿ ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1 mt-0.5">
                        <div className="bg-sati-azure h-1 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
                {grandTotalNetEarnings === 0 && (
                  <span className="text-[10px] text-slate-500 block italic py-1 text-center">ไม่มีสถิติเบิกจ่ายในรอบเวลานี้</span>
                )}
              </div>
            </div>

            {/* Budget split by Ward badges */}
            <div className="border-t border-slate-800 pt-2.5 space-y-1.5">
              <span className="text-[9px] text-slate-400 font-bold block uppercase">งบแยกตามวอร์ด/แผนก (Ward Share)</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(budgetByWard).map(([wName, wBudget]) => {
                  if (wBudget === 0) return null;
                  return (
                    <span key={wName} className="text-[8px] bg-slate-800 text-indigo-200 border border-slate-750 px-1.5 py-0.5 rounded-full font-medium">
                      {wName.split(' ')[0]}: <b className="font-bold font-mono text-white">{wBudget.toLocaleString()} ฿</b>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2.5 mt-2">
            <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5 font-bold">ยอดเสนอเบิกสุทธิสะสม (Net Total Payroll)</div>
            <div className="text-2xl font-black text-emerald-400 font-mono flex items-baseline justify-between">
              <span>{grandTotalNetEarnings.toLocaleString()} ฿</span>
              <span className="text-[10px] text-slate-400 font-normal">
                (ฐาน {grandTotalBaseEarnings.toLocaleString()} + OT {grandTotalOTPayable.toLocaleString()})
              </span>
            </div>
            <p className="text-[8px] text-slate-500 leading-tight mt-1.5">
              *ข้อมูลการเงินแสดงผลสะสมตามเกณฑ์ Maximized Benefits ข้ามกลุ่มงาน ตึก และประเภทลูกจ้างเพื่อความแม่นยำทางนิติกรรมและบัญชี
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: COMPREHENSIVE AUDIT REPORT AND CLAIMS SHEET */}
      <div className="bg-white rounded-lg border border-slate-200/70 shadow-2xs p-3.5 space-y-3">
        {/* Filter Section Row */}
        <div className="flex flex-col gap-2.5 pb-2.5 border-b border-slate-150">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Clipboard className="w-4 h-4 text-emerald-500" />
                รายงานยอดเบิกค่าจ้างและ OT รายบุคคล (Audit Report Sheet)
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">ตารางตรวจสอบสถิติการปฏิบัติงาน รายงานอัตราฐานและ OT แยกรายบุคคล ข้ามกลุ่มงาน วอร์ด ตึก แผนก และตามสัญญาจ้าง</p>
            </div>

            {/* Print Export Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-extrabold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-250 rounded cursor-pointer transition-all self-start md:self-center"
            >
              <Printer className="w-3.5 h-3.5" />
              พิมพ์รายงานการเงิน (Print/Export)
            </button>
          </div>

          {/* Grid of 5 Filters + Text Search */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60 no-print">
            {/* 1. Search Bar */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">ค้นหาบุคลากร / รหัส</label>
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2" />
                <input 
                  type="text" 
                  placeholder="ค้นหารายชื่อ/รหัส..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-6 pr-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded focus:outline-none"
                />
              </div>
            </div>

            {/* 2. Ward Selector */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">กลุ่มงาน / วอร์ด</label>
              <select
                value={selectedWardFilter}
                onChange={(e) => setSelectedWardFilter(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700"
              >
                <option value="all">แสดงทั้งหมดทุกวอร์ด ({effectiveWards.length})</option>
                {effectiveWards.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* 3. Building Selector */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">อาคาร / ตึกโรงพยาบาล</label>
              <select
                value={selectedBuildingFilter}
                onChange={(e) => setSelectedBuildingFilter(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700"
              >
                <option value="all">แสดงทั้งหมดทุกตึก</option>
                {buildingsList.map(bName => (
                  <option key={bName} value={bName}>{bName}</option>
                ))}
              </select>
            </div>

            {/* 4. Role Category / Position Selector */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">ตำแหน่ง / สายงานหลัก</label>
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value as any)}
                className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700"
              >
                <option value="all">แสดงทุกตำแหน่ง</option>
                <option value="doctor">แพทย์ (Doctor)</option>
                <option value="nurse">พยาบาลวิชาชีพ (RN)</option>
                <option value="assistant">ผู้ช่วยพยาบาล (PN/NA)</option>
                <option value="room">ห้องผ่าตัด (Operating Room)</option>
              </select>
            </div>

            {/* 5. Employee Contract Type Selector */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">ประเภทสัญญา / ลูกจ้าง</label>
              <select
                value={selectedEmpTypeFilter}
                onChange={(e) => setSelectedEmpTypeFilter(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700"
              >
                <option value="all">แสดงทุกประเภทลูกจ้าง</option>
                <option value="ข้าราชการ">ข้าราชการ</option>
                <option value="พนักงานกระทรวง">พนักงานกระทรวง</option>
                <option value="พนักงานราชการ">พนักงานราชการ</option>
                <option value="ลูกจ้างประจำ">ลูกจ้างประจำ</option>
                <option value="ลูกจ้างชั่วคราว (รายวัน)">ลูกจ้างชั่วคราว (รายวัน)</option>
                <option value="ลูกจ้างชั่วคราว (รายคาบ)">ลูกจ้างชั่วคราว (รายคาบ)</option>
              </select>
            </div>

            {/* 6. Payment Type Selector */}
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5">รูปแบบค่าจ้าง / การเบิก</label>
              <select
                value={selectedPaymentFilter}
                onChange={(e) => setSelectedPaymentFilter(e.target.value)}
                className="w-full px-1.5 py-1 text-[10px] bg-white border border-slate-300 rounded font-bold text-slate-700"
              >
                <option value="all">แสดงรูปแบบจ่ายทั้งหมด</option>
                <option value="รายเดือน">รับรายเดือน (Monthly)</option>
                <option value="รายวัน">รับรายวัน (Daily Wage)</option>
                <option value="รายคาบ">รับรายคาบ (Periodic)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Claims Table Sheet */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-900 text-white font-bold uppercase text-[9px] tracking-wider border-b border-slate-850">
                <th className="py-2.5 px-2 text-center w-8">ที่</th>
                <th className="py-2.5 px-2 w-28">กลุ่มงาน/ตึก</th>
                <th className="py-2.5 px-2 w-36">ชื่อเจ้าหน้าที่ / รหัส</th>
                <th className="py-2.5 px-2 w-24">ประเภทสัญญา / รูปแบบ</th>
                <th className="py-2.5 px-1 text-center font-mono w-10">ช</th>
                <th className="py-2.5 px-1 text-center font-mono w-10">บ</th>
                <th className="py-2.5 px-1 text-center font-mono w-10">ด</th>
                <th className="py-2.5 px-1 text-center font-mono w-10">OR</th>
                <th className="py-2.5 px-1 text-center font-mono w-10">BD</th>
                <th className="py-2.5 px-1 text-center bg-slate-800 text-slate-300 w-12 font-mono">กะรวม</th>
                <th className="py-2.5 px-2 text-right bg-indigo-950 text-indigo-200 font-bold w-20">ค่าจ้างปกติ</th>
                <th className="py-2.5 px-2 text-center bg-rose-950 text-rose-200 font-extrabold w-12 font-mono">กะ OT</th>
                <th className="py-2.5 px-2 text-right bg-rose-950 text-rose-200 font-bold w-20">ค่าตอบแทน OT</th>
                <th className="py-2.5 px-2 text-right bg-emerald-950 text-emerald-200 font-black w-24">ยอดเบิกสุทธิ</th>
              </tr>
            </thead>
            <tbody>
              {financeRows.length > 0 ? (
                financeRows.map((row, idx) => {
                  const p = row.personnel;
                  const isCustom = !!p.customRates && Object.keys(p.customRates).length > 0;
                  return (
                    <tr key={`${p.id}-${p.wardId}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-2 text-center text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="font-extrabold text-slate-700 truncate max-w-[100px]" title={row.wardName}>
                          {row.wardName.split(' ')[0]}
                        </div>
                        <div className="text-[8px] text-slate-400 truncate max-w-[100px] font-medium" title={row.building}>
                          {row.building}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="font-extrabold text-slate-800 truncate max-w-[130px] flex items-center gap-1" title={p.name}>
                          {p.name}
                          {isCustom && (
                            <span className="text-[7px] bg-sati-azure/5 text-sati-azure px-1 rounded-sm border border-sati-azure/10 font-bold" title="ใช้อัตราเฉพาะตัว">
                              RATE⭐
                            </span>
                          )}
                        </div>
                        <div className="text-[8px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono font-medium">{p.id}</span>
                          <span className="bg-slate-100 text-slate-600 px-1 rounded-sm text-[8px] font-bold scale-90">{p.position}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-600">{row.employeeType}</div>
                        <div className="text-[8px] text-slate-400 font-medium">
                          {row.paymentMode} ({row.baseWageRate > 0 ? `${row.baseWageRate.toLocaleString()}/ครั้ง` : 'ไม่มีฐานค้าง'})
                        </div>
                      </td>
                      <td className="py-2 px-1 text-center font-mono text-slate-600">{row.stats.ช || '-'}</td>
                      <td className="py-2 px-1 text-center font-mono text-slate-600">{row.stats.บ || '-'}</td>
                      <td className="py-2 px-1 text-center font-mono text-slate-600">{row.stats.ด || '-'}</td>
                      <td className="py-2 px-1 text-center font-mono text-slate-600">{row.stats.OR || '-'}</td>
                      <td className="py-2 px-1 text-center font-mono text-slate-600">{row.stats.BD || '-'}</td>
                      
                      {/* Total Shifts */}
                      <td className="py-2 px-1 text-center font-bold text-slate-700 bg-slate-50 font-mono">
                        {row.totalShifts}
                      </td>

                      {/* Regular Base Earnings (Daily / Monthly) */}
                      <td className="py-2 px-2 text-right font-semibold text-slate-600 font-mono">
                        {row.baseEarnings > 0 ? `${row.baseEarnings.toLocaleString()} ฿` : '-'}
                      </td>

                      {/* OT Shifts */}
                      <td className="py-2 px-2 text-center font-extrabold text-rose-700 bg-rose-50/20 font-mono">
                        <div>{row.otCount || '-'}</div>
                        {row.otCount > 0 && (
                          <div
                            className={`text-[7px] font-bold px-1 rounded-sm mt-0.5 inline-block ${
                              row.hasExplicitOT
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                            title={row.hasExplicitOT
                              ? 'นับจากรหัสเวร OT จริงในตาราง (ชot/บot/ดot/BD)'
                              : 'ประเมินจากเกณฑ์เวรเกิน (ยังไม่ได้ระบุรหัส OT ในตาราง)'}
                          >
                            {row.hasExplicitOT ? 'ตรงเวร' : 'ประเมิน'}
                          </div>
                        )}
                      </td>

                      {/* OT Earnings */}
                      <td className="py-2 px-2 text-right font-extrabold text-rose-700 bg-rose-50/20 font-mono">
                        {row.otPayable > 0 ? `${row.otPayable.toLocaleString()} ฿` : '-'}
                      </td>

                      {/* Total Payout */}
                      <td className="py-2 px-2 text-right font-black text-emerald-800 bg-emerald-50/40 font-mono">
                        {row.netEarnings.toLocaleString()} ฿
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-slate-400 font-semibold bg-slate-50">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto mb-1 opacity-60" />
                    ไม่พบข้อมูลประวัติและงบประมาณการเบิกจ่ายตามตัวเลือกการกรองที่ระบุ
                  </td>
                </tr>
              )}

              {/* Grand Cumulative Total Row */}
              <tr className="bg-slate-900 text-white font-extrabold text-[10px] tracking-wider border-t-2 border-slate-800">
                <td colSpan={3} className="py-3 px-3 text-right uppercase">ยอดรวมเบิกจ่ายสุทธิ (GRAND TOTAL):</td>
                <td colSpan={6}></td>
                
                {/* Total Shifts */}
                <td className="py-3 px-1 text-center font-mono text-slate-200 bg-slate-800">
                  {grandTotalShifts}
                </td>

                {/* Base Earnings Total */}
                <td className="py-3 px-2 text-right font-mono text-indigo-300">
                  {grandTotalBaseEarnings > 0 ? `${grandTotalBaseEarnings.toLocaleString()} ฿` : '-'}
                </td>

                {/* Total OT Shifts */}
                <td className="py-3 px-2 text-center font-mono text-rose-300 bg-rose-950/40">
                  {grandTotalOTCount}
                </td>

                {/* OT Earnings Total */}
                <td className="py-3 px-2 text-right font-mono text-rose-300 bg-rose-950/40">
                  {grandTotalOTPayable > 0 ? `${grandTotalOTPayable.toLocaleString()} ฿` : '-'}
                </td>

                {/* Combined Total */}
                <td className="py-3 px-2 text-right font-black text-emerald-300 bg-emerald-950/60 font-mono text-xs">
                  {grandTotalNetEarnings.toLocaleString()} ฿
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Audit Methodology Card */}
        <div className="flex items-start gap-2.5 bg-sati-azure/5 border border-sati-azure/10 text-sati-ink p-4 rounded-xl text-[10px] leading-relaxed premium-card">
          <Info className="w-4 h-4 mt-0.5 text-sati-azure flex-shrink-0 animate-pulse" />
          <div className="space-y-1">
            <b className="font-extrabold uppercase tracking-wider text-sati-space block font-display text-[11px]">ระเบียบวิธีการตรวจสอบและคำนวณบัญชีเวรโรงพยาบาล (Hospital Audit & Maximized Benefits Method):</b>
            <ul className="list-disc pl-4 space-y-1 text-sati-slate font-medium">
              <li>
                <span className="font-extrabold text-slate-800">ขอบเขตงานสะสม:</span> การกรองและคัดแยกงบแยกตามตึก, วอร์ด, ประเภทลูกจ้าง และสายงาน ทำงานด้วยโมเดลแบบรวมศูนย์ (Unified Model) ที่เชื่อมต่อตารางเวรและการตั้งค่าอัตราจ้างของทุกกลุ่มงานในระบบ
              </li>
              <li>
                <span className="font-extrabold text-slate-800">ลูกจ้างรับรายวัน (Part-time / Temporary Daily):</span> สำหรับบุคลากรที่มีสัญญาประเภท รายวัน ระบบจะนับเวรทำงานปกติจนครบเกณฑ์ (Threshold) แล้วคูณด้วยอัตราค่าจ้างรายวันปกติ และส่วนเวรงานที่เกินจากเกณฑ์จะได้รับการคำนวณเบิกด้วยอัตราโอที (OT Shift Rate) เสมือนปกติเพื่อผลประโยชน์สูงสุด
              </li>
              <li>
                <span className="font-extrabold text-slate-800">เกณฑ์การคำนวณแบบจำกัดเพดานความปลอดภัย:</span> การคำนวณสิทธิ์ประหยัดสูงสุดจะนำเงินที่มีอัตราราคาจ้างกะที่ทำงานได้สูงสุด (เช่น เวรผ่าตัด OR หรือเวรดึก ด) มาเบิกเป็นกะโอทีสะสมก่อนกะที่มีราคาจ้างต่ำ (Maximized Benefits)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
