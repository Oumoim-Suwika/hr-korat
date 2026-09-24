import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';
import type { UserRole } from '../api/client';
import { useRosterData, cellKey, downloadFile } from '../lib/useRosterData';
import { THAI_MONTHS } from '../data';
import { Fingerprint, Upload, Download, Loader2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const OFF = new Set(['ออฟ', 'O', 'V', 'T', '', null as any, undefined as any]);
const isWork = (code?: string | null) => !!code && !OFF.has(code);

/**
 * นำเข้าเวลาสแกนจริง (จากเครื่องสแกน) แล้วกระทบยอดกับตารางเวรที่วางแผนไว้
 * ธงเตือน: มีเวรแต่ไม่มีสแกน (ขาดสแกน), มีสแกนแต่ไม่มีเวร, เวลาไม่ครบ.
 * รองรับไฟล์ CSV: คอลัมน์  ชื่อ, วันที่(1-31), เวลาเข้า, เวลาออก
 */
export default function TimeScanView({ wardName, wardId, year, month, role }: {
  wardName: string; wardId: number; year: number; month: number; role: UserRole;
}) {
  const { employees, cells, days, loading } = useRosterData(wardId, year, month);
  const [scans, setScans] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canEdit = role === 'supervisor' || role === 'finance' || role === 'admin';
  const monthLabel = `${THAI_MONTHS[month - 1]} ${year}`;
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const loadScans = () => api.getTimeScans(wardId, year, month).then(setScans).catch(() => setScans([]));
  useEffect(() => { loadScans(); /* eslint-disable-next-line */ }, [wardId, year, month]);

  const scanMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of scans) m.set(`${s.employeeId}-${s.day}`, s);
    return m;
  }, [scans]);

  const rows = useMemo(() => employees.map((e) => {
    const planned = days.filter((d) => isWork(cells[cellKey(e.id, d)]?.normalCode));
    const scanned = days.filter((d) => scanMap.has(`${e.id}-${d}`));
    const missing = planned.filter((d) => !scanMap.has(`${e.id}-${d}`));
    const extra = scanned.filter((d) => !isWork(cells[cellKey(e.id, d)]?.normalCode));
    return { e, planned: planned.length, scanned: scanned.length, missing, extra };
  }).filter((r) => r.planned > 0 || r.scanned > 0), [employees, cells, days, scanMap]);

  const totalMissing = rows.reduce((s, r) => s + r.missing.length, 0);
  const totalExtra = rows.reduce((s, r) => s + r.extra.length, 0);
  const flaggedPeople = rows.filter((r) => r.missing.length || r.extra.length).length;

  const template = () => downloadFile(`เทมเพลตเวลาสแกน_${wardName}.csv`,
    'ชื่อ,วันที่,เวลาเข้า,เวลาออก\nสมหญิง ดูแลดี,1,08:00,16:05\nสมหญิง ดูแลดี,2,16:00,00:10');

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const start = /ชื่อ|name/i.test(lines[0] ?? '') ? 1 : 0;
      const items: { employeeId: number; day: number; timeIn?: string; timeOut?: string }[] = [];
      let unmatched = 0;
      for (const line of lines.slice(start)) {
        const [name, dayStr, tin, tout] = line.split(',').map((s) => s?.trim());
        const day = Number(dayStr);
        if (!name || !day) continue;
        const emp = employees.find((x) => { const full = `${x.firstName}${x.lastName ?? ''}`; return full.includes(name.replace(/\s/g, '')) || name.includes(x.firstName); });
        if (!emp) { unmatched++; continue; }
        items.push({ employeeId: emp.id, day, timeIn: tin || undefined, timeOut: tout || undefined });
      }
      if (!items.length) { flash(`ไม่พบชื่อที่ตรงกับบุคลากรในหน่วยนี้${unmatched ? ` (ไม่ตรง ${unmatched} แถว)` : ''}`); return; }
      await api.importTimeScans(wardId, year, month, items);
      await loadScans();
      flash(`นำเข้าเวลาสแกน ${items.length} รายการแล้ว${unmatched ? ` · ข้ามที่ไม่ตรงชื่อ ${unmatched} แถว` : ''}`);
    } catch { flash('อ่านไฟล์ไม่สำเร็จ'); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Fingerprint className="w-5 h-5 text-[#0F3575]" />เวลาสแกนจริง &amp; กระทบยอด · {wardName}</h2>
          <p className="text-sm text-slate-500">{monthLabel} · เทียบตารางเวร (แผน) กับเวลาสแกนจริงจากเครื่อง</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button onClick={template} className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-2 rounded-lg"><Download className="w-4 h-4" />เทมเพลต</button>
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0F3575] px-3 py-2 rounded-lg disabled:opacity-60">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}นำเข้าไฟล์สแกน (CSV)</button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
        )}
      </div>

      {toast && <div className="text-sm bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">{toast}</div>}
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        ไฟล์ CSV: <b>ชื่อ, วันที่(1-31), เวลาเข้า, เวลาออก</b> · จับคู่ชื่อกับบุคลากรในหน่วยอัตโนมัติ · คนที่ไม่มีในเครื่องสแกนให้แนบใบลงเวลาเซ็นรับรองประกอบ (หน้าเอกสารเบิก)
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card label="สแกนแล้ว (รายการ)" value={String(scans.length)} />
        <Card label="ขาดสแกน (มีเวร)" value={String(totalMissing)} warn={totalMissing > 0} />
        <Card label="สแกนเกิน (ไม่มีเวร)" value={String(totalExtra)} warn={totalExtra > 0} />
        <Card label="สถานะ" value={flaggedPeople === 0 ? 'ตรงกัน ✓' : `ตรวจ ${flaggedPeople} คน`} accent={flaggedPeople === 0} warn={flaggedPeople > 0} />
      </div>

      {loading ? <div className="grid place-items-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        : rows.length === 0 ? <p className="text-sm text-slate-400 text-center py-10">ยังไม่มีข้อมูล — ลงตารางเวร หรือ นำเข้าไฟล์สแกน</p> : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr>
              <th className="text-left px-3 py-2 font-medium">ชื่อ - ตำแหน่ง</th>
              <th className="px-3 py-2 font-medium text-center">เวรตามแผน</th>
              <th className="px-3 py-2 font-medium text-center">สแกนจริง</th>
              <th className="px-3 py-2 font-medium text-left">ผลกระทบยอด</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.e.id} className={r.missing.length || r.extra.length ? 'bg-amber-50/40' : ''}>
                  <td className="px-3 py-2"><div className="font-medium text-slate-700">{r.e.prefix}{r.e.firstName} {r.e.lastName ?? ''}</div><div className="text-[11px] text-slate-400">{r.e.positionText}</div></td>
                  <td className="px-3 py-2 text-center">{r.planned}</td>
                  <td className="px-3 py-2 text-center">{r.scanned}</td>
                  <td className="px-3 py-2">
                    {r.missing.length === 0 && r.extra.length === 0
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-4 h-4" />ตรงกัน</span>
                      : <div className="space-y-0.5 text-xs">
                          {r.missing.length > 0 && <div className="inline-flex items-center gap-1 text-amber-700 mr-3"><AlertTriangle className="w-3.5 h-3.5" />ขาดสแกน วันที่ {r.missing.join(', ')}</div>}
                          {r.extra.length > 0 && <div className="inline-flex items-center gap-1 text-rose-600"><AlertTriangle className="w-3.5 h-3.5" />สแกนแต่ไม่มีเวร วันที่ {r.extra.join(', ')}</div>}
                        </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return <div className={`rounded-xl border p-4 ${warn ? 'border-amber-300 bg-amber-50' : accent ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}><div className="text-xs text-slate-500">{label}</div><div className={`text-xl font-bold ${warn ? 'text-amber-700' : accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</div></div>;
}
