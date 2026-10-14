"use client";

import Link from "next/link";
import { Activity, Archive, FileDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  return (
    <section className="relative overflow-hidden rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-5 text-white shadow-xl sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge className="rounded-full border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300 backdrop-blur-md">
              <Activity className="mr-1 size-3.5 text-emerald-400" />
              My Livestock
            </Badge>
            <span className="text-xs font-semibold text-emerald-200/80">
              {totalRecords} animals
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Your Livestock at a Glance
            </h1>
            <p className="mt-1 text-sm font-medium text-emerald-100/80">
              View animal details, follow herd growth, and keep vaccinations up to date.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={onOpenRegister}
            className="h-11 gap-2 rounded-xl bg-emerald-500 px-4 font-black text-emerald-950 shadow-lg shadow-emerald-950/40 transition-all hover:bg-emerald-400 active:scale-95"
          >
            <Plus className="size-5 stroke-[2.5]" />
            Register livestock
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-xl border-emerald-700/50 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5">
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer text-sm">
                <Link href="/livestock-inventory/history">
                  <Archive className="size-4 text-emerald-700" />
                  Livestock history
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="min-h-11 cursor-pointer text-sm">
                <Link href="/livestock-inventory/ownership-history">Ownership history</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExportCsv} className="min-h-11 cursor-pointer text-sm">
                <FileDown className="size-4 text-emerald-700" />
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </section>
  );
}
