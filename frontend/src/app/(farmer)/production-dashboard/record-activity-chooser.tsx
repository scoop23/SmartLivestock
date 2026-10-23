"use client";

import { Button } from "@/components/ui/button";
import { Baby,Beef,Egg,Milk,Scale,Scissors,ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { LivestockInventoryItem } from "../livestock-inventory/livestock-inventory";
import type { ProductionType } from "./production-analytics";
import { getProductionTypesForLivestock } from "./production-wizard";

type Activity = {
  id: string;
  title: string;
  description: string;
  icon: typeof Milk;
  species: string[];
  productionType?: ProductionType;
};

const PRODUCTION_META: Record<ProductionType, { title: string; description: string; icon: typeof Milk }> = {
  milk: { title: "Milk production", description: "Record milk collected from your animals.", icon: Milk },
  meat: { title: "Meat yield", description: "Record meat or carcass yield using the existing production form.", icon: Beef },
  eggs: { title: "Egg collection", description: "Record eggs collected from your poultry.", icon: Egg },
  wool: { title: "Wool shearing", description: "Record wool collected from your sheep.", icon: Scissors },
};

export default function RecordActivityChooser({
  inventories,
  intentInventories,
  onRecord,
}: {
  inventories: LivestockInventoryItem[];
  intentInventories: LivestockInventoryItem[];
  onRecord: (activity: { id: string; species: string[]; productionType?: ProductionType }) => void;
}) {
  const router = useRouter();
  const species = useMemo(
    () => Array.from(new Set(inventories.map((item) => item.livestockTypeName?.trim()).filter((value): value is string => Boolean(value)))),
    [inventories],
  );
  const intentSpecies = useMemo(
    () => Array.from(new Set(intentInventories.map((item) => item.livestockTypeName?.trim()).filter((value): value is string => Boolean(value)))),
    [intentInventories],
  );
  const activities = useMemo(() => {
    const items: Activity[] = [];
    for (const name of species) {
      for (const productionType of getProductionTypesForLivestock(name)) {
        const meta = PRODUCTION_META[productionType];
        const existing = items.find((item) => item.id === productionType);
        if (existing) existing.species.push(name);
        else items.push({ id: productionType, ...meta, species: [name], productionType });
      }
      const birth = items.find((item) => item.id === "calving");
      if (birth) birth.species.push(name);
      else items.push({ id: "calving", title: "Animal birth", description: "Register a newborn and its birth details.", icon: Baby, species: [name] });
    }
    if (species.length) {
      items.push({ id: "weights", title: "Weight / growth", description: "Record an animal’s current weight.", icon: Scale, species });
    }
    if (intentSpecies.length) {
      items.push({ id: "sales", title: "Declare sale intent", description: "Tell Auction you plan to sell; Auction records the completed sale and movement.", icon: ShoppingBag, species: intentSpecies });
    }
    return items;
  }, [species, intentSpecies]);

  const open = (activity: Activity, mode: "record" | "history") => {
    if (mode === "record") {
      onRecord(activity);
      return;
    }
    const selectedSpecies = activity.species.length === 1 ? activity.species[0] : "ALL";
    const query = new URLSearchParams({ activity: activity.id, mode });
    activity.species.forEach((name) => query.append("eligibleSpecies", name));
    if (activity.productionType) query.set("type", activity.productionType);
    router.push(`/production-dashboard/${encodeURIComponent(selectedSpecies)}?${query.toString()}`);
  };

  return (
    <section aria-labelledby="record-activity-title" className="space-y-5">
      <div data-tour="production-activity-hero" className="relative isolate overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,#123b2c_0%,#1f593e_52%,#39734a_100%)] p-5 text-white shadow-[0_18px_50px_rgba(20,83,45,0.16)] sm:p-7 lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 -z-10 size-80 rounded-full border-[36px] border-white/[0.06]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 right-1/4 -z-10 size-64 rounded-full bg-lime-200/[0.08] blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-50">
              <span className="size-1.5 rounded-full bg-lime-300" /> Farm activity log
            </span>
            <h2 id="record-activity-title" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">What would you like to record?</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-emerald-50/80 sm:text-base">Choose an activity to open its existing form. You’ll select the animal before saving.</p>
          </div>
          <Button asChild variant="outline" className="min-h-11 w-full shrink-0 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto">
            <Link href="/production-dashboard/history">All production records</Link>
          </Button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          Add and receive approval for livestock before recording farm activities.
          <Link href="/livestock-inventory" className="ml-1 font-semibold text-emerald-800 underline underline-offset-4">Go to My Livestock</Link>
        </div>
      ) : (
        <div data-tour="production-activity-list" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <article key={activity.id} className="group flex min-h-56 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_14px_34px_rgba(15,23,42,0.09)]">
                <div className="flex items-start gap-3 p-4 sm:p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 transition group-hover:bg-emerald-100"><Icon className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{activity.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{activity.description}</p>
                  </div>
                </div>
                <div className="px-4 pb-4 sm:px-5">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Available for</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activity.species.map((name) => <span key={name} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{name}</span>)}
                  </div>
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:px-4">
                  <Button type="button" onClick={() => open(activity, "record")} className="min-h-10 rounded-xl bg-[#2D5A27] text-white hover:bg-[#23471f]">Record</Button>
                  <Button onClick={() => open(activity, "history")} variant="outline" className="min-h-10 rounded-xl border-slate-200 bg-white">View records</Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p data-tour="production-activity-guidance" className="text-xs text-slate-500">Only activities supported for your approved, active livestock are shown. Forecasts and combined history remain available from the records page.</p>
    </section>
  );
}
