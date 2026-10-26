import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type Employee, type RequestItem, ApiError } from '../api/client';
import type { UserRole } from '../api/client';
import { THAI_MONTHS } from '../data';
import { downloadFile } from '../lib/useRosterData';
import { Send, Check, X, Loader2, Plus, Upload, Download, FileSpreadsheet, AlertTriangle } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  leave: 'ขอลา',
  shift_change: 'ขอเปลี่ยนเวร',
  ot: 'ขอขึ้น OT',
  shift_add: 'ขอขึ้นเวรเพิ่ม',
};
// ยกเวร (cancel shift, no replacement) is modelled as a shift_change to 'ออฟ'.
const labelFor = (r: { type: string; toCode?: string | null }) =>
  r.type === 'shift_change' && r.toCode === 'ออฟ' ? 'ยกเวร (ไม่มีคนแทน)' : (TYPE_LABEL[r.type] ?? r.type);
const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  pending: { t: 'รออนุมัติ', c: 'bg-amber-100 text-amber-700' },
  approved: { t: 'อนุมัติแล้ว', c: 'bg-emerald-100 text-emerald-700' },
  rejected: { t: 'ไม่อนุมัติ', c: 'bg-rose-100 text-rose-700' },
  cancelled: { t: 'ยกเลิก', c: 'bg-slate-100 text-slate-500' },
};

interface Props {
  role: UserRole;
  wardId: number;
  year: number;
  month: number;
  myEmployeeId: number | null;
  filterType?: string;
  title?: string;
}

export default function RequestsView({ role, wardId, year, month, myEmployeeId, filterType, title }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const isStaff = role === 'staff';
  const canDecide = role === 'supervisor' || role === 'finance' || role === 'admin';
  // นำเข้าไฟล์ลา/ไปราชการแบบ bulk — เฉพาะหน้า "คำขอลา" และผู้มีสิทธิ์จัดการ
  const canImport = canDecide && filterType === 'leave';

  const showToast = (kind: 'ok' | 'err', msg: string) => { setToast({ kind, msg }); setTimeout(() => setToast(null), 3500); };

  // Named หัวหน้าผู้ควบคุม (controller) from the ward roster — shift-change
  // approvals are bound to this person (feedback: ผูกอนุมัติเปลี่ยนเวรกับหัวหน้าผู้ควบคุม).
  const [controllerName, setControllerName] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, reqs, ros] = await Promise.all([
        api.employees(wardId),
        api.getRequests(wardId, year, month),
        api.getRoster(wardId, year, month),
      ]);
      setEmployees(emps);
      setRequests(reqs);
      const ctrl = (ros.signers ?? []).find((s) => s.signerRole === 'controller');
      setControllerName(ctrl?.name?.trim() ?? '');
    } catch (e: any) { showToast('err', e?.message || 'โหลดไม่สำเร็จ'); }
    finally { setLoading(false); }
  }, [wardId, year, month]);

  useEffect(() => { load(); }, [load]);

  const empName = (id: number) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.prefix ?? ''}${e.firstName} ${e.lastName ?? ''}` : `#${id}`;
  };

  const decide = async (id: number, decision: 'approved' | 'rejected', reqType?: string) => {
    // Shift-change approvals must be authorised by the named หัวหน้าผู้ควบคุม.
    if (decision === 'approved' && reqType === 'shift_change' && !controllerName) {
      showToast('err', 'ยังไม่ได้ระบุ "หัวหน้าผู้ควบคุม" ในตารางเวร — โปรดระบุก่อนอนุมัติการเปลี่ยนเวร');
      return;
    }
    try {
      await api.decideRequest(id, decision);
      const applies = decision === 'approved' && ['leave', 'shift_change', 'shift_add'].includes(reqType ?? '');
      const base = decision === 'approved' ? (reqType === 'shift_change' && controllerName ? `อนุมัติโดยหัวหน้าผู้ควบคุม: ${controllerName}` : 'อนุมัติแล้ว') : 'ไม่อนุมัติแล้ว';
      showToast('ok', applies ? `${base} · อัปเดตลงตารางเวรอัตโนมัติแล้ว` : base);
      load();
    }
    catch (e: any) { showToast('err', e?.message || 'ไม่สำเร็จ'); }
  };

  const visible = useMemo(() => {
    let list = requests;
    if (filterType) list = list.filter((r) => r.type === filterType);
    if (isStaff && myEmployeeId) list = list.filter((r) => r.employeeId === myEmployeeId);
    return list;
  }, [requests, isStaff, myEmployeeId, filterType]);

  const pending = visible.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{title ?? 'คำขอ'} · {THAI_MONTHS[month - 1]} {year}</h2>
          <p className="text-sm text-slate-500">{isStaff ? 'คำขอของคุณ' : `ทั้งหมด ${visible.length} รายการ · รออนุมัติ ${pending.length}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImport && (
            <button onClick={() => setShowImport((s) => !s)} className="flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50">
              <FileSpreadsheet className="w-4 h-4" />นำเข้าไฟล์ลา/ไปราชการ
            </button>
          )}
          <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e]">
            <Plus className="w-4 h-4" />สร้างคำขอ
          </button>
        </div>
      </div>

      {toast && <div className={`text-sm rounded-lg px-3 py-2 ${toast.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{toast.msg}</div>}

      {showImport && canImport && (
        <LeaveImport
          employees={employees} wardId={wardId} year={year} month={month}
          onDone={(msg) => { setShowImport(false); showToast('ok', msg); load(); }}
          onError={(msg) => showToast('err', msg)}
          onClose={() => setShowImport(false)}
        />
      )}

      {showForm && (
        <RequestForm
          employees={employees} wardId={wardId} year={year} month={month}
          fixedEmployeeId={isStaff ? myEmployeeId : null}
          defaultType={(filterType as any) || 'leave'}
          onDone={(msg) => { setShowForm(false); showToast('ok', msg); load(); }}
          onError={(msg) => showToast('err', msg)}
        />
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีคำขอ</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {visible.map((r) => {
            const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.pending;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-700">{labelFor(r)}</span>
                    <span className="text-sm text-slate-500">{empName(r.employeeId)}</span>
                    {r.day && <span className="text-xs text-slate-400">วันที่ {r.day}{r.toDay ? `-${r.toDay}` : ''}</span>}
                    {(r.fromCode || r.toCode) && <span className="text-xs text-slate-400">{r.fromCode ?? '—'} → {r.toCode ?? '—'}</span>}
                  </div>
                  {r.reason && <div className="text-xs text-slate-400 mt-0.5 truncate">{r.reason}</div>}
                  {r.type === 'shift_change' && (
                    <div className="text-[11px] text-[#0F3575] mt-0.5">
                      {r.status === 'approved'
                        ? `อนุมัติการเปลี่ยนเวรโดยหัวหน้าผู้ควบคุม${controllerName ? ` : ${controllerName}` : ''}`
                        : `ผู้มีอำนาจอนุมัติ: หัวหน้าผู้ควบคุม${controllerName ? ` (${controllerName})` : ' — ยังไม่ได้ระบุในตารางเวร'}`}
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${st.c}`}>{st.t}</span>
                {canDecide && r.status === 'pending' && (
                  <div className="flex gap-1">
                    <button onClick={() => decide(r.id, 'approved', r.type)} title="อนุมัติ" className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Check className="w-4 h-4" /></button>
                    <button onClick={() => decide(r.id, 'rejected', r.type)} title="ไม่อนุมัติ" className="p-1.5 rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100"><X className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** หนึ่งแถวที่อ่านได้จากไฟล์ (จับคู่ชื่อแล้ว) */
interface ParsedLeaveRow {
  lineNo: number;
  rawName: string;
  employeeId: number | null;
  employeeName: string | null;
  day: number | null;
  toDay: number | null;
  reason: string;
  error: string | null;
}

/** ตัดบรรทัด CSV โดยรองรับค่าที่ครอบด้วยเครื่องหมายคำพูด */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const normName = (s: string) => s.replace(/\s|\u00a0/g, '').replace(/^(นาย|นาง|นางสาว|น\.ส\.|ด\.ช\.|ด\.ญ\.)/, '');

/**
 * นำเข้าข้อมูลลา / ไปราชการ จากไฟล์ CSV แบบ bulk (requirement 11.2).
 *
 * สโคปที่ตกลงในที่ประชุมกับโรงพยาบาลคือรองรับการนำเข้าไฟล์ สำหรับหน่วยที่ยัง
 * ไม่ได้ใช้ระบบลาออนไลน์เดียวกัน (ไม่ใช่การเชื่อม Real-time กับระบบ HR).
 *
 * มีขั้นตรวจทานก่อนยืนยัน เพราะการอนุมัติจะเขียนสัญลักษณ์ลา (V) / ไปราชการ (T)
 * ลงตารางเวรของเดือนนั้นจริง.
 */
function LeaveImport({ employees, wardId, year, month, onDone, onError, onClose }: {
  employees: Employee[]; wardId: number; year: number; month: number;
  onDone: (msg: string) => void; onError: (msg: string) => void; onClose: () => void;
}) {
  const [rows, setRows] = useState<ParsedLeaveRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const daysInMonth = new Date(year - 543, month, 0).getDate();

  const template = () => downloadFile(
    `เทมเพลตนำเข้าลา-ไปราชการ_${THAI_MONTHS[month - 1]}${year}.csv`,
    ['ชื่อ-นามสกุล,วันที่เริ่ม,ถึงวันที่,ประเภท/เหตุผล',
      'สมหญิง ดูแลดี,3,5,ลาพักผ่อน',
      'สมชาย ใจดี,12,12,ไปราชการ อบรมฟื้นฟูวิชาการ',
      'ปิยะดา ทองดี,20,,ลากิจ'].join('\n'),
  );

  const parse = async (file: File) => {
    setFileName(file.name);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (!lines.length) { onError('ไฟล์ว่าง'); return; }
      // ข้ามบรรทัดหัวตารางถ้ามี
      const start = /ชื่อ|name/i.test(lines[0]) ? 1 : 0;
      const parsed: ParsedLeaveRow[] = [];
      lines.slice(start).forEach((line, i) => {
        const [name, fromStr, toStr, reason] = splitCsvLine(line);
        if (!name && !fromStr) return;
        const lineNo = start + i + 1;
        const day = Number(fromStr);
        const toRaw = toStr ? Number(toStr) : NaN;
        const target = normName(name ?? '');
        const emp = employees.find((x) => {
          const full = normName(`${x.firstName}${x.lastName ?? ''}`);
          return full === target || (target.length >= 4 && (full.includes(target) || target.includes(full)));
        });

        let error: string | null = null;
        if (!name) error = 'ไม่มีชื่อ';
        else if (!emp) error = 'ไม่พบชื่อนี้ในกลุ่มงาน';
        else if (!day || day < 1 || day > daysInMonth) error = `วันที่เริ่มไม่ถูกต้อง (1-${daysInMonth})`;
        else if (toStr && (!toRaw || toRaw < day || toRaw > daysInMonth)) error = `ถึงวันที่ไม่ถูกต้อง (${day}-${daysInMonth})`;

        parsed.push({
          lineNo, rawName: name ?? '',
          employeeId: emp?.id ?? null,
          employeeName: emp ? `${emp.prefix ?? ''}${emp.firstName} ${emp.lastName ?? ''}`.trim() : null,
          day: Number.isFinite(day) ? day : null,
          toDay: toStr && Number.isFinite(toRaw) ? toRaw : null,
          reason: reason ?? '',
          error,
        });
      });
      if (!parsed.length) { onError('อ่านข้อมูลจากไฟล์ไม่ได้ — ตรวจรูปแบบคอลัมน์กับเทมเพลต'); return; }
      setRows(parsed);
    } catch { onError('อ่านไฟล์ไม่สำเร็จ'); }
  };

  const valid = rows?.filter((r) => !r.error) ?? [];
  const invalid = rows?.filter((r) => r.error) ?? [];

  const confirm = async () => {
    if (!valid.length) return;
    setBusy(true);
    try {
      const res = await api.importLeaveRequests({
        wardId, year, month, autoApprove,
        items: valid.map((r) => ({ employeeId: r.employeeId!, day: r.day!, toDay: r.toDay, reason: r.reason || null })),
      });
      onDone(
        autoApprove
          ? `นำเข้า ${res.imported} รายการ · อัปเดตลงตารางเวรแล้ว ${res.applied} รายการ${invalid.length ? ` · ข้าม ${invalid.length} แถวที่มีปัญหา` : ''}`
          : `นำเข้า ${res.imported} รายการ เข้าคิวรออนุมัติแล้ว${invalid.length ? ` · ข้าม ${invalid.length} แถว` : ''}`,
      );
    } catch (e: any) {
      onError(e?.message || 'นำเข้าไม่สำเร็จ');
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">นำเข้าข้อมูลลา / ไปราชการ · {THAI_MONTHS[month - 1]} {year}</h3>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">ปิด</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={template} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg"><Download className="w-4 h-4" />ดาวน์โหลดเทมเพลต</button>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Upload className="w-4 h-4" />เลือกไฟล์ CSV</button>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])} />
        {fileName && <span className="text-xs text-slate-400 self-center">{fileName}</span>}
      </div>

      <p className="text-[11px] text-slate-400">
        คอลัมน์: <b>ชื่อ-นามสกุล, วันที่เริ่ม, ถึงวันที่ (เว้นได้ถ้าวันเดียว), ประเภท/เหตุผล</b> ·
        เหตุผลที่มีคำว่า "ไปราชการ / อบรม / ประชุม / สัมมนา" จะลงตารางเวรเป็น <b>T</b> ส่วนที่เหลือเป็น <b>V</b> (ลา) ·
        ถ้าต้นทางเป็น Excel ให้บันทึกเป็น CSV (UTF-8) ก่อน
      </p>

      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 text-xs">พร้อมนำเข้า {valid.length} แถว</span>
            {invalid.length > 0 && <span className="text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2.5 py-1 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />มีปัญหา {invalid.length} แถว (จะถูกข้าม)</span>}
            <label className="flex items-center gap-2 text-xs text-slate-600 ml-auto">
              <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="w-4 h-4" />
              อนุมัติและลงตารางเวรทันที (ข้อมูลผ่านการอนุมัติจากต้นทางแล้ว)
            </label>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 sticky top-0"><tr>
                <th className="px-2 py-1.5 font-medium text-left">บรรทัด</th>
                <th className="px-2 py-1.5 font-medium text-left">ชื่อในไฟล์</th>
                <th className="px-2 py-1.5 font-medium text-left">จับคู่ได้</th>
                <th className="px-2 py-1.5 font-medium text-center">วันที่</th>
                <th className="px-2 py-1.5 font-medium text-left">ประเภท/เหตุผล</th>
                <th className="px-2 py-1.5 font-medium text-left">ผล</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.lineNo} className={r.error ? 'bg-rose-50/40' : undefined}>
                    <td className="px-2 py-1.5 text-slate-400">{r.lineNo}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.rawName || '—'}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.employeeName ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center text-slate-600">{r.day ?? '—'}{r.toDay && r.toDay !== r.day ? `–${r.toDay}` : ''}</td>
                    <td className="px-2 py-1.5 text-slate-500">{r.reason || '—'}</td>
                    <td className={`px-2 py-1.5 text-xs ${r.error ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {r.error ?? (/ไปราชการ|อบรม|ประชุม|สัมมนา/.test(r.reason) ? 'ไปราชการ (T)' : 'ลา (V)')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setRows(null); setFileName(''); }} className="text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg">เลือกไฟล์ใหม่</button>
            <button onClick={confirm} disabled={busy || !valid.length} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}ยืนยันนำเข้า {valid.length} รายการ
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RequestForm({ employees, wardId, year, month, fixedEmployeeId, defaultType, onDone, onError }: {
  employees: Employee[]; wardId: number; year: number; month: number;
  fixedEmployeeId: number | null; defaultType?: 'leave' | 'shift_change' | 'ot' | 'shift_add';
  onDone: (msg: string) => void; onError: (msg: string) => void;
}) {
  const [type, setType] = useState<'leave' | 'shift_change' | 'ot' | 'shift_add' | 'cancel'>(defaultType ?? 'leave');
  const [employeeId, setEmployeeId] = useState<number | null>(fixedEmployeeId ?? employees[0]?.id ?? null);
  const [day, setDay] = useState<number>(1);
  const [toDay, setToDay] = useState<number | ''>('');
  const [fromCode, setFromCode] = useState('');
  const [toCode, setToCode] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) { onError('ยังไม่ได้เลือกบุคลากร'); return; }
    setBusy(true);
    try {
      const isCancel = type === 'cancel';
      await api.createRequest({
        type: isCancel ? 'shift_change' : type, employeeId, wardId, year, month, day,
        toDay: toDay === '' ? null : Number(toDay),
        fromCode: fromCode || null,
        toCode: isCancel ? 'ออฟ' : (toCode || null),
        reason: reason || null,
      });
      onDone('ส่งคำขอแล้ว');
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'duplicate_ot') onError(err.message);
      else if (err instanceof ApiError && err.code === 'calendar_not_locked') onError(err.message);
      else onError(err?.message || 'ส่งคำขอไม่สำเร็จ');
    } finally { setBusy(false); }
  };

  const field = 'text-sm border border-slate-300 rounded-lg px-3 py-2 w-full';
  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-lg p-4 grid sm:grid-cols-2 gap-3">
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">ประเภท</span>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className={field}>
          <option value="leave">ขอลา / ไปราชการ</option>
          <option value="shift_change">ขอเปลี่ยนเวร (มีคนแทน)</option>
          <option value="cancel">ยกเวร (ไม่มีคนแทน)</option>
          <option value="ot">ขอขึ้น OT</option>
          <option value="shift_add">ขอขึ้นเวรเพิ่ม</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">บุคลากร</span>
        <select value={employeeId ?? ''} onChange={(e) => setEmployeeId(Number(e.target.value))} className={field} disabled={fixedEmployeeId != null}>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.prefix}{e.firstName} {e.lastName ?? ''}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">วันที่</span>
        <input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} className={field} />
      </label>
      <label className="text-sm">
        <span className="block text-slate-500 mb-1">ถึงวันที่ (ถ้าลาหลายวัน)</span>
        <input type="number" min={1} max={31} value={toDay} onChange={(e) => setToDay(e.target.value === '' ? '' : Number(e.target.value))} className={field} />
      </label>
      {type === 'shift_change' && (
        <>
          <label className="text-sm"><span className="block text-slate-500 mb-1">เวรเดิม</span><input value={fromCode} onChange={(e) => setFromCode(e.target.value)} placeholder="เช่น ช" className={field} /></label>
          <label className="text-sm"><span className="block text-slate-500 mb-1">เวรใหม่</span><input value={toCode} onChange={(e) => setToCode(e.target.value)} placeholder="เช่น บ" className={field} /></label>
        </>
      )}
      {type === 'cancel' && (
        <label className="text-sm sm:col-span-2"><span className="block text-slate-500 mb-1">เวรที่ต้องการยก (จะเปลี่ยนเป็น "ออฟ" เมื่ออนุมัติ)</span><input value={fromCode} onChange={(e) => setFromCode(e.target.value)} placeholder="เช่น ด (เวรดึกที่ยก)" className={field} /></label>
      )}
      {type === 'ot' && (
        <label className="text-sm"><span className="block text-slate-500 mb-1">รหัส OT</span><input value={toCode} onChange={(e) => setToCode(e.target.value)} placeholder="เช่น BD / ชot" className={field} /></label>
      )}
      <label className="text-sm sm:col-span-2">
        <span className="block text-slate-500 mb-1">เหตุผล</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={field} placeholder="รายละเอียดเพิ่มเติม" />
      </label>
      <div className="sm:col-span-2 flex justify-end">
        <button type="submit" disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-4 py-2 rounded-lg hover:bg-[#0c2a5e] disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}ส่งคำขอ
        </button>
      </div>
    </form>
  );
}
