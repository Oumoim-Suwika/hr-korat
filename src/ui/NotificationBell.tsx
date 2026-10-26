import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type EditWindowInfo, type UserRole } from '../api/client';
import { Bell, AlarmClock, AlertTriangle, Loader2, X } from 'lucide-react';

/**
 * แจ้งเตือนภายในแอป (in-app alert) — requirement 10.2.
 *
 * เดิมมีเพียงข้อความนิ่งบนการ์ดขั้นตอนในหน้า "การเงิน & เบิกจ่าย" ที่ต้องเข้าไป
 * ดูเองจึงจะเห็น. ส่วนนี้ดึงสถานะกรอบเวลาแก้ไขของทุกหน่วยงาน (คำนวณจาก server)
 * มาแสดงเป็นกระดิ่งบนแถบหัวทุกหน้า พร้อมตัวเลขจำนวนรายการที่ต้องรีบจัดการ
 * และเด้งรายการขึ้นเองหนึ่งครั้งต่อการเข้าใช้งาน เมื่อมีรายการที่เลยกำหนด
 * หรือใกล้ครบกำหนด เพื่อลดความเสี่ยงเบิกจ่ายล่าช้า.
 *
 * รีเฟรชอัตโนมัติทุก 5 นาที เพื่อให้สถานะเดินตามเวลาจริงแม้ผู้ใช้เปิดหน้าทิ้งไว้.
 */

const REFRESH_MS = 5 * 60 * 1000;
const AUTO_OPEN_FLAG = 'sati_alert_autoshown';

export default function NotificationBell({ year, month, role, userWardId, onOpenWard }: {
  year: number;
  month: number;
  role: UserRole;
  userWardId: number | null;
  /** กดรายการแล้วพาไปหน้าการเงินของกลุ่มงานนั้น */
  onOpenWard?: (wardId: number) => void;
}) {
  const [windows, setWindows] = useState<EditWindowInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try { setWindows(await api.getAllEditWindows(year, month)); }
    catch { setWindows([]); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  // ปิดเมื่อคลิกข้างนอก
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // หน่วยงานที่ผู้ใช้เกี่ยวข้อง: หัวหน้าที่ผูกวอร์ด/เจ้าหน้าที่เห็นเฉพาะวอร์ดตัวเอง
  // การเงิน/แอดมิน และหัวหน้าพยาบาล (ไม่ผูกวอร์ด) เห็นทั้งโรงพยาบาล
  const scoped = useMemo(() => {
    const seesAll = role === 'finance' || role === 'admin' || userWardId == null;
    return seesAll ? windows : windows.filter((w) => w.wardId === userWardId);
  }, [windows, role, userWardId]);

  const alerts = useMemo(
    () => scoped
      .filter((w) => w.state === 'due_soon' || w.state === 'closed')
      .sort((a, b) => (a.state === b.state ? a.workingDaysLeft - b.workingDaysLeft : a.state === 'closed' ? -1 : 1)),
    [scoped],
  );
  const urgent = alerts.length;

  // เด้งขึ้นเองครั้งเดียวต่อ session เมื่อมีรายการต้องรีบ
  useEffect(() => {
    if (loading || urgent === 0) return;
    if (sessionStorage.getItem(AUTO_OPEN_FLAG)) return;
    sessionStorage.setItem(AUTO_OPEN_FLAG, '1');
    setOpen(true);
  }, [loading, urgent]);

  return (
    <div className="relative no-print" ref={boxRef}>
      <button
        onClick={() => setOpen((s) => !s)}
        title="การแจ้งเตือน"
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100"
      >
        <Bell className="w-5 h-5" />
        {urgent > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center">
            {urgent}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">การแจ้งเตือน</span>
            <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="grid place-items-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8 px-4">
                ไม่มีรายการที่ใกล้ครบกำหนด<br />
                <span className="text-xs">กรอบเวลาแก้ไขข้อมูลของทุกกลุ่มงานยังอยู่ในเกณฑ์</span>
              </p>
            ) : alerts.map((w) => {
              const closed = w.state === 'closed';
              const Icon = closed ? AlertTriangle : AlarmClock;
              return (
                <button
                  key={w.wardId}
                  onClick={() => { onOpenWard?.(w.wardId); setOpen(false); }}
                  className="w-full text-left flex gap-2.5 px-4 py-3 hover:bg-slate-50"
                >
                  <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${closed ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-700">{w.wardName}</span>
                    <span className="block text-xs text-slate-500 leading-snug">{w.message}</span>
                    {!w.enforced && (
                      <span className="block text-[11px] text-slate-400 mt-0.5">ยังไม่บังคับตัดสิทธิ์แก้ไข — แจ้งเตือนเท่านั้น</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {!loading && scoped.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-400 border-t border-slate-100">
              ติดตาม {scoped.length} กลุ่มงาน · รอบ {month}/{year} · อัปเดตอัตโนมัติทุก 5 นาที
            </div>
          )}
        </div>
      )}
    </div>
  );
}
