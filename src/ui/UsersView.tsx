import React, { useEffect, useState } from 'react';
import { api, type Ward } from '../api/client';
import { Loader2, ShieldCheck, Plus } from 'lucide-react';

const ROLE_TH: Record<string, string> = { staff: 'เจ้าหน้าที่', supervisor: 'หัวหน้างาน', finance: 'การเงิน', admin: 'ผู้ดูแลระบบ' };

export default function UsersView() {
  const [users, setUsers] = useState<any[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [nu, setNu] = useState({ email: '', displayName: '', password: '', role: 'staff', wardId: '' as any });
  const [toast, setToast] = useState<string | null>(null);

  const load = () => { setLoading(true); Promise.all([api.users(), api.wards()]).then(([u, w]) => { setUsers(u); setWards(w); }).finally(() => setLoading(false)); };
  useEffect(load, []);

  const create = async () => {
    if (!nu.email || !nu.displayName || !nu.password) return;
    await api.createUser({ ...nu, wardId: nu.wardId ? Number(nu.wardId) : null });
    setShow(false); setNu({ email: '', displayName: '', password: '', role: 'staff', wardId: '' }); load();
    setToast('เพิ่มผู้ใช้แล้ว'); setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-[#0F3575]" />จัดการผู้ใช้ ({users.length})</h2>
        <button onClick={() => setShow((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Plus className="w-4 h-4" />เพิ่มผู้ใช้</button>
      </div>
      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}
      {show && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid sm:grid-cols-2 gap-2">
          <input placeholder="อีเมล" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="ชื่อที่แสดง" value={nu.displayName} onChange={(e) => setNu({ ...nu, displayName: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="รหัสผ่าน" type="text" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm">
            {Object.entries(ROLE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={nu.wardId} onChange={(e) => setNu({ ...nu, wardId: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm">
            <option value="">— ทุกวอร์ด —</option>
            {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button onClick={create} className="text-sm text-white bg-[#0F3575] rounded px-3 py-2">บันทึกผู้ใช้</button>
        </div>
      )}
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ</th><th className="text-left px-3 py-2 font-medium">อีเมล</th>
              <th className="text-left px-3 py-2 font-medium">บทบาท</th><th className="text-left px-3 py-2 font-medium">วอร์ด</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-medium text-slate-700">{u.displayName}</td>
                  <td className="px-3 py-2 text-slate-500">{u.email}</td>
                  <td className="px-3 py-2"><span className="text-xs bg-slate-100 rounded-full px-2 py-0.5">{ROLE_TH[u.role] ?? u.role}</span></td>
                  <td className="px-3 py-2 text-slate-500">{wards.find((w) => w.id === u.wardId)?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
