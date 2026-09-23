import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, AlertCircle, CheckCircle, HelpCircle, FileText
} from 'lucide-react';
import { Personnel, OTSettings, Role } from '../types';
import { THAI_MONTHS } from '../data';

interface DashboardProps {
  personnel: Personnel[];
  schedule: Record<string, string>;
  year: number;
  month: number;
  otSettings: OTSettings;
  daysCount: number;
}

export default function Dashboard({
  personnel,
  schedule,
  year,
  month,
  otSettings,
  daysCount
}: DashboardProps) {

  // Helper to compute stats
  const activePersonnel = personnel.filter(p => p.active);
  const doctors = activePersonnel.filter(p => p.role === 'doctor');
  const nurses = activePersonnel.filter(p => p.role === 'nurse');
  const assistants = activePersonnel.filter(p => p.role === 'assistant');
  const rooms = activePersonnel.filter(p => p.role === 'room');

  // Compute OT costs and metrics
  let totalOTCost = 0;
  let totalShiftsScheduled = 0;

  // Track cost per role
  const costByRole: Record<Role, number> = {
    doctor: 0,
    nurse: 0,
    assistant: 0,
    room: 0
  };

  // Track shift count by type
  const shiftTypeCount: Record<string, number> = {
    'ช': 0, 'บ': 0, 'ด': 0, 'OR': 0, 'BD': 0, 'O': 0, 'V': 0, 'T': 0
  };

  // Track daily cost trend
  const dailyCosts = Array.from({ length: daysCount }, (_, idx) => ({
    day: idx + 1,
    cost: 0,
    doctorCost: 0,
    nurseCost: 0,
    assistantCost: 0,
    roomCost: 0
  }));

  // Work hours check per week
  const weeklyHours: Record<string, Record<number, number>> = {}; // personnelId -> weekIndex -> hours

  activePersonnel.forEach(p => {
    let personalShiftCount = 0;
    weeklyHours[p.id] = {};

    for (let day = 1; day <= daysCount; day++) {
      const key = `${p.id}-${day}`;
      const shift = schedule[key];
      if (shift && shift !== 'O') {
        totalShiftsScheduled++;
        shiftTypeCount[shift] = (shiftTypeCount[shift] || 0) + 1;

        // Calculate hours
        let hours = 8;
        if (shift === 'BD') hours = 4;
        else if (shift === 'O' || shift === 'V' || shift === 'T') hours = 0;

        // Calculate cost
        const rate = otSettings.rates[p.role]?.[shift] || 0;
        totalOTCost += rate;
        costByRole[p.role] += rate;

        // Daily trend
        const dailyIndex = day - 1;
        if (dailyCosts[dailyIndex]) {
          dailyCosts[dailyIndex].cost += rate;
          if (p.role === 'doctor') dailyCosts[dailyIndex].doctorCost += rate;
          else if (p.role === 'nurse') dailyCosts[dailyIndex].nurseCost += rate;
          else if (p.role === 'assistant') dailyCosts[dailyIndex].assistantCost += rate;
          else if (p.role === 'room') dailyCosts[dailyIndex].roomCost += rate;
        }

        // Weekly hours calculation (approximate 7 days per week)
        const weekIdx = Math.floor((day - 1) / 7);
        weeklyHours[p.id][weekIdx] = (weeklyHours[p.id][weekIdx] || 0) + hours;
      }
    }
  });

  // Role labels
  const roleLabels: Record<Role, string> = {
    doctor: 'แพทย์',
    nurse: 'พยาบาล',
    assistant: 'ผู้ช่วยพยาบาล',
    room: 'ห้องผ่าตัด'
  };

  // Data for role cost chart
  const roleCostData = Object.keys(costByRole).map(key => {
    const roleKey = key as Role;
    return {
      name: roleLabels[roleKey],
      'ค่าตอบแทน OT (บาท)': costByRole[roleKey]
    };
  });

  // Data for shift type distribution
  const shiftColors: Record<string, string> = {
    'ช': '#F59E0B',
    'บ': '#0EA5E9',
    'ด': '#6366F1',
    'ชot': '#D97706',
    'บot': '#0284C7',
    'ดot': '#4F46E5',
    'OR': '#10B981',
    'BD': '#F43F5E',
    'O': '#64748B',
    'V': '#22C55E',
    'T': '#D946EF'
  };

  const shiftNames: Record<string, string> = {
    'ช': 'เวรเช้า',
    'บ': 'เวรบ่าย',
    'ด': 'เวรดึก',
    'ชot': 'เวรเช้า OT',
    'บot': 'เวรบ่าย OT',
    'ดot': 'เวรดึก OT',
    'OR': 'เวรผ่าตัด',
    'BD': 'เวรบ่ายดึก BD'
  };

  const shiftDistributionData = Object.keys(shiftTypeCount)
    .filter(key => shiftTypeCount[key] > 0 && key !== 'O' && key !== 'V' && key !== 'T')
    .map(key => ({
      name: shiftNames[key] || `เวร ${key}`,
      value: shiftTypeCount[key],
      color: shiftColors[key] || '#cbd5e1'
    }));

  // Audit warnings calculation
  const auditWarnings: Array<{ id: string; type: 'warning' | 'info'; message: string }> = [];

  // 1. High earners check (> 25,000 THB in OT)
  activePersonnel.forEach(p => {
    let personalCost = 0;
    let shiftsCount = 0;
    for (let day = 1; day <= daysCount; day++) {
      const shift = schedule[`${p.id}-${day}`];
      if (shift && shift !== 'O' && shift !== 'V' && shift !== 'T') {
        shiftsCount++;
        personalCost += otSettings.rates[p.role]?.[shift] || 0;
      }
    }
    if (personalCost > 25000) {
      auditWarnings.push({
        id: `high-earn-${p.id}`,
        type: 'warning',
        message: `${roleLabels[p.role]} ${p.name} เบิกยอด OT สูงสุดประเดือน: ${personalCost.toLocaleString()} บาท (${shiftsCount} เวร)`
      });
    }

    // 2. High work hours per week check (> 48 hours)
    if (weeklyHours[p.id]) {
      Object.keys(weeklyHours[p.id]).forEach(wk => {
        const hrs = weeklyHours[p.id][+wk];
        if (hrs > 48) {
          auditWarnings.push({
            id: `high-hrs-${p.id}-${wk}`,
            type: 'warning',
            message: `${roleLabels[p.role]} ${p.name} ปฏิบัติหน้าที่หนักเกินสัปดาห์ที่ ${+wk + 1}: ${hrs} ชม. (เกินขีด 48 ชม./สัปดาห์)`
          });
        }
      });
    }
  });

  // 3. Operating Room high cost check (> 15,000 THB)
  rooms.forEach(r => {
    let roomCost = 0;
    for (let day = 1; day <= daysCount; day++) {
      const shift = schedule[`${r.id}-${day}`];
      if (shift && shift !== 'O') {
        roomCost += otSettings.rates['room']?.[shift] || 0;
      }
    }
    if (roomCost > 15000) {
      auditWarnings.push({
        id: `room-cost-${r.id}`,
        type: 'info',
        message: `ยอดเบิกใช้ห้องผ่าตัด ${r.name} สูงสะสม: ${roomCost.toLocaleString()} บาท`
      });
    }
  });

  return (
    <div className="space-y-5">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md hover:border-gold-300/60 premium-card">
          <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100/40 text-emerald-600 rounded-xl border border-emerald-100">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">งบประมาณ OT รวมทั้งแผนก</div>
            <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{totalOTCost.toLocaleString()} ฿</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">ประจำเดือน {THAI_MONTHS[month - 1]} {year}</div>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md hover:border-gold-300/60 premium-card">
          <div className="p-3 bg-gradient-to-br from-sky-50 to-sky-100/40 text-sky-600 rounded-xl border border-sky-100">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">บุคลากรที่ปฏิบัติหน้าที่ (Active)</div>
            <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{activePersonnel.length} ราย</div>
            <div className="text-[10px] text-sky-600 font-semibold mt-0.5">
              แพทย์ {doctors.length} · พยาบาล {nurses.length} · ผู้ช่วย {assistants.length}
            </div>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md hover:border-gold-300/60 premium-card">
          <div className="p-3 bg-gradient-to-br from-indigo-50 to-indigo-100/40 text-indigo-600 rounded-xl border border-indigo-100">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">ยอดจำนวนเวรสะสม</div>
            <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">{totalShiftsScheduled} เวร</div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">ไม่รวมกะหยุดปฏิบัติงานพิเศษ (OFF)</div>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-4 transition-all hover:shadow-md hover:border-gold-300/60 premium-card">
          <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100/40 text-gold-600 rounded-xl border border-gold-200">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">ค่าเฉลี่ยงบ OT ต่อบุคคล</div>
            <div className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              {activePersonnel.length ? Math.round(totalOTCost / activePersonnel.length).toLocaleString() : 0} ฿
            </div>
            <div className="text-[10px] text-gold-600 font-semibold mt-0.5">รักษาสมดุลกรอบงบประมาณได้เสถียร</div>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily OT Cost Trend (Line Chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2 premium-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">แนวโน้มค่าใช้จ่าย OT รายวัน</h3>
              <p className="text-[10.5px] text-slate-400">แสดงการจัดงบประมาณแบบ Real-time รายวัน ตลอดทั้งเดือน</p>
            </div>
            <span className="text-[9px] bg-sati-azure/5 text-sati-azure px-2.5 py-1 rounded-md border border-sati-azure/10 font-bold font-mono">
              วันที่ 1 - {daysCount}
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyCosts} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip 
                  formatter={(value: any) => [`${value.toLocaleString()} ฿`, 'ยอดเงิน']}
                  labelFormatter={(label) => `วันที่ ${label}`}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                <Line type="monotone" dataKey="cost" name="งบรวมทั้งหมด" stroke="#266BFF" strokeWidth={2.5} dot={{ r: 1.5 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="doctorCost" name="แพทย์" stroke="#F59E0B" strokeWidth={1.2} dot={false} />
                <Line type="monotone" dataKey="nurseCost" name="พยาบาล" stroke="#00B894" strokeWidth={1.2} dot={false} />
                <Line type="monotone" dataKey="roomCost" name="ห้องผ่าตัด" stroke="#7C5CFF" strokeWidth={1.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shift Type Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between premium-card">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">สัดส่วนประเภทเวร</h3>
            <p className="text-[10.5px] text-slate-400 mb-3">จำนวนเวรสะสม แยกตามลักษณะการปฏิบัติการ</p>
          </div>
          <div className="h-40 flex items-center justify-center">
            {shiftDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shiftDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {shiftDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [`${value} เวร`, 'จำนวน']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-400 text-[11px] text-center">ไม่มีข้อมูลเวรที่จัดขณะนี้</div>
            )}
          </div>
          {/* Custom Legends */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9.5px] mt-3 border-t border-slate-100 pt-3">
            {shiftDistributionData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-600 truncate font-semibold">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cost by Role (Bar Chart) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-1 premium-card">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display mb-1">งบประมาณแยกตามสายงาน</h3>
          <p className="text-[10.5px] text-slate-400 mb-4">เปรียบเทียบค่าใช้จ่ายกลุ่มบุคลากรและห้องบริการ</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleCostData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip formatter={(value: any) => [`${value.toLocaleString()} ฿`, 'งบประมาณ']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="ค่าตอบแทน OT (บาท)" fill="#266BFF" radius={[4, 4, 0, 0]} barSize={26}>
                  {roleCostData.map((entry, idx) => {
                    const colors = ['#F59E0B', '#00B894', '#6FA8FF', '#7C5CFF'];
                    return <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Audit Log / Finance Checks */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs lg:col-span-2 flex flex-col premium-card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">ระบบตรวจทานงบประมาณ & อนุมัติการทำงาน</h3>
              <p className="text-[10.5px] text-slate-400">วิเคราะห์เพื่อป้องกันความเสี่ยงในการจัดอัตรากำลังและช่วยประกอบการอนุมัติงบประมาณ</p>
            </div>
          </div>

          <div className="overflow-y-auto max-h-56 space-y-2.5 pr-1 flex-1">
            {auditWarnings.length > 0 ? (
              auditWarnings.map((warn) => (
                <div 
                  key={warn.id} 
                  className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                    warn.type === 'warning' 
                      ? 'bg-rose-50/40 border-rose-100/70 text-rose-900' 
                      : 'bg-indigo-50/20 border-indigo-100/70 text-indigo-900'
                  }`}
                >
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${warn.type === 'warning' ? 'text-rose-500' : 'text-indigo-500'}`} />
                  <span className="text-[11px] font-medium leading-normal">{warn.message}</span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-full border border-emerald-100/60 shadow-sm">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-slate-600">ระบบตรวจสอบเสร็จสิ้น: ไม่พบข้อกังวลทางงบประมาณหรือกำลังคน</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
