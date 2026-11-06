"use client";

import { cowHead } from "@lucide/lab";
import { AlertTriangle, Icon, Layers, ShieldCheck, TrendingUp, Users } from "lucide-react";

interface DataOverviewKpisProps {
  totalLivestock: number;
  totalBatches?: number;
  vaccinationCoveragePct: number;
  vaccinatedHeads: number;
  totalHeads: number;
  totalTransferValue: number | null;
  activeIncidents: number;
  totalFarmers: number;
  totalSlaughterKg?: number;
  isLoading?: boolean;
}

const getValueFontSize = (val: string) => {
  if (val.length >= 12) return "text-sm sm:text-base xl:text-[15px] 2xl:text-lg";
  if (val.length >= 9) return "text-base sm:text-lg xl:text-base 2xl:text-xl";
  return "text-xl sm:text-2xl";
};

export function DataOverviewKpis({
  totalLivestock,
  totalBatches = 0,
  vaccinationCoveragePct,
  vaccinatedHeads,
  totalHeads,
  totalTransferValue,
  activeIncidents,
  totalFarmers,
  isLoading = false,
}: DataOverviewKpisProps) {
  const cards = [
    {
      id: "livestock",
      title: "Total Livestock Heads",
      value: totalLivestock.toLocaleString(),
      subtitle: "Registered, active inventory",
      icon: <Icon iconNode={cowHead} className="size-5" />,
      iconBg: "bg-[#EAF5EC]",
      iconColor: "text-[#0F4A2F]",
      iconBorder: "border-[#BEE1C6]",
      barColor: "bg-emerald-600",
    },
    {
      id: "herds",
      title: "Herds",
      value: totalBatches.toLocaleString(),
      subtitle: "Housing pens & lots",
      icon: <Layers className="size-5" />,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#1E40AF]",
      iconBorder: "border-[#BFDBFE]",
      barColor: "bg-[#1E3A8A]",
    },
    {
      id: "vaccination",
      title: "Vaccination Coverage",
      value: `${vaccinationCoveragePct}%`,
      subtitle: `${vaccinatedHeads.toLocaleString()} of ${totalHeads.toLocaleString()} current heads vaccinated`,
      icon: <ShieldCheck className="size-5" />,
      iconBg: "bg-[#ECFDF5]",
      iconColor: "text-[#047857]",
      iconBorder: "border-[#A7F3D0]",
      barColor: "bg-emerald-600",
    },
    {
      id: "sales",
      title: "Approved Sales Value",
      value: totalTransferValue == null ? "Not recorded" : `₱${totalTransferValue.toLocaleString()}`,
      subtitle: "Recorded approved sales",
      icon: <TrendingUp className="size-5" />,
      iconBg: "bg-[#FFFBEB]",
      iconColor: "text-[#D97706]",
      iconBorder: "border-[#FDE68A]",
      barColor: "bg-amber-500",
    },
    {
      id: "diseases",
      title: "Disease Reports",
      value: activeIncidents.toLocaleString(),
      subtitle: "Awaiting review",
      icon: <AlertTriangle className="size-5" />,
      iconBg: "bg-[#FFF1F2]",
      iconColor: "text-[#E11D48]",
      iconBorder: "border-[#FECDD3]",
      barColor: "bg-rose-600",
    },
    {
      id: "farmers",
      title: "Registered Raisers",
      value: totalFarmers.toLocaleString(),
      subtitle: "Verified MAO farmers",
      icon: <Users className="size-5" />,
      iconBg: "bg-[#F0F9FF]",
      iconColor: "text-[#0284C7]",
      iconBorder: "border-[#BAE6FD]",
      barColor: "bg-sky-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((card, idx) => (
        <div
          key={card.id}
          style={{ animationDelay: `${idx * 60}ms` }}
          className="group rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs flex flex-col justify-between hover:shadow-md hover:-translate-y-1 transition-all duration-300 ease-out min-h-[118px] overflow-hidden cursor-default animate-in fade-in slide-in-from-bottom-3 fill-mode-both motion-reduce:animate-none motion-reduce:transform-none"
        >
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <div
              className={`size-9 sm:size-10 rounded-xl flex items-center justify-center shrink-0 border ${card.iconBg} ${card.iconColor} ${card.iconBorder} group-hover:scale-110 group-hover:rotate-2 transition-transform duration-300 ease-out`}
            >
              {card.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-semibold text-slate-600 leading-tight truncate group-hover:text-slate-900 transition-colors"
                title={card.title}
              >
                {card.title}
              </p>
              <p
                className={`${getValueFontSize(card.value)} font-black text-slate-900 tracking-tight mt-1 leading-tight truncate transition-colors`}
                title={card.value}
              >
                {isLoading ? "—" : card.value}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] text-slate-500 font-medium truncate" title={card.subtitle}>
              {card.subtitle}
            </p>
            <div
              className={`h-1 w-10 group-hover:w-16 rounded-full ${card.barColor} transition-all duration-300 ease-out`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
