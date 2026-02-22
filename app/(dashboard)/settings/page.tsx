/**
 * Settings Page — profile info, change password, logout
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { changePassword } from '@/lib/auth';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, User, Lock, LogOut, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage() {
  const { user, signOut } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changing, setChanging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!oldPassword) e.oldPassword = 'Podaj aktualne hasło';
    if (!newPassword) e.newPassword = 'Podaj nowe hasło';
    else if (newPassword.length < 8) e.newPassword = 'Hasło musi mieć co najmniej 8 znaków';
    if (!confirmPassword) e.confirmPassword = 'Potwierdź nowe hasło';
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Hasła nie są zgodne';
    return e;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setChanging(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success('Hasło zostało zmienione');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.message || 'Nie udało się zmienić hasła';
      if (msg.includes('Incorrect') || msg.includes('incorrect') || msg.includes('NotAuthorized')) {
        setErrors({ oldPassword: 'Nieprawidłowe aktualne hasło' });
      } else {
        toast.error(msg);
      }
    } finally {
      setChanging(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    if (role === 'owner') return { label: 'Owner', className: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' };
    if (role === 'admin') return { label: 'Admin', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' };
    return { label: 'Client', className: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30' };
  };

  const badge = getRoleBadge(user?.role);

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
          <Settings className="text-zinc-400" size={22} />
          Ustawienia
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Zarządzaj kontem i hasłem</p>
      </div>

      {/* Profile section */}
      <Card className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <User size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Profil</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Email</label>
            <div className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-zinc-400 select-all">
              {user?.email || '—'}
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Rola</label>
            <div className="flex items-center">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
          {user?.clientId && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Client ID</label>
              <div className="px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-zinc-400 font-mono">
                {user.clientId}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Change password */}
      <Card className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Zmień hasło</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Old password */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">
              Aktualne hasło
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={e => { setOldPassword(e.target.value); setErrors(prev => ({ ...prev, oldPassword: '' })); }}
                className={`w-full px-3 py-2.5 bg-white/[0.03] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all pr-10 ${
                  errors.oldPassword
                    ? 'border-red-500/40 focus:ring-red-500/20'
                    : 'border-white/[0.06] focus:ring-blue-500/20 focus:border-blue-500/30'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowOld(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.oldPassword && <p className="text-xs text-red-400 mt-1">{errors.oldPassword}</p>}
          </div>

          {/* New password */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">
              Nowe hasło
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, newPassword: '' })); }}
                className={`w-full px-3 py-2.5 bg-white/[0.03] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all pr-10 ${
                  errors.newPassword
                    ? 'border-red-500/40 focus:ring-red-500/20'
                    : 'border-white/[0.06] focus:ring-blue-500/20 focus:border-blue-500/30'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs text-red-400 mt-1">{errors.newPassword}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">
              Potwierdź nowe hasło
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
              className={`w-full px-3 py-2.5 bg-white/[0.03] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all ${
                errors.confirmPassword
                  ? 'border-red-500/40 focus:ring-red-500/20'
                  : 'border-white/[0.06] focus:ring-blue-500/20 focus:border-blue-500/30'
              }`}
              placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>}
          </div>

          <Button
            type="submit"
            disabled={changing}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {changing ? 'Zmieniam...' : 'Zmień hasło'}
          </Button>
        </form>
      </Card>

      {/* Logout */}
      <Card className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <LogOut size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Sesja</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Wylogowanie kończy bieżącą sesję na tym urządzeniu.
        </p>
        <Button
          onClick={signOut}
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50"
        >
          <LogOut size={15} className="mr-2" />
          Wyloguj się
        </Button>
      </Card>
    </div>
  );
}
