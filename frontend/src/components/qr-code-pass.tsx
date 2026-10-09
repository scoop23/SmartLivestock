"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, Printer, QrCode, ShieldCheck, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";

export interface QrCodePassProps {
  code: string;
  qrPayload: string;
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
  qrPayload,
  title,
  subtitle = "SmartLivestock record identity",
  ownerName,
  barangay,
  specie,
  headCount,
  status = "RECORDED",
  verifiedAt,
  compact = false,
}: QrCodePassProps) {
  const [copied, setCopied] = useState(false);
  const [qrState, setQrState] = useState<{ payload: string; url: string; error: string } | null>(null);

  // Payload format is supplied by the record-specific caller to prevent ID-type mixups.
  const qrValue = qrPayload;
  const qrDataUrl = qrState?.payload === qrValue ? qrState.url : "";
  const qrError = qrState?.payload === qrValue
    ? qrState.error
    : !code || !qrValue ? "This pass is missing its record identifier, so no QR code can be generated." : "";
  const normalizedStatus = status.toUpperCase();
  const statusColor = normalizedStatus === "APPROVED"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : normalizedStatus === "VERIFIED"
      ? "bg-sky-100 text-sky-800 border-sky-200"
      : normalizedStatus === "PENDING"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";
  useEffect(() => {
    let isMounted = true;
    if (!code || !qrValue) {
      return () => { isMounted = false; };
    }

    QRCode.toDataURL(qrValue, {
      width: compact ? 220 : 320,
      margin: 1,
      color: { dark: "#064E3B", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        if (isMounted) setQrState({ payload: qrValue, url, error: "" });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setQrState({ payload: qrValue, url: "", error: "QR generation failed. Copy the identifier and try again." });
          console.error("Failed to generate QR Code:", error);
        }
      });

    return () => { isMounted = false; };
  }, [code, qrValue, compact]);
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopied(true);
      toast.success("QR identifier copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy this identifier. Select and copy it manually.");
    }
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
              SmartLivestock record identity
            </p>
            <h4 className="text-xs font-black text-slate-900 leading-tight">
              {title}
            </h4>
            <p className="text-[10px] text-slate-500">{subtitle}</p>
          </div>
        </div>

        <Badge className={`${statusColor} border text-[9px] font-black uppercase px-2 py-0.5`}>
          {status}
        </Badge>
      </div>

      {/* ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ Guidance Note: How This Digital QR Pass Works ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ */}
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
            Movement approval is reviewed separately
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
                alt={`QR code for ${code}`}
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
        <p className="mt-2 break-all text-xs font-mono font-black text-emerald-950 tracking-wider">
          {code}
        </p>
      </div>
      {qrError && <p role="alert" className="w-full text-left text-xs font-medium text-rose-700">{qrError}</p>}

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
          Registry identity only
        </span>
        <span className="font-mono text-slate-400">
          {verifiedAt || "Record identifier only"}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="min-h-11 flex-1 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 gap-1.5"
          title="Copy the QR identifier"
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy code"}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadQr}
          disabled={!qrDataUrl || !qrValue}
          className="min-h-11 flex-1 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 gap-1.5"
          title="Download PNG barcode image"
        >
          <Download className="size-3 text-slate-600" />
          <span>Save PNG</span>
        </Button>

        <Button
          size="sm"
          onClick={handlePrint}
          className="min-h-11 rounded-xl text-xs font-bold bg-[#2D5A27] hover:bg-[#23461f] text-white gap-1.5 px-3 shadow-2xs"
          title="Print record QR"
        >
          <Printer className="size-3" />
          <span>Print</span>
        </Button>
      </div>
    </div>
  );
}
