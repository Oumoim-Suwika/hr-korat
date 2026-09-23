import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Loader2, ScrollText } from 'lucide-react';

const ACTION_TH: Record<string, string> = {
  login: 'เข้าสู่ระบบ', save: 'บันทึก', submit: 'ส่งอนุมัติ', approve: 'อนุมัติ', reject: 'ไม่อนุมัติ',
  approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', create: 'สร้าง', update: 'แก้ไข', lock: 'ล็อก', set: 'ตั้งค่า', import: 'นำเข้า',
};

export default function AuditView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.auditLogs().then(setLogs).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><ScrollText className="w-5 h-5 text-[#0F3575]" />บันทึกการตรวจสอบ (Audit Log)</h2>
        <p className="text-sm text-slate-500">ประวัติการกระทำในระบบ 200 รายการล่าสุด</p>
      </div>
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="text-xs text-slate-400 w-40 shrink-0">{new Date(l.ts).toLocaleString('th-TH')}</span>
              <span className="text-slate-600"><b>{ACTION_TH[l.action] ?? l.action}</b> · {l.entity}{l.entityId ? ` #${l.entityId}` : ''}</span>
              {l.detail && <span className="text-xs text-slate-400 truncate">{JSON.stringify(l.detail)}</span>}
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-slate-400 text-center py-8">ยังไม่มีบันทึก</p>}
        </div>
      )}
    </div>
  );
}
