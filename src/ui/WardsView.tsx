import React, { useEffect, useMemo, useState } from 'react';
import { api, type Ward, type Employee } from '../api/client';
import type { UserRole } from '../api/client';
import { Building2, Save, Plus, Loader2, Users, ChevronDown, ChevronRight, SlidersHorizontal, X } from 'lucide-react';

export default function WardsView({ role }: { role: UserRole }) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [nw, setNw] = useState({ code: '', name: '', building: '', phone: '' });
  const canEdit = role === 'supervisor' || role === 'admin';
  const canCreate = role === 'admin';

  const load = () => { setLoading(true); Promise.all([api.wards(), api.allEmployees()]).then(([w, e]) => { setWards(w); setEmps(e); }).finally(() => setLoading(false)); };
  useEffect(load, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const countOf = (id: number) => emps.filter((e) => e.homeWardId === id).length;
  const avg = wards.length ? Math.round((emps.length / wards.length) * 10) / 10 : 0;

  const saveConditions = async (w: Ward) => {
    await api.updateWard(w.id, { conditions: editing[w.id] ?? (w as any).conditions ?? '' });
    flash(`บันทึกเงื่อนไข ${w.code} แล้ว`);
  };
  const createWard = async () => {
    if (!nw.code || !nw.name) return;
    await api.createWard(nw); setShowNew(false); setNw({ code: '', name: '', building: '', phone: '' }); load(); flash('เพิ่มวอร์ดแล้ว');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#0F3575]" />จัดการวอร์ด / กลุ่มงาน</h2>
          <p className="text-sm text-slate-500">ฐานข้อมูลวอร์ดและบุคลากรของโรงพยาบาล</p>
        </div>
        {canCreate && <button onClick={() => setShowNew((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e]"><Plus className="w-4 h-4" />เพิ่มวอร์ด</button>}
      </div>
      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      {/* summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500 mb-1">วอร์ดทั้งหมด</div><div className="text-2xl font-bold text-[#0F3575]">{wards.length}</div><div className="text-xs text-slate-400">กลุ่มงาน</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500 mb-1">บุคลากรทั้งหมด</div><div className="text-2xl font-bold text-slate-800">{emps.length}</div><div className="text-xs text-slate-400">คน</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 hidden lg:block"><div className="text-xs text-slate-500 mb-1">เฉลี่ยต่อวอร์ด</div><div className="text-2xl font-bold text-slate-800">{avg}</div><div className="text-xs text-slate-400">คน/วอร์ด</div></div>
      </div>

      {showNew && canCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid sm:grid-cols-5 gap-2 items-center">
          <input placeholder="รหัส (เช่น W05)" value={nw.code} onChange={(e) => setNw({ ...nw, code: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="ชื่อกลุ่มงาน" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="โทร" value={nw.phone} onChange={(e) => setNw({ ...nw, phone: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <button onClick={createWard} className="text-sm text-white bg-[#0F3575] rounded px-3 py-2">บันทึก</button>
        </div>
      )}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><div className="font-semibold text-slate-800">รายละเอียดวอร์ด</div></div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-4 py-2.5 font-medium">ชื่อวอร์ด</th>
              <th className="text-left px-4 py-2.5 font-medium">รหัส</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">อาคาร / โทร</th>
              <th className="px-4 py-2.5 font-medium text-center">บุคลากร</th>
              <th className="px-4 py-2.5 font-medium text-center">สถานะ</th>
              <th className="px-4 py-2.5 font-medium text-right">เงื่อนไข</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {wards.map((w) => (
                <React.Fragment key={w.id}>
                  <tr className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{w.name}</td>
                    <td className="px-4 py-2.5"><span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">{w.code}</span></td>
                    <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">{w.building ?? '—'}{w.phone ? ` · โทร ${w.phone}` : ''}</td>
                    <td className="px-4 py-2.5 text-center"><span className="inline-flex items-center gap-1 text-slate-600"><Users className="w-3.5 h-3.5 text-slate-400" />{countOf(w.id)}</span></td>
                    <td className="px-4 py-2.5 text-center"><span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">ใช้งาน</span></td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setExpanded(expanded === w.id ? null : w.id)} className="inline-flex items-center gap-1 text-xs text-[#0F3575] hover:underline"><SlidersHorizontal className="w-3.5 h-3.5" />เงื่อนไขจัดเวร{expanded === w.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</button>
                    </td>
                  </tr>
                  {expanded === w.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={6} className="px-4 py-3">
                        <label className="text-xs text-slate-500">เงื่อนไขจัดเวรเฉพาะวอร์ด (ใช้ประกอบการจัดตาราง / AI)</label>
                        <textarea rows={2} defaultValue={(w as any).conditions ?? ''} disabled={!canEdit}
                          onChange={(e) => setEditing({ ...editing, [w.id]: e.target.value })}
                          placeholder="เช่น เวรดึกต้องมี RN อย่างน้อย 2, ห้ามขึ้นเวรเกิน 6 วันติด, พักหลังดึกอย่างน้อย 1 วัน"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 disabled:bg-slate-50" />
                        {canEdit && <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setExpanded(null)} className="flex items-center gap-1 text-sm text-slate-400 px-2"><X className="w-4 h-4" />ปิด</button>
                          <button onClick={() => saveConditions(w)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-1.5 rounded-lg"><Save className="w-4 h-4" />บันทึกเงื่อนไข</button>
                        </div>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
