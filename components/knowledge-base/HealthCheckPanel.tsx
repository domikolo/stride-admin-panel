'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, AlertTriangle, CheckCircle2, Wrench, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { healthCheckKB, healthFixQuestions, healthFixApply, HealthCheckResult, HealthCheckIssue } from '@/lib/api';
import { KBEntry } from '@/lib/types';

interface HealthCheckPanelProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onEntryCreated?: (entry: KBEntry) => void;
  onEntryUpdated?: (entry: KBEntry) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : score >= 5 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
    : 'text-red-400 bg-red-500/10 border-red-500/20';

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="text-2xl font-bold">{score}</span>
      <span className="text-xs opacity-80">/ 10</span>
    </div>
  );
}

type IssueStatus = 'idle' | 'loading_questions' | 'answering' | 'applying' | 'done' | 'error';

interface IssueRowState {
  status: IssueStatus;
  questions: string[];
  answers: string[];
  error?: string;
}

function IssueRow({
  issue,
  clientId,
  onEntryCreated,
  onEntryUpdated,
}: {
  issue: HealthCheckIssue;
  clientId: string;
  onEntryCreated?: (entry: KBEntry) => void;
  onEntryUpdated?: (entry: KBEntry) => void;
}) {
  const [state, setState] = useState<IssueRowState>({
    status: 'idle',
    questions: [],
    answers: [],
  });

  const handleFix = async () => {
    setState(s => ({ ...s, status: 'loading_questions', error: undefined }));
    try {
      const result = await healthFixQuestions(clientId, {
        issue_description: issue.description,
        section_name: issue.section,
        fix_type: issue.fixType,
      });
      setState(s => ({
        ...s,
        status: 'answering',
        questions: result.questions,
        answers: new Array(result.questions.length).fill(''),
      }));
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message || 'Blad ladowania pytan' }));
    }
  };

  const handleCancel = () => {
    setState({ status: 'idle', questions: [], answers: [] });
  };

  const handleApply = async () => {
    setState(s => ({ ...s, status: 'applying' }));
    try {
      const result = await healthFixApply(clientId, {
        issue_description: issue.description,
        section_name: issue.section,
        answers: state.answers,
        entry_id: issue.entryId,
        fix_type: issue.fixType,
      });
      setState(s => ({ ...s, status: 'done' }));
      if (result.action === 'created' && onEntryCreated) {
        onEntryCreated(result.entry);
      } else if (result.action === 'updated' && onEntryUpdated) {
        onEntryUpdated(result.entry);
      }
    } catch (err: any) {
      setState(s => ({ ...s, status: 'error', error: err.message || 'Blad zastosowania poprawki' }));
    }
  };

  const setAnswer = (idx: number, value: string) => {
    setState(s => {
      const answers = [...s.answers];
      answers[idx] = value;
      return { ...s, answers };
    });
  };

  const allAnswered = state.answers.every(a => a.trim().length > 0);
  const isExpanded = state.status !== 'idle' && state.status !== 'done';

  if (state.status === 'done') {
    return (
      <div className="flex items-start gap-2.5 p-3 bg-green-500/[0.05] border border-green-500/20 rounded-lg">
        <CheckCircle2 size={14} className="text-green-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500 mb-0.5">{issue.section}</p>
          <p className="text-sm text-green-400">Naprawiono</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden">
      {/* Issue header row */}
      <div className="flex items-start gap-2.5 p-3 bg-white/[0.02]">
        {issue.severity === 'high'
          ? <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          : <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
        }
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500 mb-0.5">{issue.section}</p>
          <p className="text-sm text-zinc-300">{issue.description}</p>
        </div>
        <div className="shrink-0 ml-2">
          {state.status === 'idle' && (
            <Button
              onClick={handleFix}
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
            >
              <Wrench size={12} />
              Napraw
            </Button>
          )}
          {isExpanded && state.status !== 'loading_questions' && (
            <Button
              onClick={handleCancel}
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-zinc-500 hover:text-zinc-300"
            >
              Anuluj
            </Button>
          )}
        </div>
      </div>

      {/* Expanded: loading questions */}
      {state.status === 'loading_questions' && (
        <div className="px-3 py-4 border-t border-white/[0.04] flex items-center gap-2 justify-center">
          <Loader2 size={14} className="animate-spin text-blue-400" />
          <span className="text-xs text-zinc-500">Generuję pytania...</span>
        </div>
      )}

      {/* Expanded: questions form */}
      {(state.status === 'answering' || state.status === 'applying') && (
        <div className="px-3 py-3 border-t border-white/[0.04] space-y-3">
          {state.questions.map((q, i) => (
            <div key={i}>
              <label className="block text-xs text-zinc-400 mb-1">{q}</label>
              <input
                type="text"
                value={state.answers[i] || ''}
                onChange={e => setAnswer(i, e.target.value)}
                disabled={state.status === 'applying'}
                className="w-full h-8 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 text-sm text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-blue-500/40 disabled:opacity-50"
                placeholder="Twoja odpowiedź..."
              />
            </div>
          ))}
          <div className="flex justify-end pt-1">
            <Button
              onClick={handleApply}
              size="sm"
              disabled={!allAnswered || state.status === 'applying'}
              className="gap-1.5 text-xs h-7 bg-blue-600 hover:bg-blue-700"
            >
              {state.status === 'applying' ? (
                <><Loader2 size={12} className="animate-spin" /> Stosowanie...</>
              ) : (
                'Zastosuj'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <div className="px-3 py-2 border-t border-white/[0.04]">
          <p className="text-xs text-red-400">{state.error}</p>
          <button onClick={handleFix} className="text-xs text-blue-400 hover:underline mt-1">
            Spróbuj ponownie
          </button>
        </div>
      )}
    </div>
  );
}

export default function HealthCheckPanel({
  open,
  onClose,
  clientId,
  onEntryCreated,
  onEntryUpdated,
}: HealthCheckPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    healthCheckKB(clientId)
      .then(setResult)
      .catch(err => setError(err.message || 'Nie udało się przeprowadzić analizy.'))
      .finally(() => setLoading(false));
  }, [open, clientId]);

  if (!open) return null;

  return (
    <div className="rounded-lg border border-white/[0.08] bg-zinc-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-medium text-zinc-300">Analiza jakości bazy wiedzy</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 size={24} className="animate-spin text-blue-400" />
            <p className="text-sm text-zinc-400">Analizuję bazę wiedzy...</p>
            <p className="text-xs text-zinc-600">To może potrwać 10-20 sekund</p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 p-3 bg-red-500/[0.05] border border-red-500/20 rounded-lg">
            <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {result && !loading && (
          <>
            {/* Score + summary */}
            <div className="flex items-start gap-4">
              <ScoreBadge score={result.score} />
              <p className="text-sm text-zinc-300 leading-relaxed pt-1">{result.summary}</p>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Problemy</h4>
                {result.issues.map((issue, i) => (
                  <IssueRow
                    key={i}
                    issue={issue}
                    clientId={clientId}
                    onEntryCreated={onEntryCreated}
                    onEntryUpdated={onEntryUpdated}
                  />
                ))}
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Rekomendacje</h4>
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                    <CheckCircle2 size={14} className="text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-zinc-300">{rec}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
