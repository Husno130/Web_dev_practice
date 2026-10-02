export default function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Supabase environment variables are not set, so the app is showing its built-in sample data."
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-300 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
      demo data
    </span>
  );
}
