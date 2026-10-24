// Temporary empty-state page. Feature pages replace these in later parts.
export function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">Coming soon.</p>
    </div>
  );
}
