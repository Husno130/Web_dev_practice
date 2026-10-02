import type { EstimateResult } from "@/lib/estimate/types";
import { formatArea, formatNumber, formatPkr } from "@/lib/estimate/format";

const CATEGORY_LABELS: Record<string, string> = {
  land: "Land",
  transaction: "Transaction",
  approvals: "Approvals",
  construction: "Construction",
  professional: "Professional",
  contingency: "Contingency",
  escalation: "Escalation",
};

export default function EstimateBreakdown({ result }: { result: EstimateResult }) {
  const { lines, inputs } = result;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5 sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
            Expected total
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-300">
            {formatPkr(result.totalPkr)}
          </p>
          <p className="mt-1 text-xs text-emerald-200/70">
            {formatPkr(result.perSqftPkr)} / sqft covered
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Likely range
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {formatPkr(result.lowPkr)}
            <span className="mx-1 text-slate-500">–</span>
            {formatPkr(result.highPkr)}
          </p>
          <p className="mt-1 text-xs text-slate-500">±15% sensitivity band</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Assumptions
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
            <li>Plot: {formatArea(inputs.plotAreaSqft)}</li>
            <li>Covered: {formatArea(inputs.coveredAreaSqft)}</li>
            <li>
              {inputs.qualityTier} finishing · {formatNumber(inputs.timelineMonths)} months
            </li>
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Line item</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={`${line.category}-${index}`}
                className="border-t border-white/5 align-top"
              >
                <td className="px-4 py-3">
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-slate-300">
                    {CATEGORY_LABELS[line.category] ?? line.category}
                  </span>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <p className="text-slate-200">{line.label}</p>
                  {line.detail ? (
                    <p className="mt-0.5 text-xs text-slate-500">{line.detail}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right font-medium text-slate-100">
                  {formatPkr(line.amountPkr)}
                  <span className="block text-[11px] font-normal text-slate-500 sm:hidden">
                    {line.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900/80">
            <tr className="border-t border-white/10">
              <td className="px-4 py-3 text-slate-400" colSpan={2}>
                Subtotal
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-100">
                {formatPkr(result.subtotalPkr)}
              </td>
            </tr>
            <tr className="border-t border-white/10">
              <td className="px-4 py-3 text-slate-400" colSpan={2}>
                Contingency
              </td>
              <td className="px-4 py-3 text-right text-slate-100">
                {formatPkr(result.contingencyPkr)}
              </td>
            </tr>
            <tr className="border-t border-white/10">
              <td className="px-4 py-3 text-slate-400" colSpan={2}>
                Escalation
              </td>
              <td className="px-4 py-3 text-right text-slate-100">
                {formatPkr(result.escalationPkr)}
              </td>
            </tr>
            <tr className="border-t border-emerald-400/30">
              <td className="px-4 py-3 font-semibold text-slate-100" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 text-right text-lg font-bold text-emerald-300">
                {formatPkr(result.totalPkr)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <details className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          Rates used in this estimate
        </summary>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(result.ratesUsed).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <dt className="truncate text-slate-500">{key}</dt>
              <dd className="font-medium text-slate-300">{formatNumber(value, 2)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
