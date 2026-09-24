import React, { useMemo, useState, useEffect } from 'react';
import { useRosterData, rateFor, cellKey } from '../lib/useRosterData';
import PrintableRoster from './PrintableRoster';
import ClaimDocuments, { defaultMemo, lineForWard, type MemoEdits } from './ClaimDocuments';
import DailyForms from './DailyForms';
import RequestToWork from './RequestToWork';
import { FileText, Printer, Loader2, RotateCcw, Pencil } from 'lucide-react';

type Tab = 'request' | 'ot' | 'bd' | 'daily';

export default function DocumentsView({ wardName, wardPhone, wardId, year, month }: {
  wardName: string; wardPhone?: string; wardId: number; year: number; month: number;
}) {
  const { employees, cells, signers, days, ceYear, roster, loading } = useRosterData(wardId, year, month);
  const [tab, setTab] = useState<Tab>('request');
  const [showEdit, setShowEdit] = useState(false);
  const [edits, setEdits] = useState<MemoEdits>({});
  const storeKey = `memo_${wardId}_${year}_${month}`;

  // OT-only totals (exclude BD) for the editable memo placeholder
  const { otCount, otTotal } = useMemo(() => {
    let total = 0; const people = new Set<number>();
    for (const e of employees) for (const d of days) {
      const c = cells[cellKey(e.id, d)]?.otCode;
      if (c && c !== 'BD') { total += rateFor(e.role, c); people.add(e.id); }
    }
    return { otCount: people.size, otTotal: total };
  }, [employees, cells, days]);
  const def = useMemo(() => defaultMemo(wardName, month, year, otCount, otTotal, lineForWard(employees), 'ot'),
    [wardName, month, year, otCount, otTotal, employees]);

  useEffect(() => { const raw = localStorage.getItem(storeKey); setEdits(raw ? JSON.parse(raw) : {}); }, [storeKey]);
  const update = (patch: MemoEdits) => { const next = { ...edits, ...patch }; setEdits(next); localStorage.setItem(storeKey, JSON.stringify(next)); };
  const reset = () => { setEdits({}); localStorage.removeItem(storeKey); };
  const ta = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';

  const schedule = <PrintableRoster wardName={wardName} month={month} year={year} ceYear={ceYear} days={days} employees={employees} cells={cells} signers={signers} note={roster?.note ?? null} />;

  const renderPacket = (forPrint: boolean) => {
    if (tab === 'request') return <><div style={forPrint ? { pageBreakAfter: 'always' } : undefined}><RequestToWork wardName={wardName} wardPhone={wardPhone} month={month} year={year} employees={employees} signers={signers} /></div>{forPrint && schedule}</>;
    if (tab === 'ot') return <><div style={forPrint ? { pageBreakAfter: 'always' } : undefined}><ClaimDocuments variant="ot" wardName={wardName} wardPhone={wardPhone} month={month} year={year} employees={employees} cells={cells} days={days} signers={signers} edits={edits} /></div>{forPrint && schedule}</>;
    if (tab === 'bd') return <><div style={forPrint ? { pageBreakAfter: 'always' } : undefined}><ClaimDocuments variant="bd" wardName={wardName} wardPhone={wardPhone} month={month} year={year} employees={employees} cells={cells} days={days} signers={signers} /></div>{forPrint && schedule}</>;
    return <DailyForms wardName={wardName} wardPhone={wardPhone} month={month} year={year} ceYear={ceYear} days={days} employees={employees} cells={cells} signers={signers} />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-[#0F3575]" />ชุดเอกสารเบิกจ่าย (ตราครุฑ)</h2>
          <p className="text-sm text-slate-500">{wardName} · เชื่อมจากตารางเวรจริง · เลขไทย · แยกชุด OT / บ่ายดึก / รายวัน · พิมพ์ → PDF</p>
        </div>
        <div className="flex gap-2">
          {tab === 'ot' && <button onClick={() => setShowEdit((s) => !s)} className="flex items-center gap-1.5 text-sm text-slate-700 border border-slate-300 px-3 py-2 rounded-lg"><Pencil className="w-4 h-4" />แก้เนื้อความ</button>}
          <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg hover:bg-[#0c2a5e]"><Printer className="w-4 h-4" />พิมพ์ทั้งชุด (PDF)</button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap no-print">
        {([['request', 'ชุดขอขึ้น'], ['ot', 'ชุดเบิก OT'], ['bd', 'ชุดเบิกบ่ายดึก'], ['daily', 'ชุดรายวัน/รายคาบ']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-sm px-4 py-2 rounded-lg border ${tab === k ? 'bg-[#0F3575] text-white border-[#0F3575]' : 'border-slate-300 text-slate-600'}`}>{label}</button>
        ))}
      </div>

      {showEdit && tab === 'ot' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 no-print">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-600">แก้ไขเนื้อความบันทึกข้อความ (ชุด OT)</span>
            <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-500"><RotateCcw className="w-3.5 h-3.5" />ใช้ค่าเริ่มต้น</button></div>
          <label className="block text-xs text-slate-500">เรื่อง</label>
          <input className={ta} value={edits.subject ?? def.subject} onChange={(e) => update({ subject: e.target.value })} />
          <label className="block text-xs text-slate-500">ย่อหน้าที่ 1</label>
          <textarea rows={3} className={ta} value={edits.body1 ?? def.body1} onChange={(e) => update({ body1: e.target.value })} />
          <label className="block text-xs text-slate-500">ย่อหน้าที่ 2</label>
          <textarea rows={4} className={ta} value={edits.body2 ?? def.body2} onChange={(e) => update({ body2: e.target.value })} />
        </div>
      )}

      {loading ? <div className="grid place-items-center py-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <>
          <div className="no-print bg-slate-100 rounded-xl p-4 overflow-auto">{renderPacket(false)}</div>
          <div className="print-sheet gov-form">{renderPacket(true)}</div>
        </>
      )}
    </div>
  );
}
