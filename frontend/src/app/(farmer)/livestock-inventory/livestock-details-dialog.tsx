import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LivestockInventoryItem } from "./page";

// ─── Backend model matches ──────────────────────────────────────────

interface ProductionRecord {
  id: string;
  production_type: "MILK" | "EGGS" | "WOOL";
  quantity: number;
  unit: "LITERS" | "PIECES" | "KILOGRAMS";
  record_date: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
}

interface SlaughterRecord {
  id: string;
  livestock_type_name: string;
  quantity: number;
  carcass_weight: number | null;
  record_date: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
}

interface LiveAnimalSale {
  id: string;
  quantity: number;
  sale_method: "MATA-MATA" | "WEIGHING" | "OTHER";
  total_live_weight: number | null;
  price_per_head: number | null;
  price_per_kg: number | null;
  total_price: number | null;
  destination: string;
  sale_date: string;
  purpose: "BREEDING" | "FATTENING" | "SLAUGHTER" | "UNKNOWN";
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
}

interface DiseaseCase {
  id: string;
  name: string;
  affected_count: number;
  record_date: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
}

interface MortalityRecord {
  id: string;
  death_count: number;
  cause: string;
  record_date: string;
  status: "PENDING" | "VERIFIED" | "APPROVED" | "REJECTED";
}

const mockProduction: ProductionRecord[] = [
  { id: 'p1', production_type: 'MILK', quantity: 450, unit: 'LITERS', record_date: '2026-04-23', status: 'APPROVED' },
  { id: 'p2', production_type: 'MILK', quantity: 445, unit: 'LITERS', record_date: '2026-04-22', status: 'APPROVED' },
];

const mockSlaughter: SlaughterRecord[] = [
  { id: 's1', livestock_type_name: 'Cattle', quantity: 1, carcass_weight: 158, record_date: '2026-04-15', status: 'APPROVED' },
];

const mockSales: LiveAnimalSale[] = [
  { id: 'ls1', quantity: 2, sale_method: 'WEIGHING', total_live_weight: 620, price_per_head: null, price_per_kg: 251.61, total_price: 156000, destination: 'Batangas Meat Packing', sale_date: '2026-03-15', purpose: 'SLAUGHTER', status: 'APPROVED' },
  { id: 'ls2', quantity: 1, sale_method: 'MATA-MATA', total_live_weight: null, price_per_head: 85000, price_per_kg: null, total_price: 85000, destination: 'Local Trader - R. Santos', sale_date: '2026-02-10', purpose: 'FATTENING', status: 'APPROVED' },
];

const mockDisease: DiseaseCase[] = [
  { id: 'd1', name: 'Foot rot', affected_count: 2, record_date: '2026-01-20', status: 'APPROVED' },
  { id: 'd2', name: 'Mastitis', affected_count: 1, record_date: '2025-11-05', status: 'APPROVED' },
];

const mockMortality: MortalityRecord[] = [
  { id: 'm1', death_count: 1, cause: 'Old age', record_date: '2026-03-28', status: 'APPROVED' },
  { id: 'm2', death_count: 1, cause: 'Injury from fencing', record_date: '2026-02-14', status: 'APPROVED' },
];

interface LivestockDetailsDialogProps {
  livestock: LivestockInventoryItem | null;
  open: boolean;
  onOpenChange: () => void;
}

const getStatusBadge = (status: string) => {
  const isApproved = status === "APPROVED";
  return (
    <Badge
      variant="outline"
      className={
        isApproved
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
      }
    >
      {status}
    </Badge>
  );
};

// Fixed EmptyState to fill height naturally without collapsing
const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center flex-1 h-full min-h-[250px] text-center p-6">
    <p className="text-sm text-slate-500 font-medium">{message}</p>
  </div>
);

// Unified card container wrapper
const RecordCard = ({ children }: { children: React.ReactNode }) => (
  <div className="p-3.5 bg-slate-50/70 hover:bg-slate-50 rounded-xl border border-slate-200/80 transition-colors duration-150">
    {children}
  </div>
);

export default function LivestockDetailsDialog({
  livestock,
  open,
  onOpenChange,
}: LivestockDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 
        Key fix: Fixed dialog dimensions using `h-[580px]` instead of flexible `vh` limits,
        ensuring the frame size stays 100% constant across tab switches.
      */}
      <DialogContent className="sm:max-w-2xl w-[95vw] h-[580px] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white flex-shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-slate-900">
            <div className="p-2 rounded-lg bg-[#2D5A27]/10 text-[#2D5A27]">
              <Layers className="w-5 h-5" />
            </div>
            {livestock?.entryType === "INDIVIDUAL"
              ? livestock?.tagNumber
              : `${livestock?.quantity}x ${livestock?.livestockTypeName} (Batch)`}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {[livestock?.livestockTypeName, livestock?.breed, livestock?.sex]
              .filter(Boolean)
              .join(" • ")}
          </DialogDescription>
        </DialogHeader>

        {/* Content Tabs */}
        {livestock && (
          <Tabs defaultValue="production" className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Horizontal Tabs Header */}
            <div className="px-6 py-2 bg-slate-50/50 border-b border-slate-100 flex-shrink-0">
              <ScrollArea className="w-full">
                <TabsList className="bg-slate-200/60 p-1 h-auto inline-flex gap-1 rounded-lg">
                  <TabsTrigger value="production" className="px-3 py-1.5 text-xs font-medium">
                    Production
                  </TabsTrigger>
                  <TabsTrigger value="slaughter" className="px-3 py-1.5 text-xs font-medium">
                    Slaughter
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="px-3 py-1.5 text-xs font-medium">
                    Live Sales
                  </TabsTrigger>
                  <TabsTrigger value="disease" className="px-3 py-1.5 text-xs font-medium">
                    Disease
                  </TabsTrigger>
                  <TabsTrigger value="mortality" className="px-3 py-1.5 text-xs font-medium">
                    Mortality
                  </TabsTrigger>
                </TabsList>
              </ScrollArea>
            </div>

            {/* Locked Content Container */}
            <div className="flex-1 min-h-0 relative">
              {/* Production */}
              <TabsContent value="production" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full [&>div>div]:!flex [&>div>div]:!flex-col [&>div>div]:min-h-full">
                  <div className="p-6 flex-1 flex flex-col">
                    {mockProduction.length === 0 ? (
                      <EmptyState message="No production records found." />
                    ) : (
                      <div className="space-y-2.5">
                        {mockProduction.map((r: ProductionRecord) => (
                          <RecordCard key={r.id}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {r.production_type}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {r.record_date} •{" "}
                                  <span className="font-medium text-slate-700">
                                    {r.quantity} {r.unit}
                                  </span>
                                </p>
                              </div>
                              {getStatusBadge(r.status)}
                            </div>
                          </RecordCard>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Slaughter */}
              <TabsContent value="slaughter" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full [&>div>div]:!flex [&>div>div]:!flex-col [&>div>div]:min-h-full">
                  <div className="p-6 flex-1 flex flex-col">
                    {mockSlaughter.length === 0 ? (
                      <EmptyState message="No slaughter records found." />
                    ) : (
                      <div className="space-y-2.5">
                        {mockSlaughter.map((r: SlaughterRecord) => (
                          <RecordCard key={r.id}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {r.livestock_type_name}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {r.record_date} • {r.quantity} head
                                  {r.quantity > 1 ? "s" : ""}
                                </p>
                                {r.carcass_weight && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Dressed Weight:{" "}
                                    <span className="font-medium text-slate-700">
                                      {r.carcass_weight} kg
                                    </span>
                                  </p>
                                )}
                              </div>
                              {getStatusBadge(r.status)}
                            </div>
                          </RecordCard>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Live Sales */}
              <TabsContent value="sales" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full [&>div>div]:!flex [&>div>div]:!flex-col [&>div>div]:min-h-full">
                  <div className="p-6 flex-1 flex flex-col">
                    {mockSales.length === 0 ? (
                      <EmptyState message="No live sale records found." />
                    ) : (
                      <div className="space-y-2.5">
                        {mockSales.map((r: LiveAnimalSale) => (
                          <RecordCard key={r.id}>
                            <div className="flex items-start justify-between mb-1.5">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {r.destination}
                                </p>
                                {r.price_per_head && (
                                  <p className="text-xs text-slate-500">
                                    ₱{r.price_per_head.toLocaleString()} / head
                                  </p>
                                )}
                              </div>
                              {r.total_price && (
                                <p className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  ₱{r.total_price.toLocaleString()}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 border-t border-slate-200/60 pt-2 mt-2">
                              <span>{r.sale_date}</span>
                              <span>•</span>
                              <span>
                                {r.quantity} head{r.quantity > 1 ? "s" : ""}
                              </span>
                              {r.total_live_weight && (
                                <>
                                  <span>•</span>
                                  <span>{r.total_live_weight} kg</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="capitalize">
                                {r.sale_method?.toLowerCase().replace("-", " ")}
                              </span>
                              <span>•</span>
                              <span className="capitalize">{r.purpose?.toLowerCase()}</span>
                            </div>
                          </RecordCard>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Disease */}
              <TabsContent value="disease" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full [&>div>div]:!flex [&>div>div]:!flex-col [&>div>div]:min-h-full">
                  <div className="p-6 flex-1 flex flex-col">
                    {mockDisease.length === 0 ? (
                      <EmptyState message="No disease records found." />
                    ) : (
                      <div className="space-y-2.5">
                        {mockDisease.map((r: DiseaseCase) => (
                          <RecordCard key={r.id}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {r.record_date} •{" "}
                                  <span className="font-medium text-slate-700">
                                    {r.affected_count} affected
                                  </span>
                                </p>
                              </div>
                              {getStatusBadge(r.status)}
                            </div>
                          </RecordCard>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Mortality */}
              <TabsContent value="mortality" className="m-0 h-full focus-visible:outline-none">
                <ScrollArea className="h-full w-full [&>div>div]:!flex [&>div>div]:!flex-col [&>div>div]:min-h-full">
                  <div className="p-6 flex-1 flex flex-col">
                    {mockMortality.length === 0 ? (
                      <EmptyState message="No mortality records found." />
                    ) : (
                      <div className="space-y-2.5">
                        {mockMortality.map((r: MortalityRecord) => (
                          <RecordCard key={r.id}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{r.cause}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{r.record_date}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50"
                              >
                                {r.death_count} head{r.death_count > 1 ? "s" : ""}
                              </Badge>
                            </div>
                          </RecordCard>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
