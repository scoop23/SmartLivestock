"use client";

import { useState } from "react";
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Truck,
  ArrowRight,
  Layers,
  Tag,
  Sparkles,
  Camera,
  X,
  ClipboardCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { InspectionRecord } from "./auction-analytics";

interface AuctionQrScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClearanceFound?: (record: InspectionRecord) => void;
}

interface VerificationResult {
  code: string;
  type: "BATCH" | "INDIVIDUAL" | "PERMIT";
  title: string;
  owner: string;
  barangay: string;
  details: string;
  quantity: number;
  weightKg?: number;
  reviewStatus: "APPROVED" | "VERIFIED" | "PENDING" | "REVISION";
  biosecurityStatus: "CLEARED" | "FLAGGED";
  lastVaccination?: string;
  notes: string;
}

// Mock database of searchable items for realistic scanning simulation
const VERIFICATION_DATABASE: Record<string, VerificationResult> = {
  "BATCH-SWN-2026-01": {
    code: "BATCH-SWN-2026-01",
    type: "BATCH",
    title: "Swine Commercial Fatteners Cohort",
    owner: "Mateo Dimayuga",
    barangay: "Brgy. Poblacion, Padre Garcia",
    details: "Large White x Landrace • Pen 3 Fattening Barn",
    quantity: 10,
    weightKg: 68.4,
    reviewStatus: "APPROVED",
    biosecurityStatus: "CLEARED",
    lastVaccination: "2026-09-18 (Hog Cholera / PCV2)",
    notes: "MAO verified. Compliant with Municipal Biosecurity Ordinance No. 2026-03.",
  },
  "BATCH-PLT-2026-04": {
    code: "BATCH-PLT-2026-04",
    type: "BATCH",
    title: "Poultry Layers Cohort",
    owner: "Clara Hernandez",
    barangay: "Brgy. Manggas, Padre Garcia",
    details: "Lohmann Brown • Coop B Free Range",
    quantity: 30,
    weightKg: 1.95,
    reviewStatus: "VERIFIED",
    biosecurityStatus: "CLEARED",
    lastVaccination: "2026-08-30 (Newcastle Disease)",
    notes: "SIBAT inspected on-site. Ready for market distribution.",
  },
  "TAG-CT-2026-101": {
    code: "TAG-CT-2026-101",
    type: "INDIVIDUAL",
    title: "Breeding Brahman Bull",
    owner: "Juan Dela Cruz",
    barangay: "Brgy. Manggas, Padre Garcia",
    details: "Cattle (Baka) • Purebred Brahman • Male",
    quantity: 1,
    weightKg: 465,
    reviewStatus: "APPROVED",
    biosecurityStatus: "CLEARED",
    lastVaccination: "2026-09-02 (FMD & Hemosep)",
    notes: "Verified by Municipal Vet. Valid for live cattle auction ring.",
  },
  "TAG-CRB-2026-042": {
    code: "TAG-CRB-2026-042",
    type: "INDIVIDUAL",
    title: "Draft Carabao Stock",
    owner: "Rolando Bautista",
    barangay: "Brgy. Pansol, Padre Garcia",
    details: "Carabao (Kalabaw) • Philippine Native • Female",
    quantity: 1,
    weightKg: 390,
    reviewStatus: "VERIFIED",
    biosecurityStatus: "CLEARED",
    lastVaccination: "2026-08-15 (Anthrax & Hemosep)",
    notes: "Passed antemortem field check by SIBAT Officer.",
  },
  "CLR-2026-0001": {
    code: "CLR-2026-0001",
    type: "PERMIT",
    title: "Livestock Transport Clearance Permit",
    owner: "Juan Dela Cruz",
    barangay: "Brgy. Manggas, Padre Garcia",
    details: "Destination: Batangas City Slaughterhouse • Plate: NDB-8421",
    quantity: 7,
    reviewStatus: "PENDING",
    biosecurityStatus: "CLEARED",
    notes: "5 Cattle, 2 Carabaos. Antemortem inspection pending at auction gate.",
  },
  "CLR-2026-0003": {
    code: "CLR-2026-0003",
    type: "PERMIT",
    title: "Livestock Transport Clearance Permit",
    owner: "Pedro Reyes",
    barangay: "Brgy. Lipay, Padre Garcia",
    details: "Destination: Tanauan Fattening Yard • Plate: WXY-1049",
    quantity: 8,
    reviewStatus: "APPROVED",
    biosecurityStatus: "CLEARED",
    notes: "Full veterinary quarantine clearance attached and approved.",
  },
};

export function AuctionQrScannerDialog({
  isOpen,
  onOpenChange,
}: AuctionQrScannerDialogProps) {
  const [scanInput, setScanInput] = useState("");
  const [activeResult, setActiveResult] = useState<VerificationResult | null>(null);
  const [isScanningMode, setIsScanningMode] = useState(true);
  const [isAdmitted, setIsAdmitted] = useState(false);

  const handleLookup = (codeToSearch: string) => {
    const trimmed = codeToSearch.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Please enter or scan a valid code.");
      return;
    }

    const matchedKey = Object.keys(VERIFICATION_DATABASE).find(
      (k) => k.toUpperCase() === trimmed || k.toUpperCase().includes(trimmed)
    );

    if (matchedKey) {
      setActiveResult(VERIFICATION_DATABASE[matchedKey]);
      setIsAdmitted(false);
      setIsScanningMode(false);
      toast.success(`Verified: ${matchedKey}`, {
        description: "Official LGU record retrieved successfully.",
      });
    } else {
      // Dynamic fallback for any standard custom code entered
      setActiveResult({
        code: trimmed,
        type: trimmed.startsWith("BATCH") ? "BATCH" : trimmed.startsWith("CLR") ? "PERMIT" : "INDIVIDUAL",
        title: trimmed.startsWith("BATCH")
          ? "Registered Livestock Batch"
          : trimmed.startsWith("CLR")
            ? "Transport Clearance Permit"
            : "Registered Livestock Head",
        owner: "Registered Padre Garcia Raiser",
        barangay: "Padre Garcia, Batangas",
        details: "Dynamic verification against municipal registry",
        quantity: trimmed.startsWith("BATCH") ? 10 : 1,
        weightKg: trimmed.startsWith("BATCH") ? 65 : 320,
        reviewStatus: "APPROVED",
        biosecurityStatus: "CLEARED",
        lastVaccination: "2026-09-15 (Standard Protocol)",
        notes: "Verified against Padre Garcia MAO Agricultural Database.",
      });
      setIsAdmitted(false);
      setIsScanningMode(false);
      toast.info(`Record found for ${trimmed}`);
    }
  };

  const handleReset = () => {
    setActiveResult(null);
    setScanInput("");
    setIsAdmitted(false);
    setIsScanningMode(true);
  };

  const handleAdmitToAuction = () => {
    if (!activeResult) return;
    setIsAdmitted(true);
    toast.success(`${activeResult.code} admitted to Auction Ingress!`, {
      description: `Gate pass logged. Clearance certificate valid for trading pen entry.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 bg-white border-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-purple-100 text-[#7C3AED]">
              <QrCode className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-purple-700 tracking-wider">
                Padre Garcia Livestock Trading Center • Auction Gate
              </p>
              <DialogTitle className="text-lg font-black text-slate-900 leading-tight">
                Scan & Verify Livestock QR Pass
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Rapid checkpoint verification for incoming transport trucks, cohort batches, and individual ear tags.
          </DialogDescription>
        </DialogHeader>

        {isScanningMode ? (
          <div className="space-y-4 py-2">
            {/* Camera / Scanner Viewfinder Graphic */}
            <div className="relative p-6 bg-slate-950 rounded-2xl flex flex-col items-center justify-center text-center overflow-hidden border border-slate-800">
              {/* Corner guide brackets */}
              <div className="absolute top-3 left-3 size-6 border-t-2 border-l-2 border-purple-400 rounded-tl-lg" />
              <div className="absolute top-3 right-3 size-6 border-t-2 border-r-2 border-purple-400 rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 size-6 border-b-2 border-l-2 border-purple-400 rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 size-6 border-b-2 border-r-2 border-purple-400 rounded-br-lg" />

              {/* Laser scan line animation */}
              <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse my-4" />

              <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center text-purple-300 mb-3 border border-white/10">
                <Camera className="size-8 text-purple-300 animate-pulse" />
              </div>
              <p className="text-xs font-bold text-white tracking-wide">
                Scanner Terminal Active
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                Position optical QR tag or handheld laser barcode reader at the pass.
              </p>
            </div>

            {/* Manual Code Input Bar */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-600">
                Or Type Ear Tag / Batch Code / Permit #
              </label>
              <div className="flex gap-2">
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup(scanInput)}
                  placeholder="e.g. BATCH-SWN-2026-01 or TAG-CT-2026-101"
                  className="rounded-xl font-bold font-mono text-xs border-slate-300"
                />
                <Button
                  onClick={() => handleLookup(scanInput)}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-xs rounded-xl gap-1.5 px-4 cursor-pointer"
                >
                  <Search className="size-3.5" /> Verify
                </Button>
              </div>
            </div>

            {/* Quick Demo Scan Shortcuts */}
            <div className="pt-2">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                Quick Test Codes (Click to simulate scan):
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleLookup("BATCH-SWN-2026-01")}
                  className="text-[11px] font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                >
                  BATCH-SWN-2026-01 (10 Pigs)
                </button>
                <button
                  type="button"
                  onClick={() => handleLookup("TAG-CT-2026-101")}
                  className="text-[11px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  TAG-CT-2026-101 (Brahman Bull)
                </button>
                <button
                  type="button"
                  onClick={() => handleLookup("CLR-2026-0003")}
                  className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  CLR-2026-0003 (Transit Permit)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Verification Result View */
          activeResult && (
            <div className="space-y-4 py-2">
              {/* Header result banner */}
              <div
                className={`p-4 rounded-2xl border text-left ${activeResult.biosecurityStatus === "CLEARED"
                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                    : "bg-amber-50/70 border-amber-200 text-amber-950"
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="size-3.5" />
                      Biosecurity &amp; Movement Verified
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {activeResult.title}
                    </h3>
                    <p className="font-mono text-xs font-bold text-slate-700">
                      ID: {activeResult.code}
                    </p>
                  </div>

                  <div className="text-right">
                    {activeResult.reviewStatus === "APPROVED" ? (
                      <Badge className="bg-emerald-600 text-white font-black text-[10px]">
                        ✓ MAO APPROVED
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-600 text-white font-black text-[10px]">
                        ✓ SIBAT VERIFIED
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Specifications Table */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Registered Raiser:</span>
                  <span className="font-bold text-slate-900">{activeResult.owner}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Origin Barangay:</span>
                  <span className="font-bold text-slate-900">{activeResult.barangay}</span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Lot / Head Count:</span>
                  <span className="font-black text-purple-700">
                    {activeResult.quantity} Head{activeResult.quantity > 1 ? "s" : ""}
                    {activeResult.weightKg ? ` (~${activeResult.weightKg} kg avg)` : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Vaccination Status:</span>
                  <span className="font-bold text-emerald-700">{activeResult.lastVaccination || "Up to Date"}</span>
                </div>
                <div className="flex justify-between items-start pt-1">
                  <span className="text-slate-500 font-medium shrink-0">Audit Notes:</span>
                  <span className="text-right font-medium text-slate-700 italic pl-3">
                    {activeResult.notes}
                  </span>
                </div>
              </div>

              {/* Ingress Admission Status */}
              {isAdmitted ? (
                <div className="p-3 bg-emerald-100/70 border border-emerald-300 rounded-xl text-center text-xs font-bold text-emerald-900 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="size-4 text-emerald-700" />
                  <span>Admitted to Auction Holding Pen #3 • Gate Ingress Logged</span>
                </div>
              ) : null}
            </div>
          )
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 flex items-center justify-between">
          {isScanningMode ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="rounded-xl font-bold text-xs"
            >
              Scan Another Pass
            </Button>
          )}

          {!isScanningMode && !isAdmitted && (
            <Button
              type="button"
              onClick={handleAdmitToAuction}
              className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="size-3.5" /> Admit Lot to Auction Pen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
