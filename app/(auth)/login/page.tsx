/**
 * Login Page — email/password + optional TOTP MFA step
 */

'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // MFA step
  const [submitCode, setSubmitCode] = useState<((code: string) => Promise<void>) | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const totpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (submitCode) totpRef.current?.focus();
  }, [submitCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result?.mfaPending) {
        setSubmitCode(() => result.submitCode);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nieprawidłowe dane logowania');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!submitCode) return;
    setError('');
    setLoading(true);
    try {
      await submitCode(totpCode);
    } catch {
      setError('Nieprawidłowy kod. Sprawdź aplikację i spróbuj ponownie.');
      setTotpCode('');
      totpRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b]">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="space-y-4 items-center text-center">
          <img src="/logo.png" alt="Stride" className="h-8 w-auto" />
          <div>
            <CardTitle className="text-2xl font-semibold text-white">
              Admin Panel
            </CardTitle>
            <CardDescription className="text-zinc-500 text-sm mt-1">
              {submitCode
                ? 'Weryfikacja dwuetapowa'
                : 'Zaloguj się do panelu administracyjnego'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!submitCode ? (
            /* ── Krok 1: email + hasło ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-150"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Hasło</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-150"
                  placeholder="••••••••"
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
                className="w-full bg-white text-black hover:bg-zinc-200 font-medium transition-colors"
                disabled={loading}
              >
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </Button>
            </form>
          ) : (
            /* ── Krok 2: kod TOTP ── */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <ShieldCheck size={22} className="text-blue-400" />
                </div>
                <p className="text-sm text-zinc-400 text-center">
                  Otwórz aplikację uwierzytelniającą i wpisz 6-cyfrowy kod.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Kod weryfikacyjny</label>
                <input
                  ref={totpRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-center text-2xl tracking-[0.5em] placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/30 transition-all duration-150"
                  placeholder="000000"
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
                className="w-full bg-white text-black hover:bg-zinc-200 font-medium transition-colors"
                disabled={loading || totpCode.length < 6}
              >
                {loading ? 'Weryfikacja...' : 'Potwierdź'}
              </Button>
              <button
                type="button"
                onClick={() => { setSubmitCode(null); setError(''); setTotpCode(''); }}
                className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Wróć do logowania
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
