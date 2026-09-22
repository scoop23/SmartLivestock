"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Skull,
  Plus,
  Package,
  Command as CommandIcon,
  Search,
  ClipboardList,
  CalendarDays,
  Map,
  Megaphone,
  Bell,
  Activity,
  Milk,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface FarmerActionDockProps {
  onOpenReportIllness: (defaultType?: "DISEASE" | "MORTALITY") => void;
  onOpenReportsList: () => void;
}

export default function FarmerActionDock({
  onOpenReportIllness,
  onOpenReportsList,
}: FarmerActionDockProps) {
  const router = useRouter();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
        return;
      }

      // Alt+S (Report Sickness / DiseaseCase)
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onOpenReportIllness("DISEASE");
        return;
      }

      // Alt+M (Report Mortality / MortalityRecord)
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        onOpenReportIllness("MORTALITY");
        return;
      }

      // Alt+A (Register Animal / LivestockInventory)
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        router.push("/livestock-inventory");
        return;
      }

      // Alt+P (Log Production / ProductionRecord)
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        router.push("/production-dashboard");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, onOpenReportIllness]);

  const modKey = isMac ? "⌥" : "Alt";

  return (
    <>
      <TooltipProvider delayDuration={150}>
        {/* Floating Dock Fixed at Bottom Center */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="relative group/dock">
            {/* Ambient subtle glow ring */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-600/20 via-sky-600/20 to-emerald-600/20 blur-lg opacity-70 group-hover/dock:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Glassmorphic Dock Container */}
            <nav
              aria-label="Farmer Quick Action Dock"
              className="relative flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-full bg-white/85 dark:bg-slate-950/85 backdrop-blur-xl border border-slate-200/90 dark:border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition-all duration-300 hover:shadow-[0_16px_48px_rgba(45,90,39,0.22)] hover:border-emerald-700/40"
            >
              {/* 1. Report Sickness (DiseaseCase) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onOpenReportIllness("DISEASE")}
                    className="group relative flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full text-slate-800 dark:text-slate-200 hover:text-amber-950 hover:bg-amber-50/90 dark:hover:bg-amber-950/40 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-full bg-amber-100/90 text-amber-800 shadow-2xs group-hover:bg-amber-200 transition-colors">
                      <Stethoscope className="size-4" />
                    </div>
                    <span className="text-xs font-black tracking-tight hidden md:inline">
                      Report Sickness
                    </span>
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-100 rounded-md border border-slate-200/80">
                      {modKey}S
                    </kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10} className="font-bold text-xs">
                  <p>Log Sickness / Disease Case ({modKey}+S)</p>
                </TooltipContent>
              </Tooltip>

              {/* 2. Report Mortality (MortalityRecord) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onOpenReportIllness("MORTALITY")}
                    className="group relative flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full text-slate-800 dark:text-slate-200 hover:text-rose-950 hover:bg-rose-50/90 dark:hover:bg-rose-950/40 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-full bg-rose-100/90 text-rose-800 shadow-2xs group-hover:bg-rose-200 transition-colors">
                      <Skull className="size-4" />
                    </div>
                    <span className="text-xs font-black tracking-tight hidden md:inline">
                      Report Mortality
                    </span>
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-100 rounded-md border border-slate-200/80">
                      {modKey}M
                    </kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10} className="font-bold text-xs">
                  <p>Log Animal Mortality Casualty ({modKey}+M)</p>
                </TooltipContent>
              </Tooltip>

              {/* 3. Register Animal (LivestockInventory) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => router.push("/livestock-inventory")}
                    className="group relative flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full text-slate-800 dark:text-slate-200 hover:text-[#2D5A27] hover:bg-emerald-50/90 dark:hover:bg-emerald-950/40 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-full bg-emerald-700/15 text-[#2D5A27] shadow-2xs group-hover:bg-emerald-700/25 transition-colors">
                      <Plus className="size-4" />
                    </div>
                    <span className="text-xs font-black tracking-tight hidden md:inline">
                      Register Animal
                    </span>
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-100 rounded-md border border-slate-200/80">
                      {modKey}A
                    </kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10} className="font-bold text-xs">
                  <p>Add Animal to Municipal Herd Registry ({modKey}+A)</p>
                </TooltipContent>
              </Tooltip>

              {/* 4. Log Yield (ProductionRecord) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => router.push("/production-dashboard")}
                    className="group relative flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full text-slate-800 dark:text-slate-200 hover:text-sky-900 hover:bg-sky-50/90 dark:hover:bg-sky-950/40 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-full bg-sky-100/90 text-sky-800 shadow-2xs group-hover:bg-sky-200 transition-colors">
                      <Package className="size-4" />
                    </div>
                    <span className="text-xs font-black tracking-tight hidden md:inline">
                      Log Yield
                    </span>
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-400 bg-slate-100 rounded-md border border-slate-200/80">
                      {modKey}P
                    </kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10} className="font-bold text-xs">
                  <p>Record Milk Harvest & Production ({modKey}+P)</p>
                </TooltipContent>
              </Tooltip>

              {/* Divider */}
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

              {/* 5. Command Palette Trigger (⌘K) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsCommandOpen(true)}
                    className="group relative flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 hover:bg-[#2D5A27] text-slate-700 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                  >
                    <Search className="size-3.5 group-hover:text-white transition-colors" />
                    <span className="text-xs font-black tracking-tight hidden sm:inline">
                      Actions
                    </span>
                    <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono font-black text-slate-500 group-hover:text-white/90 bg-white/70 group-hover:bg-white/20 rounded-md border border-slate-200/80 group-hover:border-white/20">
                      ⌘K
                    </kbd>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10} className="font-bold text-xs">
                  <p>Quick Command Palette (⌘K or Ctrl+K)</p>
                </TooltipContent>
              </Tooltip>
            </nav>
          </div>
        </div>
      </TooltipProvider>

      {/* ── COMMAND PALETTE MODAL (⌘K) ── */}
      <CommandDialog
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        title="Padre Garcia Farmer Operations"
        description="Search tools, log animal data, or inspect reports..."
      >
        <CommandInput placeholder="Type a command, animal tag, or tool..." />
        <CommandList className="max-h-[380px] overflow-y-auto">
          <CommandEmpty>No matching action found.</CommandEmpty>

          <CommandGroup heading="Backend Operational Models">
            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                onOpenReportIllness("DISEASE");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Stethoscope className="size-4 text-amber-600" />
              <span>Report Sickness or Clinical Symptoms (DiseaseCase)</span>
              <CommandShortcut>{modKey}S</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                onOpenReportIllness("MORTALITY");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Skull className="size-4 text-rose-600" />
              <span>Report Deceased Animal / Loss (MortalityRecord)</span>
              <CommandShortcut>{modKey}M</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/livestock-inventory");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Plus className="size-4 text-[#2D5A27]" />
              <span>Register Animal to Herd Registry (LivestockInventory)</span>
              <CommandShortcut>{modKey}A</CommandShortcut>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/production-dashboard");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Milk className="size-4 text-sky-600" />
              <span>Log Dairy Yield & Farm Production (ProductionRecord)</span>
              <CommandShortcut>{modKey}P</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Surveillance & Health Tracking">
            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                onOpenReportsList();
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <ClipboardList className="size-4 text-purple-600" />
              <span>View Health & Mortality Reports History</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/report-observation");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Activity className="size-4 text-emerald-700" />
              <span>Open Full Surveillance Ledger</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/alerts");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Bell className="size-4 text-rose-600" />
              <span>Municipal Weather & Biosecurity Advisories</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Municipal Programs & GIS">
            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/farmer-scheduling");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <CalendarDays className="size-4 text-indigo-600" />
              <span>MAO Vaccination & Veterinary Programs</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/gis-user-map");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Map className="size-4 text-teal-600" />
              <span>Pasture Grazing GIS & Boundary Map</span>
            </CommandItem>

            <CommandItem
              onSelect={() => {
                setIsCommandOpen(false);
                router.push("/farmer-announcement");
              }}
              className="cursor-pointer gap-2 py-2.5"
            >
              <Megaphone className="size-4 text-amber-600" />
              <span>Municipal Announcements & Bulletins</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
