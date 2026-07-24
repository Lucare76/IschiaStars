export function RequestMessageBox({ message, className = "" }: { message?: string | null; className?: string }) {
  const normalized = message?.trim();
  if (!normalized) return null;

  return (
    <div className={`rounded-2xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200 ${className}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">Note arrivate dal form cliente</p>
      <div className="mt-2 whitespace-pre-wrap break-words leading-6">{normalized}</div>
    </div>
  );
}
