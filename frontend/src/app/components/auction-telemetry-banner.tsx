"use client";

import { Building, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface AuctionTelemetryBannerProps {
  facility?: string;
  className?: string;
}

export function AuctionTelemetryBanner({
  facility = "PADRE GARCIA LIVESTOCK TRADING CENTER",
  className = "",
}: AuctionTelemetryBannerProps) {
  const [clockString, setClockString] = useState<string>("");

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const updateTime = () => {
      setClockString(`${formatter.format(new Date())} PHT`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`border-b border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-2 sm:px-6 md:px-8 shrink-0 ${className}`}
    >
      <div className="w-full flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
        <div className="flex items-center gap-2 font-semibold text-slate-600">
          <Building className="size-3.5 text-emerald-600" />
          <span>
            FACILITY:{" "}
            <strong className="font-mono text-slate-900 uppercase">
              {facility}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
            <Clock className="size-3.5 text-slate-400" />
            <span className="tabular-nums font-bold">
              {clockString || "Loading Manila time…"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
