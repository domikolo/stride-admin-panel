'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { healthCheckKB, HealthCheckResult } from '@/lib/api';

interface HealthCheckModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
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

export default function HealthCheckModal({ open, onClose, clientId }: HealthCheckModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 max-h-[80vh] flex flex-col bg-zinc-900 border border-white/[0.08] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-medium text-white">Analiza jakości bazy wiedzy</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-400" />
              <p className="text-sm text-zinc-400">Analizuję bazę wiedzy...</p>
              <p className="text-xs text-zinc-600">To może potrwać 10-20 sekund</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/[0.05] border border-red-500/20 rounded-lg">
              <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
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
                  <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Problemy</h3>
                  {result.issues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                      {issue.severity === 'high'
                        ? <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                        : <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
                      }
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-500 mb-0.5">{issue.section}</p>
                        <p className="text-sm text-zinc-300">{issue.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Rekomendacje</h3>
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

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-white/[0.06]">
          <Button
            variant="ghost" size="sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Zamknij
          </Button>
        </div>
      </div>
    </div>
  );
}
