/**
 * QuestionsModal — scrollable overlay showing all question examples with conversation links
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { X, MessageSquare, ExternalLink } from 'lucide-react';

interface QuestionsModalProps {
  topicName: string;
  examples: string[];
  questionSources?: Record<string, { sessionId: string; conversationNumber: number }>;
  onClose: () => void;
}

export default function QuestionsModal({ topicName, examples, questionSources, onClose }: QuestionsModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-[#111113] border border-white/[0.08] rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-white truncate pr-2">{topicName}</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{examples.length} pytań</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto p-2 space-y-0.5">
          {examples.map((example, idx) => {
            const source = questionSources?.[example];
            return source ? (
              <Link
                key={idx}
                href={`/conversations/${source.sessionId}?conversation_number=${source.conversationNumber}&highlight=${encodeURIComponent(example)}`}
                onClick={onClose}
                className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.05] text-[13px] text-zinc-400 hover:text-blue-400 transition-colors group"
              >
                <MessageSquare size={13} className="mt-0.5 shrink-0 text-zinc-600 group-hover:text-blue-500 transition-colors" />
                <span className="flex-1 leading-snug">„{example}"</span>
                <ExternalLink size={11} className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
              </Link>
            ) : (
              <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg text-[13px] text-zinc-500">
                <MessageSquare size={13} className="mt-0.5 shrink-0 text-zinc-700" />
                <span className="leading-snug">„{example}"</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
