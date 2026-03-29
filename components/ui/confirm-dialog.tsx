'use client';

import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Potwierdź',
  cancelLabel = 'Anuluj',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm bg-[#111113] border border-white/[0.08] rounded-xl shadow-2xl p-5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          {description && (
            <p className="text-sm text-zinc-400">{description}</p>
          )}
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-zinc-400 hover:text-white">
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className={destructive
              ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
              : 'bg-blue-600 hover:bg-blue-700 text-white border-0'
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
