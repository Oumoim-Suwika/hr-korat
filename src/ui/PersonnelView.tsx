import React, { useEffect, useRef, useState, useMemo } from 'react';
import { api, type Employee, type Ward } from '../api/client';
import type { UserRole } from '../api/client';
import { Loader2, Users, Plus, Upload, Download } from 'lucide-react';

const ROLE_TH: Record<string, string> = { doctor: 'แพทย์', nurse: 'พยาบาล', assistant: 'ผู้ช่วยพยาบาล', room: 'ห้องผ่าตัด', support: 'สนับสนุน' };

function tenure(startDate?: string | null): string {
  if (!startDate) return '—';
  const s = new Date(startDate); if (isNaN(+s)) return '—';
  const now = new Date();
  let m = (now.getFullYear() - s.getFullYear()) * 12 + (now.getMonth() - s.getMonth());
  if (now.getDate() < s.getDate()) m--;
  if (m < 0) m = 0;
  return `${Math.floor(m / 12)} ปี ${m % 12} เดือน`;
}
function fmtDate(d?: string | null): string {
  if (!d) return '—'; const dt = new Date(d); if (isNaN(+dt)) return '—';
  return dt.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PersonnelView({ wardId, wardName, role }: { wardId: number; wardName?: string; role: UserRole }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filterWard, setFilterWard] = useState<number | 'all'>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [ne, setNe] = useState({ prefix: 'นางสาว', firstName: '', lastName: '', role: 'support', positionText: '', employeeType: 'ข้าราชการ', paymentType: 'รายเดือน', employeeCode: '', startDate: '', homeWardId: wardId });
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = role === 'supervisor' || role === 'admin';

  const load = () => {
    setLoading(true);
    Promise.all([api.allEmployees(), api.wards()]).then(([e, w]) => { setRows(e); setWards(w); }).finally(() => setLoading(false));
  };
  useEffect(load, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const wardName2 = (id?: number) => wards.find((w) => w.id === id)?.name ?? '—';

  const filtered = useMemo(() => rows.filter((e) =>
    (filterWard === 'all' || e.homeWardId === filterWard) && (filterRole === 'all' || e.role === filterRole)
  ), [rows, filterWard, filterRole]);

  const add = async () => {
    if (!ne.firstName) return;
    await api.createEmployee({ ...ne });
    setShow(false); setNe({ ...ne, firstName: '', lastName: '', positionText: '' }); load(); flash('เพิ่มบุคลากรแล้ว');
  };

  const onFile = async (f: File) => {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const start = lines[0]?.toLowerCase().includes('firstname') || lines[0]?.includes('ชื่อ') ? 1 : 0;
    const target = filterWard === 'all' ? wardId : filterWard;
    const emps = lines.slice(start).map((l) => {
      const [prefix, firstName, lastName, r, positionText, employeeType, paymentType] = l.split(',').map((s) => s?.trim());
      return { prefix, firstName, lastName, role: (['doctor', 'nurse', 'assistant', 'room', 'support'].includes(r) ? r : 'support'), positionText, employeeType: employeeType || 'ข้าราชการ', paymentType: (['รายเดือน', 'รายวัน', 'รายคาบ'].includes(paymentType) ? paymentType : 'รายเดือน'), homeWardId: target };
    }).filter((e) => e.firstName);
    if (!emps.length) { flash('ไม่พบข้อมูลในไฟล์'); return; }
    const n = await api.importEmployees(emps); load(); flash(`นำเข้า ${n} รายชื่อเข้า ${wardName2(target)} แล้ว`);
  };

  const template = () => {
    const csv = 'prefix,firstName,lastName,role,positionText,employeeType,paymentType\nนางสาว,สมหญิง,ใจดี,nurse,พยาบาลวิชาชีพ,ข้าราชการ,รายเดือน';
    const b = new Blob(['\uFEFF' + csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'template_personnel.csv'; a.click();
  };

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of rows) c[e.role] = (c[e.role] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-[#0F3575]" />จัดการบุคลากร (ทั้งหมด {rows.length} คน)</h2>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={template} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg"><Download className="w-4 h-4" />เทมเพลต</button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"><Upload className="w-4 h-4" />นำเข้า CSV</button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <button onClick={() => setShow((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Plus className="w-4 h-4" />เพิ่ม</button>
          </div>
        )}
      </div>

      {/* role summary chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ROLE_TH).map(([k, v]) => (
          <span key={k} className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-600">{v}: <b className="text-[#0F3575]">{roleCounts[k] || 0}</b></span>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2">
        <select value={filterWard} onChange={(e) => setFilterWard(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
          <option value="all">ทุกกลุ่มงาน</option>
          {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="text-sm border border-slate-300 rounded-lg px-3 py-1.5">
          <option value="all">ทุกสาย/ตำแหน่ง</option>
          {Object.entries(ROLE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-slate-400 self-center">แสดง {filtered.length} คน</span>
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      {show && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid sm:grid-cols-3 gap-2">
          <input placeholder="คำนำหน้า" value={ne.prefix} onChange={(e) => setNe({ ...ne, prefix: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="ชื่อ" value={ne.firstName} onChange={(e) => setNe({ ...ne, firstName: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="นามสกุล" value={ne.lastName} onChange={(e) => setNe({ ...ne, lastName: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="ตำแหน่ง" value={ne.positionText} onChange={(e) => setNe({ ...ne, positionText: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm sm:col-span-2" />
          <select value={ne.role} onChange={(e) => setNe({ ...ne, role: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm">
            {Object.entries(ROLE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={ne.homeWardId} onChange={(e) => setNe({ ...ne, homeWardId: Number(e.target.value) })} className="border border-slate-300 rounded px-3 py-2 text-sm">
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <select value={ne.paymentType} onChange={(e) => setNe({ ...ne, paymentType: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm">
            {['รายเดือน', 'รายวัน', 'รายคาบ'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input placeholder="ประเภทการจ้าง" value={ne.employeeType} onChange={(e) => setNe({ ...ne, employeeType: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="เลขที่คำสั่งจ้าง (ลูกจ้างรายวัน)" value={ne.employeeCode} onChange={(e) => setNe({ ...ne, employeeCode: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <label className="text-sm text-slate-500 flex items-center gap-2">วันที่เริ่มจ้าง<input type="date" value={ne.startDate} onChange={(e) => setNe({ ...ne, startDate: e.target.value })} className="border border-slate-300 rounded px-2 py-1.5 text-sm flex-1" /></label>
          <button onClick={add} className="text-sm text-white bg-[#0F3575] rounded px-3 py-2 sm:col-span-3">บันทึกบุคลากร</button>
        </div>
      )}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : filtered.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ไม่พบบุคลากรตามตัวกรอง</p> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-4 py-2 font-medium">ชื่อ - นามสกุล</th><th className="text-left px-4 py-2 font-medium">ตำแหน่ง</th>
              <th className="text-left px-4 py-2 font-medium">กลุ่มงาน</th><th className="text-left px-4 py-2 font-medium">สาย</th>
              <th className="text-left px-4 py-2 font-medium">ประเภทจ้าง</th><th className="text-left px-4 py-2 font-medium">การจ่าย</th>
              <th className="text-left px-4 py-2 font-medium">คำสั่งจ้าง / อายุงาน</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium text-slate-700">{e.prefix}{e.firstName} {e.lastName ?? ''}</td>
                  <td className="px-4 py-2 text-slate-600">{e.positionText ?? ROLE_TH[e.role]}</td>
                  <td className="px-4 py-2 text-slate-500">{wardName2(e.homeWardId)}</td>
                  <td className="px-4 py-2 text-slate-500">{ROLE_TH[e.role] ?? e.role}</td>
                  <td className="px-4 py-2 text-slate-500">{e.employeeType ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{e.paymentType}</td>
                  <td className="px-4 py-2 text-slate-500">{(e.paymentType === 'รายวัน' || e.paymentType === 'รายคาบ')
                    ? <span className="text-xs">{e.employeeCode ? `คำสั่ง ${e.employeeCode}` : 'ยังไม่ระบุคำสั่ง'} · เริ่ม {fmtDate(e.startDate)} · อายุงาน {tenure(e.startDate)}</span>
                    : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
