/** Human-friendly PKR formatting: "PKR 1.25 Crore" / "PKR 45 Lakh" / "PKR 3,500". */
export function formatPkr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "PKR —";
  const n = Math.round(Number(value));
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs >= 1e9) return `${sign}PKR ${trim(abs / 1e9)} Arab`;
  if (abs >= 1e7) return `${sign}PKR ${trim(abs / 1e7)} Crore`;
  if (abs >= 1e5) return `${sign}PKR ${trim(abs / 1e5)} Lakh`;
  return `${sign}PKR ${abs.toLocaleString("en-US")}`;
}

/** Plain number formatting with thousands separators. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

const UNIT_LABELS: Record<string, string> = {
  marla: "Marla",
  kanal: "Kanal",
  sqft: "sq ft",
  sqyd: "sq yd",
  sqm: "sq m",
};

/**
 * "10 Marla (2,722 sqft)" style area formatting. Falls back gracefully when
 * only the normalised square footage is available.
 */
export function formatArea(
  areaSqft?: number | null,
  areaValue?: number | null,
  areaUnit?: string | null,
): string {
  const unitKey = (areaUnit ?? "").trim().toLowerCase();
  const unitLabel = UNIT_LABELS[unitKey] ?? (areaUnit ? capitalize(areaUnit.trim()) : "");
  const hasUnit = areaValue != null && Number.isFinite(Number(areaValue)) && unitLabel !== "";
  const hasSqft = areaSqft != null && Number.isFinite(Number(areaSqft));

  if (hasUnit && hasSqft) {
    return `${formatNumber(areaValue)} ${unitLabel} (${formatNumber(areaSqft)} sqft)`;
  }
  if (hasUnit) return `${formatNumber(areaValue)} ${unitLabel}`;
  if (hasSqft) return `${formatNumber(areaSqft)} sqft`;
  return "Area n/a";
}

/** "12 months" / "1 month". */
export function formatMonths(months: number | null | undefined): string {
  if (months == null || !Number.isFinite(Number(months))) return "—";
  const n = Number(months);
  return `${formatNumber(n)} ${n === 1 ? "month" : "months"}`;
}

function trim(x: number): string {
  return x
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
