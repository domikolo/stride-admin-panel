'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAccessToken } from '@/lib/token';
import { useAuth } from '@/hooks/useAuth';

type Step = 'loading' | 'qr' | 'verify' | 'done';

export default function MfaSetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('loading');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Redirect non-owners away
    if (user && user.role !== 'owner') {
      router.replace('/dashboard');
      return;
    }
    if (user) startSetup();
  }, [user]);

  const startSetup = async () => {
    setBusy(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/auth/mfa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd konfiguracji MFA');
      setSecretCode(data.secretCode);
      const uri = `otpauth://totp/Stride%20Panel:${encodeURIComponent(user?.email || '')}?secret=${data.secretCode}&issuer=Stride%20Panel`;
      const qr = await QRCode.toDataURL(uri, { width: 200, margin: 2 });
      setQrDataUrl(qr);
      setStep('qr');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
      setStep('qr');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const token = getAccessToken();
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token, code }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Nieprawidłowy kod');
      }
      setStep('done');
      setTimeout(() => router.replace('/dashboard'), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nieprawidłowy kod');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="space-y-4 items-center text-center">
          <img src="/logo.png" alt="Stride" className="h-8 w-auto" />
          <div>
            <CardTitle className="text-2xl font-semibold text-white">
              Wymagana weryfikacja dwuetapowa
            </CardTitle>
            <CardDescription className="text-zinc-500 text-sm mt-1">
              {step === 'done'
                ? 'MFA skonfigurowane pomyślnie'
                : 'Konta właścicieli muszą mieć aktywne MFA'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'loading' && (
            <p className="text-center text-zinc-400 text-sm py-4">Ładowanie...</p>
          )}

          {(step === 'qr') && (
            <div className="space-y-5">
              <p className="text-sm text-zinc-400 text-center">
                Zeskanuj kod QR w aplikacji uwierzytelniającej (Google Authenticator, Authy, itp.)
              </p>
              {qrDataUrl && (
                <div className="flex justify-center">
                  <img src={qrDataUrl} alt="QR kod MFA" className="rounded-lg" />
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-1">
                  Klucz ręczny
                </label>
                <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-zinc-400 font-mono tracking-wider select-all break-all">
                  {secretCode}
                </div>
              </div>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <Button
                className="w-full bg-white text-black hover:bg-zinc-200 font-medium"
                onClick={() => setStep('verify')}
                disabled={!secretCode || busy}
              >
                Dalej — wpisz kod
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-zinc-400 text-center">
                Wpisz 6-cyfrowy kod z aplikacji aby potwierdzić konfigurację.
              </p>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Kod weryfikacyjny
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  placeholder="000000"
                  autoFocus
                  required
                />
              </div>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-white text-black hover:bg-zinc-200 font-medium"
                disabled={busy || code.length < 6}
              >
                {busy ? 'Weryfikacja...' : 'Aktywuj MFA'}
              </Button>
              <button
                type="button"
                onClick={() => setStep('qr')}
                className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Wróć do kodu QR
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center py-4 space-y-2">
              <div className="text-4xl">✓</div>
              <p className="text-zinc-400 text-sm">Przekierowywanie do panelu...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
