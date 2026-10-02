import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        404
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 text-slate-400">
        The listing may have been removed, or the link may be incorrect.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/properties"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Browse properties
        </Link>
        <Link
          href="/calculator"
          className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5"
        >
          Cost calculator
        </Link>
      </div>
    </div>
  );
}
