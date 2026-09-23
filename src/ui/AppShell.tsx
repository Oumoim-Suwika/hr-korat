import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, type Ward } from '../api/client';
import ScheduleView from './ScheduleView';
import RequestsView from './RequestsView';
import PersonnelView from './PersonnelView';
import { THAI_MONTHS } from '../data';
import {
  Calendar, LayoutDashboard, DollarSign, Users, FileText, Send, LogOut, Loader2, Construction,
} from 'lucide-react';
import type { UserRole } from '../api/client';

type TabKey = 'schedule' | 'requests' | 'dashboard' | 'finance' | 'personnel' | 'documents';

const NAV: { key: TabKey; label: string; icon: any; roles: UserRole[] }[] = [
  { key: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard, roles: ['staff', 'supervisor', 'finance', 'admin'] },
  { key: 'schedule', label: 'ตารางเวร', icon: Calendar, roles: ['staff', 'supervisor', 'finance', 'admin'] },
  { key: 'requests', label: 'คำขอ (เปลี่ยนเวร/ลา/OT)', icon: Send, roles: ['staff', 'supervisor', 'finance', 'admin'] },
  { key: 'finance', label: 'การเงิน & เบิกจ่าย', icon: DollarSign, roles: ['finance', 'admin'] },
  { key: 'personnel', label: 'บุคลากร', icon: Users, roles: ['supervisor', 'admin'] },
  { key: 'documents', label: 'ฟอร์มตั้งเบิก', icon: FileText, roles: ['staff', 'supervisor', 'finance', 'admin'] },
];

const ROLE_LABEL: Record<UserRole, string> = {
  staff: 'เจ้าหน้าที่', supervisor: 'หัวหน้างาน', finance: 'การเงิน', admin: 'ผู้ดูแลระบบ',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardId, setWardId] = useState<number | null>(user?.wardId ?? null);
  const [year, setYear] = useState(2569);
  const [month, setMonth] = useState(7);
  const [tab, setTab] = useState<TabKey>('schedule');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const w = await api.wards();
        setWards(w);
        setWardId((cur) => cur ?? w[0]?.id ?? null);
      } finally { setLoading(false); }
    })();
  }, []);

  if (!user) return null;
  const nav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#0F3575] text-white grid place-items-center font-bold">S</div>
          <div>
            <div className="font-bold text-slate-800 text-sm leading-tight">Sati จัดเวร · OT</div>
            <div className="text-[11px] text-slate-400">รพ.มหาราชนครราชสีมา</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            return (
              <button key={n.key} onClick={() => setTab(n.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${tab === n.key ? 'bg-[#0F3575] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Icon className="w-4 h-4" />{n.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-2 mb-2">
            <div className="text-sm font-medium text-slate-700">{user.displayName}</div>
            <div className="text-[11px] text-slate-400">{ROLE_LABEL[user.role]}</div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100">
            <LogOut className="w-4 h-4" />ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <select value={wardId ?? ''} onChange={(e) => setWardId(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5" disabled={user.role === 'supervisor' && !!user.wardId}>
              {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
              {THAI_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
              {[2568, 2569, 2570].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          {loading || wardId == null ? (
            <div className="grid place-items-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : tab === 'schedule' ? (
            <ScheduleView role={user.role} wards={wards} wardId={wardId} year={year} month={month} />
          ) : tab === 'requests' ? (
            <RequestsView role={user.role} wardId={wardId} year={year} month={month} myEmployeeId={user.employeeId} />
          ) : tab === 'personnel' ? (
            <PersonnelView wardId={wardId} />
          ) : (
            <Placeholder tab={tab} />
          )}
        </div>
      </main>
    </div>
  );
}

function Placeholder({ tab }: { tab: TabKey }) {
  const labels: Record<string, string> = {
    dashboard: 'แดชบอร์ดภาพรวม', requests: 'คำขอเปลี่ยนเวร/ลา/OT',
    finance: 'การเงิน & เบิกจ่าย', personnel: 'บุคลากร', documents: 'ฟอร์มตั้งเบิก (PDF ตราครุฑ)',
  };
  return (
    <div className="grid place-items-center py-24 text-center">
      <Construction className="w-10 h-10 text-slate-300 mb-3" />
      <h3 className="text-lg font-semibold text-slate-600">{labels[tab]}</h3>
      <p className="text-sm text-slate-400 mt-1 max-w-md">
        โมดูลนี้กำลังย้ายเข้าระบบใหม่ (เชื่อม backend) — เมนูพร้อมแล้ว ฟีเจอร์จะทยอยเปิดในรอบถัดไป
      </p>
    </div>
  );
}
