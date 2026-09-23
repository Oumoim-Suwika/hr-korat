import React from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './ui/Login';
import AppShell from './ui/AppShell';

function Gate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
    );
  }
  return user ? <AppShell /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
