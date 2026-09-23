import React, { useState, useEffect } from 'react';
import { 
  Activity, Calendar, DollarSign, Users, Award, 
  Sparkles, Save, Trash2, HelpCircle, ShieldAlert,
  ChevronDown, FileText, Database, Info, Shield, History, ArrowRight, AlertTriangle, UserCog, LucideIcon,
  PanelLeft, Home
} from 'lucide-react';

import { Personnel, OTSettings, Role, Ward, ChangeLog, PolicySettings, ShiftType } from './types';
import { UserRole, TabKey, ROLE_TABS, ROLE_LABELS, ROLE_SHORT, ROLE_DESCRIPTIONS } from './roles';
import { 
  DEFAULT_PERSONNEL, DEFAULT_OT_SETTINGS, DEFAULT_POLICIES, 
  THAI_MONTHS, THAI_DAYS_SHORT, SHIFT_TYPES
} from './data';

import Dashboard from './components/Dashboard';
import ScheduleBoard from './components/ScheduleBoard';
import FinanceView from './components/FinanceView';
import PersonnelView from './components/PersonnelView';
import DocumentsView from './components/DocumentsView';
import RulesSettingsView from './components/RulesSettingsView';
import WardIntegrationView from './components/WardIntegrationView';

// Storage Keys
const STORAGE_KEY_WARD_ID = 'smart_scheduler_ward_id_v2';
const STORAGE_KEY_WARD_PERSONNEL = 'smart_scheduler_ward_personnel_v2';
const STORAGE_KEY_WARD_SCHEDULES = 'smart_scheduler_ward_schedules_v2';
const STORAGE_KEY_WARD_APPROVED = 'smart_scheduler_ward_approved_v2';
const STORAGE_KEY_WARD_STATUSES = 'smart_scheduler_ward_statuses_v2';
const STORAGE_KEY_WARD_PINNED = 'smart_scheduler_ward_pinned_v2';
const STORAGE_KEY_CHANGE_LOGS = 'smart_scheduler_change_logs_v2';
const STORAGE_KEY_POLICIES = 'smart_scheduler_policies_v2';
const STORAGE_KEY_SHIFT_TYPES = 'smart_scheduler_shift_types_v2';
const STORAGE_KEY_OT = 'smart_scheduler_ot_v2';
const STORAGE_KEY_YEAR = 'smart_scheduler_year_v2';
const STORAGE_KEY_MONTH = 'smart_scheduler_month_v2';
const STORAGE_KEY_ROLE = 'smart_scheduler_user_role_v2';

// Data-driven navigation — gated by user role via ROLE_TABS
const NAV_ITEMS: { key: TabKey; icon: LucideIcon; short: string; label: string; title: string }[] = [
  { key: 'dashboard', icon: Activity, short: 'ภาพรวม', label: 'แดชบอร์ดภาพรวม', title: 'แดชบอร์ดภาพรวมการเงิน' },
  { key: 'schedule', icon: Calendar, short: 'ตารางเวร', label: 'ตารางจัดเวร', title: 'ตารางจัดเวรแผนก' },
  { key: 'finance', icon: DollarSign, short: 'การเงิน', label: 'การเงิน & ตรวจสอบงบ', title: 'ราคาจ้าง & ตรวจสอบงบ' },
  { key: 'personnel', icon: Users, short: 'บุคลากร', label: 'ข้อมูลบุคลากร', title: 'ข้อมูลบุคลากร & ห้องผ่าตัด' },
  { key: 'documents', icon: FileText, short: 'ตั้งเบิก', label: 'ฟอร์มตั้งเบิก', title: 'ฟอร์มตั้งเบิกและเอกสารราชการ' },
  { key: 'rules', icon: Shield, short: 'กฎกะเวร', label: 'กฎ & ประเภทกะ', title: 'ตั้งเกณฑ์เวรและประเภทกะ' },
  { key: 'integration', icon: Database, short: 'ส่ง&นำเข้า', label: 'นำส่ง & นำเข้า', title: 'ระบบนำส่ง อนุมัติ นำเข้าข้อมูล และ Log' },
];

// Sidebar section groupings (ChartSum-style)
const NAV_GROUPS: { title: string; keys: TabKey[] }[] = [
  { title: 'แดชบอร์ด', keys: ['dashboard'] },
  { title: 'จัดการเวร & เบิกจ่าย', keys: ['schedule', 'finance', 'documents', 'integration'] },
  { title: 'ข้อมูลหลัก', keys: ['personnel'] },
  { title: 'ตั้งค่าระบบ', keys: ['rules'] },
];

// Breadcrumb title + subtitle per tab
const PAGE_META: Record<TabKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'แดชบอร์ดภาพรวม', subtitle: 'สรุปงบประมาณ OT จำนวนเวร และการตรวจสอบความเสี่ยงด้านกำลังคน' },
  schedule: { title: 'ตารางจัดเวร', subtitle: 'จัดและปรับปรุงตารางกะการปฏิบัติงานของกลุ่มงาน' },
  finance: { title: 'การเงิน & ตรวจสอบงบ', subtitle: 'ตั้งอัตราค่าตอบแทน คำนวณ OT และตรวจสอบรายจ่ายทุกกลุ่มงาน' },
  personnel: { title: 'ข้อมูลบุคลากร', subtitle: 'ทะเบียนแพทย์ พยาบาล ผู้ช่วยพยาบาล และห้องผ่าตัด' },
  documents: { title: 'ฟอร์มตั้งเบิกและเอกสารราชการ', subtitle: 'ออกบันทึกข้อความ หลักฐานการจ่ายเงิน และตารางเวร ตราครุฑ' },
  rules: { title: 'กฎกะเวร & ประเภทกะ', subtitle: 'ตั้งเกณฑ์ความปลอดภัยการขึ้นเวรและรหัสกะปฏิบัติการ' },
  integration: { title: 'นำส่ง อนุมัติ & นำเข้าข้อมูล', subtitle: 'ส่งขออนุมัติเวร ตรวจความไม่ตรง นำเข้ารายชื่อ/ตารางเวร และดู Log' },
};

const INITIAL_WARDS: Ward[] = [
  { id: 'U01', name: 'กลุ่มงานการเงิน (U01)', building: 'ตึกการเงิน/อำนวยการ', phone: '32077' },
  { id: 'A01', name: 'กลุ่มงานวิสัญญีวิทยา (A01)', building: 'ตึกศัลยกรรม', phone: '32078' },
  { id: 'M01', name: 'กลุ่มงานอายุรกรรม (M01)', building: 'ตึกอายุรกรรม', phone: '35870' },
  { id: 'ICU', name: 'หอผู้ป่วยวิกฤต (ICU)', building: 'ตึกวิกฤตบำบัด', phone: '31415' },
  { id: 'ER', name: 'แผนกฉุกเฉิน (ER)', building: 'ตึกฉุกเฉินอุบัติเหตุ', phone: '39911' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const pageMeta = PAGE_META[activeTab];

  // Tabs the current role is allowed to see
  const allowedTabs = ROLE_TABS[userRole];
  const visibleNav = NAV_ITEMS.filter(item => allowedTabs.includes(item.key));

  // Keep the active tab within what the role can access
  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [userRole]);

  const handleChangeRole = (role: UserRole) => {
    setUserRole(role);
    localStorage.setItem(STORAGE_KEY_ROLE, role);
    if (!ROLE_TABS[role].includes(activeTab)) {
      setActiveTab(ROLE_TABS[role][0]);
    }
  };
  
  // Date State
  const [year, setYear] = useState<number>(2569); // 2026 BE
  const [month, setMonth] = useState<number>(7);   // July
  
  // Custom Rules and Shift Types
  const [policies, setPolicies] = useState<PolicySettings>(DEFAULT_POLICIES);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(SHIFT_TYPES);

  // Ward States
  const [activeWardId, setActiveWardId] = useState<string>('U01');
  const [wardPersonnel, setWardPersonnel] = useState<Record<string, Personnel[]>>({});
  const [wardSchedules, setWardSchedules] = useState<Record<string, Record<string, string>>>({});
  const [wardApprovedSchedules, setWardApprovedSchedules] = useState<Record<string, Record<string, string>>>({});
  const [wardApprovalStatuses, setWardApprovalStatuses] = useState<Record<string, 'draft' | 'pending_approval' | 'approved'>>({});
  const [wardPinnedShifts, setWardPinnedShifts] = useState<Record<string, Record<string, boolean>>>({});
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);

  const [otSettings, setOTSettings] = useState<OTSettings>(DEFAULT_OT_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<string>('บันทึกข้อมูลในเครื่อง (โลคัล) เรียบร้อย');

  // Load state on mount
  useEffect(() => {
    try {
      const storedActiveWardId = localStorage.getItem(STORAGE_KEY_WARD_ID) || 'U01';
      setActiveWardId(storedActiveWardId);

      const storedPolicies = localStorage.getItem(STORAGE_KEY_POLICIES);
      if (storedPolicies) setPolicies(JSON.parse(storedPolicies));

      const storedShiftTypes = localStorage.getItem(STORAGE_KEY_SHIFT_TYPES);
      if (storedShiftTypes) setShiftTypes(JSON.parse(storedShiftTypes));

      const storedWPersonnel = localStorage.getItem(STORAGE_KEY_WARD_PERSONNEL);
      if (storedWPersonnel) {
        setWardPersonnel(JSON.parse(storedWPersonnel));
      } else {
        // Initialize multi-ward personnel with clones and modifications
        const initStaff: Record<string, Personnel[]> = {
          U01: DEFAULT_PERSONNEL,
          A01: DEFAULT_PERSONNEL.map((p, i) => ({ ...p, id: `A_RN${String(i+1).padStart(3, '0')}`, name: p.name.replace('สมหญิง', 'พญ.สมรัก').replace('สมศักดิ์', 'นพ.ยศดรค์') })),
          M01: DEFAULT_PERSONNEL.slice(1, 10).map((p, i) => ({ ...p, id: `M_RN${String(i+1).padStart(3, '0')}` })),
          ICU: DEFAULT_PERSONNEL.slice(2, 12).map((p, i) => ({ ...p, id: `ICU_RN${String(i+1).padStart(3, '0')}` })),
          ER: DEFAULT_PERSONNEL.slice(3, 14).map((p, i) => ({ ...p, id: `ER_RN${String(i+1).padStart(3, '0')}` }))
        };
        setWardPersonnel(initStaff);
      }

      const storedWSchedules = localStorage.getItem(STORAGE_KEY_WARD_SCHEDULES);
      if (storedWSchedules) setWardSchedules(JSON.parse(storedWSchedules));

      const storedWApproved = localStorage.getItem(STORAGE_KEY_WARD_APPROVED);
      if (storedWApproved) setWardApprovedSchedules(JSON.parse(storedWApproved));

      const storedWStatuses = localStorage.getItem(STORAGE_KEY_WARD_STATUSES);
      if (storedWStatuses) setWardApprovalStatuses(JSON.parse(storedWStatuses));

      const storedWPinned = localStorage.getItem(STORAGE_KEY_WARD_PINNED);
      if (storedWPinned) setWardPinnedShifts(JSON.parse(storedWPinned));

      const storedLogs = localStorage.getItem(STORAGE_KEY_CHANGE_LOGS);
      if (storedLogs) setChangeLogs(JSON.parse(storedLogs));

      const storedOT = localStorage.getItem(STORAGE_KEY_OT);
      if (storedOT) setOTSettings(JSON.parse(storedOT));

      const storedYear = localStorage.getItem(STORAGE_KEY_YEAR);
      if (storedYear) setYear(parseInt(storedYear));

      const storedMonth = localStorage.getItem(STORAGE_KEY_MONTH);
      if (storedMonth) setMonth(parseInt(storedMonth));

      const storedRole = localStorage.getItem(STORAGE_KEY_ROLE) as UserRole | null;
      if (storedRole && ROLE_TABS[storedRole]) setUserRole(storedRole);
    } catch (e) {
      console.error('Error loading localStorage:', e);
    }
  }, []);

  // Synchronize States to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARD_ID, activeWardId);
  }, [activeWardId]);

  useEffect(() => {
    if (Object.keys(wardPersonnel).length > 0) {
      localStorage.setItem(STORAGE_KEY_WARD_PERSONNEL, JSON.stringify(wardPersonnel));
    }
  }, [wardPersonnel]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARD_SCHEDULES, JSON.stringify(wardSchedules));
  }, [wardSchedules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARD_APPROVED, JSON.stringify(wardApprovedSchedules));
  }, [wardApprovedSchedules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARD_STATUSES, JSON.stringify(wardApprovalStatuses));
  }, [wardApprovalStatuses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WARD_PINNED, JSON.stringify(wardPinnedShifts));
  }, [wardPinnedShifts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CHANGE_LOGS, JSON.stringify(changeLogs));
  }, [changeLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_POLICIES, JSON.stringify(policies));
  }, [policies]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SHIFT_TYPES, JSON.stringify(shiftTypes));
  }, [shiftTypes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_OT, JSON.stringify(otSettings));
  }, [otSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_YEAR, year.toString());
    localStorage.setItem(STORAGE_KEY_MONTH, month.toString());
  }, [year, month]);

  // Compute number of days in selected month
  const getDaysInMonth = () => {
    return new Date(year - 543, month, 0).getDate();
  };

  const daysCount = getDaysInMonth();

  // Active Ward Helpers
  const personnel = wardPersonnel[activeWardId] || [];
  const schedule = wardSchedules[activeWardId] || {};
  const pinnedShifts = wardPinnedShifts[activeWardId] || {};
  const activeWard = INITIAL_WARDS.find(w => w.id === activeWardId) || INITIAL_WARDS[0];

  const handleWardChange = (wardId: string) => {
    setActiveWardId(wardId);
    setSaveStatus(`ย้ายกลุ่มงานปฏิบัติงานไปยัง ${INITIAL_WARDS.find(w => w.id === wardId)?.name}`);
  };

  const handleManualSave = () => {
    setSaveStatus('บันทึกข้อมูลดราฟต์ล่าสุดลงระบบสำเร็จแล้ว ✓');
    setTimeout(() => setSaveStatus('กำลังทำงานอยู่บนระบบจัดเวรความปลอดภัยสูงสุด'), 3000);
  };

  // Operations and Log Handlers
  const logShiftChange = (pId: string, pName: string, day: number, oldVal: string | null, newVal: string | null, note: string) => {
    const newLog: ChangeLog = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toLocaleString('th-TH'),
      wardId: activeWardId,
      wardName: activeWard.name,
      personnelId: pId,
      personnelName: pName,
      day,
      oldShift: oldVal,
      newShift: newVal,
      note
    };
    setChangeLogs(prev => [newLog, ...prev]);
  };

  const handleAddPersonnel = (person: Omit<Personnel, 'id' | 'order'>) => {
    const activeList = wardPersonnel[activeWardId] || [];
    const rolePrefixes: Record<Role, string> = {
      doctor: 'DOC',
      nurse: 'RN',
      assistant: 'PN',
      room: 'OR'
    };
    const prefix = rolePrefixes[person.role];
    const roleList = activeList.filter(p => p.role === person.role);
    const newId = `${prefix}${String(roleList.length + 1).padStart(3, '0')}`;
    const newOrder = activeList.length + 1;

    const newPerson: Personnel = {
      ...person,
      id: newId,
      order: newOrder
    };

    setWardPersonnel({
      ...wardPersonnel,
      [activeWardId]: [...activeList, newPerson]
    });
  };

  const handleUpdatePersonnel = (updated: Personnel) => {
    const activeList = wardPersonnel[activeWardId] || [];
    setWardPersonnel({
      ...wardPersonnel,
      [activeWardId]: activeList.map(p => p.id === updated.id ? updated : p)
    });
  };

  const handleDeletePersonnel = (id: string) => {
    const activeList = wardPersonnel[activeWardId] || [];
    const activeSched = wardSchedules[activeWardId] || {};
    const activePinned = wardPinnedShifts[activeWardId] || {};

    const updatedList = activeList.filter(p => p.id !== id);
    const updatedSched = { ...activeSched };
    const updatedPinned = { ...activePinned };

    for (let d = 1; d <= 31; d++) {
      delete updatedSched[`${id}-${d}`];
      delete updatedPinned[`${id}-${d}`];
    }

    setWardPersonnel({
      ...wardPersonnel,
      [activeWardId]: updatedList
    });
    setWardSchedules({
      ...wardSchedules,
      [activeWardId]: updatedSched
    });
    setWardPinnedShifts({
      ...wardPinnedShifts,
      [activeWardId]: updatedPinned
    });
  };

  const handleUpdateSchedule = (key: string, value: string | null) => {
    const activeSched = wardSchedules[activeWardId] || {};
    const oldVal = activeSched[key] || null;
    if (oldVal === value) return;

    const parts = key.split('-');
    const pId = parts[0];
    const day = parseInt(parts[parts.length - 1]);
    const staff = personnel.find(p => p.id === pId);
    const staffName = staff ? staff.name : pId;

    const updated = { ...activeSched };
    if (value === null) {
      delete updated[key];
    } else {
      updated[key] = value;
    }

    setWardSchedules({
      ...wardSchedules,
      [activeWardId]: updated
    });

    logShiftChange(pId, staffName, day, oldVal, value, 'แก้ไขผ่านหน้าตารางกะเวร');
  };

  const handleTogglePin = (key: string) => {
    const activePinned = wardPinnedShifts[activeWardId] || {};
    const updated = { ...activePinned };
    if (updated[key]) {
      delete updated[key];
    } else {
      updated[key] = true;
    }
    setWardPinnedShifts({
      ...wardPinnedShifts,
      [activeWardId]: updated
    });
  };

  const handleClearSchedule = () => {
    if (confirm('คุณต้องการเคลียร์ตารางเวรทั้งหมดของเดือนนี้หรือไม่? (เวรที่ล็อก 🔒 ไว้จะไม่ถูกเคลียร์)')) {
      const activeSched = wardSchedules[activeWardId] || {};
      const activePinned = wardPinnedShifts[activeWardId] || {};
      const updated = { ...activeSched };
      
      Object.keys(updated).forEach(key => {
        const parts = key.split('-');
        const pId = parts[0];
        const day = parseInt(parts[parts.length - 1]);
        const staff = personnel.find(p => p.id === pId);

        if (!activePinned[key]) {
          const oldVal = updated[key];
          delete updated[key];
          logShiftChange(pId, staff ? staff.name : pId, day, oldVal, null, 'ล้างกะทั้งหมด');
        }
      });

      setWardSchedules({
        ...wardSchedules,
        [activeWardId]: updated
      });
    }
  };

  const handleAutoSchedule = () => {
    const activeStaff = personnel.filter(p => p.active);
    const updatedSchedule = { ...schedule };

    const doctors = activeStaff.filter(p => p.role === 'doctor');
    const nurses = activeStaff.filter(p => p.role === 'nurse');
    const assistants = activeStaff.filter(p => p.role === 'assistant');
    const rooms = activeStaff.filter(p => p.role === 'room');

    for (let day = 1; day <= daysCount; day++) {
      const dateObj = new Date(year - 543, month - 1, day);
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

      // 1. Doctors Auto-Scheduling
      doctors.forEach((doc, idx) => {
        const key = `${doc.id}-${day}`;
        if (pinnedShifts[key]) return;

        const yesterdayKey = `${doc.id}-${day - 1}`;
        const yesterdayShift = updatedSchedule[yesterdayKey];

        if (yesterdayShift === 'ด' || yesterdayShift === 'OR') {
          updatedSchedule[key] = 'O';
        } else {
          const cycleSeed = (idx + day) % 5;
          if (cycleSeed === 0) updatedSchedule[key] = 'ช';
          else if (cycleSeed === 1) updatedSchedule[key] = 'บ';
          else if (cycleSeed === 2) updatedSchedule[key] = 'ด';
          else if (cycleSeed === 3) updatedSchedule[key] = 'OR';
          else updatedSchedule[key] = 'O';
        }
      });

      // 2. Rooms Auto-Scheduling
      rooms.forEach((room, idx) => {
        const key = `${room.id}-${day}`;
        if (pinnedShifts[key]) return;

        if (isWeekend) {
          updatedSchedule[key] = (idx + day) % 3 === 0 ? 'OR' : 'O';
        } else {
          const cycleSeed = (idx + day) % 3;
          if (cycleSeed === 0) updatedSchedule[key] = 'ช';
          else if (cycleSeed === 1) updatedSchedule[key] = 'บ';
          else updatedSchedule[key] = 'O';
        }
      });

      // 3. Nurses & Assistants Auto-Scheduling
      const scheduleStaffRole = (staffList: Personnel[], minCh: number, minBa: number, minDu: number) => {
        const eligible = staffList.filter(s => {
          const key = `${s.id}-${day}`;
          if (pinnedShifts[key]) return false;
          
          const yesterdayKey = `${s.id}-${day - 1}`;
          const yesterdayShift = updatedSchedule[yesterdayKey];
          if (!policies.allowAfternoonToNight && (yesterdayShift === 'บ' || yesterdayShift === 'BD')) {
            return false;
          }
          return true;
        });

        const shuffled = [...eligible].sort(() => 0.5 - Math.random());

        let assignedCh = 0;
        let assignedBa = 0;
        let assignedDu = 0;

        shuffled.forEach((staff) => {
          const key = `${staff.id}-${day}`;
          const yesterdayKey = `${staff.id}-${day - 1}`;
          
          if (policies.banNightAfterOff && updatedSchedule[yesterdayKey] === 'ด') {
            updatedSchedule[key] = 'O';
            return;
          }

          if (assignedCh < minCh) {
            updatedSchedule[key] = 'ช';
            assignedCh++;
          } else if (assignedBa < minBa) {
            updatedSchedule[key] = 'บ';
            assignedBa++;
          } else if (assignedDu < minDu) {
            updatedSchedule[key] = 'ด';
            assignedDu++;
          } else {
            const rand = Math.floor(Math.random() * 10);
            if (rand === 0) updatedSchedule[key] = 'T';
            else updatedSchedule[key] = 'O';
          }
        });
      };

      if (isWeekend) {
        scheduleStaffRole(nurses, 1, 1, 1);
        scheduleStaffRole(assistants, 1, 1, 0);
      } else {
        scheduleStaffRole(nurses, 2, 1, 1);
        scheduleStaffRole(assistants, 1, 1, 1);
      }
    }

    setWardSchedules({
      ...wardSchedules,
      [activeWardId]: updatedSchedule
    });
    setSaveStatus('จัดตารางเวรอัจฉริยะเสร็จสมบูรณ์เรียบร้อย! ✨');
    setTimeout(() => setSaveStatus('ระบบเซฟความปลอดภัยลงฐานข้อมูลอัตโนมัติแล้ว'), 3500);
  };

  // Import workflows
  const handleImportPersonnel = (newStaff: Omit<Personnel, 'id' | 'order'>[]) => {
    const activeList = wardPersonnel[activeWardId] || [];
    const rolePrefixes: Record<Role, string> = {
      doctor: 'DOC',
      nurse: 'RN',
      assistant: 'PN',
      room: 'OR'
    };

    const added = newStaff.map((person, idx) => {
      const prefix = rolePrefixes[person.role];
      const count = activeList.filter(p => p.role === person.role).length + idx + 1;
      const id = `${prefix}${String(count).padStart(3, '0')}`;
      const order = activeList.length + idx + 1;
      return {
        ...person,
        id,
        order
      };
    });

    setWardPersonnel({
      ...wardPersonnel,
      [activeWardId]: [...activeList, ...added]
    });
    setSaveStatus(`นำเข้าข้อมูลบุคลากรใหม่จำนวน ${added.length} รายสำเร็จ`);
  };

  const handleImportSchedule = (imported: Record<string, string>) => {
    const activeSched = wardSchedules[activeWardId] || {};
    setWardSchedules({
      ...wardSchedules,
      [activeWardId]: {
        ...activeSched,
        ...imported
      }
    });
    setSaveStatus('นำเข้าตารางปฏิบัติการสำเร็จแล้ว ✓');
  };

  const handleApproveSchedule = () => {
    const activeSched = wardSchedules[activeWardId] || {};
    setWardApprovedSchedules({
      ...wardApprovedSchedules,
      [activeWardId]: { ...activeSched }
    });
    setWardApprovalStatuses({
      ...wardApprovalStatuses,
      [activeWardId]: 'pending_approval'
    });
    setSaveStatus('บันทึกส่งขออนุมัติเวรแล้ว ✓');
    alert('ส่งขออนุมัติเวรสำเร็จ! ระบบได้บันทึกภาพถ่ายตารางเวร (Snapshot Standard) สำหรับใช้ตรวจเช็คความถูกต้องเทียบกับตารางทำงานจริงแล้ว');
  };

  const handleSubmitActualSchedule = () => {
    setWardApprovalStatuses({
      ...wardApprovalStatuses,
      [activeWardId]: 'approved'
    });
    setSaveStatus('นำส่งเวรจริงปฏิบัติงานเรียบร้อย ✓');
    alert('นำส่งเวรจริงและจัดตั้งล็อคระบบความคุ้มครองเรียบร้อยแล้ว!');
  };

  const handleClearLogs = () => {
    if (confirm('ต้องการลบประวัติการเปลี่ยนแปลงทั้งหมดหรือไม่?')) {
      setChangeLogs([]);
    }
  };

  // Cross-Ward Time Overlap Conflict Checker
  const checkOverlapConflicts = () => {
    const conflicts: {
      day: number;
      personName: string;
      ward1: string;
      ward2: string;
      shift1: string;
      shift2: string;
      time1: string;
      time2: string;
    }[] = [];

    for (let day = 1; day <= daysCount; day++) {
      const dayAssignments: Record<string, { wardName: string; shiftCode: string; startHour: number; endHour: number }[]> = {};

      INITIAL_WARDS.forEach(w => {
        const pList = wardPersonnel[w.id] || [];
        const sched = wardSchedules[w.id] || {};

        pList.forEach(p => {
          const cellKey = `${p.id}-${day}`;
          const shiftCode = sched[cellKey];
          if (shiftCode && shiftCode !== 'O' && shiftCode !== 'V' && shiftCode !== 'T') {
            const matchedShift = shiftTypes.find(s => s.code === shiftCode);
            if (matchedShift) {
              const key = p.name.trim();
              if (!dayAssignments[key]) {
                dayAssignments[key] = [];
              }
              dayAssignments[key].push({
                wardName: w.name,
                shiftCode: shiftCode,
                startHour: matchedShift.startHour,
                endHour: matchedShift.endHour
              });
            }
          }
        });
      });

      Object.entries(dayAssignments).forEach(([personName, assigns]) => {
        if (assigns.length > 1) {
          for (let i = 0; i < assigns.length; i++) {
            for (let j = i + 1; j < assigns.length; j++) {
              const a1 = assigns[i];
              const a2 = assigns[j];

              const start1 = a1.startHour;
              const end1 = a1.endHour;
              const start2 = a2.startHour;
              const end2 = a2.endHour;

              // [start1, end1] and [start2, end2] overlap if:
              const overlaps = Math.max(start1, start2) < Math.min(end1, end2);

              if (overlaps) {
                conflicts.push({
                  day,
                  personName,
                  ward1: a1.wardName,
                  ward2: a2.wardName,
                  shift1: a1.shiftCode,
                  shift2: a2.shiftCode,
                  time1: `${String(start1).padStart(2, '0')}:00 - ${String(end1).padStart(2, '0')}:00`,
                  time2: `${String(start2).padStart(2, '0')}:00 - ${String(end2).padStart(2, '0')}:00`,
                });
              }
            }
          }
        }
      });
    }

    return conflicts;
  };

  const overlapConflicts = checkOverlapConflicts();
  const hasOverlapConflicts = overlapConflicts.length > 0;

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Left Sidebar (ChartSum-style light theme) - Desktop Only */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-white border-r border-slate-200 flex flex-col flex-shrink-0 hidden md:flex no-print transition-[width] duration-200`}>
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-slate-100 flex-shrink-0 ${sidebarCollapsed ? 'justify-center px-1' : 'px-3'}`}>
          <img
            src="/sati-logo.jpg"
            alt="Sati"
            className={`object-contain object-left ${sidebarCollapsed ? 'h-8 w-full' : 'h-10 w-auto max-w-[150px]'}`}
          />
        </div>

        {/* Grouped Nav Items — filtered by the current user's role */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = visibleNav.filter((n) => group.keys.includes(n.key));
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                {!sidebarCollapsed && (
                  <div className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {items.map(({ key, icon: Icon, label, title }) => {
                    const isActive = activeTab === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        title={title}
                        className={`relative w-full flex items-center gap-3 rounded-lg cursor-pointer transition-all ${
                          sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'
                        } ${
                          isActive
                            ? 'bg-sati-azure/8 text-sati-azure font-bold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-semibold'
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r bg-sati-azure" />
                        )}
                        <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-sati-azure' : 'text-slate-400'}`} />
                        {!sidebarCollapsed && <span className="text-[12.5px] truncate">{label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer/Version */}
        <div className={`border-t border-slate-100 py-3 flex-shrink-0 ${sidebarCollapsed ? 'text-center px-0' : 'px-4'}`}>
          <div className="text-[10px] text-slate-400 font-medium" title="Sati Shift & OT Audit v2.9">
            {sidebarCollapsed ? 'v2.9' : 'Sati Shift & OT Audit · v2.9'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden h-full bg-slate-50">
        {/* Clean top bar (ChartSum-style) */}
        <header className="h-14 bg-white border-b border-slate-200 px-3 md:px-4 flex items-center justify-between z-30 no-print flex-shrink-0">
          {/* Left: collapse toggle + context selectors */}
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hidden md:flex items-center justify-center transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
            >
              <PanelLeft className="w-4.5 h-4.5" />
            </button>

            {/* Mobile Logo */}
            <div className="md:hidden flex-shrink-0">
              <img src="/sati-logo.jpg" alt="Sati" className="h-7 w-auto object-contain" />
            </div>

            {/* Context selectors */}
            <div className="hidden md:flex items-center gap-2">
              <select 
                value={activeWardId}
                onChange={(e) => handleWardChange(e.target.value)}
                className="bg-white border border-slate-200 hover:border-sati-azure text-slate-700 text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-sati-azure cursor-pointer"
              >
                {INITIAL_WARDS.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>

              <select 
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="bg-white border border-slate-200 hover:border-sati-azure text-slate-700 text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-sati-azure cursor-pointer"
              >
                {THAI_MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>

              <select 
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="bg-white border border-slate-200 hover:border-sati-azure text-slate-700 text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-sati-azure cursor-pointer"
              >
                <option value={2569}>พ.ศ. 2569</option>
                <option value={2570}>พ.ศ. 2570</option>
                <option value={2571}>พ.ศ. 2571</option>
                <option value={2572}>พ.ศ. 2572</option>
              </select>

              <span className="text-[10px] text-sati-azure bg-sati-azure/5 font-semibold px-2 py-1 rounded-md border border-sati-azure/10 font-mono">{daysCount} วัน</span>
            </div>
          </div>

          {/* Right: status + role + save + avatar */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              <span className="text-slate-600 max-w-[220px] truncate">{saveStatus}</span>
            </div>

            <button
              onClick={handleManualSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sati-azure hover:bg-sati-azure/90 text-white text-[11px] font-bold shadow-sm active:scale-98 transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">บันทึกดราฟต์</span>
            </button>

            {/* Role switcher */}
            <div className="flex items-center gap-1.5 pl-1 md:pl-2 md:border-l md:border-slate-200" title={ROLE_DESCRIPTIONS[userRole]}>
              <div className="w-8 h-8 rounded-full bg-sati-azure/10 text-sati-azure hidden sm:flex items-center justify-center flex-shrink-0">
                <UserCog className="w-4 h-4" />
              </div>
              <select
                value={userRole}
                onChange={(e) => handleChangeRole(e.target.value as UserRole)}
                className="bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold py-1.5 px-2 rounded-lg hover:border-sati-azure transition-all focus:outline-none focus:ring-1 focus:ring-sati-azure cursor-pointer max-w-[150px]"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* Mobile Sub-Header for selectors and tab navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex flex-col gap-2 md:hidden no-print flex-shrink-0">
          {/* Selectors row */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 text-[10px]">
              <span className="text-slate-500">แผนก:</span>
              <select 
                value={activeWardId}
                onChange={(e) => handleWardChange(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 font-bold py-0.5 px-1 rounded text-[10px]"
              >
                {INITIAL_WARDS.map((w) => (
                  <option key={w.id} value={w.id}>{w.id}</option>
                ))}
              </select>

              <span className="text-slate-500">เดือน:</span>
              <select 
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="bg-white border border-slate-200 text-slate-700 font-bold py-0.5 px-1 rounded text-[10px]"
              >
                {THAI_MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m.substring(0, 3)}</option>
                ))}
              </select>
              <select 
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="bg-white border border-slate-200 text-slate-700 font-bold py-0.5 px-1 rounded text-[10px]"
              >
                <option value={2569}>2569</option>
                <option value={2570}>2570</option>
              </select>
            </div>
            
            <div className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate max-w-[120px]">
              {saveStatus}
            </div>
          </div>

          {/* Quick tab nav for mobile — filtered by role */}
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${visibleNav.length}, minmax(0, 1fr))` }}>
            {visibleNav.map(({ key, icon: IconComp, short }) => {
              const isSel = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex flex-col items-center justify-center py-1 rounded text-[8px] font-bold border transition-all ${
                    isSel 
                      ? 'bg-sati-azure border-sati-space text-white' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 mb-0.5" />
                  <span className="truncate max-w-full">{short}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Safety Guideline Alert - subtle ribbon (schedule context) */}
        {activeTab === 'schedule' && (
          <section className="bg-amber-50 border-b border-amber-100 px-4 py-1.5 flex items-center justify-between text-[10px] sm:text-[11px] leading-tight no-print flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="bg-warning/15 text-warning-deep font-bold text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider">Safety</span>
              <span className="text-amber-800 hidden md:inline">ห้ามปฏิบัติงานควบกะติดต่อกันเกิน 16 ชั่วโมง (เช่น บ่ายควบดึก) เพื่อป้องกันภาวะเหนื่อยล้าของบุคลากร</span>
              <span className="text-amber-800 md:hidden">ห้ามขึ้นเวรควบกะเกิน 16 ชม.</span>
            </div>
            <div className="text-[9px] text-slate-400 hidden lg:block">บันทึกอัตโนมัติแล้ว</div>
          </section>
        )}

        {/* Cross-Ward Time Overlap Warning Panel (Dynamic Hospital Watchdog) */}
        {hasOverlapConflicts && (
          <div className="bg-rose-50 border-b border-rose-200 p-3 flex flex-col gap-2 no-print flex-shrink-0 animate-fade-in shadow-xs">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-[12px]">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 animate-bounce" />
              <span>ตรวจพบการขึ้นเวรปฏิบัติงานเวลาทับซ้อนกันข้ามกลุ่มงาน/ตึก! (Cross-Ward Overlap Detected)</span>
              <span className="text-[10px] bg-rose-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                {overlapConflicts.length} จุดผิดพลาด
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[140px] overflow-y-auto">
              {overlapConflicts.map((conf, idx) => (
                <div key={idx} className="bg-white border border-rose-150 p-2 rounded text-[11px] flex flex-col gap-1 shadow-2xs hover:border-rose-400 transition-all">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span className="text-indigo-600 font-extrabold">วันที่ {conf.day}</span>
                    <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">{conf.personName}</span>
                  </div>
                  <div className="text-slate-600 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate max-w-[120px]">{conf.ward1}</span>
                      <span className="font-mono text-emerald-600 font-bold">{conf.shift1} ({conf.time1})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate max-w-[120px]">{conf.ward2}</span>
                      <span className="font-mono text-amber-600 font-bold">{conf.shift2} ({conf.time2})</span>
                    </div>
                  </div>
                  <div className="text-[9px] text-rose-500 font-medium italic mt-1 border-t border-rose-50 pt-1">
                    ⚠️ ห้ามขึ้นเวรชนกันแม้จะอยู่คนละตึกหรือวอร์ด!
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Master Main Views Area */}
        <main className="flex-1 overflow-y-auto print-target bg-slate-50 flex flex-col">
          {/* Breadcrumb + page title */}
          <div className="px-4 md:px-6 pt-5 pb-1 no-print">
            <nav className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
              <Home className="w-3 h-3" />
              <span>หน้าหลัก</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-semibold">{pageMeta.title}</span>
            </nav>
            <h1 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">{pageMeta.title}</h1>
            <p className="text-[11px] md:text-xs text-slate-500 mt-0.5">{pageMeta.subtitle}</p>
          </div>

          <div className="px-4 md:px-6 py-4 flex-1">
          {activeTab === 'dashboard' && (
            <Dashboard 
              personnel={personnel}
              schedule={schedule}
              year={year}
              month={month}
              otSettings={otSettings}
              daysCount={daysCount}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleBoard 
              personnel={personnel}
              schedule={schedule}
              onUpdateSchedule={handleUpdateSchedule}
              pinnedShifts={pinnedShifts}
              onTogglePin={handleTogglePin}
              year={year}
              month={month}
              daysCount={daysCount}
              onAutoSchedule={handleAutoSchedule}
              onClearSchedule={handleClearSchedule}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView 
              personnel={personnel}
              schedule={schedule}
              otSettings={otSettings}
              onUpdateOTSettings={setOTSettings}
              year={year}
              month={month}
              daysCount={daysCount}
              wardPersonnel={wardPersonnel}
              wardSchedules={wardSchedules}
              activeWardId={activeWardId}
              wards={INITIAL_WARDS}
              onUpdateWardPersonnel={setWardPersonnel}
            />
          )}

          {activeTab === 'personnel' && (
            <PersonnelView 
              personnel={personnel}
              onAddPersonnel={handleAddPersonnel}
              onUpdatePersonnel={handleUpdatePersonnel}
              onDeletePersonnel={handleDeletePersonnel}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView 
              personnel={personnel}
              schedule={schedule}
              otSettings={otSettings}
              year={year}
              month={month}
              daysCount={daysCount}
              wards={INITIAL_WARDS}
              wardPersonnel={wardPersonnel}
              wardSchedules={wardSchedules}
              activeWardId={activeWardId}
            />
          )}

          {activeTab === 'rules' && (
            <RulesSettingsView
              policies={policies}
              onUpdatePolicies={setPolicies}
              shiftTypes={shiftTypes}
              onUpdateShiftTypes={setShiftTypes}
              onResetToDefaults={() => {
                setPolicies(DEFAULT_POLICIES);
                setShiftTypes(SHIFT_TYPES);
              }}
            />
          )}

          {activeTab === 'integration' && (
            <WardIntegrationView
              activeWard={activeWard}
              wards={INITIAL_WARDS}
              onChangeWard={handleWardChange}
              personnel={personnel}
              onImportPersonnel={handleImportPersonnel}
              schedule={schedule}
              approvedSchedule={wardApprovedSchedules[activeWardId] || {}}
              onImportSchedule={handleImportSchedule}
              onApproveSchedule={handleApproveSchedule}
              onSubmitActualSchedule={handleSubmitActualSchedule}
              approvalStatus={wardApprovalStatuses[activeWardId] || 'draft'}
              changeLogs={changeLogs}
              onClearLogs={handleClearLogs}
              daysCount={daysCount}
            />
          )}
          </div>

          {/* Footer */}
          <footer className="border-t border-slate-200 bg-white px-4 md:px-6 py-3 flex items-center justify-between text-[10px] text-slate-400 no-print">
            <span>© 2026 <span className="font-semibold text-sati-azure">Sati</span> Co., Ltd. สงวนลิขสิทธิ์</span>
            <span className="font-mono">เวอร์ชัน v2.9.0</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
