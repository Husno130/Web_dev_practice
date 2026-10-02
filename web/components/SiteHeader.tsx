import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-bold text-slate-950">
            PC
          </span>
          <span className="font-semibold tracking-tight text-slate-100">
            PlotCost <span className="text-emerald-400">PK</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/properties"
            className="rounded-md px-3 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Properties
          </Link>
          <Link
            href="/calculator"
            className="rounded-md px-3 py-2 text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Cost calculator
          </Link>
        </nav>
      </div>
    </header>
  );
}
