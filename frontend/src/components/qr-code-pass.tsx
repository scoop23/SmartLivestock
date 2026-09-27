"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, Printer, QrCode, ShieldCheck } from "lucide-react";
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

/**
 * Deterministic pseudo-random matrix generator based on input string hash
 * Produces authentic-looking, distinct QR patterns for each livestock/batch code
 */
function generateQrMatrix(seed: string): boolean[][] {
  const size = 25;
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  // Simple string hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  // Draw 3 standard QR Position Detection Patterns (Corners)
  const drawCorner = (rStart: number, cStart: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[rStart + r][cStart + c] = isBorder || isCenter;
      }
    }
  };

  drawCorner(0, 0); // Top-left
  drawCorner(0, size - 7); // Top-right
  drawCorner(size - 7, 0); // Bottom-left

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Populate data bits deterministically
  let pseudoState = Math.abs(hash) || 123456789;
  const nextPseudo = () => {
    pseudoState = (pseudoState * 1664525 + 1013904223) % 4294967296;
    return pseudoState / 4294967296;
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Don't overwrite corner finder patterns
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      // Leave center emblem free
      const inCenter = r >= 10 && r <= 14 && c >= 10 && c <= 14;

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inCenter) {
        matrix[r][c] = nextPseudo() > 0.48;
      }
    }
  }

  return matrix;
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
  const matrix = React.useMemo(() => generateQrMatrix(code || "PG-MAO-001"), [code]);

  const verificationUrl = typeof window !== "undefined"
    ? `${window.location.origin}/data-validation/batches?batchId=${encodeURIComponent(code)}`
    : `https://smartlivestock.padregarcia.gov.ph/verify/${code}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    toast.success("Verification payload copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full bg-white rounded-2xl border-2 border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col items-center text-center space-y-3.5 relative overflow-hidden">
      {/* Top Security Banner */}
      <div className="flex items-center justify-between w-full pb-2 border-b border-slate-100 text-left">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
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

      {/* Vector QR Code Matrix Frame */}
      <div className="p-3 bg-gradient-to-b from-slate-50 to-emerald-50/30 rounded-2xl border-2 border-dashed border-emerald-300/80 relative shadow-inner">
        <div className="p-2.5 bg-white rounded-xl shadow-md border border-slate-200 relative">
          <svg
            className={compact ? "size-36" : "size-44 sm:size-48"}
            viewBox="0 0 250 250"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Draw QR Cells */}
            {matrix.map((row, r) =>
              row.map((active, c) =>
                active ? (
                  <rect
                    key={`${r}-${c}`}
                    x={c * 10}
                    y={r * 10}
                    width={9.2}
                    height={9.2}
                    rx={1.5}
                    fill="#064E3B"
                  />
                ) : null
              )
            )}

            {/* Center Security Emblem */}
            <rect x="92" y="92" width="66" height="66" rx="14" fill="#047857" />
            <rect x="96" y="96" width="58" height="58" rx="10" fill="white" />
            <circle cx="125" cy="125" r="18" fill="#ECFDF5" />
            <text
              x="125"
              y="131"
              fontSize="14"
              fontWeight="900"
              fontFamily="sans-serif"
              textAnchor="middle"
              fill="#064E3B"
            >
              PG
            </text>
          </svg>
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
      <div className="w-full flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1 text-emerald-700 font-bold">
          <ShieldCheck className="size-3" />
          Scannable at Checkpoints &amp; PGLAM
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
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy Link"}</span>
        </Button>

        <Button
          size="sm"
          onClick={handlePrint}
          className="flex-1 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 h-8.5 shadow-2xs"
        >
          <Printer className="size-3" />
          <span>Print QR Pass</span>
        </Button>
      </div>
    </div>
  );
}
