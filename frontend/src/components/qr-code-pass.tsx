"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, Printer, QrCode, ShieldCheck, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";

export interface QrCodePassProps {
  code: string;
  title: string;
  subtitle?: string;
  ownerName?: string;
  barangay?: string;
  specie?: string;
  headCount?: number | string;
  status?: string;
  verifiedAt?: string;
  compact?: boolean;
}

export function QrCodePass({
  code,
  title,
  subtitle = "Municipal Biosecurity & Traceability Pass",
  ownerName,
  barangay,
  specie,
  headCount,
  status = "APPROVED",
  verifiedAt,
  compact = false,
}: QrCodePassProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const verificationUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/data-validation/batches?batchId=${encodeURIComponent(code)}`
      : `https://smartlivestock.padregarcia.gov.ph/data-validation/batches?batchId=${encodeURIComponent(code)}`;

  useEffect(() => {
    let isMounted = true;
    if (!code) return;

    // Generate real, camera-scannable standard QR Code Data URL
    QRCode.toDataURL(verificationUrl, {
      width: compact ? 220 : 320,
      margin: 1,
      color: {
        dark: "#064E3B", // Deep emerald for biosecurity theme
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H", // High error correction to allow center emblem
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate QR Code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [code, verificationUrl, compact]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    toast.success("Verification link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `QR-Pass-${code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded QR pass for ${code}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col items-center text-center space-y-3.5 relative overflow-hidden">
      {/* Top Security Banner */}
      <div className="flex items-center justify-between w-full pb-2 border-b border-slate-100 text-left">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[#2D5A27] text-white flex items-center justify-center font-black text-xs shadow-xs">
            PG
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              Padre Garcia MAO Biosecurity
            </p>
            <h4 className="text-xs font-black text-slate-900 leading-tight">
              {title}
            </h4>
          </div>
        </div>

        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-black uppercase px-2 py-0.5">
          {status}
        </Badge>
      </div>

      {/* ── Guidance Note: How This Digital QR Pass Works ── */}
      <div className="w-full text-left p-3 rounded-xl bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-slate-50 border border-emerald-200/90 shadow-2xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
          <Info className="size-3.5 text-emerald-700 shrink-0" />
          <span>How this Digital QR Pass works:</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          This QR carries an identifier. Authorized staff must retrieve the current record from SmartLivestock. The QR itself does not prove movement approval, clearance, ownership, or biosecurity status.
        </p>
        <div className="flex items-center gap-3 pt-0.5 text-[10px] text-emerald-800 font-semibold flex-wrap">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            Registry identifier
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            Database is the source of truth
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            MAO reviews movement separately
          </span>
        </div>
      </div>

      {/* ISO-Standard Scannable QR Code Frame */}
      <div className="p-3 bg-gradient-to-b from-slate-50 to-emerald-50/30 rounded-2xl border-2 border-dashed border-emerald-300/80 relative shadow-inner">
        <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 relative inline-block">
          {qrDataUrl ? (
            <div className="relative">
              <img
                src={qrDataUrl}
                alt={`Official QR Code for ${code}`}
                className={compact ? "size-36 object-contain" : "size-44 sm:size-48 object-contain"}
              />
              {/* Center Seal Emblem */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="size-9 rounded-full bg-white shadow-xs border-2 border-[#2D5A27] flex items-center justify-center">
                  <span className="text-[10px] font-black text-[#2D5A27] font-mono leading-none">
                    PG
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center bg-slate-50 rounded-lg ${compact ? "size-36" : "size-44 sm:size-48"}`}>
              <QrCode className="size-8 text-slate-300 animate-pulse" />
            </div>
          )}
        </div>

        {/* Code Identifier Below QR */}
        <p className="mt-2 text-xs font-mono font-black text-emerald-950 tracking-wider">
          {code}
        </p>
      </div>

      {/* Metadata Pill Grid */}
      <div className="w-full grid grid-cols-2 gap-2 text-left text-xs pt-1">
        {ownerName && (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">
              Registered Raiser
            </span>
            <p className="font-bold text-slate-800 truncate">{ownerName}</p>
          </div>
        )}

        {barangay && (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">
              Location Origin
            </span>
            <p className="font-bold text-slate-800 truncate">Brgy. {barangay}</p>
          </div>
        )}

        {headCount !== undefined && (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">
              Head Count
            </span>
            <p className="font-black text-emerald-700">{headCount} Heads</p>
          </div>
        )}

        {specie && (
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 block uppercase">
              Specie Type
            </span>
            <p className="font-bold text-slate-800 truncate">{specie}</p>
          </div>
        )}
      </div>

      {/* Scanner Instructions & Verification Footer */}
      <div className="w-full flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1 text-emerald-700 font-bold">
          <ShieldCheck className="size-3.5" />
          Camera-Scannable at Municipal Checkpoints
        </span>
        <span className="font-mono text-slate-400">
          {verifiedAt || "Certified 2026"}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="flex-1 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 gap-1.5 h-8.5"
          title="Copy direct verification link"
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy Link"}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadQr}
          className="flex-1 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 gap-1.5 h-8.5"
          title="Download PNG barcode image"
        >
          <Download className="size-3 text-slate-600" />
          <span>Save PNG</span>
        </Button>

        <Button
          size="sm"
          onClick={handlePrint}
          className="rounded-xl text-xs font-bold bg-[#2D5A27] hover:bg-[#23461f] text-white gap-1.5 h-8.5 px-3 shadow-2xs"
          title="Print official clearance certificate"
        >
          <Printer className="size-3" />
          <span>Print</span>
        </Button>
      </div>
    </div>
  );
}
