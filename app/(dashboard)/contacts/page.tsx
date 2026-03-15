/**
 * Contacts Page — CRM-lite
 * Table + Kanban, sortable columns, custom pipeline stages (global/backend), right panel, export CSV
 * + Appointment badge/filter, manual appointment creation, reminders system
 */

'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';

import { flashElement } from '@/hooks/useSearchHighlight';
import { useAuth } from '@/hooks/useAuth';
import { useClientId } from '@/hooks/useClientId';
import {
  getContact, updateContact, deleteContact,
  updateContactStages, createAppointment,
  getReminders, createReminder, deleteReminder,
  getReminderRules, updateReminderRules,
  getContactTimeline,
} from '@/lib/api';
import { useSWR, fetcher } from '@/lib/swr';
import { ContactProfile, ContactTimelineEvent, Reminder, ReminderRule } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, Mail, Phone, Calendar, MessageSquare,
  Copy, Check, X, Trash2, ExternalLink, Download,
  RefreshCw, List, Columns, ChevronUp, ChevronDown, Plus,
  Bell, CalendarPlus, Clock, Repeat, Activity, Loader2, ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Pipeline Config ──────────────────────────────────────────────────────────

interface StageConfig {
  value: string;
  label: string;
  bgClass?: string;
  textClass?: string;
  dotClass?: string;
  hex?: string;
  isCustom?: boolean;
}

interface CustomStage { id: string; label: string; hex: string; }

const DEFAULT_STAGES: StageConfig[] = [
  { value: 'new',       label: 'Nowy',              bgClass: 'bg-zinc-500/15',    textClass: 'text-zinc-400',    dotClass: 'bg-zinc-500' },
  { value: 'contacted', label: 'Kontakt nawiązany', bgClass: 'bg-blue-500/15',    textClass: 'text-blue-400',    dotClass: 'bg-blue-500' },
  { value: 'proposal',  label: 'Oferta wysłana',    bgClass: 'bg-amber-500/15',   textClass: 'text-amber-400',   dotClass: 'bg-amber-500' },
  { value: 'won',       label: 'Wygrany',           bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400', dotClass: 'bg-emerald-500' },
  { value: 'lost',      label: 'Przegrany',         bgClass: 'bg-red-500/15',     textClass: 'text-red-400',     dotClass: 'bg-red-500' },
];

const COLOR_PALETTE = [
  '#8b5cf6', '#3b82f6', '#06b6d4', '#22c55e',
  '#f97316', '#ec4899', '#eab308', '#f43f5e',
];

function hex2bg(hex: string) { return hex + '26'; }

// ─── UI Atoms ─────────────────────────────────────────────────────────────────

function StatusBadge({ status, allStages }: { status: string; allStages: StageConfig[] }) {
  const s = allStages.find(x => x.value === status) ?? DEFAULT_STAGES[0];
  if (s.isCustom) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: hex2bg(s.hex!), color: s.hex }}>
        <span style={{ backgroundColor: s.hex }} className="w-1.5 h-1.5 rounded-full" />
        {s.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bgClass} ${s.textClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dotClass}`} />
      {s.label}
    </span>
  );
}

type SortField = 'lastSeen' | 'firstSeen' | 'contactInfo' | 'status';
type SortDir   = 'asc' | 'desc';

function formatTs(ts: number) {
  if (!ts) return '—';
  try { return format(new Date(ts * 1000), 'd MMM yyyy'); } catch { return '—'; }
}

function ContactIcon({ type }: { type: 'email' | 'phone' }) {
  return type === 'email'
    ? <Mail size={13} className="text-zinc-500 flex-shrink-0" />
    : <Phone size={13} className="text-zinc-500 flex-shrink-0" />;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

// ─── Add Stage Form ───────────────────────────────────────────────────────────

function AddStageForm({ onAdd, onCancel }: { onAdd: (label: string, hex: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState(COLOR_PALETTE[0]);
  return (
    <div className="mt-1 p-3 bg-white/[0.03] rounded-lg border border-white/[0.08] space-y-2.5">
      <input
        autoFocus
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
        placeholder="Nazwa etapu..."
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && name.trim() && onAdd(name.trim(), hex)}
      />
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_PALETTE.map(c => (
          <button key={c} onClick={() => setHex(c)}
            className="w-5 h-5 rounded-full transition-transform hover:scale-110 flex-shrink-0"
            style={{ backgroundColor: c, outline: hex === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-zinc-500 h-7 px-2 text-xs">Anuluj</Button>
        <Button size="sm" disabled={!name.trim()} onClick={() => name.trim() && onAdd(name.trim(), hex)}
          className="h-7 px-3 text-xs" style={{ backgroundColor: hex + '33', color: hex, border: 'none' }}>
          Dodaj
        </Button>
      </div>
    </div>
  );
}

// ─── Appointment Badge ────────────────────────────────────────────────────────

function AppointmentBadge({ datetime, status }: { datetime?: string | null; status?: string | null }) {
  const label = datetime
    ? format(new Date(datetime), 'd MMM HH:mm')
    : 'Spotkanie';
  const isPending = status === 'pending';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
      isPending ? 'bg-amber-500/15 text-amber-400' : 'bg-violet-500/15 text-violet-400'
    }`}>
      <Calendar size={9} />
      {label}
    </span>
  );
}

// ─── Create Appointment Modal ─────────────────────────────────────────────────

function CreateAppointmentModal({
  contact,
  clientId,
  onClose,
  onCreated,
}: {
  contact: ContactProfile;
  clientId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [dt, setDt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!dt) return;
    setSaving(true);
    try {
      await createAppointment(clientId, {
        contact_info: contact.contactInfo,
        contact_type: contact.contactType,
        datetime: dt,
        notes,
        contact_name: contact.displayName || '',
      });
      toast.success('Spotkanie zostało umówione');
      onCreated();
      onClose();
    } catch {
      toast.error('Nie udało się umówić spotkania');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white text-[15px]">Umów spotkanie</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-white/[0.06]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <p className="text-xs text-zinc-500 mb-0.5">Kontakt</p>
            <p className="text-sm text-white">{contact.displayName || contact.contactInfo}</p>
            {contact.displayName && <p className="text-xs text-zinc-400">{contact.contactInfo}</p>}
          </div>

          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Data i godzina *</label>
            <input
              type="datetime-local"
              value={dt}
              onChange={e => setDt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Notatka (opcjonalna)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="np. Klient zadzwonił osobiście, interesuje się pakietem M"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-zinc-400 hover:text-white">
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={!dt || saving}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white border-0">
              {saving ? 'Zapisywanie...' : 'Umów'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reminder helpers ─────────────────────────────────────────────────────────

const REPEAT_OPTIONS = [
  { value: 'none',    label: 'Jednorazowo' },
  { value: 'daily',   label: 'Codziennie' },
  { value: 'weekly',  label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
  { value: 'yearly',  label: 'Co rok' },
  { value: 'custom',  label: 'Co X dni' },
];

const CHANNEL_OPTIONS = [
  { value: 'inapp', label: 'In-app (dzwoneczek)' },
  { value: 'email', label: 'Email' },
  { value: 'both',  label: 'In-app + Email' },
];

const TRIGGER_LABELS: Record<string, string> = {
  appointment_confirmed: 'Spotkanie potwierdzone',
  appointment_cancelled: 'Spotkanie odwołane',
  contact_added:         'Nowy kontakt',
  no_activity_days:      'Brak aktywności',
};

const TRIGGER_COLORS: Record<string, string> = {
  appointment_confirmed: 'bg-emerald-500/15 text-emerald-400',
  appointment_cancelled: 'bg-red-500/15 text-red-400',
  contact_added:         'bg-blue-500/15 text-blue-400',
  no_activity_days:      'bg-amber-500/15 text-amber-400',
};

function formatFireAt(ts: number) {
  try { return format(new Date(ts * 1000), 'd MMM yyyy, HH:mm'); } catch { return '—'; }
}

function formatRepeat(r: Reminder['repeat']) {
  switch (r.type) {
    case 'daily':   return 'Codziennie';
    case 'weekly':  return 'Co tydzień';
    case 'monthly': return 'Co miesiąc';
    case 'yearly':  return 'Co rok';
    case 'custom':  return `Co ${r.intervalDays ?? 7} dni`;
    default:        return 'Jednorazowo';
  }
}

function formatChannel(ch: string) {
  if (ch === 'email') return 'Email';
  if (ch === 'both')  return 'In-app + Email';
  return 'In-app';
}

// ─── Add Reminder Modal (with contact picker) ─────────────────────────────────

function AddReminderWithPickerModal({
  clientId, contacts, preselectedProfileId, onClose, onCreated,
}: {
  clientId: string;
  contacts: ContactProfile[];
  preselectedProfileId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [profileId, setProfileId] = useState(preselectedProfileId || '');
  const [contactSearch, setContactSearch] = useState('');
  const [dt, setDt] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('inapp');
  const [repeatType, setRepeatType] = useState('none');
  const [intervalDays, setIntervalDays] = useState(7);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setDt(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  }, []);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts.slice(0, 8);
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.contactInfo.toLowerCase().includes(q) || (c.displayName || '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [contacts, contactSearch]);

  const selectedContact = contacts.find(c => c.profileId === profileId);

  const handleSubmit = async () => {
    if (!profileId || !dt || !message.trim()) return;
    setSaving(true);
    try {
      await createReminder(clientId, {
        profile_id: profileId,
        fire_at: Math.floor(new Date(dt).getTime() / 1000),
        message: message.trim(),
        channel,
        repeat: repeatType === 'custom' ? { type: 'custom', interval_days: intervalDays } : { type: repeatType },
        contact_info: selectedContact?.contactInfo,
        contact_type: selectedContact?.contactType,
      });
      toast.success('Przypomnienie dodane');
      onCreated();
      onClose();
    } catch { toast.error('Nie udało się dodać przypomnienia'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white text-[15px]">Nowe przypomnienie</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1 rounded-md hover:bg-white/[0.06] transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          {/* Contact picker */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Kontakt *</label>
            {selectedContact ? (
              <div className="flex items-center justify-between p-3 bg-blue-500/[0.07] border border-blue-500/20 rounded-lg">
                <div>
                  <p className="text-sm text-white">{selectedContact.displayName || selectedContact.contactInfo}</p>
                  {selectedContact.displayName && <p className="text-xs text-zinc-400">{selectedContact.contactInfo}</p>}
                </div>
                {!preselectedProfileId && (
                  <button onClick={() => { setProfileId(''); setContactSearch(''); }} className="text-zinc-500 hover:text-zinc-300 p-1"><X size={13} /></button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input placeholder="Szukaj kontaktu..." value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors" />
                {filteredContacts.length > 0 && (
                  <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl z-10 overflow-hidden max-h-36 overflow-y-auto">
                    {filteredContacts.map(c => (
                      <button key={c.profileId} onClick={() => { setProfileId(c.profileId); setContactSearch(''); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/[0.05] transition-colors border-b border-white/[0.04] last:border-0">
                        <p className="text-sm text-white">{c.displayName || c.contactInfo}</p>
                        {c.displayName && <p className="text-xs text-zinc-500">{c.contactInfo}</p>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Data i godzina *</label>
            <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Treść przypomnienia *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="np. Oddzwoń z ofertą, sprawdź czy dotarła propozycja..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Powtarzanie</label>
              <select value={repeatType} onChange={e => setRepeatType(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-2 text-sm text-foreground focus:outline-none cursor-pointer">
                {REPEAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Kanał</label>
              <select value={channel} onChange={e => setChannel(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-2 text-sm text-foreground focus:outline-none cursor-pointer">
                {CHANNEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {repeatType === 'custom' && (
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Co ile dni</label>
              <input type="number" min={1} max={365} value={intervalDays}
                onChange={e => setIntervalDays(Math.max(1, parseInt(e.target.value) || 7))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-zinc-400 hover:text-white">Anuluj</Button>
            <Button onClick={handleSubmit} disabled={!profileId || !dt || !message.trim() || saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0">
              {saving ? 'Zapisywanie...' : 'Dodaj'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add Rule Modal ───────────────────────────────────────────────────────────

function AddRuleModal({ clientId, existingRules, onClose, onCreated }: {
  clientId: string;
  existingRules: ReminderRule[];
  onClose: () => void;
  onCreated: (rules: ReminderRule[]) => void;
}) {
  const TRIGGERS = Object.entries(TRIGGER_LABELS).map(([value, label]) => ({ value, label }));
  const [trigger, setTrigger] = useState('appointment_confirmed');
  const [delayAmount, setDelayAmount] = useState(2);
  const [delayUnit, setDelayUnit] = useState<'hours' | 'days'>('days');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [channel, setChannel] = useState('inapp');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const delayHours = delayUnit === 'days' ? delayAmount * 24 : delayAmount;

  const handleSubmit = async () => {
    if (!trigger || !messageTemplate.trim()) return;
    setSaving(true);
    try {
      const newRule: ReminderRule = {
        id: 'rule_' + Date.now(),
        trigger: trigger as ReminderRule['trigger'],
        delayHours,
        messageTemplate: messageTemplate.trim(),
        channel: channel as ReminderRule['channel'],
        enabled: true,
        label: label.trim(),
      };
      const updated = [...existingRules, newRule];
      await updateReminderRules(clientId, updated);
      toast.success('Reguła dodana');
      onCreated(updated);
    } catch { toast.error('Błąd zapisu'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-white text-[15px]">Nowa reguła automatyczna</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1 rounded-md hover:bg-white/[0.06] transition-colors"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Gdy zajdzie zdarzenie</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-2.5 py-2 text-sm text-foreground focus:outline-none cursor-pointer">
              {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">
              {trigger === 'no_activity_days' ? 'Próg nieaktywności' : 'Przypomnij po'}
            </label>
            <div className="flex gap-2">
              <input type="number" min={trigger === 'no_activity_days' ? 1 : 0} value={delayAmount} onChange={e => setDelayAmount(Math.max(trigger === 'no_activity_days' ? 1 : 0, parseInt(e.target.value) || 0))}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20 transition-colors" />
              <select value={delayUnit} onChange={e => setDelayUnit(e.target.value as 'hours' | 'days')}
                className="bg-muted border border-border rounded-lg px-2.5 py-2 text-sm text-foreground focus:outline-none cursor-pointer">
                <option value="hours">godzinach</option>
                <option value="days">dniach</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Treść przypomnienia *</label>
            <textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={3}
              placeholder="np. Follow-up po spotkaniu z {name} — sprawdź zainteresowanie"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none" />
            <p className="text-[10px] text-zinc-600 mt-1">Dostępne tokeny: <span className="text-zinc-400">{'{name}'}</span> <span className="text-zinc-400">{'{contact_info}'}</span> <span className="text-zinc-400">{'{datetime}'}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Kanał</label>
              <select value={channel} onChange={e => setChannel(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-2.5 py-2 text-sm text-foreground focus:outline-none cursor-pointer">
                {CHANNEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Etykieta (opcjonalna)</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="np. Post-meeting"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors" />
            </div>
          </div>
          {/* Preview */}
          {(messageTemplate || delayAmount > 0) && (
            <div className="p-3 bg-white/[0.03] rounded-lg border border-white/[0.06] space-y-1">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Podgląd reguły</p>
              <p className="text-xs text-zinc-300">
                Gdy <span className={`inline px-1.5 py-0.5 rounded-full text-[10px] font-medium ${TRIGGER_COLORS[trigger] || 'bg-zinc-500/15 text-zinc-400'}`}>{TRIGGER_LABELS[trigger]}</span>
                {trigger === 'no_activity_days'
                  ? <>{' '}→ gdy nieaktywny przez <strong className="text-white">{delayAmount} {delayUnit === 'hours' ? 'godz.' : 'dni'}</strong> przypomnij przez <strong className="text-white">{formatChannel(channel)}</strong>:</>
                  : <>{' '}→ za <strong className="text-white">{delayAmount} {delayUnit === 'hours' ? 'godz.' : 'dni'}</strong> przypomnij przez <strong className="text-white">{formatChannel(channel)}</strong>:</>
                }
              </p>
              {messageTemplate && <p className="text-xs text-zinc-400 italic">&ldquo;{messageTemplate}&rdquo;</p>}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-zinc-400 hover:text-white">Anuluj</Button>
            <Button onClick={handleSubmit} disabled={!trigger || !messageTemplate.trim() || saving}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white border-0">
              {saving ? 'Zapisywanie...' : 'Dodaj regułę'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reminders Tab ────────────────────────────────────────────────────────────

function RemindersTab({ clientId, contacts }: { clientId: string; contacts: ContactProfile[] }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loadingR, setLoadingR] = useState(true);
  const [loadingRules, setLoadingRules] = useState(true);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [reminderFilter, setReminderFilter] = useState<'pending' | 'fired' | ''>('pending');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);

  const contactsMap = useMemo(() => {
    const m: Record<string, ContactProfile> = {};
    contacts.forEach(c => { m[c.profileId] = c; });
    return m;
  }, [contacts]);

  const loadReminders = useCallback(async () => {
    setLoadingR(true);
    try {
      const res = await getReminders(clientId);
      setReminders(res.reminders);
    } catch { /* ignore */ }
    finally { setLoadingR(false); }
  }, [clientId]);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const res = await getReminderRules(clientId);
      setRules(res.rules);
    } catch { /* ignore */ }
    finally { setLoadingRules(false); }
  }, [clientId]);

  useEffect(() => { loadReminders(); loadRules(); }, [loadReminders, loadRules]);

  const handleDeleteReminder = async (reminderId: string) => {
    setDeleting(reminderId);
    try {
      await deleteReminder(clientId, reminderId);
      setReminders(prev => prev.filter(r => r.reminderId !== reminderId));
      toast.success('Usunięto');
    } catch { toast.error('Błąd'); }
    finally { setDeleting(null); }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const updated = rules.filter(r => r.id !== ruleId);
    setSavingRules(true);
    try {
      await updateReminderRules(clientId, updated);
      setRules(updated);
      toast.success('Reguła usunięta');
    } catch { toast.error('Błąd'); }
    finally { setSavingRules(false); }
  };

  const handleToggleRule = async (ruleId: string) => {
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r);
    setSavingRules(true);
    try {
      await updateReminderRules(clientId, updated);
      setRules(updated);
    } catch { toast.error('Błąd'); }
    finally { setSavingRules(false); }
  };

  const pending = reminders.filter(r => r.status === 'pending').sort((a, b) => a.fireAt - b.fireAt);
  const fired   = reminders.filter(r => r.status === 'fired').sort((a, b) => b.fireAt - a.fireAt);
  const displayed = reminderFilter === 'pending' ? pending
    : reminderFilter === 'fired' ? fired
    : [...pending, ...fired].sort((a, b) => a.fireAt - b.fireAt);

  const activeRulesCount = rules.filter(r => r.enabled).length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: pending.length, label: 'Nadchodzących' },
          { value: fired.length,   label: 'Wykonanych' },
          { value: activeRulesCount, label: 'Aktywnych reguł' },
        ].map(s => (
          <Card key={s.label} className="glass-card p-4">
            <div className="text-lg font-semibold text-white">{s.value}</div>
            <div className="text-sm text-zinc-500 mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Reminders list */}
      <Card className="glass-card">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-white text-[15px]">Przypomnienia</h2>
            <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border">
              {([['pending', 'Nadchodzące'], ['fired', 'Wykonane'], ['', 'Wszystkie']] as const).map(([v, lbl]) => (
                <button key={v} onClick={() => setReminderFilter(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${reminderFilter === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {lbl}
                  {v === 'pending' && pending.length > 0 && (
                    <span className="ml-1.5 bg-blue-500 text-white rounded-full px-1.5 text-[9px] font-bold">{pending.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={loadReminders} className="text-zinc-400 hover:text-white gap-1.5">
              <RefreshCw size={13} />Odśwież
            </Button>
            <Button size="sm" onClick={() => setShowAddReminder(true)} className="bg-blue-600 hover:bg-blue-700 text-white border-0 gap-1.5">
              <Plus size={14} />Dodaj przypomnienie
            </Button>
          </div>
        </div>

        {loadingR ? (
          <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : displayed.length === 0 ? (
          <EmptyState icon={Bell}
            title={reminderFilter === 'fired' ? 'Brak wykonanych przypomnień' : 'Brak nadchodzących przypomnień'}
            description={reminderFilter !== 'fired' ? 'Dodaj ręczne przypomnienie lub skonfiguruj reguły automatyczne poniżej.' : ''} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kontakt</TableHead>
                <TableHead>Treść</TableHead>
                <TableHead>Kiedy</TableHead>
                <TableHead>Powtarzanie</TableHead>
                <TableHead>Kanał</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map(r => {
                const c = contactsMap[r.profileId];
                const overdue = r.status === 'pending' && r.fireAt < Date.now() / 1000;
                return (
                  <TableRow key={r.reminderId} className="hover:bg-white/[0.02]">
                    <TableCell>
                      {c ? (
                        <div>
                          <p className="text-sm text-white">{c.displayName || c.contactInfo}</p>
                          {c.displayName && <p className="text-xs text-zinc-500">{c.contactInfo}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600 font-mono">{r.profileId.slice(0, 8)}…</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-sm text-zinc-200 truncate">{r.message}</p>
                      {r.source.startsWith('rule:') && (
                        <span className="text-[10px] text-zinc-600">automatyczne</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm ${overdue ? 'text-red-400 font-medium' : 'text-zinc-300'}`}>
                        {formatFireAt(r.fireAt)}
                      </span>
                      {overdue && <p className="text-[10px] text-red-500">Zaległe</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {r.repeat.type !== 'none' && <Repeat size={11} className="text-zinc-500" />}
                        <span className="text-sm text-zinc-400">{formatRepeat(r.repeat)}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm text-zinc-400">{formatChannel(r.channel)}</span></TableCell>
                    <TableCell>
                      {r.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full text-xs">
                          <Clock size={10} />Oczekuje
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-500/15 text-zinc-500 rounded-full text-xs">
                          <Check size={10} />Wykonane
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => handleDeleteReminder(r.reminderId)} disabled={deleting === r.reminderId}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded">
                        <X size={13} />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Automation Rules */}
      <Card className="glass-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-white text-[15px]">Reguły automatyczne</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Automatycznie tworzą przypomnienia gdy zajdzie określone zdarzenie</p>
          </div>
          <Button size="sm" onClick={() => setShowAddRule(true)} className="bg-violet-600 hover:bg-violet-700 text-white border-0 gap-1.5">
            <Plus size={14} />Dodaj regułę
          </Button>
        </div>

        {loadingRules ? (
          <div className="p-4 space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center mx-auto mb-3">
              <Repeat size={20} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-400">Brak reguł automatycznych</p>
            <p className="text-xs text-zinc-600 mt-1 max-w-xs mx-auto">
              Przykład: gdy spotkanie zostanie potwierdzone → za 2 dni automatycznie utwórz przypomnienie o follow-upie
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {rules.map(rule => (
              <div key={rule.id} className={`flex items-start gap-4 px-5 py-2.5 transition-opacity ${!rule.enabled ? 'opacity-40' : ''}`}>
                {/* Toggle */}
                <button onClick={() => handleToggleRule(rule.id)} disabled={savingRules}
                  className={`mt-1 w-9 h-5 rounded-full transition-colors flex-shrink-0 flex items-center px-0.5 ${rule.enabled ? 'bg-blue-600' : 'bg-white/[0.1]'}`}>
                  <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                {/* Rule description */}
                <div className="flex-1 min-w-0">
                  {rule.label && <p className="text-xs text-zinc-500 mb-1">{rule.label}</p>}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm text-zinc-400">Gdy</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_COLORS[rule.trigger] || 'bg-zinc-500/15 text-zinc-400'}`}>
                      {TRIGGER_LABELS[rule.trigger] || rule.trigger}
                    </span>
                    <span className="text-sm text-zinc-400">→ za</span>
                    <span className="text-sm text-white font-medium">
                      {rule.delayHours < 24
                        ? `${rule.delayHours} godz.`
                        : `${Math.round(rule.delayHours / 24)} ${Math.round(rule.delayHours / 24) === 1 ? 'dzień' : 'dni'}`}
                    </span>
                    <span className="text-sm text-zinc-400">przez</span>
                    <span className="text-sm text-zinc-300">{formatChannel(rule.channel)}</span>
                  </div>
                  <p className="text-sm text-zinc-300 truncate">&ldquo;{rule.messageTemplate}&rdquo;</p>
                  <p className="text-[10px] text-zinc-700 mt-1">Tokeny: {'{name}'} {'{contact_info}'} {'{datetime}'}</p>
                </div>
                <button onClick={() => handleDeleteRule(rule.id)} disabled={savingRules}
                  className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded flex-shrink-0 mt-0.5">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddReminder && (
        <AddReminderWithPickerModal
          clientId={clientId} contacts={contacts}
          onClose={() => setShowAddReminder(false)}
          onCreated={loadReminders}
        />
      )}
      {showAddRule && (
        <AddRuleModal
          clientId={clientId} existingRules={rules}
          onClose={() => setShowAddRule(false)}
          onCreated={updated => { setRules(updated); setShowAddRule(false); }}
        />
      )}
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  profileId: string;
  clientId: string;
  allStages: StageConfig[];
  contacts: ContactProfile[];
  onClose: () => void;
  onUpdated: (patch: Partial<ContactProfile> & { profileId: string }) => void;
  onDeleted: (profileId: string) => void;
  onAddStage: (label: string, hex: string) => Promise<void>;
  onDeleteStage: (id: string) => Promise<void>;
  onAppointmentCreated: () => void;
}

function TagPill({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/15 text-violet-400 rounded-full text-xs">
      {tag}
      <button onClick={onRemove} className="hover:text-violet-200 transition-colors">
        <X size={10} />
      </button>
    </span>
  );
}

function DetailPanel({ profileId, clientId, allStages, contacts, onClose, onUpdated, onDeleted, onAddStage, onDeleteStage, onAppointmentCreated }: DetailPanelProps) {
  const router = useRouter();
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('new');
  const [showAddStage, setShowAddStage] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [timeline, setTimeline] = useState<ContactTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    setShowAddStage(false);
    setTimeline([]);
    // Pre-populate from list data to avoid loading flash
    const fromList = contacts.find(c => c.profileId === profileId);
    if (fromList) {
      setContact(fromList);
      setEditName(fromList.displayName || '');
      setEditNotes(fromList.notes || '');
      setEditStatus(fromList.status);
      setEditTags(fromList.tags || []);
      setLoading(false);
    } else {
      setLoading(true);
    }
    // Fetch full detail (includes sources array)
    getContact(clientId, profileId).then(c => {
      setContact(c);
      setEditName(c.displayName || '');
      setEditNotes(c.notes || '');
      setEditStatus(c.status);
      setEditTags(c.tags || []);
      setLoading(false);
    }).catch(() => setLoading(false));
    // Fetch activity timeline separately (enriched, lazy)
    setTimelineLoading(true);
    getContactTimeline(clientId, profileId)
      .then(data => setTimeline(data.timeline))
      .catch(() => {})
      .finally(() => setTimelineLoading(false));
  }, [profileId, clientId]);

  const save = async (field: string, value: string) => {
    if (!contact) return;
    setSaving(true);
    try {
      await updateContact(clientId, profileId, { [field]: value });
      const patch = field === 'display_name' ? { displayName: value } : { [field]: value };
      setContact(prev => prev ? { ...prev, ...patch } : prev);
      onUpdated({ profileId, ...patch });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || editTags.includes(t) || editTags.length >= 20) return;
    const newTags = [...editTags, t];
    setEditTags(newTags);
    setTagInput('');
    try {
      await updateContact(clientId, profileId, { tags: newTags });
      setContact(prev => prev ? { ...prev, tags: newTags } : prev);
      onUpdated({ profileId, tags: newTags });
    } catch (e) { console.error(e); }
  };

  const removeTag = async (tag: string) => {
    const newTags = editTags.filter(t => t !== tag);
    setEditTags(newTags);
    try {
      await updateContact(clientId, profileId, { tags: newTags });
      setContact(prev => prev ? { ...prev, tags: newTags } : prev);
      onUpdated({ profileId, tags: newTags });
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteContact(clientId, profileId);
      onDeleted(profileId);
      onClose();
      toast.success('Kontakt usunięty');
    } catch (e) {
      console.error(e);
      toast.error('Nie udało się usunąć kontaktu');
      setSaving(false);
    }
  };

  const handleAddStage = async (label: string, hex: string) => {
    setShowAddStage(false);
    await onAddStage(label, hex);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-card border-l border-border z-50 flex flex-col shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
        <h2 className="font-semibold text-white text-[15px]">Szczegóły kontaktu</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-white/[0.06]">
          <X size={18} />
        </button>
      </div>

      {showCreateAppt && contact && (
        <CreateAppointmentModal
          contact={contact}
          clientId={clientId}
          onClose={() => setShowCreateAppt(false)}
          onCreated={onAppointmentCreated}
        />
      )}

      {loading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !contact ? (
        <div className="p-4 text-zinc-500 text-sm">Nie znaleziono kontaktu.</div>
      ) : (
        <div className="flex-1 p-4 space-y-5">
          {/* Contact info */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500/20 to-blue-600/10 border border-white/[0.08] flex items-center justify-center flex-shrink-0">
              <ContactIcon type={contact.contactType} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-white font-medium text-sm truncate">{contact.contactInfo}</span>
                <CopyButton text={contact.contactInfo} />
              </div>
              <span className="text-xs text-zinc-500 capitalize">{contact.contactType}</span>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Nazwa / Imię</label>
            <input
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
              placeholder="Wpisz imię lub nazwę..."
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => { if (editName !== (contact.displayName || '')) save('display_name', editName); }}
            />
          </div>

          {/* Pipeline status */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Status pipeline</label>
            <div className="space-y-0.5">
              {allStages.map(s => (
                <div key={s.value} className="flex items-center group">
                  <button
                    onClick={() => { setEditStatus(s.value); save('status', s.value); }}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left"
                    style={editStatus === s.value && s.isCustom ? { backgroundColor: hex2bg(s.hex!), color: s.hex } : {}}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${!s.isCustom ? s.dotClass : ''}`}
                      style={s.isCustom ? { backgroundColor: s.hex } : {}}
                    />
                    <span className={editStatus === s.value ? (s.isCustom ? '' : s.textClass!) : 'text-zinc-500 hover:text-zinc-300'}>
                      {s.label}
                    </span>
                    {editStatus === s.value && <Check size={13} className="ml-auto opacity-60" />}
                  </button>
                  {s.isCustom && (
                    <button
                      onClick={() => onDeleteStage(s.value)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-600 hover:text-red-400 rounded ml-1"
                      title="Usuń etap"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}

              {showAddStage ? (
                <AddStageForm onAdd={handleAddStage} onCancel={() => setShowAddStage(false)} />
              ) : (
                <button
                  onClick={() => setShowAddStage(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors w-full"
                >
                  <Plus size={11} />Dodaj własny etap
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Notatki</label>
            <textarea
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none"
              placeholder="Dodaj notatkę..."
              rows={4}
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
            />
            <Button size="sm" variant="ghost" className="mt-1 text-zinc-400 hover:text-white" disabled={saving}
              onClick={() => save('notes', editNotes)}>
              {saving ? 'Zapisywanie...' : 'Zapisz notatkę'}
            </Button>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Tagi</label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
              {editTags.map(tag => (
                <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)} />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                placeholder="Dodaj tag..."
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              />
              <Button size="sm" variant="ghost" onClick={addTag} className="text-zinc-400 hover:text-white px-3">
                Dodaj
              </Button>
            </div>
          </div>

          {/* Book appointment */}
          <div className="pt-1 border-t border-white/[0.04]">
            <button
              onClick={() => setShowCreateAppt(true)}
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors py-1 w-full"
            >
              <CalendarPlus size={14} />Umów spotkanie
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-zinc-600 space-y-1 pt-1 border-t border-white/[0.04]">
            <div>Pierwszy kontakt: <span className="text-zinc-400">{formatTs(contact.firstSeen)}</span></div>
            <div>Ostatni kontakt: <span className="text-zinc-400">{formatTs(contact.lastSeen)}</span></div>
            <div>Źródła: <span className="text-zinc-400">{contact.sourceCount}</span></div>
          </div>

          {/* Activity Timeline */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Activity size={13} className="text-zinc-500" />
              <p className="text-xs text-zinc-500 uppercase tracking-wide">Aktywność</p>
            </div>
            {timelineLoading && (
              <div className="flex items-center gap-2 py-3 text-zinc-600 text-xs">
                <Loader2 size={12} className="animate-spin" />Ładowanie historii…
              </div>
            )}
            {!timelineLoading && timeline.length === 0 && (
              <p className="text-xs text-zinc-600 py-2">Brak aktywności</p>
            )}
            {!timelineLoading && timeline.length > 0 && (
              <div className="relative pl-4">
                {/* Vertical connector line */}
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-white/[0.06]" />
                <div className="space-y-3">
                  {timeline.map((event, i) => (
                    <div key={i} className="relative">
                      {/* Dot on the line */}
                      <div className={`absolute -left-4 top-[7px] w-2 h-2 rounded-full border ${
                        event.type === 'appointment'  ? 'bg-violet-500/30 border-violet-500/60' :
                        event.type === 'status_change' ? 'bg-zinc-500/30 border-zinc-500/60' :
                                                         'bg-blue-500/30 border-blue-500/60'
                      }`} />
                      <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {event.type === 'appointment'
                              ? <Calendar size={11} className="text-violet-400 flex-shrink-0" />
                              : event.type === 'status_change'
                              ? <ArrowRight size={11} className="text-zinc-500 flex-shrink-0" />
                              : <MessageSquare size={11} className="text-blue-400 flex-shrink-0" />}
                            <span className={`text-[11px] font-medium ${
                              event.type === 'appointment'   ? 'text-violet-400' :
                              event.type === 'status_change' ? 'text-zinc-400' :
                                                               'text-blue-400'
                            }`}>
                              {event.type === 'appointment' ? 'Spotkanie' : event.type === 'status_change' ? 'Zmiana etapu' : 'Rozmowa'}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {new Date(event.timestamp * 1000).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {(event.type === 'conversation' || event.type === 'appointment') && event.sessionId && (
                            <button
                              onClick={() => router.push(`/conversations/${event.sessionId}`)}
                              className="text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
                              title="Otwórz rozmowę"
                            >
                              <ExternalLink size={11} />
                            </button>
                          )}
                        </div>

                        {event.type === 'conversation' && event.firstMessagePreview && (
                          <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2 italic">
                            &ldquo;{event.firstMessagePreview}&rdquo;
                          </p>
                        )}
                        {event.type === 'conversation' && event.keywords && (
                          <div className="flex flex-wrap gap-1">
                            {event.keywords.split(',').slice(0, 4).map(kw => kw.trim()).filter(Boolean).map(kw => (
                              <span key={kw} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.05] text-zinc-500 border border-white/[0.06]">
                                {kw}
                              </span>
                            ))}
                            {event.messageCount > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-zinc-600">
                                {event.messageCount} wiad.
                              </span>
                            )}
                          </div>
                        )}

                        {event.type === 'appointment' && event.datetime && (
                          <p className="text-[11px] text-zinc-400">
                            {new Date(event.datetime).toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        {event.type === 'appointment' && event.status && (
                          <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            event.status === 'verified'  ? 'bg-green-500/15 text-green-400' :
                            event.status === 'cancelled' ? 'bg-red-500/15 text-red-400' :
                                                           'bg-yellow-500/15 text-yellow-400'
                          }`}>
                            {event.status === 'verified' ? 'potwierdzone' : event.status === 'cancelled' ? 'odwołane' : 'oczekuje'}
                          </span>
                        )}

                        {event.type === 'status_change' && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <ArrowRight size={10} className="text-zinc-500 flex-shrink-0" />
                            {(() => {
                              const s = allStages.find(x => x.value === event.newStatus);
                              return (
                                <span className={`text-[11px] font-medium ${s?.textClass ?? 'text-zinc-400'}`}>
                                  {s?.label ?? event.newStatus}
                                </span>
                              );
                            })()}
                            {event.userEmail && (
                              <span className="text-[10px] text-zinc-600">
                                · {event.userEmail.split('@')[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-white/[0.06]">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-red-400">Usunąć kontakt i wszystkie powiązane rekordy?</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-zinc-400">Anuluj</Button>
                  <Button size="sm" onClick={handleDelete} disabled={saving}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0">
                    {saving ? 'Usuwanie...' : 'Potwierdź'}
                  </Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-sm text-red-500/70 hover:text-red-400 transition-colors py-1">
                <Trash2 size={14} />Usuń kontakt
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban ───────────────────────────────────────────────────────────────────

function KanbanColumn({ stage, contacts, onSelect, selectedId, onDrop }: {
  stage: StageConfig; contacts: ContactProfile[];
  onSelect: (c: ContactProfile) => void; selectedId: string | null;
  onDrop: (e: React.DragEvent, toStage: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`flex-1 min-w-[170px] rounded-xl p-2 transition-all duration-150 ${
        dragOver
          ? 'bg-blue-500/[0.06] ring-1 ring-blue-500/30'
          : 'bg-transparent'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => { setDragOver(false); onDrop(e, stage.value); }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${!stage.isCustom ? stage.dotClass : ''}`}
          style={stage.isCustom ? { backgroundColor: stage.hex } : {}} />
        <span className={`text-xs font-medium ${stage.isCustom ? '' : stage.textClass}`}
          style={stage.isCustom ? { color: stage.hex } : {}}>
          {stage.label}
        </span>
        <span className={`text-xs ml-auto font-medium transition-colors ${dragOver ? 'text-blue-400' : 'text-zinc-600'}`}>{contacts.length}</span>
      </div>
      <div className="space-y-2">
        {contacts.map(c => (
          <div
            key={c.profileId}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.setData('contactId', c.profileId);
              e.dataTransfer.setData('fromStage', stage.value);
              (e.currentTarget as HTMLDivElement).style.opacity = '0.5';
            }}
            onDragEnd={(e) => {
              (e.currentTarget as HTMLDivElement).style.opacity = '1';
            }}
            onClick={() => onSelect(c)}
            className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all ${
              selectedId === c.profileId
                ? 'border-white/20 bg-white/[0.08] shadow-sm'
                : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1]'
            }`}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <ContactIcon type={c.contactType} />
              <span className="text-xs text-zinc-300 truncate font-medium">{c.displayName || c.contactInfo}</span>
            </div>
            {c.displayName && <p className="text-[11px] text-zinc-500 truncate pl-[18px]">{c.contactInfo}</p>}
            <div className="flex items-center mt-1.5 pl-[18px]">
              <span className="text-[10px] text-zinc-600">{formatTs(c.lastSeen)}</span>
              <span className="text-[10px] text-zinc-700 ml-auto">{c.sourceCount} źr.</span>
            </div>
            {c.hasAppointment && (
              <div className="mt-1.5 pl-[18px]">
                <AppointmentBadge datetime={c.appointmentDatetime} status={c.appointmentStatus} />
              </div>
            )}
            {c.tags && c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 pl-[18px]">
                {c.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-violet-500/15 text-violet-400 rounded-full">{tag}</span>
                ))}
                {c.tags.length > 2 && <span className="text-[9px] text-zinc-600">+{c.tags.length - 2}</span>}
              </div>
            )}
          </div>
        ))}
        {contacts.length === 0 && (
          <div className={`h-16 border border-dashed rounded-lg flex items-center justify-center transition-all ${
            dragOver ? 'border-blue-500/40 bg-blue-500/[0.04]' : 'border-white/[0.05]'
          }`}>
            <span className={`text-[11px] transition-colors ${dragOver ? 'text-blue-400' : 'text-zinc-700'}`}>
              {dragOver ? 'Upuść tutaj' : 'Brak'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [mainTab, setMainTab] = useState<'contacts' | 'reminders'>('contacts');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAppt, setFilterAppt] = useState<'' | 'true' | 'false'>('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastSeen');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  const clientId = useClientId();
  const searchParams = useSearchParams();

  const { data: contactsData, isLoading: contactsLoading, error: contactsError, mutate: mutateContacts } = useSWR<{ contacts: ContactProfile[]; count: number }>(
    clientId ? `/clients/${clientId}/contacts?limit=200` : null, fetcher, { refreshInterval: 30_000 }
  );
  const { data: stagesData, mutate: mutateStages } = useSWR<{ stages: CustomStage[] }>(
    clientId ? `/clients/${clientId}/contacts/stages` : null, fetcher, { refreshInterval: 30_000 }
  );

  const contacts: ContactProfile[] = contactsData?.contacts ?? [];
  const customStages: CustomStage[] = stagesData?.stages ?? [];
  const loading = contactsLoading;
  const error = contactsError ? 'Nie udało się załadować kontaktów.' : null;

  const allStages: StageConfig[] = useMemo(() => [
    ...DEFAULT_STAGES,
    ...customStages.map(cs => ({
      value: cs.id, label: cs.label, hex: cs.hex, isCustom: true as const,
    })),
  ], [customStages]);

  // Client-side filter
  const filtered = useMemo(() => {
    let arr = contacts;
    if (filterStatus) arr = arr.filter(c => c.status === filterStatus);
    if (filterSource) arr = arr.filter(c => c.sourceTypes?.includes(filterSource) ?? true);
    if (filterType)   arr = arr.filter(c => c.contactType === filterType);
    if (filterAppt === 'true')  arr = arr.filter(c => c.hasAppointment);
    if (filterAppt === 'false') arr = arr.filter(c => !c.hasAppointment);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(c =>
        c.contactInfo.toLowerCase().includes(q) ||
        (c.displayName || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [contacts, filterStatus, filterSource, filterType, filterAppt, search]);

  // Client-side sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const d = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'lastSeen':    return d * (a.lastSeen - b.lastSeen);
        case 'firstSeen':   return d * (a.firstSeen - b.firstSeen);
        case 'contactInfo': return d * a.contactInfo.localeCompare(b.contactInfo);
        case 'status':      return d * a.status.localeCompare(b.status);
        default:            return d * (a.lastSeen - b.lastSeen);
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const paginated  = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page]);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  // Open panel + scroll to + flash row when navigated from search (?hl=profileId)
  // useSearchParams is reactive — fires even when already on /contacts
  useEffect(() => {
    const hlProfileId = searchParams.get('hl');
    if (!hlProfileId || !contacts.length) return;
    const found = contacts.find(c => c.profileId === hlProfileId);
    if (!found) return;
    router.replace('/contacts');
    setView('table');
    setSelectedId(hlProfileId);
    const idx = sorted.findIndex(c => c.profileId === hlProfileId);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
    setTimeout(() => {
      const el = document.querySelector(`[data-profile-id="${hlProfileId}"]`);
      if (el) flashElement(el);
    }, 300);
  }, [searchParams, contacts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const kanbanGroups = useMemo(() => {
    const groups: Record<string, ContactProfile[]> = {};
    allStages.forEach(s => { groups[s.value] = []; });
    sorted.forEach(c => {
      if (groups[c.status] !== undefined) groups[c.status].push(c);
      else groups['new'].push(c);
    });
    return groups;
  }, [sorted, allStages]);

  const loadContacts = () => mutateContacts();

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  const exportCsv = () => {
    const rows = sorted.map(c => [
      c.contactInfo, c.contactType, c.displayName || '',
      allStages.find(s => s.value === c.status)?.label || c.status,
      formatTs(c.firstSeen), formatTs(c.lastSeen), c.sourceCount,
    ]);
    const csv = [['Kontakt','Typ','Nazwa','Status','Pierwszy kontakt','Ostatni kontakt','Źródła'], ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `kontakty-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleAddStage = async (label: string, hex: string) => {
    if (!clientId) return;
    const id = 'custom_' + Date.now();
    const updated = [...customStages, { id, label, hex }];
    await updateContactStages(clientId, updated).catch(console.error);
    mutateStages();
  };

  const handleDeleteStage = async (id: string) => {
    if (!clientId) return;
    const updated = customStages.filter(s => s.id !== id);
    await updateContactStages(clientId, updated).catch(console.error);
    mutateStages();
  };

  const handleDrop = async (e: React.DragEvent, toStage: string) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData('contactId');
    const fromStage = e.dataTransfer.getData('fromStage');
    if (!contactId || !clientId || fromStage === toStage) return;
    // Optimistic update
    mutateContacts(prev => prev ? {
      ...prev,
      contacts: prev.contacts.map(c => c.profileId === contactId ? { ...c, status: toStage } : c)
    } : prev, false);
    await updateContact(clientId, contactId, { status: toStage }).catch(console.error);
  };

  const toggleBulkSelect = (profileId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  };

  const handleBulkStatusChange = async (status: string) => {
    if (!clientId || !status) return;
    const ids = Array.from(selectedIds);
    // Optimistic update
    mutateContacts(prev => prev ? {
      ...prev,
      contacts: prev.contacts.map(c => ids.includes(c.profileId) ? { ...c, status } : c)
    } : prev, false);
    await Promise.all(ids.map(id => updateContact(clientId, id, { status }).catch(console.error)));
    setSelectedIds(new Set());
    setBulkStatus('');
  };

  const handleBulkDelete = async () => {
    if (!clientId || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    mutateContacts(prev => prev ? {
      ...prev,
      contacts: prev.contacts.filter(c => !ids.includes(c.profileId))
    } : prev, false);
    await Promise.all(ids.map(id => deleteContact(clientId, id).catch(console.error)));
    setSelectedIds(new Set());
  };

  const handleUpdated = (patch: Partial<ContactProfile> & { profileId: string }) => {
    mutateContacts(prev => prev
      ? { ...prev, contacts: prev.contacts.map(c => c.profileId === patch.profileId ? { ...c, ...patch } : c) }
      : prev, false);
  };

  const handleDeleted = (pid: string) => {
    mutateContacts(prev => prev
      ? { ...prev, contacts: prev.contacts.filter(c => c.profileId !== pid) }
      : prev, false);
    setSelectedId(null);
  };

  const handleAppointmentCreated = () => {
    // Refresh contacts to get updated hasAppointment badge
    mutateContacts();
  };

  const SortTh = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <TableHead className={`cursor-pointer select-none hover:text-zinc-200 transition-colors ${className}`}
      onClick={() => handleSort(field)}>
      <div className="flex items-center gap-1">
        {label}
        {sortField === field
          ? sortDir === 'asc' ? <ChevronUp size={13} className="text-blue-400" /> : <ChevronDown size={13} className="text-blue-400" />
          : <ChevronDown size={13} className="text-zinc-700" />}
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-28" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className={`space-y-5 transition-all duration-300 ${selectedId && mainTab === 'contacts' ? 'pr-[388px]' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-white">Kontakty</h1>
          <p className="text-sm text-zinc-500 mt-1">Leady zebrane przez chatbota i system przypomnień</p>
        </div>
        {mainTab === 'contacts' && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={loadContacts} className="text-zinc-400 hover:text-white gap-1.5">
              <RefreshCw size={14} />Odśwież
            </Button>
            <Button variant="ghost" size="sm" onClick={exportCsv} disabled={sorted.length === 0} className="text-zinc-400 hover:text-white gap-1.5">
              <Download size={14} />Eksport CSV
            </Button>
            <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border">
              <Button variant="ghost" size="sm" onClick={() => setView('table')}
                className={view === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}>
                <List size={15} className="mr-1.5" />Tabela
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setView('kanban')}
                className={view === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}>
                <Columns size={15} className="mr-1.5" />Kanban
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main tab switcher */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border w-fit">
        <button
          onClick={() => setMainTab('contacts')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mainTab === 'contacts'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users size={13} />
          Kontakty
          {contacts.length > 0 && (
            <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded-full">
              {contacts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab('reminders')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            mainTab === 'reminders'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bell size={13} />
          Przypomnienia
        </button>
      </div>

      {mainTab === 'reminders' && clientId ? (
        <RemindersTab clientId={clientId} contacts={contacts} />
      ) : (
      <>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input type="text" placeholder="Szukaj..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors w-48" />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none cursor-pointer">
          <option value="">Wszystkie statusy</option>
          {allStages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1); }}
          className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none cursor-pointer">
          <option value="">Wszystkie źródła</option>
          <option value="appointment">Spotkanie</option>
          <option value="conversation">Rozmowa</option>
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none cursor-pointer">
          <option value="">Email i telefon</option>
          <option value="email">Email</option>
          <option value="phone">Telefon</option>
        </select>
        {/* Appointment filter */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg border border-border">
          {(['', 'true', 'false'] as const).map(v => (
            <button key={v}
              onClick={() => { setFilterAppt(v); setPage(1); }}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${filterAppt === v ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-400 hover:text-white'}`}>
              {v === ''      ? 'Wszyscy'
               : v === 'true' ? <span className="flex items-center gap-1"><Calendar size={11} />Ze spotkaniem</span>
               : 'Bez spotkania'}
            </button>
          ))}
        </div>
        {(filterStatus || filterSource || filterType || filterAppt || search) && (
          <button onClick={() => { setFilterStatus(''); setFilterSource(''); setFilterType(''); setFilterAppt(''); setSearch(''); setPage(1); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1">
            <X size={12} />Wyczyść
          </button>
        )}
      </div>

      {/* Table */}
      {view === 'table' ? (
        <Card className="glass-card">
          {sorted.length === 0 ? (
            <EmptyState icon={Users} title="Brak kontaktów"
              description="Kontakty pojawią się tutaj gdy chatbot zbierze email lub telefon." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        className="accent-blue-500"
                        checked={paginated.length > 0 && paginated.every(c => selectedIds.has(c.profileId))}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set(paginated.map(c => c.profileId)));
                          else setSelectedIds(new Set());
                        }}
                      />
                    </TableHead>
                    <SortTh field="contactInfo" label="Kontakt" />
                    <SortTh field="status" label="Status" />
                    <TableHead>Typ</TableHead>
                    <TableHead>Tagi</TableHead>
                    <TableHead>Źr.</TableHead>
                    <SortTh field="firstSeen" label="Pierwszy kontakt" />
                    <SortTh field="lastSeen" label="Ostatni kontakt" />
                    <TableHead className="w-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(c => (
                    <TableRow key={c.profileId}
                      data-profile-id={c.profileId}
                      className={`hover:bg-white/[0.04] cursor-pointer transition-colors ${selectedId === c.profileId ? 'bg-white/[0.06]' : ''} ${selectedIds.has(c.profileId) ? 'bg-blue-500/[0.04]' : ''}`}
                      onClick={() => setSelectedId(c.profileId === selectedId ? null : c.profileId)}>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="accent-blue-500"
                          checked={selectedIds.has(c.profileId)}
                          onChange={() => toggleBulkSelect(c.profileId)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <ContactIcon type={c.contactType} />
                          </div>
                          <div className="min-w-0">
                            {c.displayName && <p className="text-sm text-white font-medium truncate">{c.displayName}</p>}
                            <p className={`text-sm truncate ${c.displayName ? 'text-zinc-400' : 'text-white'}`}>{c.contactInfo}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={c.status} allStages={allStages} />
                          {c.hasAppointment && <AppointmentBadge datetime={c.appointmentDatetime} status={c.appointmentStatus} />}
                        </div>
                      </TableCell>
                      <TableCell><span className="text-xs text-zinc-400 capitalize">{c.contactType}</span></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-violet-500/15 text-violet-400 rounded-full">{tag}</span>
                          ))}
                          {(c.tags?.length || 0) > 3 && <span className="text-[10px] text-zinc-600">+{(c.tags?.length || 0) - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell><span className="text-sm text-zinc-400">{c.sourceCount}</span></TableCell>
                      <TableCell><span className="text-sm text-zinc-400">{formatTs(c.firstSeen)}</span></TableCell>
                      <TableCell><span className="text-sm text-zinc-400">{formatTs(c.lastSeen)}</span></TableCell>
                      <TableCell>
                        <ChevronDown size={14} className={`transition-transform ${selectedId === c.profileId ? 'rotate-[-90deg] text-white' : 'text-zinc-700'}`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <span className="text-xs text-zinc-500">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} z {sorted.length}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                      className="text-zinc-400 hover:text-white h-7 px-2 text-xs">← Wstecz</Button>
                    <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                      className="text-zinc-400 hover:text-white h-7 px-2 text-xs">Dalej →</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: allStages.length * 185 + 'px' }}>
            {allStages.map(stage => (
              <KanbanColumn key={stage.value} stage={stage} contacts={kanbanGroups[stage.value] || []}
                onSelect={c => setSelectedId(c.profileId === selectedId ? null : c.profileId)}
                selectedId={selectedId}
                onDrop={handleDrop} />
            ))}
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2.5 bg-card/90 backdrop-blur-xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-1.5 px-2">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Check size={11} className="text-blue-400" />
            </div>
            <span className="text-sm text-white font-semibold tabular-nums">{selectedIds.size}</span>
            <span className="text-sm text-zinc-400">zaznaczonych</span>
          </div>
          <div className="w-px h-5 bg-white/[0.08] mx-1" />
          <select
            value={bulkStatus}
            onChange={e => setBulkStatus(e.target.value)}
            className="bg-white/[0.06] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="">Zmień status...</option>
            {allStages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {bulkStatus && (
            <Button size="sm" onClick={() => handleBulkStatusChange(bulkStatus)}
              className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0">
              Zastosuj
            </Button>
          )}
          <div className="w-px h-5 bg-white/[0.08] mx-1" />
          <button
            onClick={handleBulkDelete}
            className="h-7 px-3 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Usuń
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors ml-1">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Detail panel */}
      {selectedId && clientId && (
        <DetailPanel
          profileId={selectedId}
          clientId={clientId}
          allStages={allStages}
          contacts={contacts}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onAddStage={handleAddStage}
          onDeleteStage={handleDeleteStage}
          onAppointmentCreated={handleAppointmentCreated}
        />
      )}
      </>
      )}
    </div>
  );
}
