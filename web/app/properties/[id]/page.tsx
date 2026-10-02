import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import DemoBadge from "@/components/DemoBadge";
import Stat from "@/components/Stat";
import { getPriceHistory, getProperty } from "@/lib/queries";
import { SQFT_PER_MARLA } from "@/lib/estimate/engine";
import { formatArea, formatNumber, formatPkr } from "@/lib/estimate/format";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const { property } = await getProperty(id);
  return {
    title: property?.title ?? "Property",
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-200">{value}</dd>
    </div>
  );
}

export default async function PropertyDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { property, demo } = await getProperty(id);

  if (!property) {
    notFound();
  }

  const history = await getPriceHistory(id);
  const place = property.location ?? property.sector ?? property.city;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/properties" className="text-emerald-300 hover:text-emerald-200">
          ← Back to properties
        </Link>
        {demo ? <DemoBadge /> : null}
      </div>

      <div className="mt-5 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize text-slate-300">
              {property.property_type}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize text-slate-300">
              for {property.purpose}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize text-slate-400">
              {property.source}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            {property.title ?? "Untitled listing"}
          </h1>
          <p className="mt-2 text-slate-400">{place}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Price" value={formatPkr(property.price_pkr)} />
            <Stat
              label="Area"
              value={formatArea(property.area_sqft, property.area_value, property.area_unit)}
            />
            <Stat
              label="Per marla"
              value={
                property.price_pkr != null && property.area_sqft
                  ? formatPkr(property.price_pkr / (property.area_sqft / SQFT_PER_MARLA))
                  : "—"
              }
            />
          </div>

          {property.description ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-white">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {property.description}
              </p>
            </section>
          ) : null}

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-white">Price history</h2>
            {history.length === 0 ? (
              <p className="mt-2 rounded-xl border border-white/10 bg-slate-900/50 p-4 text-sm text-slate-400">
                No recorded price changes for this listing yet.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-2.5 font-medium">Recorded</th>
                      <th className="px-4 py-2.5 text-right font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id} className="border-t border-white/5">
                        <td className="px-4 py-2.5 text-slate-400">
                          {formatDate(entry.recorded_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-200">
                          {formatPkr(entry.price_pkr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <h2 className="text-base font-semibold text-emerald-200">
              Estimate the build cost
            </h2>
            <p className="mt-1 text-sm text-emerald-200/80">
              Use this plot&apos;s area and listed price as the starting point, then layer on
              construction, approvals and fees.
            </p>
            <Link
              href={`/calculator?propertyId=${property.id}`}
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Estimate build cost →
            </Link>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Listing details
            </h2>
            <dl className="mt-2">
              <DetailRow label="Sector" value={property.sector ?? "—"} />
              <DetailRow label="Location" value={property.location ?? "—"} />
              <DetailRow label="City" value={property.city} />
              <DetailRow label="Type" value={property.property_type} />
              <DetailRow label="Purpose" value={property.purpose} />
              <DetailRow label="Price" value={formatPkr(property.price_pkr)} />
              <DetailRow
                label="Area (raw)"
                value={
                  property.area_value != null
                    ? `${formatNumber(
                        property.area_value,
                        Number.isInteger(property.area_value) ? 0 : 2,
                      )} ${property.area_unit ?? ""}`.trim()
                    : "—"
                }
              />
              <DetailRow
                label="Area (sqft)"
                value={property.area_sqft != null ? formatNumber(property.area_sqft) : "—"}
              />
              <DetailRow
                label="Bedrooms"
                value={property.bedrooms != null ? String(property.bedrooms) : "—"}
              />
              <DetailRow
                label="Bathrooms"
                value={property.bathrooms != null ? String(property.bathrooms) : "—"}
              />
              <DetailRow
                label="Coordinates"
                value={
                  property.latitude != null && property.longitude != null
                    ? `${property.latitude.toFixed(4)}, ${property.longitude.toFixed(4)}`
                    : "—"
                }
              />
              <DetailRow label="First seen" value={formatDate(property.first_seen_at)} />
              <DetailRow label="Last seen" value={formatDate(property.last_seen_at)} />
              <DetailRow label="Active" value={property.is_active ? "Yes" : "No"} />
            </dl>
            <a
              href={property.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-emerald-300 hover:text-emerald-200"
            >
              View original listing ↗
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
