import React, { useEffect, useState } from 'react';
import { api, type Ward } from '../api/client';
import type { UserRole } from '../api/client';
import { Building2, Save, Plus, Loader2 } from 'lucide-react';

export default function WardsView({ role }: { role: UserRole }) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [nw, setNw] = useState({ code: '', name: '', building: '', phone: '' });
  const canEdit = role === 'supervisor' || role === 'admin';
  const canCreate = role === 'admin';

  const load = () => { setLoading(true); api.wards().then(setWards).finally(() => setLoading(false)); };
  useEffect(load, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const saveConditions = async (w: Ward) => {
    await api.updateWard(w.id, { conditions: editing[w.id] ?? (w as any).conditions ?? '' });
    flash(`บันทึกเงื่อนไข ${w.code} แล้ว`);
  };
  const createWard = async () => {
    if (!nw.code || !nw.name) return;
    await api.createWard(nw); setShowNew(false); setNw({ code: '', name: '', building: '', phone: '' }); load(); flash('เพิ่มวอร์ดแล้ว');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Building2 className="w-5 h-5 text-[#0F3575]" />จัดการวอร์ด / กลุ่มงาน ({wards.length})</h2>
        {canCreate && <button onClick={() => setShowNew((s) => !s)} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg"><Plus className="w-4 h-4" />เพิ่มวอร์ด</button>}
      </div>
      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}

      {showNew && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 grid sm:grid-cols-4 gap-2">
          <input placeholder="รหัส (เช่น W05)" value={nw.code} onChange={(e) => setNw({ ...nw, code: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <input placeholder="ชื่อกลุ่มงาน" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="โทร" value={nw.phone} onChange={(e) => setNw({ ...nw, phone: e.target.value })} className="border border-slate-300 rounded px-3 py-2 text-sm" />
          <button onClick={createWard} className="text-sm text-white bg-[#0F3575] rounded px-3 py-2 sm:col-span-4">บันทึกวอร์ด</button>
        </div>
      )}

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="space-y-3">
          {wards.map((w) => (
            <div key={w.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-semibold text-slate-700">{w.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{w.building} · โทร {w.phone}</span>
                </div>
              </div>
              <label className="text-xs text-slate-500">เงื่อนไขจัดเวรเฉพาะวอร์ด (ใช้ประกอบการจัดตาราง / AI)</label>
              <textarea rows={2} defaultValue={(w as any).conditions ?? ''} disabled={!canEdit}
                onChange={(e) => setEditing({ ...editing, [w.id]: e.target.value })}
                placeholder="เช่น เวรดึกต้องมี RN อย่างน้อย 2, ห้ามขึ้นเวรเกิน 6 วันติด, พักหลังดึกอย่างน้อย 1 วัน"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1 disabled:bg-slate-50" />
              {canEdit && <div className="flex justify-end mt-2"><button onClick={() => saveConditions(w)} className="flex items-center gap-1.5 text-sm text-[#0F3575] border border-[#0F3575]/30 px-3 py-1.5 rounded-lg"><Save className="w-4 h-4" />บันทึกเงื่อนไข</button></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
