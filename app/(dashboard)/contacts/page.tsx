/**
 * Contacts Page — CRM-lite
 * Table + Kanban, sortable columns, custom pipeline stages, right panel, export CSV
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getClientContacts, getContact, updateContact, deleteContact } from '@/lib/api';
import { ContactProfile } from '@/lib/types';
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
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Pipeline Config ──────────────────────────────────────────────────────────

interface StageConfig {
  value: string;
  label: string;
  bgClass?: string;
  textClass?: string;
  dotClass?: string;
  hex?: string;         // for custom stages
  isCustom?: boolean;
}

const DEFAULT_STAGES: StageConfig[] = [
  { value: 'new',       label: 'Nowy',              bgClass: 'bg-zinc-500/15',    textClass: 'text-zinc-400',    dotClass: 'bg-zinc-500' },
  { value: 'contacted', label: 'Kontakt nawiązany', bgClass: 'bg-blue-500/15',    textClass: 'text-blue-400',    dotClass: 'bg-blue-500' },
  { value: 'proposal',  label: 'Oferta wysłana',    bgClass: 'bg-amber-500/15',   textClass: 'text-amber-400',   dotClass: 'bg-amber-500' },
  { value: 'won',       label: 'Wygrany',           bgClass: 'bg-emerald-500/15', textClass: 'text-emerald-400', dotClass: 'bg-emerald-500' },
  { value: 'lost',      label: 'Przegrany',         bgClass: 'bg-red-500/15',     textClass: 'text-red-400',     dotClass: 'bg-red-500' },
];

const COLOR_PALETTE = [
  '#8b5cf6', // violet
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#22c55e', // green
  '#f97316', // orange
  '#ec4899', // pink
  '#eab308', // yellow
  '#f43f5e', // rose
];

interface CustomStage {
  id: string;
  label: string;
  hex: string;
}

function hex2bg(hex: string) { return hex + '26'; } // ~15% opacity

function StageIndicator({ stage }: { stage: StageConfig }) {
  if (stage.isCustom) {
    return <span style={{ backgroundColor: stage.hex }} className="w-2 h-2 rounded-full flex-shrink-0" />;
  }
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.dotClass}`} />;
}

function StatusBadge({ status, allStages }: { status: string; allStages: StageConfig[] }) {
  const s = allStages.find(x => x.value === status) ?? DEFAULT_STAGES[0];
  if (s.isCustom) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: hex2bg(s.hex!), color: s.hex }}
      >
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

type SortField = 'lastSeen' | 'firstSeen' | 'contactInfo' | 'status';
type SortDir = 'asc' | 'desc';

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
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-zinc-600 hover:text-zinc-300 transition-colors p-0.5 rounded"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

function SortIcon({ field, active, dir }: { field: SortField; active: boolean; dir: SortDir }) {
  if (!active) return <ChevronDown size={13} className="text-zinc-700 ml-1" />;
  return dir === 'asc'
    ? <ChevronUp size={13} className="text-blue-400 ml-1" />
    : <ChevronDown size={13} className="text-blue-400 ml-1" />;
}

// ─── Custom Stage Form ────────────────────────────────────────────────────────

function AddStageForm({ onAdd, onCancel }: { onAdd: (label: string, hex: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [hex, setHex] = useState(COLOR_PALETTE[0]);
  return (
    <div className="mt-2 p-3 bg-white/[0.03] rounded-lg border border-white/[0.08] space-y-2.5">
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
          <button
            key={c}
            onClick={() => setHex(c)}
            className="w-5 h-5 rounded-full transition-transform hover:scale-110 flex-shrink-0"
            style={{ backgroundColor: c, outline: hex === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 h-7 px-2 text-xs">
          Anuluj
        </Button>
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={() => name.trim() && onAdd(name.trim(), hex)}
          className="h-7 px-3 text-xs"
          style={{ backgroundColor: hex + '33', color: hex, border: 'none' }}
        >
          Dodaj etap
        </Button>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  profileId: string;
  clientId: string;
  allStages: StageConfig[];
  onClose: () => void;
  onUpdated: (c: Partial<ContactProfile> & { profileId: string }) => void;
  onDeleted: (profileId: string) => void;
  onAddStage: (label: string, hex: string) => void;
}

function DetailPanel({ profileId, clientId, allStages, onClose, onUpdated, onDeleted, onAddStage }: DetailPanelProps) {
  const router = useRouter();
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('new');
  const [showAddStage, setShowAddStage] = useState(false);

  useEffect(() => {
    setLoading(true);
    setConfirmDelete(false);
    setShowAddStage(false);
    getContact(clientId, profileId).then(c => {
      setContact(c);
      setEditName(c.displayName || '');
      setEditNotes(c.notes || '');
      setEditStatus(c.status);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [profileId, clientId]);

  const save = async (field: string, value: string) => {
    if (!contact) return;
    setSaving(true);
    try {
      await updateContact(clientId, profileId, { [field]: value });
      const patch = field === 'display_name' ? { displayName: value } : { [field]: value };
      const updated = { ...contact, ...patch } as ContactProfile;
      setContact(updated);
      onUpdated({ profileId, ...patch });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteContact(clientId, profileId);
      onDeleted(profileId);
      onClose();
    } catch (e) { console.error(e); setSaving(false); }
  };

  const handleAddStage = (label: string, hex: string) => {
    setShowAddStage(false);
    onAddStage(label, hex);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[380px] bg-[#0e0e10] border-l border-white/[0.06] z-50 flex flex-col shadow-2xl overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/[0.06] sticky top-0 bg-[#0e0e10] z-10">
        <h2 className="font-semibold text-white text-[15px]">Szczegóły kontaktu</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-white/[0.06]">
          <X size={18} />
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-24 w-full" />
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
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Nazwa / Imię</label>
            <input
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
              placeholder="Wpisz imię lub nazwę..."
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={() => { if (editName !== (contact.displayName || '')) save('display_name', editName); }}
            />
          </div>

          {/* Status / Pipeline */}
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Status pipeline</label>
            <div className="space-y-0.5">
              {allStages.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setEditStatus(s.value); save('status', s.value); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left`}
                  style={
                    editStatus === s.value && s.isCustom
                      ? { backgroundColor: hex2bg(s.hex!), color: s.hex }
                      : editStatus === s.value
                      ? {}
                      : {}
                  }
                  {...(editStatus !== s.value && !s.isCustom ? {} : {})}
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${!s.isCustom ? s.dotClass : ''}`}
                    style={s.isCustom ? { backgroundColor: s.hex } : {}}
                  />
                  <span className={
                    editStatus === s.value
                      ? s.isCustom ? '' : s.textClass
                      : 'text-zinc-500 hover:text-zinc-300'
                  }>
                    {s.label}
                  </span>
                  {editStatus === s.value && <Check size={13} className="ml-auto opacity-70" />}
                </button>
              ))}

              {/* Add custom stage */}
              {showAddStage ? (
                <AddStageForm onAdd={handleAddStage} onCancel={() => setShowAddStage(false)} />
              ) : (
                <button
                  onClick={() => setShowAddStage(true)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Plus size={11} />
                  Dodaj własny etap
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
            <Button
              size="sm" variant="ghost"
              className="mt-1 text-zinc-400 hover:text-white"
              disabled={saving}
              onClick={() => save('notes', editNotes)}
            >
              {saving ? 'Zapisywanie...' : 'Zapisz notatkę'}
            </Button>
          </div>

          {/* Meta */}
          <div className="text-xs text-zinc-600 space-y-1 pt-1 border-t border-white/[0.04]">
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
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-zinc-400">Anuluj</Button>
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

// ─── Kanban ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  stage, contacts, onSelect, selectedId,
}: {
  stage: StageConfig;
  contacts: ContactProfile[];
  onSelect: (c: ContactProfile) => void;
  selectedId: string | null;
}) {
  return (
    <div className="flex-1 min-w-[170px]">
      <div className="flex items-center gap-2 mb-3 px-1">
        <StageIndicator stage={stage} />
        <span
          className={`text-xs font-medium ${stage.isCustom ? '' : stage.textClass}`}
          style={stage.isCustom ? { color: stage.hex } : {}}
        >
          {stage.label}
        </span>
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
            <div className="flex items-center gap-1.5 mb-0.5">
              <ContactIcon type={c.contactType} />
              <span className="text-xs text-zinc-300 truncate font-medium">
                {c.displayName || c.contactInfo}
              </span>
            </div>
            {c.displayName && (
              <p className="text-[11px] text-zinc-500 truncate pl-[18px]">{c.contactInfo}</p>
            )}
            <div className="flex items-center mt-1.5 pl-[18px]">
              <span className="text-[10px] text-zinc-600">{formatTs(c.lastSeen)}</span>
              <span className="text-[10px] text-zinc-700 ml-auto">{c.sourceCount} źr.</span>
            </div>
          </div>
        ))}
        {contacts.length === 0 && (
          <div className="h-16 border border-dashed border-white/[0.05] rounded-lg flex items-center justify-center">
            <span className="text-[11px] text-zinc-700">Brak</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STAGES_STORAGE_KEY = (clientId: string) => `contacts_stages_${clientId}`;

function loadCustomStages(clientId: string): CustomStage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STAGES_STORAGE_KEY(clientId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomStages(clientId: string, stages: CustomStage[]) {
  try { localStorage.setItem(STAGES_STORAGE_KEY(clientId), JSON.stringify(stages)); } catch {}
}

export default function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastSeen');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [customStages, setCustomStages] = useState<CustomStage[]>([]);
  const PAGE_SIZE = 20;

  const clientId = user?.role === 'owner' ? 'stride-services' : user?.clientId || 'stride-services';

  // Load custom stages from localStorage once clientId is known
  useEffect(() => {
    if (user) setCustomStages(loadCustomStages(clientId));
  }, [user, clientId]);

  // Merge default + custom stages
  const allStages: StageConfig[] = useMemo(() => [
    ...DEFAULT_STAGES,
    ...customStages.map(cs => ({
      value: cs.id,
      label: cs.label,
      hex: cs.hex,
      isCustom: true as const,
    })),
  ], [customStages]);

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getClientContacts(clientId, { limit: 200 });
      setContacts(data.contacts);
      setPage(1);
    } catch (e) {
      console.error(e);
      setError('Nie udało się załadować kontaktów.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) loadContacts(); }, [user]);

  // Client-side filter → sort → paginate
  const filtered = useMemo(() => {
    let arr = contacts;
    if (filterStatus) arr = arr.filter(c => c.status === filterStatus);
    if (filterSource) arr = arr.filter(c => c.sources
      ? c.sources.some(s => s.sourceType === filterSource)
      : true
    );
    if (filterType) arr = arr.filter(c => c.contactType === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(c =>
        c.contactInfo.toLowerCase().includes(q) ||
        (c.displayName || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [contacts, filterStatus, filterSource, filterType, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'lastSeen':   return dir * (a.lastSeen - b.lastSeen);
        case 'firstSeen':  return dir * (a.firstSeen - b.firstSeen);
        case 'contactInfo': return dir * a.contactInfo.localeCompare(b.contactInfo);
        case 'status':     return dir * a.status.localeCompare(b.status);
        default:           return dir * (a.lastSeen - b.lastSeen);
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const paginated = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page]);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

  const kanbanGroups = useMemo(() => {
    const groups: Record<string, ContactProfile[]> = {};
    allStages.forEach(s => { groups[s.value] = []; });
    sorted.forEach(c => {
      if (groups[c.status] !== undefined) {
        groups[c.status].push(c);
      } else {
        // unknown status → put in 'new'
        groups['new'].push(c);
      }
    });
    return groups;
  }, [sorted, allStages]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  };

  const exportCsv = () => {
    const headers = ['Kontakt', 'Typ', 'Nazwa', 'Status', 'Pierwszy kontakt', 'Ostatni kontakt', 'Źródła'];
    const rows = sorted.map(c => [
      c.contactInfo,
      c.contactType,
      c.displayName || '',
      allStages.find(s => s.value === c.status)?.label || c.status,
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

  const handleAddStage = (label: string, hex: string) => {
    const id = 'custom_' + label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
    const updated = [...customStages, { id, label, hex }];
    setCustomStages(updated);
    saveCustomStages(clientId, updated);
  };

  const handleUpdated = (patch: Partial<ContactProfile> & { profileId: string }) => {
    setContacts(prev => prev.map(c => c.profileId === patch.profileId ? { ...c, ...patch } : c));
  };

  const handleDeleted = (pid: string) => {
    setContacts(prev => prev.filter(c => c.profileId !== pid));
    setSelectedId(null);
  };

  const ThCell = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-white transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {label}
        <SortIcon field={field} active={sortField === field} dir={sortDir} />
      </div>
    </TableHead>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-9 w-28" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className={`space-y-5 transition-all duration-300 ${selectedId ? 'pr-[388px]' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-3">
            Kontakty
            {contacts.length > 0 && (
              <span className="text-sm font-normal bg-white/[0.06] text-zinc-400 px-2.5 py-0.5 rounded-full">
                {sorted.length}{sorted.length !== contacts.length ? ` / ${contacts.length}` : ''}
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Leady zebrane przez chatbota</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={loadContacts} className="text-zinc-400 hover:text-white gap-1.5">
            <RefreshCw size={14} />
            Odśwież
          </Button>
          <Button variant="ghost" size="sm" onClick={exportCsv} disabled={sorted.length === 0} className="text-zinc-400 hover:text-white gap-1.5">
            <Download size={14} />
            Eksport CSV
          </Button>
          <div className="flex gap-1 bg-[#111113] p-1 rounded-lg border border-white/[0.06]">
            <Button variant="ghost" size="sm" onClick={() => setView('table')}
              className={view === 'table' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white'}>
              <List size={15} className="mr-1.5" />Tabela
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView('kanban')}
              className={view === 'kanban' ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-400 hover:text-white'}>
              <Columns size={15} className="mr-1.5" />Kanban
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          placeholder="Szukaj..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/20 transition-colors w-48"
        />
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="">Wszystkie statusy</option>
          {allStages.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={e => { setFilterSource(e.target.value); setPage(1); }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="">Wszystkie źródła</option>
          <option value="appointment">Spotkanie</option>
          <option value="conversation">Rozmowa</option>
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
          className="bg-[#111113] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="">Email i telefon</option>
          <option value="email">Email</option>
          <option value="phone">Telefon</option>
        </select>
        {(filterStatus || filterSource || filterType || search) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterSource(''); setFilterType(''); setSearch(''); setPage(1); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <X size={12} />Wyczyść
          </button>
        )}
      </div>

      {/* Table view */}
      {view === 'table' ? (
        <Card className="glass-card">
          {sorted.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Brak kontaktów"
              description="Kontakty pojawią się tutaj gdy chatbot zbierze email lub telefon."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <ThCell field="contactInfo" label="Kontakt" />
                    <ThCell field="status" label="Status" />
                    <TableHead>Typ</TableHead>
                    <TableHead>Źródła</TableHead>
                    <ThCell field="firstSeen" label="Pierwszy kontakt" />
                    <ThCell field="lastSeen" label="Ostatni kontakt" />
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(c => (
                    <TableRow
                      key={c.profileId}
                      className={`hover:bg-white/[0.04] cursor-pointer transition-colors ${selectedId === c.profileId ? 'bg-white/[0.06]' : ''}`}
                      onClick={() => setSelectedId(c.profileId === selectedId ? null : c.profileId)}
                    >
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
                      <TableCell><StatusBadge status={c.status} allStages={allStages} /></TableCell>
                      <TableCell><span className="text-xs text-zinc-400 capitalize">{c.contactType}</span></TableCell>
                      <TableCell><span className="text-sm text-zinc-400">{c.sourceCount}</span></TableCell>
                      <TableCell><span className="text-sm text-zinc-400">{formatTs(c.firstSeen)}</span></TableCell>
                      <TableCell><span className="text-sm text-zinc-400">{formatTs(c.lastSeen)}</span></TableCell>
                      <TableCell>
                        <ChevronDown size={14} className={`transition-transform ${selectedId === c.profileId ? 'rotate-90 text-white' : 'text-zinc-700'}`} />
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
        /* Kanban view */
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3" style={{ minWidth: allStages.length * 185 + 'px' }}>
            {allStages.map(stage => (
              <KanbanColumn
                key={stage.value}
                stage={stage}
                contacts={kanbanGroups[stage.value] || []}
                onSelect={c => setSelectedId(c.profileId === selectedId ? null : c.profileId)}
                selectedId={selectedId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedId && (
        <DetailPanel
          profileId={selectedId}
          clientId={clientId}
          allStages={allStages}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
          onAddStage={handleAddStage}
        />
      )}
    </div>
  );
}
