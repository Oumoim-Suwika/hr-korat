import React, { useState } from 'react';
import { 
  Shield, HelpCircle, Save, Plus, Trash2, Clock, Check, AlertTriangle, RefreshCw
} from 'lucide-react';
import { PolicySettings, ShiftType } from '../types';

interface RulesSettingsViewProps {
  policies: PolicySettings;
  onUpdatePolicies: (newPolicies: PolicySettings) => void;
  shiftTypes: ShiftType[];
  onUpdateShiftTypes: (newShifts: ShiftType[]) => void;
  onResetToDefaults: () => void;
}

export default function RulesSettingsView({
  policies,
  onUpdatePolicies,
  shiftTypes,
  onUpdateShiftTypes,
  onResetToDefaults
}: RulesSettingsViewProps) {
  const [allowAfternoonToNight, setAllowAfternoonToNight] = useState(policies.allowAfternoonToNight);
  const [banNightAfterOff, setBanNightAfterOff] = useState(policies.banNightAfterOff);
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState(policies.maxHoursPerWeek);
  const [requireMinStaff, setRequireMinStaff] = useState(policies.requireMinStaff);

  // For adding custom shift types
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newHours, setNewHours] = useState(8);
  const [newStartHour, setNewStartHour] = useState(8);
  const [newEndHour, setNewEndHour] = useState(16);
  const [newBgColor, setNewBgColor] = useState('bg-teal-100');
  const [newTextColor, setNewTextColor] = useState('text-teal-800');

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePolicies({
      allowAfternoonToNight,
      banNightAfterOff,
      maxHoursPerWeek: Number(maxHoursPerWeek),
      requireMinStaff
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) {
      alert('กรุณากรอกรหัสย่อและชื่อเวรให้ครบถ้วน');
      return;
    }

    if (shiftTypes.some(s => s.code.toUpperCase() === newCode.toUpperCase())) {
      alert('มีรหัสเวรนี้อยู่ในระบบแล้ว');
      return;
    }

    const newShift: ShiftType = {
      code: newCode.toUpperCase(),
      name: `${newName} (${String(newStartHour).padStart(2, '0')}:00 - ${String(newEndHour).padStart(2, '0')}:00)`,
      hours: Number(newHours),
      bgClass: newBgColor,
      textClass: newTextColor,
      startHour: Number(newStartHour),
      endHour: Number(newEndHour)
    };

    onUpdateShiftTypes([...shiftTypes, newShift]);
    
    // Reset form
    setNewCode('');
    setNewName('');
    setNewHours(8);
    setNewStartHour(8);
    setNewEndHour(16);
    setShowAddForm(false);
  };

  const handleDeleteShift = (code: string) => {
    if (['ช', 'บ', 'ด', 'O'].includes(code)) {
      alert('ไม่สามารถลบกะหลัก (เช้า/บ่าย/ดึก/OFF) ได้');
      return;
    }
    if (confirm(`คุณต้องการลบรหัสเวร "${code}" หรือไม่?`)) {
      onUpdateShiftTypes(shiftTypes.filter(s => s.code !== code));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0b0f19] via-[#111827] to-[#1e1b4b] text-white p-6 rounded-2xl border border-[#1f293d] shadow-lg shadow-indigo-950/10">
        <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2.5 font-display text-gold-100">
          <div className="p-1.5 bg-gradient-to-br from-gold-600 to-amber-700 rounded-lg border border-gold-400/40 text-white shadow-md shadow-gold-500/10">
            <Shield className="w-5 h-5 text-gold-100" />
          </div>
          <span>ระบบตั้งค่ากฎความปลอดภัยการขึ้นเวร & กำหนดเวลาปฏิบัติการ</span>
        </h2>
        <p className="text-slate-300 text-xs mt-2.5 leading-relaxed max-w-3xl font-medium">
          กำหนดเงื่อนไขความถูกต้องของตารางเวร, ชาร์ตการทำงาน, และการป้องกันข้อผิดพลาดทางตารางเวลา (เช่น กะเวรซ้ำซ้อนกันแม้คนละอาคาร, การขึ้นเวรต่อกันจนเป็นอันตรายแก่คนไข้) ระบบจัดเวรอัตโนมัติจะตรวจสอบกฎเหล่านี้ทุกครั้งก่อนทำงาน
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Rules Card */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-5 premium-card">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest font-display">
              1. กฎและเงื่อนไขความปลอดภัย (Safety Policies)
            </h3>
          </div>

          <form onSubmit={handleSavePolicies} className="space-y-4">
            <div className="space-y-3">
              {/* Rule 1 */}
              <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/50 hover:bg-slate-50/80 transition-all">
                <div className="space-y-0.5 max-w-[80%]">
                  <label className="text-xs font-bold text-slate-800 block cursor-pointer" htmlFor="allowAfternoonToNight">
                    ห้ามขึ้นเวร บ่าย (บ) ต่อด้วยเวร ดึก (ด) ในวันเดียวกันหรือวันถัดไปทันที
                  </label>
                  <span className="text-[10px] text-slate-400 leading-normal block">
                    เพื่อความปลอดภัยของผู้ป่วยตามมาตรฐานสากล แพทย์/พยาบาลต้องการเวลาพักผ่อนขั้นต่ำ 12 ชั่วโมงติดต่อกัน
                  </span>
                </div>
                <div className="pt-1">
                  <input
                    id="allowAfternoonToNight"
                    type="checkbox"
                    checked={!allowAfternoonToNight}
                    onChange={(e) => setAllowAfternoonToNight(!e.target.checked)}
                    className="w-4 h-4 text-sati-azure border-slate-300 rounded focus:ring-sati-azure cursor-pointer"
                  />
                </div>
              </div>

              {/* Rule 2 */}
              <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/50 hover:bg-slate-50/80 transition-all">
                <div className="space-y-0.5 max-w-[80%]">
                  <label className="text-xs font-bold text-slate-800 block cursor-pointer" htmlFor="banNightAfterOff">
                    ไม่อนุมัติกะ ดึก (ด) ทันทีในวันแรกหลังจากหยุดพักร้อน/หยุดยาว (OFF)
                  </label>
                  <span className="text-[10px] text-slate-400 leading-normal block">
                    ส่งเสริมการปรับตัวของนาฬิกาชีวิต (Circadian Rhythm) โดยควรเริ่มปฏิบัติงานด้วยเวรเช้าหรือเวรบ่ายก่อน
                  </span>
                </div>
                <div className="pt-1">
                  <input
                    id="banNightAfterOff"
                    type="checkbox"
                    checked={banNightAfterOff}
                    onChange={(e) => setBanNightAfterOff(e.target.checked)}
                    className="w-4 h-4 text-sati-azure border-slate-300 rounded focus:ring-sati-azure cursor-pointer"
                  />
                </div>
              </div>

              {/* Rule 3 */}
              <div className="flex items-start justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/50 hover:bg-slate-50/80 transition-all">
                <div className="space-y-0.5 max-w-[80%]">
                  <label className="text-xs font-bold text-slate-800 block cursor-pointer" htmlFor="requireMinStaff">
                    บังคับอัตรากำลังขั้นต่ำตามเกณฑ์ภาระงานของวอร์ด (Minimum Staffing Coverage)
                  </label>
                  <span className="text-[10px] text-slate-400 leading-normal block">
                    ต้องมีพยาบาลวิชาชีพอย่างน้อย 2 คนในเวรเช้า และอย่างน้อย 1 คนในเวรบ่าย/ดึก เพื่อไม่ให้เกิดภาวะขาดแคลนกำลังพล
                  </span>
                </div>
                <div className="pt-1">
                  <input
                    id="requireMinStaff"
                    type="checkbox"
                    checked={requireMinStaff}
                    onChange={(e) => setRequireMinStaff(e.target.checked)}
                    className="w-4 h-4 text-sati-azure border-slate-300 rounded focus:ring-sati-azure cursor-pointer"
                  />
                </div>
              </div>

              {/* Rule 4 */}
              <div className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/50 hover:bg-slate-50/80 transition-all gap-2">
                <div className="space-y-0.5 max-w-[80%]">
                  <label className="text-xs font-bold text-slate-800 block">
                    กำหนดชั่วโมงการทำงานรวมสูงสุดต่อสัปดาห์ (Max Weekly Hours Limit)
                  </label>
                  <span className="text-[10px] text-slate-400 leading-normal block">
                    ชั่วโมงทำงานรวมรวมโอทีและกะปกติ ไม่ควรเกินค่าที่กำหนดเพื่อป้องกันภาวะหมดไฟ (Burnout Syndrome)
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={24}
                      max={84}
                      value={maxHoursPerWeek}
                      onChange={(e) => setMaxHoursPerWeek(Number(e.target.value))}
                      className="w-16 bg-white border border-slate-200 text-slate-800 text-xs font-bold p-1 rounded text-center focus:ring-1 focus:ring-sati-azure focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">ชม. / สัปดาห์</span>
                  </div>
                </div>
              </div>

              {/* Rule 5 - Overlap Info */}
              <div className="p-3 rounded-lg bg-sati-azure/5 border border-sati-azure/10 flex gap-2">
                <AlertTriangle className="w-4 h-4 text-sati-azure flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-sati-space block font-display">กฎเหล็กการตรวจความซ้ำซ้อนทับเวลา (Time-Overlap Check)</span>
                  <span className="text-[10px] text-sati-slate leading-normal block">
                    <b>ทำงานอัตโนมัติ:</b> ระบบจะไม่อนุญาตให้บุคลากรคนเดียวกันปฏิบัติงานซ้ำซ้อนในกะเวรที่เวลาเริ่มและสิ้นสุดคาบเกี่ยวกัน ทั้งในวอร์ดเดียวกันและ <b>ต่างวอร์ด/ต่างอาคาร</b> หากตรวจพบเวรชนกัน ระบบจะแสดงป้ายแจ้งเตือนความขัดแย้งสีแดงทันที
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onResetToDefaults}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                รีเซ็ตค่าเริ่มต้นของโรงพยาบาล
              </button>

              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveSuccess ? 'บันทึกกฎเวรสำเร็จ!' : 'บันทึกการตั้งค่ากฎ'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Custom Shifts Card */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              2. รหัสกะปฏิบัติการ & ช่วงเวลา (Shift Codes & Times)
            </h3>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-sati-azure/5 text-sati-azure border border-sati-azure/10 hover:bg-sati-azure/10 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{showAddForm ? 'ปิด' : 'เพิ่มเวรเสริม/พิเศษ'}</span>
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddShift} className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3 animate-fadeIn">
              <span className="text-[11px] font-bold text-slate-700 block">เพิ่มกะเวรใหม่ (Custom / Extra Shift)</span>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">รหัสย่อ (เช่น BD, ER)</label>
                  <input
                    type="text"
                    maxLength={3}
                    placeholder="รหัสย่อ"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs font-bold focus:ring-1 focus:ring-sati-azure focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">ชื่อเรียกเวร</label>
                  <input
                    type="text"
                    placeholder="เช่น เวรเสริมฉุกเฉิน"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:ring-1 focus:ring-sati-azure focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">จำนวน ชร.</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={newHours}
                    onChange={(e) => setNewHours(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">เวลาเริ่ม (น.)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={newStartHour}
                    onChange={(e) => setNewStartHour(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">เวลาสิ้นสุด (น.)</label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={newEndHour}
                    onChange={(e) => setNewEndHour(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-center focus:outline-none"
                  />
                </div>
              </div>

              {/* Color presets selection */}
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">สีสัญลักษณ์แบล็คกราวด์:</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { bg: 'bg-emerald-100', text: 'text-emerald-800' },
                    { bg: 'bg-rose-100', text: 'text-rose-800' },
                    { bg: 'bg-teal-100', text: 'text-teal-800' },
                    { bg: 'bg-amber-100', text: 'text-amber-800' },
                    { bg: 'bg-sky-100', text: 'text-sky-800' },
                    { bg: 'bg-indigo-100', text: 'text-indigo-800' },
                    { bg: 'bg-purple-100', text: 'text-purple-800' },
                    { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800' },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewBgColor(preset.bg);
                        setNewTextColor(preset.text);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${preset.bg} ${preset.text} ${
                        newBgColor === preset.bg ? 'ring-2 ring-sati-azure' : 'border-slate-200'
                      }`}
                    >
                      ตัวอย่าง
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1.5 rounded text-[10px] text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 font-bold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded text-[10px] text-white bg-sati-azure hover:bg-sati-azure/90 font-bold shadow-xs"
                >
                  ยืนยันบันทึกกะเวร
                </button>
              </div>
            </form>
          )}

          {/* List of active shifts */}
          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
            {shiftTypes.map(shift => {
              const isDefault = ['ช', 'บ', 'ด', 'O', 'V', 'T'].includes(shift.code);
              return (
                <div 
                  key={shift.code}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-6 rounded font-black text-center flex items-center justify-center border border-slate-200/50 ${shift.bgClass} ${shift.textClass}`}>
                      {shift.code}
                    </span>
                    <div>
                      <span className="font-bold text-slate-800 block">{shift.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium font-mono">
                        เวลาทำงาน: {shift.hours} ชม. ({String(shift.startHour).padStart(2, '0')}:00 - {String(shift.endHour).padStart(2, '0')}:00)
                      </span>
                    </div>
                  </div>

                  <div>
                    {isDefault ? (
                      <span className="text-[9px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-100">
                        กะตั้งต้นระบบ
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeleteShift(shift.code)}
                        className="p-1 rounded text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                        title="ลบรหัสกะนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
