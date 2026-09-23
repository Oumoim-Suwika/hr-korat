/** Typed client for the Sati backend API. */

// Empty string = same-origin (production: CloudFront routes /api/* to Lambda).
// Local dev overrides via .env.development (VITE_API_URL=http://localhost:4000).
const API_URL = (import.meta as any).env?.VITE_API_URL ?? '';
const TOKEN_KEY = 'sati_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, data?.error, data?.message || data?.error || `HTTP ${res.status}`);
  }
  return data as T;
}

// ---- types (mirror backend) -------------------------------------------------
export type UserRole = 'staff' | 'supervisor' | 'finance' | 'admin';
export interface AuthUser {
  id: number; email: string; displayName: string;
  role: UserRole; wardId: number | null; employeeId: number | null;
}
export interface Ward { id: number; code: string; name: string; building?: string; phone?: string; }
export interface Employee {
  id: number; prefix?: string; firstName: string; lastName?: string;
  role: string; positionText?: string; employeeType?: string; paymentType: string;
  line?: string; homeWardId?: number; sortOrder: number;
}
export interface ShiftType {
  code: string; name: string; hours: number; isOt: boolean; isWork: boolean;
  category?: string | null; sortOrder: number;
}
export interface WorkingCalendar {
  id: number; wardId: number; year: number; month: number;
  workingDays: number; locked: boolean; lockedAt?: string | null;
}
export interface Roster {
  id: number; wardId: number; year: number; month: number;
  status: 'draft' | 'pending_approval' | 'approved'; note?: string | null;
}
export interface RosterCell {
  id?: number; employeeId: number; day: number;
  normalCode?: string | null; otCode?: string | null; pinned?: boolean; external?: boolean;
}
export interface RosterSigner { ordinal: number; name: string; title?: string | null; signerRole?: 'controller' | 'approver' | 'other'; }
export interface RequestItem {
  id: number; type: string; employeeId: number; wardId: number; year: number; month: number;
  day?: number | null; toDay?: number | null; fromCode?: string | null; toCode?: string | null;
  reason?: string | null; status: string; createdAt: string;
}

// ---- api surface ------------------------------------------------------------
export const api = {
  async login(email: string, password: string) {
    const r = await request<{ token: string; user: AuthUser }>('POST', '/api/auth/login', { email, password });
    setToken(r.token);
    return r.user;
  },
  logout() { setToken(null); },
  me: () => request<{ user: AuthUser }>('GET', '/api/me').then((r) => r.user),
  health: () => request<{ ok: boolean }>('GET', '/api/health'),

  wards: () => request<{ wards: Ward[] }>('GET', '/api/wards').then((r) => r.wards),
  shiftTypes: () => request<{ shiftTypes: ShiftType[] }>('GET', '/api/shift-types').then((r) => r.shiftTypes),
  employees: (wardId: number) => request<{ employees: Employee[] }>('GET', `/api/employees?wardId=${wardId}`).then((r) => r.employees),

  getWorkingCalendar: (wardId: number, year: number, month: number) =>
    request<{ calendar: WorkingCalendar | null }>('GET', `/api/working-calendar?wardId=${wardId}&year=${year}&month=${month}`).then((r) => r.calendar),
  setWorkingCalendar: (wardId: number, year: number, month: number, workingDays: number, locked: boolean) =>
    request<{ calendar: WorkingCalendar }>('POST', '/api/working-calendar', { wardId, year, month, workingDays, locked }).then((r) => r.calendar),

  getRoster: (wardId: number, year: number, month: number) =>
    request<{ roster: Roster | null; cells: RosterCell[]; signers: RosterSigner[] }>('GET', `/api/rosters?wardId=${wardId}&year=${year}&month=${month}`),
  saveRoster: (payload: { wardId: number; year: number; month: number; note?: string | null; signers?: RosterSigner[]; cells: RosterCell[] }) =>
    request<{ roster: Roster; savedCells: number }>('POST', '/api/rosters', payload),
  submitRoster: (id: number) => request<{ roster: Roster }>('POST', `/api/rosters/${id}/submit`),
  approveRoster: (id: number) => request<{ roster: Roster }>('POST', `/api/rosters/${id}/approve`),

  getRequests: (wardId: number, year: number, month: number) =>
    request<{ requests: RequestItem[] }>('GET', `/api/requests?wardId=${wardId}&year=${year}&month=${month}`).then((r) => r.requests),
  createRequest: (payload: Partial<RequestItem> & { type: string; employeeId: number; wardId: number; year: number; month: number }) =>
    request<{ request: RequestItem }>('POST', '/api/requests', payload).then((r) => r.request),
  decideRequest: (id: number, decision: 'approved' | 'rejected') =>
    request<{ request: RequestItem }>('POST', `/api/requests/${id}/decide`, { decision }).then((r) => r.request),
};

export { API_URL };
