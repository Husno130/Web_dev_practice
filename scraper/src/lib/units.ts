// Area parsing + unit conversion.
//
// Conversion constants are fixed by the project spec:
//   1 marla    = 272.25 sqft
//   1 kanal    = 20 marla = 5445 sqft
//   1 sq yd    = 9 sqft
//   1 sq m     = 10.7639 sqft
//   1 sqft     = 1 sqft

import type { AreaUnit, ParsedArea } from '../types.js';

export const SQFT_PER_MARLA = 272.25;
export const MARLA_PER_KANAL = 20;
export const SQFT_PER_KANAL = 5445;
export const SQFT_PER_SQYD = 9;
export const SQFT_PER_SQM = 10.7639;
export const SQFT_PER_SQFT = 1;

const UNIT_FACTORS: Record<AreaUnit, number> = {
  marla: SQFT_PER_MARLA,
  kanal: SQFT_PER_KANAL,
  sqft: SQFT_PER_SQFT,
  sqyd: SQFT_PER_SQYD,
};

export function areaUnitToSqft(value: number, unit: AreaUnit): number {
  return value * UNIT_FACTORS[unit];
}

export function sqmToSqft(value: number): number {
  return value * SQFT_PER_SQM;
}

function normalizeUnitToken(token: string): AreaUnit | null {
  const t = token.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (t.startsWith('marla')) return 'marla';
  if (t.startsWith('kanal')) return 'kanal';
  if (t.includes('gaz') || t.includes('yd') || t.includes('yard')) return 'sqyd';
  if (t.includes('ft') || t.includes('feet') || t.includes('foot')) return 'sqft';
  return null;
}

// Matches "<number> <unit>" pairs. The unit alternatives are ordered longest
// first where it matters ("yard" before "yd") to avoid partial matches.
const AREA_RE =
  /(\d+(?:\.\d+)?)\s*(marla|kanal|sq\.?\s*yd|sq\.?\s*yard|square\s*yards?|gaz|sq\.?\s*ft|sq\.?\s*feet|square\s*feet|square\s*foot|sqft|sqyd)/gi;

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Extract an area from free text. Handles single values ("10 Marla",
 * "1200 Sq. Ft.", "150 Sq. Yd.") and compound values ("1 Kanal 5 Marla"),
 * summing compound components and reporting in the largest unit present.
 */
export function parseArea(text: string | null | undefined): ParsedArea {
  const empty: ParsedArea = { area_value: null, area_unit: null, area_sqft: null };
  if (!text) return empty;

  const src = String(text).replace(/,/g, ' ');
  const components: Array<{ value: number; unit: AreaUnit }> = [];

  AREA_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AREA_RE.exec(src)) !== null) {
    const value = Number.parseFloat(match[1]);
    const unit = normalizeUnitToken(match[2]);
    if (unit && Number.isFinite(value)) components.push({ value, unit });
  }
  if (components.length === 0) return empty;

  const totalSqft = components.reduce((sum, c) => sum + areaUnitToSqft(c.value, c.unit), 0);

  let primary = components[0];
  for (const c of components) {
    if (UNIT_FACTORS[c.unit] > UNIT_FACTORS[primary.unit]) primary = c;
  }

  const areaValue =
    components.length === 1 ? primary.value : totalSqft / UNIT_FACTORS[primary.unit];

  return {
    area_value: round(areaValue, 4),
    area_unit: primary.unit,
    area_sqft: round(totalSqft, 2),
  };
}
