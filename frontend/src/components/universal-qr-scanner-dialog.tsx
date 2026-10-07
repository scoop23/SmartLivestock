"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  QrCode,
  Search,
  CheckCircle2,
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
import Link from "next/link";
import api from "@/lib/axios";
import { lookupRegisteredLivestock } from "@/app/(auction)/auction-inspections/auction-analytics";
import { LivestockOperationalStatusBadge } from "@/components/livestock-operational-status-badge";

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
  owner: string;
  barangay: string;
  headCount: number;
  weightKg?: number | null;
  operationalStatus?: string;
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
}

interface InventoryLookupRecord {
  id: number;
  tag_number?: string;
  breed?: string;
  livestock_type_name?: string;
  farmer_name?: string;
  barangay_name?: string;
  quantity?: number | string;
  weight?: number | string | null;
  operational_status?: string;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Role styling & theming
  const isAuction = role === "auction";
  const isSibat = role === "sibat";

  const themeColors = isAuction
    ? {
        bannerBg: "bg-purple-100 text-[#7C3AED]",
        accent: "bg-[#7C3AED] hover:bg-[#6D28D9]",
        border: "border-purple-200",
        badge: "bg-purple-100 text-purple-800",
        title: "Padre Garcia Livestock Trading Center • Gate Scanner",
        sub: "Verify incoming transport permits, batch manifests, and auction registrations.",
      }
    : isSibat
    ? {
        bannerBg: "bg-amber-100 text-[#1A365D]",
        accent: "bg-[#1A365D] hover:bg-[#132742]",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        title: "SIBAT Field Biosecurity & Checkpoint Scanner",
        sub: "On-site verification of ear tags, vaccination records, and barangay herd movement.",
      }
    : {
        bannerBg: "bg-emerald-100 text-emerald-900",
        accent: "bg-[#2D5A27] hover:bg-[#23461f]",
        border: "border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800",
        title: "Municipal Agriculture Office • Universal QR Scanner",
        sub: "Rapid official audit of individual cattle passports, herds, and transport permits.",
      };

  const handleLookup = useCallback(async (codeToSearch: string) => {
    const trimmed = codeToSearch.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Please enter or scan a valid tag, batch, or permit code.");
      return;
    }

    setIsSearching(true);

    try {
      if (isAuction) {
        const found = await lookupRegisteredLivestock(trimmed);
        setActiveResult({
          code: found.tag_number,
          type: "INDIVIDUAL",
          title: `${found.breed || "Registered"} ${found.livestock_type_name}`,
          specie: found.livestock_type_name,
          breed: found.breed || "Not recorded",
          owner: found.owner_name,
          barangay: found.barangay || "Not recorded",
          headCount: 1,
          operationalStatus: found.operational_status,
          biosecurity: "UNKNOWN",
          details: `Registered livestock identity retrieved from the database. Registration: ${found.registration_status}. No movement or clearance approval is implied.`,
        });
        toast.success(`Registered animal found: ${found.tag_number}`);
        return;
      }

      // 1. Try querying backend for batch code if starts with BATCH
      if (trimmed.includes("BATCH")) {
        try {
          const res = await api.get<BatchLookupRecord[]>("livestock/batches/?all=true");
          const batches = Array.isArray(res.data) ? res.data : [];
          const found = batches.find(
            (b) =>
              b.batch_code?.toUpperCase() === trimmed ||
              b.batch_name?.toUpperCase() === trimmed
          );
          if (found) {
            setActiveResult({
              code: found.batch_code || String(found.id),
              type: "BATCH",
              title: found.batch_name || `Batch ${found.batch_code}`,
              specie: found.livestock_type_name || "Not recorded",
              owner: found.farmer_name || "Registered Raiser",
              barangay: found.barangay_name || "Not recorded",
              headCount: found.total_animals ?? found.animals?.length ?? 0,
              weightKg: found.average_weight ? Number(found.average_weight) : null,
              biosecurity: "UNKNOWN",
              details: `Housing: ${found.housing_pen || "General Pen"} • Feeding: ${found.feed_type || "—"}`,
              linkUrl: `/data-validation/batches?batchId=${encodeURIComponent(found.id)}`,
            });
            setIsSearching(false);
            toast.success(`Record found: ${found.batch_code}`);
            return;
          }
        } catch {
          throw new Error("Registry lookup failed");
        }
      }

      // 2. Try querying backend for livestock tag
      try {
        const res = await api.get<InventoryLookupRecord[]>("livestock/inventory/?include_inactive=true");
        const items = Array.isArray(res.data) ? res.data : [];
        const found = items.find(
          (i) =>
            i.tag_number?.toUpperCase() === trimmed ||
            String(i.id) === trimmed
        );
        if (found) {
          setActiveResult({
            code: found.tag_number || `TAG-${found.id}`,
            type: "INDIVIDUAL",
            title: `${found.breed || "Standard"} ${found.livestock_type_name || "Cattle"}`,
            specie: found.livestock_type_name || "Not recorded",
            breed: found.breed || "Not recorded",
            owner: found.farmer_name || "Registered Raiser",
            barangay: found.barangay_name || "Not recorded",
            headCount: Number(found.quantity) || 1,
            weightKg: found.weight ? Number(found.weight) : null,
            operationalStatus: found.operational_status || "ACTIVE",
            biosecurity: "UNKNOWN",
            details: `Official Tag ID #${found.tag_number || found.id} registered under Municipal Agriculture Office`,
            linkUrl: `/data-validation`,
          });
          setIsSearching(false);
          toast.success(`Record found: ${found.tag_number || found.id}`);
          return;
        }
      } catch {
        throw new Error("Registry lookup failed");
      }

      // A failed lookup is unknown; it must never manufacture approval or clearance.
      setActiveResult(null);
      toast.error("No matching accessible registry record. Transport-permit lookup is not available yet.");
    } catch {
      setActiveResult(null);
      toast.error("Unable to verify this code. Check your connection and access permissions.");
    } finally {
      setIsSearching(false);
    }
  }, [isAuction]);

  // Camera capture decodes on supported browsers; lookup still goes through the API.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame = 0;
    let scanning = true;
    if (isOpen && cameraActive) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: "environment" } })
        .then((media) => {
          stream = media;
          if (videoRef.current) {
            videoRef.current.srcObject = media;
            videoRef.current.play().catch(() => {});
          }
          const Detector = (window as unknown as {
            BarcodeDetector?: new (options: { formats: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
            };
          }).BarcodeDetector;
          if (!Detector) {
            toast.info("QR camera decoding is not supported by this browser. Use a handheld scanner or enter the code.");
            return;
          }
          const detector = new Detector({ formats: ["qr_code"] });
          const scanFrame = async () => {
            const video = videoRef.current;
            if (!scanning || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
              if (scanning) animationFrame = requestAnimationFrame(scanFrame);
              return;
            }
            try {
              const codes = await detector.detect(video);
              if (codes[0]?.rawValue) {
                scanning = false;
                setScanInput(codes[0].rawValue);
                setCameraActive(false);
                void handleLookup(codes[0].rawValue);
                return;
              }
            } catch {
              // Keep scanning; camera frames can fail transiently while autofocus adjusts.
            }
            if (scanning) animationFrame = requestAnimationFrame(scanFrame);
          };
          animationFrame = requestAnimationFrame(scanFrame);
        })
        .catch(() => {
          setCameraActive(false);
          toast.info("Camera not available or access denied. You can enter or paste the tag code below.");
        });
    }

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
      scanning = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [isOpen, cameraActive, handleLookup]);

  const handleReset = () => {
    setActiveResult(null);
    setScanInput("");
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-5 sm:p-6 bg-white border-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
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
                Scan & Verify Livestock Pass
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            {themeColors.sub}
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
                <div className="relative w-full h-44 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                  {/* Laser scan line animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Laser scan line animation */}
                  <div className="w-48 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse my-3" />
                  <div className="size-16 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 mb-2 border border-white/10">
                    <Camera className="size-8 text-emerald-300 animate-pulse" />
                  </div>
                  <p className="text-xs font-bold text-white tracking-wide">
                    Scanner Terminal Active
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Enter or paste a QR payload, or use a handheld QR scanner that types into the field. Camera capture is available on supported browsers.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCameraActive(true)}
                    className="mt-3 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold rounded-xl h-8 gap-1.5"
                  >
                    <Camera className="size-3.5" />
                    <span>Turn On Video Camera</span>
                  </Button>
                </>
              )}
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
                  placeholder="e.g. BATCH-2026-001 or PG-CAT-0941"
                  className="rounded-xl font-bold font-mono text-xs border-slate-300 h-9.5"
                />
                <Button
                  onClick={() => handleLookup(scanInput)}
                  disabled={isSearching}
                  className={`${themeColors.accent} text-white font-bold text-xs rounded-xl gap-1.5 px-4 h-9.5 cursor-pointer shadow-xs`}
                >
                  <Search className="size-3.5" />
                  <span>Verify</span>
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
                  <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold gap-1 py-1 px-2.5">
                    <ShieldCheck className="size-3.5 text-emerald-700" />
                    <span>Livestock identity found</span>
                  </Badge>
                  {activeResult.type === "INDIVIDUAL" && (
                    <LivestockOperationalStatusBadge status={activeResult.operationalStatus} />
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

                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    Biosecurity
                  </span>
                  <p className="font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" />
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
              <div className="flex items-center gap-2">


                {activeResult.linkUrl && (
                  <Link href={activeResult.linkUrl} target="_blank">
                    <Button
                      variant="outline"
                      className="border-slate-300 text-slate-700 text-xs font-bold rounded-xl h-10 gap-1.5 cursor-pointer hover:bg-slate-50"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Open File</span>
                    </Button>
                  </Link>
                )}
              </div>

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
