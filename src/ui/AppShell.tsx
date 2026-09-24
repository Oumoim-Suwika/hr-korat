import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, type Ward } from '../api/client';
import type { UserRole } from '../api/client';
import { THAI_MONTHS } from '../data';
import {
  LayoutDashboard, Calendar, CalendarClock, Users, Building2, Users2, Clock, CalendarDays,
  ArrowLeftRight, CalendarX, Send, DollarSign, FileText, BarChart3, ScrollText, ShieldCheck,
  Settings as SettingsIcon, LogOut, Loader2, Menu, History, Wallet,
} from 'lucide-react';

import DashboardView from './DashboardView';
import ScheduleView from './ScheduleView';
import DailyView from './DailyView';
import PersonnelView from './PersonnelView';
import WardsView from './WardsView';
import StaffingView from './StaffingView';
import ShiftSettingsView from './ShiftSettingsView';
import HolidaysView from './HolidaysView';
import RequestsView from './RequestsView';
import FinanceView from './FinanceView';
import DocumentsView from './DocumentsView';
import ReportsView from './ReportsView';
import PayrollView from './PayrollView';
import ReconcileView from './ReconcileView';
import FormHistoryView from './FormHistoryView';
import AuditView from './AuditView';
import UsersView from './UsersView';
import SettingsView from './SettingsView';

type TabKey =
  | 'dashboard' | 'schedule' | 'daily' | 'personnel' | 'wards' | 'staffing' | 'shifts'
  | 'holidays' | 'swap' | 'leave' | 'ot' | 'finance' | 'reconcile' | 'payroll' | 'documents' | 'history' | 'reports' | 'audit' | 'users' | 'settings';

const ALL: UserRole[] = ['staff', 'supervisor', 'finance', 'admin'];
const SUP: UserRole[] = ['supervisor', 'admin'];
const FIN: UserRole[] = ['finance', 'admin'];

interface NavItem { key: TabKey; label: string; icon: any; roles: UserRole[]; }
interface NavSection { title: string; items: NavItem[]; }

const SECTIONS: NavSection[] = [
  { title: '', items: [{ key: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, roles: ALL }] },
  { title: 'จัดเวร', items: [
    { key: 'schedule', label: 'ตารางเวร', icon: Calendar, roles: ALL },
    { key: 'daily', label: 'ปฏิทินเวร', icon: CalendarClock, roles: ALL },
    { key: 'staffing', label: 'ความต้องการพนักงาน', icon: Users2, roles: SUP },
    { key: 'shifts', label: 'ตั้งค่าเวร', icon: Clock, roles: SUP },
    { key: 'holidays', label: 'วันหยุด', icon: CalendarDays, roles: ALL },
  ]},
  { title: 'คำขอ', items: [
    { key: 'swap', label: 'คำขอแลกเวร', icon: ArrowLeftRight, roles: ALL },
    { key: 'leave', label: 'คำขอลา', icon: CalendarX, roles: ALL },
    { key: 'ot', label: 'คำขอขึ้น OT', icon: Send, roles: ALL },
  ]},
  { title: 'การเงิน & เอกสาร', items: [
    { key: 'finance', label: 'การเงิน & เบิกจ่าย', icon: DollarSign, roles: FIN },
    { key: 'reconcile', label: 'ตรวจสอบเวร↔เบิก', icon: ShieldCheck, roles: FIN },
    { key: 'payroll', label: 'เงินเดือน (Payroll)', icon: Wallet, roles: FIN },
    { key: 'documents', label: 'ฟอร์มตั้งเบิก (ครุฑ)', icon: FileText, roles: ALL },
    { key: 'history', label: 'ประวัติฟอร์ม', icon: History, roles: [...SUP, 'finance'] },
    { key: 'reports', label: 'รายงาน & วิเคราะห์', icon: BarChart3, roles: [...SUP, 'finance'] },
  ]},
  { title: 'ข้อมูลหลัก', items: [
    { key: 'personnel', label: 'จัดการบุคลากร', icon: Users, roles: SUP },
    { key: 'wards', label: 'จัดการวอร์ด', icon: Building2, roles: SUP },
  ]},
  { title: 'ระบบ (Admin)', items: [
    { key: 'audit', label: 'บันทึกการตรวจสอบ', icon: ScrollText, roles: FIN },
    { key: 'users', label: 'จัดการผู้ใช้', icon: ShieldCheck, roles: ['admin'] },
    { key: 'settings', label: 'ตั้งค่าระบบ', icon: SettingsIcon, roles: ['admin'] },
  ]},
];

const ROLE_LABEL: Record<UserRole, string> = { staff: 'เจ้าหน้าที่', supervisor: 'หัวหน้างาน', finance: 'การเงิน', admin: 'ผู้ดูแลระบบ' };

// Which header filters each page actually uses (others are hidden)
const HEADER_FILTERS: Record<TabKey, { ward?: boolean; month?: boolean; year?: boolean }> = {
  dashboard: { month: true, year: true },
  schedule: { ward: true, month: true, year: true },
  daily: { ward: true, month: true, year: true },
  personnel: {},
  wards: {},
  staffing: { ward: true },
  shifts: {},
  holidays: { year: true },
  swap: { ward: true, month: true, year: true },
  leave: { ward: true, month: true, year: true },
  ot: { ward: true, month: true, year: true },
  finance: { month: true, year: true },
  reconcile: { month: true, year: true },
  payroll: { ward: true, month: true, year: true },
  documents: { ward: true, month: true, year: true },
  history: { ward: true },
  reports: { month: true, year: true },
  audit: {},
  users: {},
  settings: {},
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardId, setWardId] = useState<number | null>(user?.wardId ?? null);
  const [year, setYear] = useState(2569);
  const [month, setMonth] = useState(7);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try { const w = await api.wards(); setWards(w); setWardId((c) => c ?? w[0]?.id ?? null); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!user) return null;
  const role = user.role;
  const ward = wards.find((w) => w.id === wardId);
  const wardName = ward?.name ?? '';

  const sections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) }))
    .filter((s) => s.items.length > 0);

  const renderView = () => {
    if (loading || wardId == null) return <div className="grid place-items-center py-20 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
    switch (tab) {
      case 'dashboard': return <DashboardView year={year} month={month} />;
      case 'schedule': return <ScheduleView role={role} wards={wards} wardId={wardId} year={year} month={month} />;
      case 'daily': return <DailyView wardName={wardName} wardId={wardId} year={year} month={month} />;
      case 'personnel': return <PersonnelView wardId={wardId} wardName={wardName} role={role} />;
      case 'wards': return <WardsView role={role} />;
      case 'staffing': return <StaffingView wardName={wardName} wardId={wardId} role={role} />;
      case 'shifts': return <ShiftSettingsView />;
      case 'holidays': return <HolidaysView year={year} role={role} />;
      case 'swap': return <RequestsView role={role} wardId={wardId} year={year} month={month} myEmployeeId={user.employeeId} filterType="shift_change" title="คำขอแลกเวร" />;
      case 'leave': return <RequestsView role={role} wardId={wardId} year={year} month={month} myEmployeeId={user.employeeId} filterType="leave" title="คำขอลา" />;
      case 'ot': return <RequestsView role={role} wardId={wardId} year={year} month={month} myEmployeeId={user.employeeId} filterType="ot" title="คำขอขึ้น OT" />;
      case 'finance': return <FinanceView wardName={wardName} wardId={wardId} year={year} month={month} />;
      case 'reconcile': return <ReconcileView wardId={wardId} year={year} month={month} />;
      case 'payroll': return <PayrollView wardName={wardName} wardId={wardId} year={year} month={month} />;
      case 'documents': return <DocumentsView wardName={wardName} wardPhone={ward?.phone} wardId={wardId} year={year} month={month} />;
      case 'history': return <FormHistoryView wardId={wardId} onOpen={(y, m) => { setYear(y); setMonth(m); setTab('documents'); }} />;
      case 'reports': return <ReportsView year={year} month={month} />;
      case 'audit': return <AuditView />;
      case 'users': return <UsersView />;
      case 'settings': return <SettingsView />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* sidebar */}
      <aside className={`no-print w-60 bg-[#0F3575] text-white flex flex-col shrink-0 fixed lg:static inset-y-0 z-30 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/15 grid place-items-center font-bold">S</div>
          <div><div className="font-bold text-sm leading-tight">Sati จัดเวร · OT</div><div className="text-[11px] text-white/60">รพ.มหาราชนครราชสีมา</div></div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-3">
          {sections.map((s, si) => (
            <div key={si}>
              {s.title && <div className="px-2 text-[10px] uppercase tracking-wide text-white/40 mb-1">{s.title}</div>}
              <div className="space-y-0.5">
                {s.items.map((n) => {
                  const Icon = n.icon;
                  return (
                    <button key={n.key} onClick={() => { setTab(n.key); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${tab === n.key ? 'bg-white text-[#0F3575] font-medium' : 'text-white/80 hover:bg-white/10'}`}>
                      <Icon className="w-4 h-4" />{n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-2 mb-2"><div className="text-sm font-medium">{user.displayName}</div><div className="text-[11px] text-white/60">{ROLE_LABEL[role]}</div></div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/10"><LogOut className="w-4 h-4" />ออกจากระบบ</button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* main */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="no-print bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
          <button className="lg:hidden p-2 -ml-2" onClick={() => setSidebarOpen(true)}><Menu className="w-5 h-5" /></button>
          {(() => {
            const hf = HEADER_FILTERS[tab] ?? {};
            if (!hf.ward && !hf.month && !hf.year) return <div className="text-sm font-medium text-slate-500">{sections.flatMap((s) => s.items).find((n) => n.key === tab)?.label ?? ''}</div>;
            return (
              <div className="flex items-center gap-2 flex-wrap">
                {hf.ward && (
                  <select value={wardId ?? ''} onChange={(e) => setWardId(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5" disabled={role === 'supervisor' && !!user.wardId}>
                    {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                )}
                {hf.month && (
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
                    {THAI_MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                )}
                {hf.year && (
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
                    {[2568, 2569, 2570].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>
            );
          })()}
        </header>
        <div className="flex-1 p-4 sm:p-6 overflow-auto">{renderView()}</div>
      </main>
    </div>
  );
}
