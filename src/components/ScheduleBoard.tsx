import React, { useState } from 'react';
import { 
  Lock, Unlock, Sparkles, Trash2, Calendar, Shield, Users, Layers, Filter, HelpCircle
} from 'lucide-react';
import { Personnel, ShiftType } from '../types';
import { SHIFT_TYPES, THAI_DAYS_SHORT, THAI_HOLIDAYS_2026 } from '../data';

interface ScheduleBoardProps {
  personnel: Personnel[];
  schedule: Record<string, string>;
  onUpdateSchedule: (key: string, value: string | null) => void;
  pinnedShifts: Record<string, boolean>;
  onTogglePin: (key: string) => void;
  year: number;
  month: number;
  daysCount: number;
  onAutoSchedule: () => void;
  onClearSchedule: () => void;
}

export default function ScheduleBoard({
  personnel,
  schedule,
  onUpdateSchedule,
  pinnedShifts,
  onTogglePin,
  year,
  month,
  daysCount,
  onAutoSchedule,
  onClearSchedule
}: ScheduleBoardProps) {
  const [activeRoleFilter, setActiveRoleFilter] = useState<'all' | 'doctor' | 'nurse' | 'assistant' | 'room'>('all');
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>('ช');
  const [isPinMode, setIsPinMode] = useState<boolean>(false);

  // Helper to determine day of week
  const getDayOfWeek = (day: number) => {
    // Gregorian calendar date for calculation (BE to CE)
    const date = new Date(year - 543, month - 1, day);
    return date.getDay(); // 0 = Sun, 1 = Mon, ...
  };

  const getHolidayName = (day: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month).padStart(2, '0');
    const key = `${formattedMonth}-${formattedDay}`;
    return THAI_HOLIDAYS_2026[key] || null;
  };

  // Filter personnel based on selected role tab
  const filteredPersonnel = personnel
    .filter(p => p.active)
    .filter(p => activeRoleFilter === 'all' || p.role === activeRoleFilter)
    .sort((a, b) => a.order - b.order);

  // Click handler for table cells
  const handleCellClick = (pId: string, day: number) => {
    const key = `${pId}-${day}`;
    
    if (isPinMode) {
      onTogglePin(key);
    } else {
      // If cell is pinned, prevent accidental change
      if (pinnedShifts[key]) {
        alert('เวรนี้ถูกล็อกไว้แล้ว กรุณาปลดล็อก (เปิดโหมดล็อก) ก่อนทำการแก้ไข');
        return;
      }
      
      const currentVal = schedule[key];
      if (currentVal === selectedShiftCode) {
        // Toggle/erase if clicking the same shift again
        onUpdateSchedule(key, null);
      } else {
        onUpdateSchedule(key, selectedShiftCode === 'CLEAR' ? null : selectedShiftCode);
      }
    }
  };

  // Label names for roles
  const roleColors: Record<string, string> = {
    doctor: 'bg-amber-100 text-amber-900 border-amber-200',
    nurse: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    assistant: 'bg-sky-100 text-sky-900 border-sky-200',
    room: 'bg-purple-100 text-purple-900 border-purple-200',
  };

  const roleText: Record<string, string> = {
    doctor: 'แพทย์',
    nurse: 'พยาบาล',
    assistant: 'ผู้ช่วยพยาบาล',
    room: 'ห้องผ่าตัด',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/70 shadow-2xs p-3.5 space-y-4">
      {/* Upper Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Role Tabs */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveRoleFilter('all')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              activeRoleFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ทั้งหมด ({personnel.filter(p => p.active).length})
          </button>
          <button
            onClick={() => setActiveRoleFilter('doctor')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              activeRoleFilter === 'doctor'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🩺 แพทย์ ({personnel.filter(p => p.active && p.role === 'doctor').length})
          </button>
          <button
            onClick={() => setActiveRoleFilter('nurse')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              activeRoleFilter === 'nurse'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            👩‍⚕️ พยาบาล ({personnel.filter(p => p.active && p.role === 'nurse').length})
          </button>
          <button
            onClick={() => setActiveRoleFilter('assistant')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              activeRoleFilter === 'assistant'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🤝 ผู้ช่วยพยาบาล ({personnel.filter(p => p.active && p.role === 'assistant').length})
          </button>
          <button
            onClick={() => setActiveRoleFilter('room')}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition-all cursor-pointer ${
              activeRoleFilter === 'room'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            🏢 ห้องผ่าตัด ({personnel.filter(p => p.active && p.role === 'room').length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAutoSchedule}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-extrabold bg-sati-azure text-white hover:bg-sati-azure/90 shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            จัดเวรอัตโนมัติ (AI Smart)
          </button>
          <button
            onClick={onClearSchedule}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-100 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            ล้างตารางเวร
          </button>
        </div>
      </div>

      {/* Float Shift Selector / Palette */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-600 mr-1.5">จานสีเวร (Shift Palette):</span>
          {SHIFT_TYPES.map(shift => (
            <button
              key={shift.code}
              onClick={() => {
                setSelectedShiftCode(shift.code);
                setIsPinMode(false);
              }}
              className={`px-2 py-1 rounded text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                selectedShiftCode === shift.code && !isPinMode
                  ? 'ring-2 ring-sati-azure ring-offset-1 scale-102 shadow-xs font-black'
                  : 'hover:bg-white bg-slate-50'
              } ${shift.bgClass} ${shift.textClass} border-slate-200/60`}
              title={shift.name}
            >
              <span className="text-[9px] w-3.5 h-3.5 rounded-full bg-white/70 flex items-center justify-center font-bold">
                {shift.code}
              </span>
              <span>{shift.code === 'ช' ? 'เช้า' : shift.code === 'บ' ? 'บ่าย' : shift.code === 'ด' ? 'ดึก' : shift.code === 'ชot' ? 'เช้าOT' : shift.code === 'บot' ? 'บ่ายOT' : shift.code === 'ดot' ? 'ดึกOT' : shift.code === 'OR' ? 'ผ่าตัด' : shift.code === 'BD' ? 'บ่ายดึก' : shift.code === 'O' ? 'OFF' : shift.code === 'V' ? 'ลาพัก' : 'อบรม'}</span>
            </button>
          ))}
          <button
            onClick={() => {
              setSelectedShiftCode('CLEAR');
              setIsPinMode(false);
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-bold bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 cursor-pointer ${
              selectedShiftCode === 'CLEAR' && !isPinMode ? 'ring-2 ring-rose-500 ring-offset-1' : ''
            }`}
          >
            🧹 ลบเวร
          </button>
        </div>

        {/* Lock/Pin Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPinMode(!isPinMode)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              isPinMode
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200/60 hover:bg-slate-50'
            }`}
            title="ล็อกเวรเพื่อป้องกันไม่ให้ถูกทับเวลาใช้ระบจัดเวรอัตโนมัติ"
          >
            {isPinMode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            ล็อกเวร (Pin) {isPinMode ? 'เปิด' : 'ปิด'}
          </button>
          <div className="text-[9px] text-slate-400 font-medium">
            {isPinMode ? '*จิ้มช่องเพื่อล็อค' : '*จิ้มช่องเพื่อใส่เวร'}
          </div>
        </div>
      </div>

      {/* Calendar Grid Table */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-lg shadow-2xs">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px]">
              <th className="py-2.5 px-3 sticky left-0 z-10 bg-slate-900 border-r border-slate-800 w-28 font-bold">บุคลากร/ห้อง</th>
              <th className="py-2.5 px-2 w-24 border-r border-slate-800 font-bold">ตำแหน่ง</th>
              {Array.from({ length: daysCount }, (_, idx) => {
                const day = idx + 1;
                const dow = getDayOfWeek(day);
                const isWE = dow === 0 || dow === 6;
                const hName = getHolidayName(day);
                const isHoliday = hName !== null;

                return (
                  <th 
                    key={day}
                    className={`py-1.5 text-center border-r border-slate-800 text-[10px] font-extrabold min-w-[32px] relative ${
                      isHoliday 
                        ? 'bg-rose-700 text-white font-black' 
                        : isWE 
                          ? 'bg-slate-850 text-rose-300 font-black' 
                          : 'bg-slate-900 text-slate-300'
                    }`}
                    title={hName || undefined}
                  >
                    <div className="font-mono">{day}</div>
                    <div className="opacity-80 text-[8px] font-normal">{THAI_DAYS_SHORT[dow]}</div>
                    {isHoliday && <span className="absolute top-0.5 right-0.5 text-[6px] text-yellow-300">★</span>}
                  </th>
                );
              })}
              <th className="py-2.5 px-1.5 text-center text-[10px] w-10 border-l border-slate-800 font-bold">เวร</th>
              <th className="py-2.5 px-1.5 text-center text-[10px] w-10 font-bold">หยุด</th>
            </tr>
          </thead>
          <tbody>
            {filteredPersonnel.length > 0 ? (
              filteredPersonnel.map((p) => {
                let workedShifts = 0;
                let leaveShifts = 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-100 text-[11px]">
                    {/* Sticky Name Col */}
                    <td className="py-2 px-3 font-bold text-slate-800 sticky left-0 z-10 bg-white border-r border-slate-100 shadow-[2px_0_4px_rgba(0,0,0,0.015)]">
                      <div className="truncate max-w-[110px]" title={p.name}>{p.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono font-medium">{p.id}</div>
                    </td>

                    {/* Role badge */}
                    <td className="py-2 px-2 border-r border-slate-100">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${roleColors[p.role]}`}>
                        {p.position}
                      </span>
                    </td>

                    {/* 31 days cells */}
                    {Array.from({ length: daysCount }, (_, idx) => {
                      const day = idx + 1;
                      const cellKey = `${p.id}-${day}`;
                      const shift = schedule[cellKey];
                      const pinned = pinnedShifts[cellKey];

                      if (shift) {
                        if (shift === 'O' || shift === 'V' || shift === 'T') {
                          leaveShifts++;
                        } else {
                          workedShifts++;
                        }
                      }

                      // Determine shift visual configuration
                      const matchedShift = SHIFT_TYPES.find(s => s.code === shift);
                      const bgClass = matchedShift ? matchedShift.bgClass : 'bg-transparent text-slate-300';
                      const textClass = matchedShift ? matchedShift.textClass : 'text-slate-300';

                      return (
                        <td 
                          key={day}
                          onClick={() => handleCellClick(p.id, day)}
                          className={`p-0.5 text-center border-r border-slate-100 transition-all cursor-pointer hover:bg-slate-100/80 ${
                            pinned ? 'bg-rose-50/70' : ''
                          }`}
                        >
                          <div className={`w-6 h-6 mx-auto rounded-sm font-extrabold flex flex-col items-center justify-center text-[10px] relative ${bgClass} ${textClass}`}>
                            {shift || '·'}
                            {pinned && (
                              <span className="absolute bottom-0 right-0 text-[6px] bg-rose-500 text-white rounded-full p-0.5" title="ล็อกไว้">
                                <Lock className="w-1.5 h-1.5" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Summary columns */}
                    <td className="py-2 px-1 text-center font-bold text-slate-800 border-l border-slate-100 bg-slate-50/60 font-mono">
                      {workedShifts}
                    </td>
                    <td className="py-2 px-1 text-center text-slate-500 bg-slate-50/60 font-mono">
                      {leaveShifts}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={daysCount + 4} className="py-10 text-center text-slate-400">
                  <Users className="w-6 h-6 mx-auto mb-1 opacity-40" />
                  <span className="text-[11px]">ไม่พบข้อมูลบุคลากรในตารางปฏิบัติการ</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom info section */}
      <div className="flex flex-col md:flex-row gap-3 text-[10px] text-slate-500 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-1 flex-shrink-0">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-bold text-slate-700">คำอธิบายสัญลักษณ์กะเวร:</span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span><b>ช</b> = เวรเช้า (8 ชม.)</span>
          <span><b>บ</b> = เวรบ่าย (8 ชม.)</span>
          <span><b>ด</b> = เวรดึก (8 ชม.)</span>
          <span><b>OR</b> = เวรห้องผ่าตัด (8 ชม.)</span>
          <span><b>BD</b> = เวรเสริม (4 ชม.)</span>
          <span><b>O</b> = OFF ประจำสัปดาห์</span>
          <span><b>V</b> = ลาพักร้อน</span>
          <span><b>T</b> = ประชุม/อบรม</span>
        </div>
      </div>
    </div>
  );
}
