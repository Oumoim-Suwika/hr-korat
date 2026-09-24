import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { THAI_MONTHS } from '../data';
import { History, Printer, Loader2 } from 'lucide-react';

const STATUS: Record<string, { t: string; c: string }> = {
  draft: { t: 'ฉบับร่าง', c: 'bg-slate-100 text-slate-600' },
  pending_approval: { t: 'รออนุมัติ', c: 'bg-amber-100 text-amber-700' },
  approved: { t: 'อนุมัติแล้ว', c: 'bg-emerald-100 text-emerald-700' },
};

export default function FormHistoryView({ wardId, onOpen }: { wardId: number; onOpen: (year: number, month: number) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); api.listRosters(wardId).then(setRows).finally(() => setLoading(false)); }, [wardId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-[#0F3575]" />ประวัติฟอร์ม / ตารางเวรที่บันทึก</h2>
        <p className="text-sm text-slate-500">ย้อนดูและพิมพ์ซ้ำได้ทุกเดือน เรียงล่าสุดก่อน</p>
      </div>
      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : rows.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีตารางเวรที่บันทึก</p> : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {rows.map((r) => {
            const st = STATUS[r.status] ?? STATUS.draft;
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="font-medium text-slate-700">ตารางเวร {THAI_MONTHS[r.month - 1]} {r.year}</div>
                  <div className="text-xs text-slate-400">แก้ไขล่าสุด {r.updatedAt ? new Date(r.updatedAt).toLocaleString('th-TH') : '—'}{r.financeLocked ? ' · การเงินปิดรอบแล้ว' : ''}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${st.c}`}>{st.t}</span>
                <button onClick={() => onOpen(r.year, r.month)} className="flex items-center gap-1.5 text-sm text-[#0F3575] border border-[#0F3575]/30 px-3 py-1.5 rounded-lg"><Printer className="w-4 h-4" />เปิด / พิมพ์</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
