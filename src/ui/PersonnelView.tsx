import React, { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { Loader2, Users } from 'lucide-react';

const ROLE_TH: Record<string, string> = {
  doctor: 'แพทย์', nurse: 'พยาบาล', assistant: 'ผู้ช่วยพยาบาล', room: 'ห้องผ่าตัด', support: 'สนับสนุน',
};

export default function PersonnelView({ wardId }: { wardId: number }) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.employees(wardId).then((e) => { if (alive) setRows(e); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [wardId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-[#0F3575]" />
        <h2 className="text-lg font-bold text-slate-800">บุคลากร ({rows.length})</h2>
      </div>
      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีบุคลากรในกลุ่มงานนี้</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-2 font-medium">ชื่อ - นามสกุล</th>
                <th className="text-left px-4 py-2 font-medium">ตำแหน่ง</th>
                <th className="text-left px-4 py-2 font-medium">สาย</th>
                <th className="text-left px-4 py-2 font-medium">ประเภทจ้าง</th>
                <th className="text-left px-4 py-2 font-medium">การจ่าย</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium text-slate-700">{e.prefix}{e.firstName} {e.lastName ?? ''}</td>
                  <td className="px-4 py-2 text-slate-600">{e.positionText ?? ROLE_TH[e.role] ?? e.role}</td>
                  <td className="px-4 py-2 text-slate-500">{e.line ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{e.employeeType ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{e.paymentType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
