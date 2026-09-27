export function FullPageSpinner() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ładowanie…</span>
    </div>
  );
}
