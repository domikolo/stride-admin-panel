/**
 * Settings Page — profile info, change password, MFA (owner), logout, audit log
 */

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { useClientId } from '@/hooks/useClientId';
import { changePassword } from '@/lib/auth';
import { getAccessToken } from '@/lib/token';
import { getAuditLog, getApiKeys, createApiKey, revokeApiKey, getChatbotSettings, updateChatbotSettings, ChatbotHours } from '@/lib/api';
import { AuditEvent, ApiKey } from '@/lib/types';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, User, Lock, LogOut, Eye, EyeOff, ShieldCheck, ShieldOff, Loader2, Sun, Moon, Monitor, BookOpen, Layers, ClipboardList, Key, Plus, Trash2, Copy, Check, Clock } from 'lucide-react';

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

// ─── API Keys Section ──────────────────────────────────────────────────────────

function ApiKeysSection({ clientId }: { clientId: string }) {
  const { data, mutate, isLoading } = useSWR(
    clientId ? ['api-keys', clientId] : null,
    () => getApiKeys(clientId)
  );

  const [newKeyName, setNewKeyName]   = useState('');
  const [creating, setCreating]       = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [newKey, setNewKey]           = useState<ApiKey | null>(null);
  const [copied, setCopied]           = useState(false);

  const keys: ApiKey[] = (data?.keys ?? []).filter(k => k.status === 'active');

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const created = await createApiKey(clientId, newKeyName.trim());
      setNewKey(created);
      setNewKeyName('');
      setShowForm(false);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Nie udało się utworzyć klucza');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string, name: string) => {
    if (!confirm(`Odwołać klucz "${name}"? Zapytania używające tego klucza przestaną działać natychmiast.`)) return;
    try {
      await revokeApiKey(clientId, keyId);
      toast.success('Klucz odwołany');
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Błąd przy odwoływaniu klucza');
    }
  };

  const handleCopy = async () => {
    if (!newKey?.rawKey) return;
    await navigator.clipboard.writeText(newKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  return (
    <Card className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key size={16} className="text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Klucze API</h2>
        </div>
        {!showForm && !newKey && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
          >
            <Plus size={13} className="mr-1" />
            Nowy klucz
          </Button>
        )}
      </div>

      <p className="text-xs text-zinc-500">
        Klucze API umożliwiają zewnętrznym aplikacjom (Zapier, Make, własny kod) odczyt Twoich danych.
        Każdy klucz ma limit {(1000).toLocaleString('pl-PL')} zapytań dziennie.
      </p>

      {/* New key revealed */}
      {newKey?.rawKey && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <p className="text-xs text-emerald-400 font-medium">
            Klucz utworzony — skopiuj go teraz, nie zostanie pokazany ponownie.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-black/30 rounded-lg text-xs text-emerald-300 font-mono break-all select-all">
              {newKey.rawKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 p-2 rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white transition-colors"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            Endpoint: <code className="text-zinc-400">{API_BASE}/clients/{clientId}/contacts</code>
            {' · '}Nagłówek: <code className="text-zinc-400">X-API-Key: {newKey.rawKey.slice(0, 16)}…</code>
          </p>
          <Button
            onClick={() => setNewKey(null)}
            variant="outline"
            className="border-white/[0.08] text-zinc-400 hover:text-white text-xs h-7"
          >
            Zamknij
          </Button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Nazwa klucza (np. Zapier)"
            autoFocus
            className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/30"
          />
          <Button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm shrink-0"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : 'Utwórz'}
          </Button>
          <Button
            onClick={() => { setShowForm(false); setNewKeyName(''); }}
            variant="outline"
            className="border-white/[0.08] text-zinc-400 hover:text-white text-sm shrink-0"
          >
            Anuluj
          </Button>
        </div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <Loader2 size={14} className="animate-spin" />Ładowanie…
        </div>
      ) : keys.length === 0 && !newKey ? (
        <p className="text-sm text-zinc-600">Brak aktywnych kluczy.</p>
      ) : keys.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Nazwa</th>
                <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium hidden sm:table-cell">Utworzony</th>
                <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Dziś</th>
                <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium hidden sm:table-cell">Łącznie</th>
                <th className="px-4 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.keyId} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-2.5 text-zinc-200 text-xs font-medium">{k.name}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs hidden sm:table-cell whitespace-nowrap">
                    {new Date(k.createdAt).toLocaleDateString('pl-PL')}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={k.callCountToday >= k.dailyLimit ? 'text-red-400' : 'text-zinc-400'}>
                      {k.callCountToday.toLocaleString('pl-PL')}
                    </span>
                    <span className="text-zinc-600"> / {k.dailyLimit.toLocaleString('pl-PL')}</span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs hidden sm:table-cell">
                    {k.callCountTotal.toLocaleString('pl-PL')}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleRevoke(k.keyId, k.name)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                      title="Odwołaj klucz"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Chatbot Hours Section ────────────────────────────────────────────────────

const DAYS = [
  { id: 'mon', label: 'Pn' },
  { id: 'tue', label: 'Wt' },
  { id: 'wed', label: 'Śr' },
  { id: 'thu', label: 'Cz' },
  { id: 'fri', label: 'Pt' },
  { id: 'sat', label: 'Sb' },
  { id: 'sun', label: 'Nd' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  return `${h}:00`;
});

const DEFAULT_HOURS: ChatbotHours = {
  enabled: false,
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  hoursFrom: '09:00',
  hoursTo: '17:00',
  timezone: 'Europe/Warsaw',
  offlineMessage: '',
};

function ChatbotHoursSection({ clientId }: { clientId: string }) {
  const [config, setConfig] = useState<ChatbotHours>(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    getChatbotSettings(clientId)
      .then(d => setConfig(d.chatbotHours ?? DEFAULT_HOURS))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const toggleEnabled = () => {
    const prev = config;
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    save(next).catch(() => setConfig(prev));
  };

  const toggleDay = (day: string) => {
    const days = config.days.includes(day)
      ? config.days.filter(d => d !== day)
      : [...config.days, day];
    setConfig(c => ({ ...c, days }));
  };

  const save = async (data = config) => {
    if (!clientId) {
      toast.error('Brak clientId');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateChatbotSettings(clientId, data);
      setConfig(updated?.chatbotHours ?? data);
      toast.success('Zapisano');
    } catch {
      setConfig(data); // rollback to known good state
      toast.error('Nie udało się zapisać — sprawdź czy Lambda jest wgrana');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return null;

  return (
    <Card className="glass-card p-4 space-y-4">
      {/* Header row with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-zinc-400" />
          <div>
            <h2 className="text-sm font-semibold text-white">Godziny pracy chatbota</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Chatbot odpowiada tylko w wybranych godzinach
            </p>
          </div>
        </div>
        {/* Toggle switch */}
        <button
          onClick={toggleEnabled}
          disabled={saving}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
            config.enabled ? 'bg-blue-600' : 'bg-white/10'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            config.enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* Collapsible config */}
      {config.enabled && (
        <div className="space-y-5 pt-1 border-t border-white/[0.06]">
          {/* Days */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-2">Aktywne dni</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map(d => (
                <button
                  key={d.id}
                  onClick={() => toggleDay(d.id)}
                  className={`w-9 h-9 rounded-lg text-xs font-medium transition-colors ${
                    config.days.includes(d.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-300 border border-white/[0.06]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-2">Godziny</label>
            <div className="flex items-center gap-3">
              <select
                value={config.hoursFrom}
                onChange={e => setConfig(c => ({ ...c, hoursFrom: e.target.value }))}
                className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/20"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-zinc-500 text-sm">→</span>
              <select
                value={config.hoursTo}
                onChange={e => setConfig(c => ({ ...c, hoursTo: e.target.value }))}
                className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/20"
              >
                {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
              <span className="text-xs text-zinc-600">Europe/Warsaw</span>
            </div>
          </div>

          {/* Offline message */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider block mb-2">
              Wiadomość poza godzinami
            </label>
            <textarea
              value={config.offlineMessage}
              onChange={e => setConfig(c => ({ ...c, offlineMessage: e.target.value }))}
              placeholder="Np. Jestem dostępny pn–pt w godz. 9:00–17:00. Zostaw wiadomość, odezwę się wkrótce."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 resize-none"
            />
            <p className="text-right text-[11px] text-zinc-600 mt-1">{config.offlineMessage.length}/500</p>
          </div>

          <Button
            onClick={() => save()}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Zapisz
          </Button>
        </div>
      )}
    </Card>
  );
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
    <Card className="glass-card p-4 space-y-4">
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
              className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-white text-center tracking-[0.5em] text-lg placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/30"
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

// ─── Audit Log Section (owner only) ───────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'knowledge_base:create':    'Dodano wpis KB',
  'knowledge_base:update':    'Zaktualizowano wpis KB',
  'knowledge_base:delete':    'Usunięto wpis KB',
  'knowledge_base:publish':   'Opublikowano wpis KB',
  'knowledge_base:unpublish': 'Cofnięto publikację KB',
  'contact:update':           'Zaktualizowano kontakt',
  'contact:delete':           'Usunięto kontakt',
  'pipeline:update':          'Zmieniono etapy pipeline',
};

function ResourceIcon({ type }: { type: string }) {
  if (type === 'knowledge_base') return <BookOpen size={13} className="text-blue-400 shrink-0" />;
  if (type === 'contact') return <User size={13} className="text-emerald-400 shrink-0" />;
  if (type === 'pipeline') return <Layers size={13} className="text-purple-400 shrink-0" />;
  return null;
}

function formatTs(iso: string) {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const RESOURCE_LABELS: Record<string, string> = {
  knowledge_base: 'KB',
  contact: 'Kontakt',
  pipeline: 'Pipeline',
};

type SortDir = 'desc' | 'asc';

function AuditLogSection({ clientId }: { clientId: string }) {
  const [filterResource, setFilterResource] = useState('');
  const [filterAction, setFilterAction]     = useState('');
  const [sortDir, setSortDir]               = useState<SortDir>('desc');

  const { data, isLoading, error } = useSWR(
    clientId ? ['audit-log', clientId] : null,
    () => getAuditLog(clientId, { limit: 100 }),
    { refreshInterval: 60000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-zinc-500 text-sm py-8 justify-center">
        <Loader2 size={16} className="animate-spin" />
        Ładowanie dziennika…
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-400 py-2.5">Nie udało się załadować dziennika zmian.</div>;
  }

  const allEvents: AuditEvent[] = data?.events ?? [];

  // Unique action values present in data (for dropdown)
  const uniqueActions = Array.from(new Set(allEvents.map(e => e.action))).sort();

  // Client-side filter + sort
  let events = allEvents;
  if (filterResource) events = events.filter(e => e.resourceType === filterResource);
  if (filterAction)   events = events.filter(e => e.action === filterAction);
  if (sortDir === 'asc') events = [...events].reverse();

  const selectCls = 'px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20 cursor-pointer';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterResource} onChange={e => setFilterResource(e.target.value)} className={selectCls}>
          <option value="">Wszystkie zasoby</option>
          <option value="knowledge_base">KB</option>
          <option value="contact">Kontakt</option>
          <option value="pipeline">Pipeline</option>
        </select>

        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={selectCls}>
          <option value="">Wszystkie akcje</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <button
          onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
          className="px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] text-xs text-zinc-300 hover:text-white hover:border-white/20 transition-colors flex items-center gap-1.5"
        >
          {sortDir === 'desc' ? '↓ Najnowsze' : '↑ Najstarsze'}
        </button>

        <span className="text-xs text-zinc-600 ml-auto">
          {events.length} / {allEvents.length} zdarzeń
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-sm text-zinc-500 py-8 text-center">
          Brak zdarzeń spełniających kryteria.
        </div>
      ) : (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium w-40">Czas</th>
                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Użytkownik</th>
                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Akcja</th>
                <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium hidden md:table-cell">ID zasobu</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const key = `${ev.resourceType}:${ev.action}`;
                const label = ACTION_LABELS[key] ?? `${RESOURCE_LABELS[ev.resourceType] ?? ev.resourceType} — ${ev.action}`;
                return (
                  <tr
                    key={ev.sk}
                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-zinc-500 text-xs whitespace-nowrap">
                      {formatTs(ev.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400 text-xs truncate max-w-[160px]">
                      {ev.userEmail}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ResourceIcon type={ev.resourceType} />
                        <span className="text-zinc-200 text-xs">{label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 text-xs font-mono truncate max-w-[120px] hidden md:table-cell">
                      {ev.resourceId || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const clientId = useClientId();
  const { theme, setTheme } = useTheme();

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
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-3">
          <Settings className="text-zinc-400" size={22} />
          Ustawienia
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Zarządzaj kontem i hasłem</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">Ogólne</TabsTrigger>
          {user?.role === 'owner' && (
            <TabsTrigger value="audit" className="flex items-center gap-1.5">
              <ClipboardList size={13} />
              Dziennik zmian
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="general">
          <div className="space-y-5">
            {/* Profile */}
            <Card className="glass-card p-4 space-y-4">
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

            {/* API Keys */}
            <ApiKeysSection clientId={clientId ?? ''} />

            {/* Appearance */}
            <Card className="glass-card p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Sun size={16} className="text-zinc-400" />
                <h2 className="text-sm font-semibold text-white">Wygląd</h2>
              </div>
              <div className="flex gap-2">
                {([
                  { value: 'light', label: 'Jasny', Icon: Sun },
                  { value: 'dark',  label: 'Ciemny', Icon: Moon },
                  { value: 'system', label: 'System', Icon: Monitor },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border text-sm transition-colors ${
                      theme === value
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                        : 'border-white/[0.06] text-zinc-500 hover:text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Chatbot hours */}
            <ChatbotHoursSection clientId={clientId ?? ''} />

            {/* MFA — owner only */}
            {user?.role === 'owner' && <MfaSection email={user.email} />}

            {/* Change password */}
            <Card className="glass-card p-4 space-y-4">
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
            <Card className="glass-card p-4">
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
        </TabsContent>

        {user?.role === 'owner' && (
          <TabsContent value="audit">
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <ClipboardList size={16} className="text-zinc-400" />
                  Dziennik zmian
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Historia operacji na danych panelu (KB, kontakty, pipeline).
                </p>
              </div>
              <AuditLogSection clientId={clientId ?? ''} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
