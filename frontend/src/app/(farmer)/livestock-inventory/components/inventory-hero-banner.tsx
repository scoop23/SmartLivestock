"use client";

import { useState } from "react";
import {
  Activity,
  Plus,
  FileDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InventoryHeroBannerProps {
  totalRecords: number;
  onExportCsv: () => void;
  onOpenRegister: () => void;
}

export function InventoryHeroBanner({
  totalRecords,
  onExportCsv,
  onOpenRegister,
}: InventoryHeroBannerProps) {
  const [showHeroBanner, setShowHeroBanner] = useState(false);

  return (
    <>
      {/* 1. Collapsed Top Ribbon (Slides in/out smoothly) */}
      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          !showHeroBanner
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none -mb-6"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={`flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white border border-emerald-800/40 shadow-md transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              !showHeroBanner
                ? "translate-y-0 scale-100 opacity-100"
                : "-translate-y-4 scale-[0.98] opacity-0"
            }`}
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md">
                <Activity className="w-3 h-3 mr-1 text-emerald-400" />
                Live Herd Registry
              </Badge>
              <span className="text-xs font-black text-white">
                Livestock Inventory & Biometric Surveillance
              </span>
              <span className="text-xs font-medium text-emerald-200/70 hidden md:inline">
                • {totalRecords} Registered Records
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={onExportCsv}
                className="gap-1.5 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl h-9 px-3 text-xs backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-300" />
                Export CSV
              </Button>
              <Button
                size="sm"
                onClick={onOpenRegister}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black gap-1.5 rounded-xl h-9 px-3.5 text-xs shadow-md shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Register Livestock
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHeroBanner(true)}
                className="group relative overflow-hidden gap-1.5 border-emerald-400/40 hover:border-emerald-300/80 bg-gradient-to-r from-emerald-500/20 via-emerald-400/25 to-teal-500/20 hover:from-emerald-500/35 hover:via-emerald-400/35 hover:to-teal-500/30 text-emerald-100 hover:text-white rounded-xl h-9 px-3 text-xs font-black shadow-xs hover:shadow-md hover:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
              >
                <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
                </span>
                <span className="tracking-tight">Show Overview</span>
                <ChevronDown className="w-3.5 h-3.5 text-emerald-300 transition-transform duration-300 ease-out group-hover:translate-y-0.5 group-hover:text-emerald-100" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Expanded Hero Banner (Slides down seamlessly) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          showHeroBanner
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0 pointer-events-none"
        }`}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white p-6 sm:p-8 border border-emerald-800/40 shadow-xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              showHeroBanner
                ? "translate-y-0 scale-100 opacity-100"
                : "-translate-y-8 scale-[0.98] opacity-0"
            }`}
          >
            {/* Subtle Ambient Background Gradients */}
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row justify-between lg:items-center gap-6">
              {/* Left Title & Status Header */}
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full backdrop-blur-md">
                    <Activity className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Live Herd Registry
                  </Badge>
                  <span className="text-xs font-semibold text-emerald-200/70">
                    {totalRecords} Registered Records
                  </span>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Livestock Inventory & Biometric Surveillance
                  </h1>
                  <p className="text-sm text-emerald-100/80 font-medium mt-1">
                    Trace ear tags, monitor herd growth, track pedigree breeds, and maintain
                    up-to-date biosecurity vaccination compliance.
                  </p>
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={onExportCsv}
                  className="gap-2 border-emerald-700/50 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl h-12 px-5 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-emerald-300" />
                  Export CSV
                </Button>

                <Button
                  onClick={onOpenRegister}
                  className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black gap-2 rounded-2xl h-12 px-6 shadow-lg shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                  Register Livestock
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setShowHeroBanner(false)}
                  className="group relative overflow-hidden gap-1.5 border border-emerald-700/50 hover:border-emerald-600 bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white font-bold rounded-2xl h-12 px-4.5 backdrop-blur-md transition-all duration-300 active:scale-95 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4 text-emerald-300 transition-transform duration-300 ease-out group-hover:-translate-y-0.5" />
                  Hide Overview
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
