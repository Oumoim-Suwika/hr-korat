import React, { useState } from 'react';
import { 
  UserPlus, Edit2, Trash2, CheckCircle2, XCircle, Search, HelpCircle, Layers, Star
} from 'lucide-react';
import { Personnel, Role, StaffLine, EmployeeType, PaymentType } from '../types';
import { REIMBURSEMENT_UNITS, lineForRole } from '../data';

interface PersonnelViewProps {
  personnel: Personnel[];
  onAddPersonnel: (person: Omit<Personnel, 'id' | 'order'>) => void;
  onUpdatePersonnel: (person: Personnel) => void;
  onDeletePersonnel: (id: string) => void;
}

export default function PersonnelView({
  personnel,
  onAddPersonnel,
  onUpdatePersonnel,
  onDeletePersonnel
}: PersonnelViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  
  // Form State for Adding / Editing
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Personnel | null>(null);
  
  // Fields State
  const [name, setName] = useState<string>('');
  const [role, setRole] = useState<Role>('nurse');
  const [position, setPosition] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);
  
  // Custom Employment Fields
  const [employeeType, setEmployeeType] = useState<EmployeeType>('ข้าราชการ');
  const [paymentType, setPaymentType] = useState<PaymentType>('รายเดือน');
  const [baseWage, setBaseWage] = useState<number>(0);
  const [line, setLine] = useState<StaffLine>('พยาบาล');

  const resetForm = () => {
    setName('');
    setRole('nurse');
    setPosition('');
    setActive(true);
    setEmployeeType('ข้าราชการ');
    setPaymentType('รายเดือน');
    setBaseWage(0);
    setLine('พยาบาล');
    setEditingPerson(null);
    setIsFormOpen(false);
  };

  const handleEditClick = (p: Personnel) => {
    setEditingPerson(p);
    setName(p.name);
    setRole(p.role);
    setPosition(p.position);
    setActive(p.active);
    setEmployeeType(p.employeeType || 'ข้าราชการ');
    setPaymentType(p.paymentType || 'รายเดือน');
    setBaseWage(p.baseWage || 0);
    setLine(p.line || lineForRole(p.role));
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !position.trim()) {
      alert('กรุณากรอกชื่อและตำแหน่งงานให้ครบถ้วน');
      return;
    }

    if (editingPerson) {
      onUpdatePersonnel({
        ...editingPerson,
        name: name.trim(),
        role,
        position: position.trim(),
        active,
        employeeType,
        paymentType,
        baseWage: Number(baseWage) || 0,
        line
      });
    } else {
      onAddPersonnel({
        name: name.trim(),
        role,
        position: position.trim(),
        active,
        employeeType,
        paymentType,
        baseWage: Number(baseWage) || 0,
        line
      });
    }
    resetForm();
  };

  const handleToggleActive = (p: Personnel) => {
    onUpdatePersonnel({
      ...p,
      active: !p.active
    });
  };

  // Filtered List
  const filteredList = personnel
    .filter(p => roleFilter === 'all' || p.role === roleFilter)
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.position.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.order - b.order);

  const roleLabels: Record<Role, string> = {
    doctor: 'แพทย์',
    nurse: 'พยาบาลวิชาชีพ (RN)',
    assistant: 'ผู้ช่วยพยาบาล (PN/NA)',
    room: 'ห้องผ่าตัด (Operating Room)'
  };

  const roleBadges: Record<Role, string> = {
    doctor: 'bg-amber-50 text-amber-800 border-amber-200',
    nurse: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    assistant: 'bg-sky-50 text-sky-800 border-sky-200',
    room: 'bg-purple-50 text-purple-800 border-purple-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">จัดการข้อมูลบุคลากรและห้องผ่าตัด (Directory)</h3>
          <p className="text-[10px] text-slate-400 font-medium">ลงทะเบียน แก้ไข ปรับสถานะ และลบประวัติของแพทย์ พยาบาล ผู้ช่วย และห้องปฏิบัติการ</p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsFormOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-extrabold bg-sati-azure text-white hover:bg-sati-azure/90 shadow-sm transition-all cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          ลงทะเบียนผู้ปฏิบัติงานใหม่
        </button>
      </div>

      {/* Add / Edit Form Modal/Panel */}
      {isFormOpen && (
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg transition-all">
          <h4 className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider font-display">
            <Star className="w-3.5 h-3.5 text-sati-azure fill-sati-azure" />
            {editingPerson ? `แก้ไขข้อมูล: ${editingPerson.name}` : 'ลงทะเบียนผู้ปฏิบัติงานใหม่'}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">ชื่อ-นามสกุล / ชื่อห้องผ่าตัด</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
                  placeholder="เช่น นพ.เกียรติภูมิ ขยันเรียน"
                  required
                />
              </div>

              {/* Role Category */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">ประเภทสายงาน (Category)</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium text-slate-700"
                >
                  <option value="doctor">แพทย์ (Doctor)</option>
                  <option value="nurse">พยาบาลวิชาชีพ (RN)</option>
                  <option value="assistant">ผู้ช่วยพยาบาล (PN/NA)</option>
                  <option value="room">ห้องผ่าตัด (Operating Room)</option>
                </select>
              </div>

              {/* Position Description */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">ตำแหน่ง / หน้าที่รับผิดชอบหลัก</label>
                <input 
                  type="text" 
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
                  placeholder="เช่น ศัลยแพทย์หัวใจ, Scrub, Circulate"
                  required
                />
              </div>

              {/* Active Status Toggle */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">สถานะผู้ปฏิบัติงาน</label>
                <select 
                  value={active ? 'true' : 'false'}
                  onChange={(e) => setActive(e.target.value === 'true')}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium text-slate-700"
                >
                  <option value="true">เปิดการใช้งาน (Active)</option>
                  <option value="false">ปิดการใช้งานชั่วคราว (Inactive)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end pt-1 border-t border-slate-100">
              {/* Employee Type / Contract Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">ประเภทลูกจ้าง / สัญญาการจ้าง</label>
                <select 
                  value={employeeType}
                  onChange={(e) => setEmployeeType(e.target.value as any)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium text-slate-700"
                >
                  <option value="ข้าราชการ">ข้าราชการ (Gov Official)</option>
                  <option value="พนักงานราชการ">พนักงานราชการ (Gov Employee)</option>
                  <option value="ลูกจ้างประจำ">ลูกจ้างประจำ (Permanent Staff)</option>
                  <option value="พนักงานกระทรวง">พนักงานกระทรวงสาธารณสุข (MOPH)</option>
                  <option value="ลูกจ้างชั่วคราว (รายวัน)">ลูกจ้างชั่วคราว (รายวัน / Daily)</option>
                  <option value="ลูกจ้างชั่วคราว (รายคาบ)">ลูกจ้างชั่วคราว (รายคาบ / Periodic)</option>
                </select>
              </div>

              {/* Payment Type */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">รูปแบบการจ่ายค่าตอบแทน</label>
                <select 
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value as any)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium text-slate-700"
                >
                  <option value="รายเดือน">รับรายเดือน (Monthly Salary)</option>
                  <option value="รายวัน">รับรายวัน (Daily Wage)</option>
                  <option value="รายคาบ">รับรายคาบ (Periodic Wage)</option>
                </select>
              </div>

              {/* Reimbursement line (สายงาน / หน่วยเบิก) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">สายงาน / หน่วยเบิก</label>
                <select
                  value={line}
                  onChange={(e) => setLine(e.target.value as StaffLine)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-medium text-slate-700"
                >
                  <option value="แพทย์">สายแพทย์ ({REIMBURSEMENT_UNITS['แพทย์'].prefix})</option>
                  <option value="พยาบาล">สายการพยาบาล ({REIMBURSEMENT_UNITS['พยาบาล'].prefix})</option>
                  <option value="สนับสนุน">สายงานสนับสนุน ({REIMBURSEMENT_UNITS['สนับสนุน'].prefix})</option>
                </select>
              </div>

              {/* Base Wage */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">เงินเดือน / อัตราจ้างพื้นฐาน (บาท)</label>
                <input 
                  type="number" 
                  value={baseWage || ''}
                  onChange={(e) => setBaseWage(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 bg-white rounded focus:outline-none focus:ring-1 focus:ring-sati-azure font-mono"
                  placeholder="เช่น 15000 หรือ 500 ต่อวัน"
                />
              </div>

              {/* Submit / Cancel Actions */}
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="flex-1 py-1.5 rounded text-xs font-bold bg-sati-azure hover:bg-sati-azure/90 text-white shadow-xs transition-all cursor-pointer"
                >
                  {editingPerson ? 'บันทึกแก้ไข' : 'ลงทะเบียน'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filtering Search row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/50">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              roleFilter === 'all'
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ทั้งหมด ({personnel.length})
          </button>
          <button
            onClick={() => setRoleFilter('doctor')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              roleFilter === 'doctor'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            แพทย์
          </button>
          <button
            onClick={() => setRoleFilter('nurse')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              roleFilter === 'nurse'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            พยาบาลวิชาชีพ
          </button>
          <button
            onClick={() => setRoleFilter('assistant')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              roleFilter === 'assistant'
                ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ผู้ช่วยพยาบาล
          </button>
          <button
            onClick={() => setRoleFilter('room')}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
              roleFilter === 'room'
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            ห้องผ่าตัด
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input 
            type="text" 
            placeholder="ค้นหารายชื่อ/ตำแหน่ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-52 pl-8 pr-2 py-1 text-[11px] bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-sati-azure"
          />
        </div>
      </div>

      {/* Personnel Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.length > 0 ? (
          filteredList.map((p) => (
            <div 
              key={p.id} 
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 shadow-xs transition-all bg-white hover:border-gold-300/60 premium-card ${
                !p.active ? 'opacity-65 bg-slate-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-[11.5px] font-black text-slate-900 flex items-center gap-1.5 leading-snug">
                    {p.name}
                    {!p.active && <span className="text-[8px] bg-slate-200 text-slate-600 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">ปิดใช้งาน</span>}
                  </h4>
                  <span className="text-[9px] text-slate-400 font-mono font-bold tracking-tight">รหัสบุคลากร: {p.id}</span>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${roleBadges[p.role]}`}>
                  {roleLabels[p.role].split(' ')[0]}
                </span>
              </div>

              <div className="text-[10px] space-y-1.5 text-slate-500 border-t border-slate-100 pt-3 mt-1">
                <div className="flex items-center gap-1"><span className="font-extrabold text-slate-700">ตำแหน่งงาน:</span> <span className="text-slate-600 font-semibold">{p.position}</span></div>
                {p.role !== 'room' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="bg-slate-50 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200/60 shadow-3xs">
                      {p.employeeType || 'ข้าราชการ'}
                    </span>
                    <span className="bg-sati-azure/5 text-sati-azure text-[9px] font-bold px-2 py-0.5 rounded-md border border-sati-azure/10 shadow-3xs">
                      {p.paymentType || 'รายเดือน'}: {(p.baseWage || 0).toLocaleString()} ฿
                    </span>
                    <span className="bg-sati-space/5 text-sati-space text-[9px] font-bold px-2 py-0.5 rounded-md border border-sati-space/10 shadow-3xs">
                      หน่วยเบิก {(p.line || lineForRole(p.role))} · {REIMBURSEMENT_UNITS[p.line || lineForRole(p.role)].prefix}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-2 mt-1">
                <span className="text-slate-400 font-bold">จัดการสถานะภาพ:</span>
                
                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(p)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer transition-colors"
                    title={p.active ? 'เปลี่ยนเป็นปิดการใช้งานชั่วคราว' : 'เปลี่ยนเป็นกำลังปฏิบัติงาน'}
                  >
                    {p.active ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </button>

                  <button
                    onClick={() => handleEditClick(p)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
                    title="แก้ไขข้อมูลบุคลากร"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`คุณต้องการลบข้อมูลของ ${p.name} หรือไม่? ข้อมูลการปฏิบัติการจะถูกเคลียร์ทันที`)) {
                        onDeletePersonnel(p.id);
                      }
                    }}
                    className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 cursor-pointer transition-colors"
                    title="ลบออกจากระบบสารสนเทศ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-10 text-center text-slate-400 font-medium bg-white rounded-lg border border-dashed border-slate-200">
            <Layers className="w-6 h-6 mx-auto mb-1 opacity-30 text-slate-400" />
            <span className="text-[11px]">ไม่พบรายชื่อบุคลากรหรือห้องปฏิบัติงานที่ค้นหา</span>
          </div>
        )}
      </div>
    </div>
  );
}
