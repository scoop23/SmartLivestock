import { BadgeDollarSign, CircleDot, Scissors, Skull, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OperationalStatus } from "./livestock-inventory";

const STATUS_CONFIG: Record<
  OperationalStatus,
  { label: string; icon: typeof CircleDot; className: string }
> = {
  ACTIVE: {
    label: "Active Herd",
    icon: CircleDot,
    className: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  SOLD: {
    label: "Sold",
    icon: BadgeDollarSign,
    className: "bg-blue-100 text-blue-900 border-blue-200",
  },
  DECEASED: {
    label: "Deceased",
    icon: Skull,
    className: "bg-slate-200 text-slate-900 border-slate-300",
  },
  SLAUGHTERED: {
    label: "Slaughtered",
    icon: Scissors,
    className: "bg-rose-100 text-rose-900 border-rose-200",
  },
  MOVED_OUT: {
    label: "Moved Out",
    icon: Truck,
    className: "bg-violet-100 text-violet-900 border-violet-200",
  },
};

export function OperationalStatusBadge({
  status = "ACTIVE",
  compact = false,
}: {
  status?: OperationalStatus;
  compact?: boolean;
}) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACTIVE;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} inline-flex items-center gap-1 font-black uppercase tracking-wide ${compact ? "px-2 py-0 text-[9px]" : "px-2.5 py-0.5 text-[10px]"}`}
    >
      <Icon className={compact ? "size-2.5" : "size-3"} />
      {config.label}
    </Badge>
  );
}
