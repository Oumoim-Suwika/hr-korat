import React, { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { computeClaim, useRosterData } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { Users, Calendar, DollarSign, Activity, Loader2 } from 'lucide-react';

export default function DashboardView({ wardName, wardId, year, month }: { wardName: string; wardId: number; year: number; month: number }) {
  const { employees, cells, days, roster, loading } = useRosterData(wardId, year, month);
  const claims = employees.map((e) => computeClaim(e, cells, days)).filter((c) => c.otCount > 0);
  const otTotal = claims.reduce((s, c) => s + c.amount, 0);
  const otShifts = claims.reduce((s, c) => s + c.otCount, 0);
  const filled = Object.values(cells).filter((c: any) => c.normalCode && c.normalCode !== 'ออฟ').length;
  const capacity = employees.length * days.length || 1;
  const coverage = Math.round((filled / capacity) * 100);

  const statusText = roster?.status === 'approved' ? 'อนุมัติแล้ว' : roster?.status === 'pending_approval' ? 'รออนุมัติ' : roster ? 'ฉบับร่าง' : 'ยังไม่จัด';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800">แดชบอร์ดภาพรวม · {wardName}</h2>
        <p className="text-sm text-slate-500">ประจำเดือน {THAI_MONTHS[month - 1]} {year}</p>
      </div>
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat icon={Users} label="บุคลากรทั้งหมด" value={`${employees.length} คน`} />
            <Stat icon={Calendar} label="สถานะตารางเวร" value={statusText} />
            <Stat icon={Activity} label="ความครอบคลุมเวร" value={`${coverage}%`} />
            <Stat icon={DollarSign} label="ยอด OT เดือนนี้" value={`${otTotal.toLocaleString('th-TH')} ฿`} accent />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">สรุป OT รายบุคคล (สูงสุด 5)</h3>
              {claims.length === 0 ? <p className="text-sm text-slate-400">ยังไม่มี OT</p> : (
                <ul className="space-y-2">
                  {claims.slice().sort((a, b) => b.amount - a.amount).slice(0, 5).map((c) => (
                    <li key={c.employee.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 truncate">{c.employee.prefix}{c.employee.firstName} {c.employee.lastName ?? ''}</span>
                      <span className="text-slate-400">{c.otCount} เวร · <b className="text-[#0F3575]">{c.amount.toLocaleString('th-TH')}฿</b></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3">ตัวเลขสำคัญ</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <KV k="จำนวนเวร OT รวม" v={`${otShifts} เวร`} />
                <KV k="ผู้มีสิทธิ์เบิก" v={`${claims.length} คน`} />
                <KV k="วันในเดือน" v={`${days.length} วัน`} />
                <KV k="ยอดเบิกเฉลี่ย/คน" v={`${claims.length ? Math.round(otTotal / claims.length).toLocaleString('th-TH') : 0} ฿`} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: any) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-[#0F3575]/30 bg-[#0F3575]/5' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Icon className="w-4 h-4" />{label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-[#0F3575]' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}
function KV({ k, v }: { k: string; v: string }) {
  return <div><div className="text-slate-400 text-xs">{k}</div><div className="font-semibold text-slate-700">{v}</div></div>;
}
