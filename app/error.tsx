'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <div className="text-center space-y-4 max-w-md px-6">
        <h2 className="text-xl font-semibold text-white">
          Coś poszło nie tak
        </h2>
        <p className="text-zinc-400 text-sm">
          Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          Spróbuj ponownie
        </button>
      </div>
    </div>
  );
}
