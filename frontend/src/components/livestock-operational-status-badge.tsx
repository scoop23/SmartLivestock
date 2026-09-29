import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  SOLD: "border-violet-200 bg-violet-50 text-violet-800",
  DECEASED: "border-slate-300 bg-slate-100 text-slate-700",
  SLAUGHTERED: "border-rose-200 bg-rose-50 text-rose-800",
  MOVED_OUT: "border-amber-200 bg-amber-50 text-amber-800",
};

interface LivestockOperationalStatusBadgeProps {
  status?: string | null;
  className?: string;
}

export function LivestockOperationalStatusBadge({
  status,
  className = "",
}: LivestockOperationalStatusBadgeProps) {
  const normalizedStatus = (status || "ACTIVE").toUpperCase();
  const label = normalizedStatus.replaceAll("_", " ");

  return (
    <Badge
      variant="outline"
      className={`text-[9px] font-black uppercase tracking-wide ${STATUS_STYLES[normalizedStatus] || STATUS_STYLES.ACTIVE} ${className}`}
    >
      Lifecycle: {label}
    </Badge>
  );
}
