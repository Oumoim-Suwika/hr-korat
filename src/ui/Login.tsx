import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogIn, Loader2 } from 'lucide-react';

const DEMO = [
  { email: 'admin@sati.local', label: 'ผู้ดูแลระบบ' },
  { email: 'finance@sati.local', label: 'การเงิน' },
  { email: 'head.u01@sati.local', label: 'หัวหน้ากลุ่มงาน' },
  { email: 'staff.u01@sati.local', label: 'เจ้าหน้าที่' },
];

export default function Login() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('head.u01@sati.local');
  const [password, setPassword] = useState('Sati@1234');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await login(email, password); } catch { /* handled */ } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#0F3575] text-white grid place-items-center font-bold text-lg">S</div>
          <h1 className="mt-3 text-xl font-bold text-slate-800">Sati จัดเวร · OT</h1>
          <p className="text-sm text-slate-500">โรงพยาบาลมหาราชนครราชสีมา</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">อีเมล</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F3575]/30 focus:border-[#0F3575]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">รหัสผ่าน</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F3575]/30 focus:border-[#0F3575]" />
          </div>

          {error && <div className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</div>}

          <button type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0F3575] text-white py-2.5 text-sm font-semibold hover:bg-[#0c2a5e] disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            เข้าสู่ระบบ
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">บัญชีทดสอบ (รหัส Sati@1234)</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO.map((d) => (
              <button key={d.email} onClick={() => setEmail(d.email)}
                className="text-xs rounded-md border border-slate-200 px-2 py-1.5 text-slate-600 hover:bg-slate-50 text-left">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
