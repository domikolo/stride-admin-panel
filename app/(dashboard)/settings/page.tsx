/**
 * Settings Page — profile info, change password, MFA (owner), logout
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { changePassword } from '@/lib/auth';
import { getAccessToken } from '@/lib/token';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, User, Lock, LogOut, Eye, EyeOff, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function callMfa(path: string, body: Record<string, string>) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Błąd serwera');
  }
  return res.json();
}

// ─── MFA Section (owner only) ─────────────────────────────────────────────────

function MfaSection({ email }: { email: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // setup wizard state
  const [step, setStep] = useState<'idle' | 'qr' | 'verify' | 'done'>('idle');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setStatusLoading(false); return; }
    callMfa('/api/auth/mfa-status', { accessToken: token })
      .then(d => setEnabled(d.enabled))
      .catch(() => setEnabled(null))
      .finally(() => setStatusLoading(false));
  }, []);

  const handleStartSetup = async () => {
    setBusy(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Brak tokenu');
      const { secretCode: secret } = await callMfa('/api/auth/mfa-setup', { accessToken: token });
      setSecretCode(secret);
      const uri = `otpauth://totp/Stride%20Panel:${encodeURIComponent(email)}?secret=${secret}&issuer=Stride%20Panel`;
      const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 2 });
      setQrDataUrl(dataUrl);
      setStep('qr');
    } catch (err: any) {
      toast.error(err.message || 'Nie udało się zainicjować konfiguracji MFA');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length < 6) return;
    setBusy(true);
    setVerifyError('');
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Brak tokenu');
      await callMfa('/api/auth/mfa-verify', { accessToken: token, code: verifyCode });
      setEnabled(true);
      setStep('done');
      toast.success('MFA włączone pomyślnie');
    } catch {
      setVerifyError('Nieprawidłowy kod. Sprawdź aplikację i spróbuj ponownie.');
      setVerifyCode('');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm('Czy na pewno chcesz wyłączyć weryfikację dwuetapową?')) return;
    setBusy(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error('Brak tokenu');
      await callMfa('/api/auth/mfa-disable', { accessToken: token });
      setEnabled(false);
      setStep('idle');
      toast.success('MFA wyłączone');
    } catch (err: any) {
      toast.error(err.message || 'Nie udało się wyłączyć MFA');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheck size={16} className="text-zinc-400" />
        <h2 className="text-sm font-semibold text-white">Weryfikacja dwuetapowa (MFA)</h2>
      </div>

      {statusLoading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Sprawdzanie statusu…
        </div>
      ) : step === 'done' || enabled === true ? (
        /* ── MFA jest włączone ── */
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-green-400 font-medium">Aktywne</span>
          </div>
          <p className="text-sm text-zinc-500">
            Twoje konto jest chronione kodem TOTP z aplikacji uwierzytelniającej.
          </p>
          <Button
            onClick={handleDisable}
            disabled={busy}
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 text-sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin mr-2" /> : <ShieldOff size={14} className="mr-2" />}
            Wyłącz MFA
          </Button>
        </div>
      ) : step === 'idle' ? (
        /* ── MFA nieaktywne ── */
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            <span className="text-sm text-zinc-500">Nieaktywne</span>
          </div>
          <p className="text-sm text-zinc-500">
            Włącz weryfikację dwuetapową aby dodatkowo zabezpieczyć konto.
          </p>
          <Button
            onClick={handleStartSetup}
            disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin mr-2" /> : <ShieldCheck size={14} className="mr-2" />}
            Skonfiguruj MFA
          </Button>
        </div>
      ) : step === 'qr' ? (
        /* ── Krok 1: QR / klucz ── */
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Zeskanuj kod QR w aplikacji (Google Authenticator, Authy itp.) lub wpisz klucz ręcznie.
          </p>
          {qrDataUrl && (
            <div className="flex justify-center">
              <img src={qrDataUrl} alt="QR kod MFA" className="rounded-lg border border-white/[0.08]" width={200} height={200} />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">Klucz ręczny</label>
            <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-zinc-400 font-mono tracking-wider select-all break-all">
              {secretCode}
            </div>
          </div>
          <Button
            onClick={() => setStep('verify')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm w-full"
          >
            Dalej — wpisz kod weryfikacyjny
          </Button>
        </div>
      ) : step === 'verify' ? (
        /* ── Krok 2: weryfikacja ── */
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            Wpisz 6-cyfrowy kod z aplikacji, aby potwierdzić konfigurację.
          </p>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">Kod weryfikacyjny</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={verifyCode}
              onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError(''); }}
              className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white text-center tracking-[0.5em] text-xl placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/30"
              placeholder="000000"
              autoFocus
            />
            {verifyError && <p className="text-xs text-red-400 mt-1">{verifyError}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setStep('qr'); setVerifyError(''); setVerifyCode(''); }}
              className="border-white/[0.08] text-zinc-400 hover:text-white text-sm"
            >
              Wróć
            </Button>
            <Button
              onClick={handleVerify}
              disabled={busy || verifyCode.length < 6}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              {busy ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Włącz MFA
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setChanging(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success('Hasło zostało zmienione');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
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

      {/* Profile */}
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

      {/* MFA — owner only */}
      {user?.role === 'owner' && <MfaSection email={user.email} />}

      {/* Change password */}
      <Card className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Zmień hasło</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">Aktualne hasło</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={e => { setOldPassword(e.target.value); setErrors(prev => ({ ...prev, oldPassword: '' })); }}
                className={`w-full px-3 py-2.5 bg-white/[0.03] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all pr-10 ${errors.oldPassword ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.06] focus:ring-blue-500/20 focus:border-blue-500/30'}`}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.oldPassword && <p className="text-xs text-red-400 mt-1">{errors.oldPassword}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">Nowe hasło</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, newPassword: '' })); }}
                className={`w-full px-3 py-2.5 bg-white/[0.03] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all pr-10 ${errors.newPassword ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.06] focus:ring-blue-500/20 focus:border-blue-500/30'}`}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.newPassword && <p className="text-xs text-red-400 mt-1">{errors.newPassword}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1.5">Potwierdź nowe hasło</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: '' })); }}
              className={`w-full px-3 py-2.5 bg-white/[0.03] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 transition-all ${errors.confirmPassword ? 'border-red-500/40 focus:ring-red-500/20' : 'border-white/[0.06] focus:ring-blue-500/20 focus:border-blue-500/30'}`}
              placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="text-xs text-red-400 mt-1">{errors.confirmPassword}</p>}
          </div>
          <Button type="submit" disabled={changing} className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
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
        <p className="text-sm text-zinc-500 mb-4">Wylogowanie kończy bieżącą sesję na tym urządzeniu.</p>
        <Button onClick={signOut} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50">
          <LogOut size={15} className="mr-2" />
          Wyloguj się
        </Button>
      </Card>
    </div>
  );
}
