import Link from "next/link";

import type { PropertyRow } from "@/lib/database.types";
import { formatArea, formatPkr } from "@/lib/estimate/format";

export default function PropertyCard({ property }: { property: PropertyRow }) {
  const place = property.sector ?? property.location ?? property.city;

  return (
    <Link
      href={`/properties/${property.id}`}
      className="group flex flex-col rounded-xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-emerald-400/40 hover:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded-full bg-white/5 px-2 py-0.5 capitalize text-slate-300">
          {property.property_type}
        </span>
        <span className="capitalize text-slate-500">{property.source}</span>
      </div>

      <h3 className="mt-3 line-clamp-2 min-h-[2.5rem] font-medium text-slate-100 group-hover:text-white">
        {property.title ?? "Untitled listing"}
      </h3>
      <p className="mt-1 line-clamp-1 text-sm text-slate-400">{place}</p>

      <div className="mt-4 flex items-end justify-between gap-2">
        <span className="text-lg font-semibold text-emerald-400">
          {formatPkr(property.price_pkr)}
        </span>
        <span className="text-right text-xs text-slate-400">
          {formatArea(property.area_sqft, property.area_value, property.area_unit)}
        </span>
      </div>
    </Link>
  );
}
