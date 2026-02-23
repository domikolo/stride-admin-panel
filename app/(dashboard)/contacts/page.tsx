/**
 * Contacts Page — CRM-lite
 * Table + Kanban views, right slide-in detail panel, filters, export CSV
 */

'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClientContacts, getContact, updateContact, deleteContact } from '@/lib/api';
import { ContactProfile, PipelineStage } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Users, Mail, Phone, Calendar, MessageSquare,
  Copy, Check, X, Trash2, ExternalLink, Download,
  RefreshCw, List, Columns, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Pipeline Config ──────────────────────────────────────────────────────────

const STAGES: { value: PipelineStage; label: string; color: string; textColor: string; dot: string }[] = [
  { value: 'new',       label: 'Nowy',              color: 'bg-zinc-500/15',  textColor: 'text-zinc-400',   dot: 'bg-zinc-500' },
  { value: 'contacted', label: 'Kontakt nawiązany', color: 'bg-blue-500/15',  textColor: 'text-blue-400',   dot: 'bg-blue-500' },
  { value: 'proposal',  label: 'Oferta wysłana',    color: 'bg-amber-500/15', textColor: 'text-amber-400',  dot: 'bg-amber-500' },
  { value: 'won',       label: 'Wygrany',           color: 'bg-emerald-500/15', textColor: 'text-emerald-400', dot: 'bg-emerald-500' },
  { value: 'lost',      label: 'Przegrany',         color: 'bg-red-500/15',   textColor: 'text-red-400',    dot: 'bg-red-500' },
];

const stageMap = Object.fromEntries(STAGES.map(s => [s.value, s]));

function StatusBadge({ status }: { status: PipelineStage }) {
  const s = stageMap[status] ?? stageMap['new'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.color} ${s.textColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  profileId: string;
  clientId: string;
  onClose: () => void;
  onUpdated: (c: ContactProfile) => void;
  onDeleted: (profileId: string) => void;
}

function DetailPanel({ profileId, clientId, onClose, onUpdated, onDeleted }: DetailPanelProps) {
  const router = useRouter();
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<PipelineStage>('new');

  useEffect(() => {
    setLoading(true);
    setConfirmDelete(false);
    getContact(clientId, profileId).then(c => {
      setContact(c);
      setEditName(c.displayName || '');
      setEditNotes(c.notes || '');
      setEditStatus(c.status);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [profileId, clientId]);

  const saveField = async (field: 'status' | 'notes' | 'display_name', value: string) => {
    if (!contact) return;
    setSaving(true);
    try {
      await updateContact(clientId, profileId, { [field]: value });
      const updated = { ...contact, [field === 'display_name' ? 'displayName' : field]: value };
      setContact(updated);
      onUpdated(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteContact(clientId, profileId);
      onDeleted(profileId);
      onClose();
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-[#0e0e10] border-l border-white/[0.06] z-50 flex flex-col shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
        <h2 className="font-semibold text-white text-[15px]">Szczegóły kontaktu</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-white/[0.06]">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !contact ? (
        <div className="p-5 text-zinc-500 text-sm">Nie znaleziono kontaktu.</div>
      ) : (
        <div className="flex-1 p-5 space-y-5">

          {/* Avatar + contact info */}
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

          {/* Display name */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Nazwa</label>
            <input
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
              placeholder="Wpisz nazwę..."
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => { if (editName !== (contact.displayName || '')) saveField('display_name', editName); }}
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Status pipeline</label>
            <div className="grid grid-cols-1 gap-1">
              {STAGES.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setEditStatus(s.value); saveField('status', s.value); }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    editStatus === s.value
                      ? `${s.color} ${s.textColor} border border-current/20`
                      : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                  {editStatus === s.value && <Check size={14} className="ml-auto" />}
                </button>
              ))}
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
            <Button
              size="sm"
              variant="ghost"
              className="mt-1.5 text-zinc-400 hover:text-white"
              disabled={saving}
              onClick={() => saveField('notes', editNotes)}
            >
              {saving ? 'Zapisywanie...' : 'Zapisz notatkę'}
            </Button>
          </div>

          {/* Meta */}
          <div className="text-xs text-zinc-600 space-y-1">
            <div>Pierwszy kontakt: <span className="text-zinc-400">{formatTs(contact.firstSeen)}</span></div>
            <div>Ostatni kontakt: <span className="text-zinc-400">{formatTs(contact.lastSeen)}</span></div>
            <div>Źródła: <span className="text-zinc-400">{contact.sourceCount}</span></div>
          </div>

          {/* Sources */}
          {contact.sources && contact.sources.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Historia źródeł</p>
              <div className="space-y-1.5">
                {contact.sources.map((src, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      {src.sourceType === 'appointment'
                        ? <Calendar size={13} className="text-violet-400" />
                        : <MessageSquare size={13} className="text-blue-400" />
                      }
                      <span className={`text-xs ${src.sourceType === 'appointment' ? 'text-violet-400' : 'text-blue-400'}`}>
                        {src.sourceType === 'appointment' ? 'Spotkanie' : 'Rozmowa'}
                      </span>
                      <span className="text-xs text-zinc-600">{formatTs(src.createdAt)}</span>
                    </div>
                    {src.sessionId && (
                      <button
                        onClick={() => router.push(`/conversations/${src.sessionId}`)}
                        className="text-zinc-600 hover:text-zinc-300 transition-colors"
                        title="Otwórz rozmowę"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete */}
          <div className="pt-2 border-t border-white/[0.06]">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-red-400">Usunąć kontakt i wszystkie powiązane rekordy?</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-zinc-400">
                    Anuluj
                  </Button>
                  <Button size="sm" onClick={handleDelete} disabled={saving}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0">
                    {saving ? 'Usuwanie...' : 'Potwierdź usunięcie'}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 text-sm text-red-500/70 hover:text-red-400 transition-colors py-1"
              >
                <Trash2 size={14} />
                Usuń kontakt
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  contacts,
  onSelect,
  selectedId,
}: {
  stage: typeof STAGES[0];
  contacts: ContactProfile[];
  onSelect: (c: ContactProfile) => void;
  selectedId: string | null;
}) {
  return (
    <div className="flex-1 min-w-[180px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
        <span className="text-xs font-medium text-zinc-400">{stage.label}</span>
        <span className="text-xs text-zinc-600 ml-auto">{contacts.length}</span>
      </div>
      <div className="space-y-2">
        {contacts.map(c => (
          <div
            key={c.profileId}
            onClick={() => onSelect(c)}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedId === c.profileId
                ? 'border-white/20 bg-white/[0.08]'
                : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ContactIcon type={c.contactType} />
              <span className="text-xs text-zinc-300 truncate">
                {c.displayName || c.contactInfo}
              </span>
            </div>
            {c.displayName && (
              <p className="text-[11px] text-zinc-500 truncate mb-1">{c.contactInfo}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-zinc-400">
                {c.sourceCount} źr.
              </span>
              <span className="text-[10px] text-zinc-600 ml-auto">{formatTs(c.lastSeen)}</span>
            </div>
          </div>
        ))}
        {contacts.length === 0 && (
          <div className="h-20 border border-dashed border-white/[0.06] rounded-lg flex items-center justify-center">
            <span className="text-xs text-zinc-700">Brak</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewType = 'table' | 'kanban';

export default function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const getClientId = () =>
    user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClientContacts(getClientId(), {
        status: statusFilter || undefined,
        source_type: sourceFilter || undefined,
        contact_type: typeFilter || undefined,
        limit: 200,
      });
      setContacts(data.contacts);
      setPage(1);
    } catch (e) {
      console.error(e);
      setError('Nie udało się załadować kontaktów. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadContacts();
  }, [user]);

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(c =>
      c.contactInfo.toLowerCase().includes(q) ||
      (c.displayName || '').toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Pagination for table view
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  // Kanban grouped
  const kanbanGroups = useMemo(() => {
    const groups: Record<PipelineStage, ContactProfile[]> = {
      new: [], contacted: [], proposal: [], won: [], lost: [],
    };
    filtered.forEach(c => { groups[c.status]?.push(c); });
    return groups;
  }, [filtered]);

  // Export CSV
  const exportCsv = () => {
    const headers = ['Kontakt', 'Typ', 'Status', 'Nazwa', 'Pierwsze widzenie', 'Ostatnie widzenie', 'Źródła'];
    const rows = filtered.map(c => [
      c.contactInfo,
      c.contactType,
      stageMap[c.status]?.label || c.status,
      c.displayName || '',
      formatTs(c.firstSeen),
      formatTs(c.lastSeen),
      c.sourceCount,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `kontakty-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Detail panel handlers
  const handleContactUpdated = (updated: ContactProfile) => {
    setContacts(prev => prev.map(c => c.profileId === updated.profileId ? { ...c, ...updated } : c));
  };

  const handleContactDeleted = (profileId: string) => {
    setContacts(prev => prev.filter(c => c.profileId !== profileId));
    setSelectedId(null);
  };

  const clientId = getClientId();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${selectedId ? 'pr-[380px]' : ''} transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
            Kontakty
            {contacts.length > 0 && (
              <span className="text-sm font-normal bg-white/[0.06] text-zinc-400 px-2.5 py-0.5 rounded-full">
                {filtered.length}
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Leady i kontakty zebrane przez chatbota</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadContacts}
            className="text-zinc-400 hover:text-white gap-1.5"
          >
            <RefreshCw size={14} />
            Odśwież
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="text-zinc-400 hover:text-white gap-1.5"
          >
            <Download size={14} />
            Eksport CSV
          </Button>
          {/* View toggle */}
          <div className="flex gap-1 bg-[#111113] p-1 rounded-lg border border-white/[0.06]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('table')}
              className={view === 'table' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white'}
            >
              <List size={15} className="mr-1.5" />
              Tabela
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setView('kanban')}
              className={view === 'kanban' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white'}
            >
              <Columns size={15} className="mr-1.5" />
              Kanban
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Szukaj kontaktu..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors w-52"
        />

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); loadContacts(); }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="">Wszystkie statusy</option>
          {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={e => { setSourceFilter(e.target.value); loadContacts(); }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="">Wszystkie źródła</option>
          <option value="appointment">Spotkanie</option>
          <option value="conversation">Rozmowa</option>
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); loadContacts(); }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="">Wszystkie typy</option>
          <option value="email">Email</option>
          <option value="phone">Telefon</option>
        </select>

        {/* Clear filters */}
        {(statusFilter || sourceFilter || typeFilter || search) && (
          <button
            onClick={() => { setStatusFilter(''); setSourceFilter(''); setTypeFilter(''); setSearch(''); loadContacts(); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <X size={12} />
            Wyczyść
          </button>
        )}
      </div>

      {/* Main content */}
      {view === 'table' ? (
        <Card className="glass-card">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Brak kontaktów"
              description="Kontakty pojawią się tutaj, gdy chatbot zbierze email lub telefon podczas rozmowy lub bookingu."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kontakt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Źródła</TableHead>
                    <TableHead>Ostatni kontakt</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(c => (
                    <TableRow
                      key={c.profileId}
                      className={`hover:bg-white/[0.04] cursor-pointer transition-colors ${
                        selectedId === c.profileId ? 'bg-white/[0.06]' : ''
                      }`}
                      onClick={() => setSelectedId(c.profileId === selectedId ? null : c.profileId)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                            <ContactIcon type={c.contactType} />
                          </div>
                          <div className="min-w-0">
                            {c.displayName && (
                              <p className="text-sm text-white font-medium truncate">{c.displayName}</p>
                            )}
                            <p className={`text-sm truncate ${c.displayName ? 'text-zinc-400' : 'text-white'}`}>
                              {c.contactInfo}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-zinc-400 capitalize">{c.contactType}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-400">{c.sourceCount}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-400">{formatTs(c.lastSeen)}</span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight size={15} className={`transition-colors ${selectedId === c.profileId ? 'text-white' : 'text-zinc-600'}`} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
                  <span className="text-xs text-zinc-500">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} z {filtered.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="text-zinc-400 hover:text-white h-7 px-2 text-xs"
                    >
                      ← Wstecz
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      className="text-zinc-400 hover:text-white h-7 px-2 text-xs"
                    >
                      Dalej →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      ) : (
        /* Kanban view */
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-[900px]">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage.value}
                stage={stage}
                contacts={kanbanGroups[stage.value]}
                onSelect={c => setSelectedId(c.profileId === selectedId ? null : c.profileId)}
                selectedId={selectedId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Right detail panel */}
      {selectedId && (
        <DetailPanel
          profileId={selectedId}
          clientId={clientId}
          onClose={() => setSelectedId(null)}
          onUpdated={handleContactUpdated}
          onDeleted={handleContactDeleted}
        />
      )}
    </div>
  );
}
