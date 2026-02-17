/**
 * GapsBar — shows unresolved KB gaps with quick "Fix" navigation
 */

'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Gap } from '@/lib/types';

interface GapsBarProps {
  gaps: Gap[];
  onFixGap: (gap: Gap) => void;
}

export default function GapsBar({ gaps, onFixGap }: GapsBarProps) {
  if (gaps.length === 0) return null;

  return (
    <div className="p-3 bg-yellow-500/[0.06] border border-yellow-500/20 rounded-lg">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-400" />
          <span className="text-sm text-yellow-400 font-medium">
            {gaps.length} {gaps.length === 1 ? 'luka' : gaps.length < 5 ? 'luki' : 'luk'} do naprawienia
          </span>
        </div>
        <Link
          href="/insights"
          className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
        >
          Insights <ArrowRight size={12} />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {gaps.map((gap) => (
          <button
            key={gap.topicId}
            onClick={() => onFixGap(gap)}
            className="text-xs px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors"
          >
            {gap.topicName} ({gap.count})
          </button>
        ))}
      </div>
    </div>
  );
}
