import React from 'react';
import { DEFAULT_OT_SETTINGS, DEFAULT_POLICIES } from '../data';
import { Settings, ShieldAlert, DollarSign } from 'lucide-react';

const ROLE_TH: Record<string, string> = { doctor: 'แพทย์', nurse: 'พยาบาล', assistant: 'ผู้ช่วยพยาบาล', room: 'ห้องผ่าตัด' };
const CODES = ['ช', 'บ', 'ด', 'ชot', 'บot', 'ดot', 'BD', 'OR'];

export default function SettingsView() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Settings className="w-5 h-5 text-[#0F3575]" />ตั้งค่าระบบ (Admin)</h2>
        <p className="text-sm text-slate-500">อัตราค่าตอบแทน และกฎการจัดเวร</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" />กฎการจัดเวร</h3>
        <ul className="text-sm text-slate-600 space-y-1.5">
          <li>• ห้ามขึ้นเวรบ่ายต่อดึกทันที: <b>{DEFAULT_POLICIES.allowAfternoonToNight ? 'อนุญาต' : 'ห้าม'}</b></li>
          <li>• ห้ามเวรดึกทันทีหลังวันหยุด: <b>{DEFAULT_POLICIES.banNightAfterOff ? 'ห้าม' : 'อนุญาต'}</b></li>
          <li>• ชั่วโมงทำงานสูงสุดต่อสัปดาห์: <b>{DEFAULT_POLICIES.maxHoursPerWeek} ชม.</b></li>
          <li>• บังคับอัตรากำลังขั้นต่ำต่อเวร: <b>{DEFAULT_POLICIES.requireMinStaff ? 'ใช่' : 'ไม่'}</b></li>
          <li className="text-rose-600">• Gate: ต้องกำหนด &amp; ล็อกวันทำการของเดือนก่อน จึงจะใส่ OT ได้</li>
        </ul>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
        <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-[#0F3575]" />อัตราค่าตอบแทน (บาท/เวร)</h3>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr>
            <th className="text-left px-3 py-2 font-medium">กลุ่ม</th>
            {CODES.map((c) => <th key={c} className="px-2 py-2 font-medium text-center">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {Object.entries(DEFAULT_OT_SETTINGS.rates).map(([role, r]) => (
              <tr key={role}>
                <td className="px-3 py-2 text-slate-600">{ROLE_TH[role] ?? role}</td>
                {CODES.map((c) => <td key={c} className="px-2 py-2 text-center text-slate-500">{(r as any)[c] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-400 mt-2">เกณฑ์ OT รายเดือน: {DEFAULT_OT_SETTINGS.threshold} เวร</p>
      </div>
    </div>
  );
}
