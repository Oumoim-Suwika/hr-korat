/**
 * Role-based access control (RBAC) for Sati Shift & OT Audit.
 *
 * Mirrors the real hospital workflow:
 *  - staff       พนักงาน/เจ้าหน้าที่ — ดูเวรตัวเอง, ขอเบิก/ยื่นปริมาณงานของตัวเอง
 *  - supervisor  หัวหน้างาน/หัวหน้ากลุ่มงาน — จัดเวร, จัดการบุคลากรในแผนก, ขอขึ้น OT, ส่งอนุมัติ
 *  - finance     ทีมการเงิน — ตรวจสอบรายจ่ายทุกแผนก, ออกหลักฐานการจ่ายเงิน
 *  - admin       ผู้ดูแลระบบ — เข้าถึงทุกเมนู
 */

export type UserRole = 'staff' | 'supervisor' | 'finance' | 'admin';

export type TabKey =
  | 'dashboard'
  | 'schedule'
  | 'finance'
  | 'personnel'
  | 'documents'
  | 'rules'
  | 'integration';

export const ROLE_LABELS: Record<UserRole, string> = {
  staff: 'เจ้าหน้าที่จัดตารางเวร / พนักงาน',
  supervisor: 'หัวหน้าพยาบาล / หัวหน้าส่วนงาน',
  finance: 'ทีมการเงิน (หัวหน้า/เจ้าหน้าที่)',
  admin: 'ผู้ดูแลระบบ (Admin)',
};

export const ROLE_SHORT: Record<UserRole, string> = {
  staff: 'พนักงาน',
  supervisor: 'หัวหน้างาน',
  finance: 'การเงิน',
  admin: 'Admin',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  staff: 'จัดตารางเวร ยื่นขอเบิก OT และกรอกปริมาณงาน — ไม่เห็นเมนูการเงิน',
  supervisor: 'จัดตารางเวร จัดการบุคลากรในกลุ่มงาน ขอขึ้น OT และส่งขออนุมัติ — ไม่เห็นเมนูการเงิน',
  finance: 'ดูตารางเวรที่จัดแล้ว/ขอจัด/เปลี่ยนแปลง และเข้าถึงเมนูการเงินทั้งหมด',
  admin: 'เข้าถึงและจัดการได้ทุกเมนูของระบบ',
};

/**
 * Tabs each role may see, in display order.
 * - Scheduling roles (staff, supervisor) do NOT see the finance menu.
 * - Finance sees the arranged schedule (view/request/change) + all finance menus.
 */
export const ROLE_TABS: Record<UserRole, TabKey[]> = {
  staff: ['dashboard', 'schedule', 'documents', 'integration'],
  supervisor: ['dashboard', 'schedule', 'personnel', 'documents', 'integration', 'rules'],
  finance: ['dashboard', 'schedule', 'finance', 'documents', 'integration'],
  admin: ['dashboard', 'schedule', 'finance', 'personnel', 'documents', 'rules', 'integration'],
};

export function canAccess(role: UserRole, tab: TabKey): boolean {
  return ROLE_TABS[role].includes(tab);
}
