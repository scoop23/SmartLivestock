"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { printElement } from "@/lib/print-element";
import { Check,CheckCircle2,Copy,Download,Info,Printer,QrCode,ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import React,{ useEffect,useState } from "react";
import { toast } from "sonner";

export interface QrCodePassProps {
  code: string;
  qrPayload: string;
  variant?: "standard" | "clinical";
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
  variant = "standard",
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

    const encodedValue = qrValue.startsWith("/")
      ? new URL(qrValue, window.location.origin).toString()
      : qrValue;
    QRCode.toDataURL(encodedValue, {
      // QR readers expect a four-module quiet zone around the code.
      width: compact ? 352 : 512,
      margin: 4,
      color: { dark: "#000000", light: "#FFFFFF" },
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
      const copyValue = qrValue.startsWith("/")
        ? new URL(qrValue, window.location.origin).toString()
        : qrValue;
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      toast.success(variant === "clinical" ? "Clinical report link copied" : "QR identifier copied");
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

  const handlePrint = (event: React.MouseEvent<HTMLButtonElement>) => {
    const pass = event.currentTarget.closest(".qr-code-pass");
    if (!pass) return;
    printElement(pass as HTMLElement, "qr-code-pass-print-active");
  };

  return (
    <div className={`qr-code-pass w-full bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 flex flex-col items-center text-center space-y-3.5 relative overflow-hidden ${variant === "clinical" ? "clinical-qr-pass border-cyan-300 shadow-cyan-950/10" : "border-slate-200/90"}`}>
      {variant === "clinical" && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500" />}
      {/* Top Security Banner */}
      <div className={`flex items-center justify-between w-full pb-2 border-b text-left ${variant === "clinical" ? "border-cyan-100" : "border-slate-100"}`}>
        <div className="flex items-center gap-2">
          <div className={`size-8 rounded-lg text-white flex items-center justify-center font-black text-[10px] shadow-xs ${variant === "clinical" ? "bg-gradient-to-br from-emerald-800 via-slate-900 to-cyan-900 ring-1 ring-cyan-300/70" : "bg-[#2D5A27] text-xs"}`}>
            {variant === "clinical" ? "SL" : "PG"}
          </div>
          <div>
            <p className={`text-[9px] font-black uppercase tracking-[0.16em] ${variant === "clinical" ? "text-cyan-700" : "text-slate-400 tracking-wider"}`}>
              {variant === "clinical" ? "SmartLivestock clinical pass" : "SmartLivestock record identity"}
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
      <div className={`w-full text-left p-3 rounded-xl border shadow-2xs space-y-1 ${variant === "clinical" ? "bg-gradient-to-r from-slate-950 via-emerald-950 to-cyan-950 border-cyan-700 text-white" : "bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-slate-50 border-emerald-200/90"}`}>
        <div className={`flex items-center gap-1.5 font-bold text-xs ${variant === "clinical" ? "text-cyan-100" : "text-emerald-950"}`}>
          <Info className={`size-3.5 shrink-0 ${variant === "clinical" ? "text-cyan-300" : "text-emerald-700"}`} />
          <span className={variant === "clinical" ? "text-cyan-100" : ""}>{variant === "clinical" ? "LIVE CLINICAL RECORD LINK" : "How this Digital QR Pass works:"}</span>
        </div>
        <p className={`text-[11px] leading-relaxed ${variant === "clinical" ? "text-slate-200" : "text-slate-600"}`}>
          {variant === "clinical"
            ? "Scan to open the latest report details in SmartLivestock. Access is checked by your account; this pass does not diagnose or approve the report."
            : "This QR carries an identifier. Authorized staff must retrieve the current record from SmartLivestock. The QR itself does not prove movement approval, clearance, ownership, or biosecurity status."}
        </p>
        <div className={`flex items-center gap-3 pt-0.5 text-[10px] font-semibold flex-wrap ${variant === "clinical" ? "text-cyan-100" : "text-emerald-800"}`}>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            {variant === "clinical" ? "Report identity" : "Registry identifier"}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            {variant === "clinical" ? "Current record details" : "Database is the source of truth"}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            {variant === "clinical" ? "No diagnosis or approval implied" : "Movement approval is reviewed separately"}
          </span>
        </div>
      </div>

      {/* ISO-Standard Scannable QR Code Frame */}
      <div className={`p-3 rounded-2xl border-2 border-dashed relative shadow-inner ${variant === "clinical" ? "bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 border-cyan-400/80" : "bg-gradient-to-b from-slate-50 to-emerald-50/30 border-emerald-300/80"}`}>
        <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 relative inline-block">
          {qrDataUrl ? (
            <div className="relative">
              <img
                src={qrDataUrl}
                alt={`QR code for ${code}`}
                className={`qr-code-pass-image ${compact ? "size-44 object-contain" : "size-44 sm:size-48 object-contain"}`}
              />
            </div>
          ) : (
            <div className={`qr-code-pass-image flex items-center justify-center bg-slate-50 rounded-lg ${compact ? "size-44" : "size-44 sm:size-48"}`}>
              <QrCode className="size-8 text-slate-300 animate-pulse" />
            </div>
          )}
        </div>

        {/* Code Identifier Below QR */}
        <p className={`mt-2 break-all text-xs font-mono font-black tracking-wider ${variant === "clinical" ? "text-cyan-100" : "text-emerald-950"}`}>
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
      <div className="qr-code-pass-actions w-full flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="min-h-11 flex-1 rounded-xl text-xs font-bold border-slate-200 hover:bg-slate-50 gap-1.5"
          title={variant === "clinical" ? "Copy the SmartLivestock report link" : "Copy the QR identifier"}
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : variant === "clinical" ? "Copy link" : "Copy code"}</span>
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
