"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import {
  QrCode,
  Search,
  Info,
  ShieldCheck,
  Camera,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import axios from "axios";
import Link from "next/link";
import api from "@/lib/axios";
import { lookupRegisteredLivestock } from "@/app/(auction)/auction-inspections/auction-analytics";
import { LivestockOperationalStatusBadge } from "@/components/livestock-operational-status-badge";
import { formatAgeClassification, formatCalendarDate, formatLivestockAge } from "@/lib/livestock-age";
import { parseLivestockQrPayload } from "@/lib/livestock-identity";

export interface UniversalQrScannerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  role?: "admin" | "sibat" | "auction" | "farmer" | "lgu";
}

interface ScannedRecord {
  code: string;
  type: "BATCH" | "INDIVIDUAL" | "PERMIT";
  title: string;
  specie: string;
  breed?: string;
  sex?: string;
  owner: string;
  barangay: string;
  headCount: number;
  weightKg?: number | null;
  operationalStatus?: string;
  registrationStatus?: string;
  reviewStatus?: string;
  birthDate?: string | null;
  age?: { years: number; months: number; total_months: number } | null;
  ageClassification?: string;
  livestockId?: number;
  eligible?: boolean;
  biosecurity: "CLEARED" | "FLAGGED" | "UNKNOWN";
  lastVaccination?: string;
  details: string;
  linkUrl?: string;
}

interface BatchLookupRecord {
  id: number | string;
  batch_code?: string;
  batch_name?: string;
  livestock_type_name?: string;
  farmer_name?: string;
  barangay_name?: string;
  total_animals?: number;
  animals?: unknown[];
  average_weight?: number | string | null;
  housing_pen?: string;
  feed_type?: string;
  status?: string;
  review_status?: string;
  review_remarks?: string | null;
}

export function UniversalQrScannerDialog({
  isOpen,
  onOpenChange,
  role = "admin",
}: UniversalQrScannerDialogProps) {
  const [scanInput, setScanInput] = useState("");
  const [activeResult, setActiveResult] = useState<ScannedRecord | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lookupRequestId = useRef(0);
  const lookupInFlight = useRef(false);
  const scannerControls = useRef<IScannerControls | null>(null);

  // Role styling & theming
  const isAuction = role === "auction";
  const isSibat = role === "sibat";

  const themeColors = isAuction
    ? {
        bannerBg: "bg-purple-100 text-[#7C3AED]",
        accent: "bg-[#7C3AED] hover:bg-[#6D28D9]",
        border: "border-purple-200",
        badge: "bg-purple-100 text-purple-800",
        title: "Padre Garcia Livestock Trading Center Ã¢â‚¬Â¢ Gate Scanner",
        sub: "Resolve registered livestock identities and supported batch records against the registry.",
      }
    : isSibat
    ? {
        bannerBg: "bg-amber-100 text-[#1A365D]",
        accent: "bg-[#1A365D] hover:bg-[#132742]",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        title: "SIBAT Field Biosecurity & Checkpoint Scanner",
        sub: "Resolve livestock identities within your assigned barangay scope.",
      }
    : {
        bannerBg: "bg-emerald-100 text-emerald-900",
        accent: "bg-[#2D5A27] hover:bg-[#23461f]",
        border: "border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800",
        title: "Municipal Agriculture Office Ã¢â‚¬Â¢ Universal QR Scanner",
        sub: "Resolve current livestock registry records and review their eligibility status.",
      };

  const handleLookup = useCallback(async (codeToSearch: string) => {
    const input = codeToSearch.trim();
    if (!input) {
      toast.error("Please enter or scan a livestock or batch identifier.");
      return;
    }
    if (lookupInFlight.current) return;

    const target = parseLivestockQrPayload(input);
    if (target.kind === "UNSUPPORTED") {
      toast.error("This QR belongs to a different record type. Scan an individual livestock or batch QR.");
      return;
    }

    const requestId = ++lookupRequestId.current;
    lookupInFlight.current = true;
    setIsSearching(true);
    setActiveResult(null);
    try {
      if (target.kind === "BATCH") {
        // The backend resolves one herd only after applying the caller's ownership or barangay scope.
        const response = await api.get<BatchLookupRecord>("livestock/batches/lookup/", {
          params: { code: target.code },
        });
        if (requestId !== lookupRequestId.current) return;
        const batch = response.data;
        const id = String(batch.id);
        setActiveResult({
          code: batch.batch_code || id,
          type: "BATCH",
          title: batch.batch_name || `Batch ${batch.batch_code || id}`,
          specie: batch.livestock_type_name || "Not recorded",
          owner: batch.farmer_name || "Registered farmer",
          barangay: batch.barangay_name || "Not recorded",
          headCount: batch.total_animals ?? 0,
          weightKg: batch.average_weight == null ? null : Number(batch.average_weight),
          operationalStatus: batch.status,
          reviewStatus: batch.review_status,
          biosecurity: "UNKNOWN",
          details: batch.review_remarks || "A registry lookup shows the current batch record only. It does not approve a movement or inspection.",
          linkUrl: isSibat
            ? `/sibat/batches?batchId=${encodeURIComponent(id)}`
            : isAuction
              ? "/auction-inspections"
              : role === "farmer"
                ? `/livestock-inventory/batches?batchId=${encodeURIComponent(id)}`
                : `/data-validation/batches?batchId=${encodeURIComponent(id)}`,
        });
        toast.success(`Batch record found: ${batch.batch_code || id}`);
        return;
      }

      // QR values carry identity only; the authorized API supplies current record data and status.
      const animal = await lookupRegisteredLivestock(target.code);
      if (requestId !== lookupRequestId.current) return;
      setActiveResult({
        code: animal.tag_number || String(animal.id),
        type: "INDIVIDUAL",
        title: `${animal.breed || "Registered"} ${animal.livestock_type_name}`,
        specie: animal.livestock_type_name,
        breed: animal.breed || "Not recorded",
        sex: animal.sex || "Not recorded",
        owner: animal.owner_name,
        barangay: animal.barangay || "Not recorded",
        headCount: 1,
        operationalStatus: animal.operational_status,
        registrationStatus: animal.registration_status,
        birthDate: animal.birth_date,
        age: animal.age,
        ageClassification: animal.age_classification,
        livestockId: animal.id,
        eligible: animal.eligible,
        biosecurity: "UNKNOWN",
        details: animal.eligible
          ? "Approved and active in the livestock register. This lookup does not approve a movement or inspection."
          : animal.ineligibility_reason,
        linkUrl: isSibat
          ? "/sibat?tab=inventory"
          : isAuction
            ? "/auction-inspections"
            : role === "farmer"
              ? `/livestock-inventory/${animal.id}`
              : "/data-validation?domain=livestock",
      });
      toast.success(`Livestock identity found: ${animal.tag_number || animal.id}`);
    } catch (cause: unknown) {
      if (requestId !== lookupRequestId.current) return;
      setActiveResult(null);
      if (axios.isAxiosError(cause)) {
        const response = cause.response;
        const detail = (response?.data as { detail?: string } | undefined)?.detail;
        toast.error(response?.status === 404
          ? "No matching record is available in your authorized scope."
          : response?.status === 403
            ? "Your account is not authorized to view this record type or barangay."
            : response?.status === 409
              ? detail || "This identifier matches more than one record. Scan its canonical QR code."
              : detail || "Unable to contact the registry. Check your connection and try again.");
      } else {
        toast.error("Unable to verify this livestock identifier.");
      }
    } finally {
      if (requestId === lookupRequestId.current) {
        lookupInFlight.current = false;
        setIsSearching(false);
      }
    }
  }, [isAuction, isSibat, role]);

  const enableCamera = () => {
    if (!window.isSecureContext) {
      setCameraMessage("Camera access requires HTTPS or localhost. You can still enter the code below.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera access is unavailable in this browser. Enter the code below.");
      return;
    }
    setCameraMessage("");
    setCameraActive(true);
  };

  // ZXing provides camera decoding when BarcodeDetector is unavailable; this is identity lookup only.
  useEffect(() => {
    let cancelled = false;
    let controls: IScannerControls | null = null;
    if (isOpen && cameraActive && videoRef.current) {
      const reader = new BrowserQRCodeReader();
      reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result) => {
          if (!result || cancelled) return;
          const code = result.getText();
          setScanInput(code);
          setCameraActive(false);
          controls?.stop();
          void handleLookup(code);
        },
      ).then((startedControls) => {
        controls = startedControls;
        scannerControls.current = startedControls;
        // getUserMedia can resolve after the dialog closes; stop its late-arriving stream.
        if (cancelled) startedControls.stop();
      }).catch((error: unknown) => {
        if (cancelled) return;
        setCameraActive(false);
        setCameraMessage(error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow access in browser settings or enter the code below."
          : "No usable camera was found. Enter the livestock code below instead.");
      });
    }

    return () => {
      cancelled = true;
      controls?.stop();
      if (scannerControls.current === controls) scannerControls.current = null;
    };
  }, [isOpen, cameraActive, handleLookup]);

  const handleReset = () => {
    lookupRequestId.current += 1;
    lookupInFlight.current = false;
    setIsSearching(false);
    setActiveResult(null);
    setScanInput("");
    setCameraMessage("");
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      lookupRequestId.current += 1;
      lookupInFlight.current = false;
      setCameraActive(false);
      setIsSearching(false);
      setActiveResult(null);
      setScanInput("");
      setCameraMessage("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg rounded-3xl p-4 sm:p-6 bg-white border-slate-100 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <div className={`p-2 rounded-xl shrink-0 ${themeColors.bannerBg}`}>
              <QrCode className="size-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {themeColors.title}
              </p>
              <DialogTitle className="text-lg font-black text-slate-900 leading-tight">
                Find a Livestock Record
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            {themeColors.sub} The QR is only an identifier; current status comes from SmartLivestock.
          </DialogDescription>
        </DialogHeader>

        {!activeResult ? (
          <div className="space-y-4 py-2">
            {/* Viewfinder Camera Graphic */}
            <div className="relative p-6 bg-slate-950 rounded-2xl flex flex-col items-center justify-center text-center overflow-hidden border border-slate-800 shadow-inner">
              {/* Corner guide brackets */}
              <div className="absolute top-3 left-3 size-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-3 right-3 size-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-3 left-3 size-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-3 right-3 size-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

              {cameraActive ? (
                <div className="w-full space-y-2">
                  <div className="relative h-44 w-full overflow-hidden rounded-xl bg-black">
                    <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                    {/* Laser scan line animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCameraActive(false)} className="min-h-11 border-white/20 bg-white/10 text-xs text-white hover:bg-white/20">Stop camera</Button>
                </div>
              ) : (
                <>
                  {/* Laser scan line animation */}
                  <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse my-3" />
                  <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 mb-2 border border-white/10">
                    <Camera className="size-8 text-emerald-300 animate-pulse" />
                  </div>
                  <p className="text-xs font-bold text-white tracking-wide">
                    Ready to scan
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Center the livestock QR in the frame, or enter its tag or code below. The lookup does not approve ownership, movement, or clearance.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={enableCamera}
                    className="mt-3 min-h-11 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold rounded-xl gap-1.5"
                  >
                    <Camera className="size-3.5" />
                    <span>Turn On Video Camera</span>
                  </Button>
                </>
              )}
            </div>
            {cameraMessage && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{cameraMessage}</p>}

            {/* Manual Code Input Bar */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-600">
                Ear tag, batch code, or QR value
              </label>
              <div className="flex gap-2">
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup(scanInput)}
                  placeholder="e.g. BATCH-2026-001 or PG-CAT-0941"
                  disabled={isSearching}
                  className="min-h-11 min-w-0 rounded-xl font-bold font-mono text-xs border-slate-300"
                />
                <Button
                  onClick={() => handleLookup(scanInput)}
                  disabled={isSearching}
                  className={`${themeColors.accent} text-white font-bold text-xs rounded-xl gap-1.5 px-4 min-h-11 cursor-pointer shadow-xs`}
                >
                  <Search className="size-3.5" />
                  <span>{isSearching ? "SearchingÃ¢â‚¬Â¦" : "Search"}</span>
                </Button>
              </div>
            </div>

          </div>
        ) : (
          /* Scanned Result Card */
          <div className="space-y-4 py-2 animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Header Badge Strip */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/60 to-slate-50 border border-emerald-200 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-black text-emerald-950">
                      {activeResult.code}
                    </span>
                    <Badge className="bg-emerald-700 text-white text-[10px] font-black uppercase">
                      {activeResult.type}
                    </Badge>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">
                    {activeResult.title}
                  </h3>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <Badge className={activeResult.type === "INDIVIDUAL" && !activeResult.eligible
                    ? "bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold gap-1 py-1 px-2.5"
                    : "bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold gap-1 py-1 px-2.5"}>
                    <ShieldCheck className="size-3.5" />
                    <span>{activeResult.type === "INDIVIDUAL"
                      ? activeResult.registrationStatus?.replaceAll("_", " ") || "Registration status not returned"
                      : "Batch record found"}</span>
                  </Badge>
                  {activeResult.type === "INDIVIDUAL" && (
                    <LivestockOperationalStatusBadge status={activeResult.operationalStatus} />
                  )}
                  {activeResult.type === "BATCH" && activeResult.reviewStatus && (
                    <Badge variant="outline" className="text-[10px]">Review: {activeResult.reviewStatus.replaceAll("_", " ")}</Badge>
                  )}
                  {activeResult.type === "BATCH" && activeResult.operationalStatus && (
                    <Badge variant="outline" className="text-[10px]">Herd: {activeResult.operationalStatus}</Badge>
                  )}
                </div>
              </div>

              {/* Data Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-emerald-200/60">
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Owner / Raiser
                  </span>
                  <p className="font-bold text-slate-900 truncate">{activeResult.owner}</p>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Barangay
                  </span>
                  <p className="font-bold text-slate-900 truncate">{activeResult.barangay}</p>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Head Count
                  </span>
                  <p className="font-bold text-emerald-800">
                    {activeResult.headCount} {activeResult.headCount === 1 ? "Head" : "Heads"}
                  </p>
                </div>
                {activeResult.type === "INDIVIDUAL" && (
                  <>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Sex</span>
                      <p className="font-bold text-slate-900">{activeResult.sex || "Not recorded"}</p>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Breed</span>
                      <p className="font-bold text-slate-900">{activeResult.breed || "Not recorded"}</p>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Birth Date</span>
                      <p className="font-bold text-slate-900">{formatCalendarDate(activeResult.birthDate)}</p>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Age / Class</span>
                      <p className="font-bold text-slate-900">{formatLivestockAge(activeResult.age)} Ã‚Â· {formatAgeClassification(activeResult.ageClassification)}</p>
                    </div>
                  </>
                )}

                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Biosecurity
                  </span>
                  <p className="font-bold text-slate-600 flex items-center gap-1">
                    <Info className="size-3.5" />
                    <span>Not assessed by registry lookup</span>
                  </p>
                </div>
              </div>

              {activeResult.details && (
                <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-xl border border-emerald-100 leading-relaxed">
                  {activeResult.details}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {activeResult.linkUrl && (
                <Link href={activeResult.linkUrl} className="block" target={role === "auction" ? "_blank" : undefined}>
                  <Button variant="outline" className="w-full min-h-11 gap-2">
                    <ExternalLink className="size-4" />
                    {activeResult.type === "INDIVIDUAL" && role === "farmer"
                      ? "Open livestock profile"
                      : role === "sibat"
                        ? "Open assigned review workspace"
                        : role === "auction"
                          ? "Open auction inspection workspace"
                          : "Open registry review"}
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                onClick={handleReset}
                className="w-full text-slate-500 hover:text-slate-800 text-xs font-bold rounded-xl h-8.5 cursor-pointer"
              >
                Scan Another Tag
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
