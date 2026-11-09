"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, FileText, SlidersHorizontal, ShieldCheck } from "lucide-react";

export type PullOutGatePassData = {
  id: number;
  reference?: string;
  gate_pass_number?: string;
  livestock?: number;
  tag_number?: string;
  livestock_type_name?: string;
  breed?: string;
  sex?: string;
  age?: { years: number; months: number; total_months: number } | string | null;
  weight?: string | number | null;
  farmer_id?: number;
  farmer_name?: string;
  farmer_address?: string;
  farmer_contact?: string;
  farmer_rsbsa?: string;
  barangay_name?: string | null;
  colc_number?: string;
  original_certificate_number?: string;
  target_date?: string | null;
  target_destination?: string;
  notes?: string;
  review_notes?: string;
  registration_status?: string;
  created_at?: string;
};

interface AuctionPullOutGatePassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: PullOutGatePassData | null;
  allRecords?: PullOutGatePassData[];
}

export function AuctionPullOutGatePassDialog({
  open,
  onOpenChange,
  record: initialRecord,
  allRecords = [],
}: AuctionPullOutGatePassDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [copyType, setCopyType] = useState<"ORIGINAL" | "DUPLICATE" | "TRIPLICATE">("ORIGINAL");
  const [paperTheme, setPaperTheme] = useState<"yellow" | "white">("yellow");
  const [showSignatorySettings, setShowSignatorySettings] = useState(false);

  // Editable Municipal Officials
  const [inspectorName, setInspectorName] = useState("ROBERTO V. MENDOZA");
  const [inspectorTitle, setInspectorTitle] = useState("Tagasuri sa Pintuan / Exit Gate Inspector");
  const [adminName, setAdminName] = useState("ENGR. ALBERTO S. ATIENZA");
  const [adminTitle, setAdminTitle] = useState("Punong Tagapamahala / Auction Market Administrator");

  const activeRecord = useMemo(() => {
    if (selectedId && allRecords.length > 0) {
      const found = allRecords.find((r) => r.id === selectedId);
      if (found) return found;
    }
    return initialRecord;
  }, [selectedId, allRecords, initialRecord]);

  // Gate Pass Control Serial Number (e.g., GP-2026-000123)
  const gatePassControlNumber = useMemo(() => {
    if (!activeRecord) return "GP-2026-000001";
    if (activeRecord.gate_pass_number) return activeRecord.gate_pass_number;
    const year = activeRecord.target_date
      ? activeRecord.target_date.slice(0, 4)
      : new Date().getFullYear();
    return `GP-${year}-${String(activeRecord.id).padStart(6, "0")}`;
  }, [activeRecord]);

  // Formatted Date
  const formattedDate = useMemo(() => {
    const today = new Date();
    const dateStr = activeRecord?.target_date || today.toISOString().slice(0, 10);
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return {
        month: parts[1].replace(/^0/, ""),
        day: parts[2].replace(/^0/, ""),
        year: parts[0],
        full: new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    }
    return {
      month: String(today.getMonth() + 1),
      day: String(today.getDate()),
      year: String(today.getFullYear()),
      full: today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    };
  }, [activeRecord]);

  // Formatted Age
  const formattedAge = useMemo(() => {
    if (!activeRecord?.age) return "3 Taon (Years)";
    if (typeof activeRecord.age === "string") return activeRecord.age;
    const y = activeRecord.age.years || 0;
    const m = activeRecord.age.months || 0;
    if (y > 0 && m > 0) return `${y} yr${y > 1 ? "s" : ""}, ${m} mo${m > 1 ? "s" : ""}`;
    if (y > 0) return `${y} Taon (${y} yr${y > 1 ? "s" : ""})`;
    if (m > 0) return `${m} Buwan (${m} mo${m > 1 ? "s" : ""})`;
    return "Under 1 month";
  }, [activeRecord]);

  const handlePrint = () => {
    window.print();
  };

  if (!activeRecord) return null;

  const ownerName = activeRecord.farmer_name || "G. Juan Dela Cruz";
  const ownerAddress =
    activeRecord.farmer_address ||
    (activeRecord.barangay_name
      ? `Brgy. ${activeRecord.barangay_name}, Padre Garcia, Batangas`
      : "Padre Garcia, Batangas");
  const ownerRsbsa = activeRecord.farmer_rsbsa || "04-10-18-001-000123";
  const species = activeRecord.livestock_type_name || "Baka (Cattle)";
  const breed = activeRecord.breed || "Brahman Cross";
  const sex = (activeRecord.sex || "Female").toUpperCase();
  const weight = activeRecord.weight ? `${activeRecord.weight} kg` : "320.00 kg";
  const tagNumber = activeRecord.tag_number || "BTG-PG-00123";
  const colcNumber =
    activeRecord.colc_number ||
    activeRecord.original_certificate_number ||
    "COLC-2026-000123";
  const preregRef = activeRecord.reference || `AP-${String(activeRecord.id).padStart(6, "0")}`;
  const destination =
    activeRecord.target_destination ||
    `FARM RESIDENCE · ${ownerAddress.toUpperCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96dvh] max-w-4xl overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none print:shadow-none print:max-h-none print:max-w-none print:w-full print:m-0">
        {/* Dialog Header — Hidden during Print */}
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <FileText className="size-5 text-amber-600" />
            Official Livestock Auction Pull-Out Gate Pass Clearance
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Padre Garcia Municipal Livestock Auction Market — Katibayan sa Paglalabas ng Hayop (Unsold Withdrawal Clearance).
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar Controls — Hidden during Print */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Record Switcher Dropdown if allRecords provided */}
            {allRecords.length > 0 && (
              <div className="w-56">
                <Select
                  value={String(activeRecord.id)}
                  onValueChange={(val) => setSelectedId(Number(val))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Record" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allRecords.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)} className="text-xs">
                        {r.reference || `AP-${r.id}`} · {r.tag_number || r.livestock_type_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Copy Type Badge Dropdown */}
            <div className="w-40">
              <Select
                value={copyType}
                onValueChange={(val) => setCopyType(val as "ORIGINAL" | "DUPLICATE" | "TRIPLICATE")}
              >
                <SelectTrigger className="h-9 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORIGINAL" className="text-xs font-bold">
                    ORIGINAL (Exit Security)
                  </SelectItem>
                  <SelectItem value="DUPLICATE" className="text-xs font-bold">
                    DUPLICATE (Owner Copy)
                  </SelectItem>
                  <SelectItem value="TRIPLICATE" className="text-xs font-bold">
                    TRIPLICATE (Office File)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Paper Theme Toggle */}
            <div className="w-38">
              <Select
                value={paperTheme}
                onValueChange={(val) => setPaperTheme(val as "yellow" | "white")}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yellow" className="text-xs">
                    Authentic Yellow Gate Pass
                  </SelectItem>
                  <SelectItem value="white" className="text-xs">
                    Plain White Stationery
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Signatory Settings Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSignatorySettings(!showSignatorySettings)}
              className="h-9 text-xs gap-1.5"
            >
              <SlidersHorizontal className="size-3.5" />
              Signatories
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="h-9 bg-[#854d0e] hover:bg-[#713f12] text-white text-xs font-bold px-4 gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Printer className="size-4" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Collapsible Signatory Bar */}
        {showSignatorySettings && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 print:hidden animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Custom Officials for Gate Pass
              </span>
              <span className="text-[11px] text-slate-500">Edit values before printing</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-slate-500 font-bold">Exit Gate Inspector</Label>
                <Input
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 font-bold">Auction Market Administrator</Label>
                <Input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* PRINTABLE OFFICIAL GATE PASS CONTAINER                              */}
        {/* Replica of Municipal Livestock Pull-Out Clearance Form              */}
        {/* =================================================================== */}
        <div className="w-full flex justify-center py-2 print:py-0 print:m-0">
          <div
            id="auction-pull-out-gate-pass-sheet"
            className={`w-full max-w-[760px] p-6 sm:p-8 font-serif text-[11.5px] leading-relaxed text-black shadow-md border print:shadow-none print:border-none print:p-4 print:max-w-none transition-colors ${
              paperTheme === "yellow"
                ? "bg-[#fef9c3] print:bg-[#fef9c3] border-amber-200"
                : "bg-white print:bg-white border-slate-200"
            }`}
            style={{
              fontFamily: "'Times New Roman', Times, Georgia, serif",
              color: "#111827",
            }}
          >
            {/* 1. Header Bar: Dual Municipal/Provincial Seals & Control Number */}
            <div className="flex items-start justify-between gap-2 border-b-2 border-black/80 pb-2 mb-3">
              {/* Left: Batangas Seal & Form Reference */}
              <div className="flex items-center gap-2.5">
                <div className="size-14 relative flex items-center justify-center shrink-0">
                  <Image
                    src="/images/batangas-seal.png"
                    alt="Lalawigan ng Batangas Seal"
                    width={56}
                    height={56}
                    className="size-14 object-contain"
                    unoptimized
                  />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[9.5px] font-bold uppercase tracking-tight">Municipal Form No. 104-A</p>
                  <p className="text-[8.5px] italic text-black/75">Revised August 2020</p>
                  <div className="inline-flex items-center gap-1 border border-black/50 px-1 py-0.2 rounded-xs mt-0.5">
                    <ShieldCheck className="size-2.5 text-emerald-700" />
                    <span className="text-[8px] font-bold font-mono">EXIT CLEARANCE</span>
                  </div>
                </div>
              </div>

              {/* Center: LGU Header Titles */}
              <div className="text-center flex-1 px-1">
                <p className="text-[10px] italic">Republic of the Philippines</p>
                <p className="text-[13px] font-bold tracking-wide uppercase">PROVINCE OF BATANGAS</p>
                <p className="text-[11px] font-bold uppercase">MUNICIPALITY OF PADRE GARCIA</p>
                <p className="text-[9.5px] uppercase tracking-wider font-sans font-semibold text-black/80 mt-0.5">
                  Office of the Local Economic Enterprise Management
                </p>
                <p className="text-[11px] font-black uppercase tracking-wide text-black mt-0.5">
                  PADRE GARCIA MUNICIPAL LIVESTOCK AUCTION MARKET
                </p>
              </div>

              {/* Right: Padre Garcia Seal, Copy Badge, and Red Control Number */}
              <div className="flex items-center gap-2 text-right">
                <div className="space-y-0.5">
                  <p className="text-[10.5px] font-black uppercase tracking-wider">{copyType}</p>
                  <p className="font-mono text-xs font-black tracking-tight text-[#b91c1c] print:text-[#b91c1c]">
                    {gatePassControlNumber}
                  </p>
                  <p className="font-mono text-[9px] font-bold text-black/70">
                    REF: {preregRef}
                  </p>
                </div>

                <div className="size-14 relative flex items-center justify-center shrink-0">
                  <Image
                    src="/images/padre-garcia-seal.png"
                    alt="Bayan ng Padre Garcia Seal"
                    width={56}
                    height={56}
                    className="size-14 object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </div>

            {/* 2. Official Document Title */}
            <div className="text-center my-3.5">
              <h1 className="text-base sm:text-[17px] font-black tracking-wide uppercase leading-tight">
                KATIBAYAN SA PAGLALABAS NG HAYOP
              </h1>
              <p className="text-[11px] font-bold uppercase tracking-wider text-black/90 mt-0.5">
                LIVESTOCK AUCTION WITHDRAWAL &amp; GATE PASS CLEARANCE
              </p>
              <div className="inline-block mt-1 border-t-2 border-b-2 border-black/80 px-4 py-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#991b1b]">
                  WALANG BUMILI SA SUBSTA · UNSOLD LIVESTOCK PULL-OUT
                </span>
              </div>
            </div>

            {/* 3. Petsa at Oras (Date & Time of Release) */}
            <div className="flex justify-between items-center mb-3 text-xs border-b border-black/20 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">Preregistration Code:</span>
                <span className="font-mono font-bold bg-black/5 px-2 py-0.5 border border-black/30 rounded-xs">
                  {preregRef}
                </span>
              </div>
              <div className="text-right">
                <span className="font-bold">Petsa ng Paglalabas (Date): </span>
                <span className="font-mono font-bold underline px-1">
                  {formattedDate.month} / {formattedDate.day} / {formattedDate.year}
                </span>
              </div>
            </div>

            {/* 4. Body Content Paragraphs */}
            <div className="space-y-3 leading-[1.8]">
              {/* Formal Declaration */}
              <p className="text-justify indent-6">
                Pinatutunayan sa pamamagitan nito na ang rehistradong may-ari na nakatala sa ibaba ay binibigyan ng opisyal na pahintulot upang <strong>ILABAS</strong> at ibalik sa kanyang nasasakupang pasilidad o tirahan ang hayop na ipinasok sa Pamilihang Bayan ng Padre Garcia ngunit <strong>HINDI NAIPAGBILI (UNSOLD)</strong> matapos ang sesyon ng subasta.
              </p>
              <p className="text-[9.5px] italic text-black/75 -mt-2">
                This certifies that the registered owner specified below is officially cleared to withdraw and transport from the Padre Garcia Municipal Livestock Auction Market the animal which was entered but remained unsold after the auction market session.
              </p>

              {/* SECTION A: Owner Details */}
              <div className="border border-black p-3 space-y-1 bg-black/[0.02]">
                <p className="text-[10.5px] font-black uppercase tracking-wider border-b border-black/40 pb-1 mb-1">
                  I. IMPORMASYON NG MAY-ARI / FARMER-OWNER INFORMATION
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="font-bold">Pangalan ng May-ari (Owner Name): </span>
                    <span className="font-bold underline uppercase">{ownerName}</span>
                  </div>
                  <div>
                    <span className="font-bold">RSBSA Control No.: </span>
                    <span className="font-mono font-bold underline">{ownerRsbsa}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-bold">Tirahan / Barangay (Address): </span>
                    <span className="font-semibold underline">{ownerAddress}</span>
                  </div>
                </div>
              </div>

              {/* SECTION B: Animal Description & Characteristics */}
              <div className="border border-black p-3 space-y-1 bg-black/[0.02]">
                <p className="text-[10.5px] font-black uppercase tracking-wider border-b border-black/40 pb-1 mb-1">
                  II. PAGLALARAWAN NG HAYOP / ANIMAL SPECIFICATIONS
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="font-bold block text-[10px] text-black/70">Uri (Species):</span>
                    <span className="font-bold">{species}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-black/70">Lahi (Breed):</span>
                    <span className="font-bold">{breed}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-black/70">Kasarian (Sex):</span>
                    <span className="font-bold">{sex}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-black/70">Gulang (Age):</span>
                    <span className="font-bold font-mono">{formattedAge}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-black/70">Scale Weight (Timbang):</span>
                    <span className="font-bold font-mono text-emerald-950">{weight}</span>
                  </div>
                  <div>
                    <span className="font-bold block text-[10px] text-black/70">Ear Tag (Palatandaan):</span>
                    <span className="font-mono font-black text-[#991b1b]">{tagNumber}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="font-bold block text-[10px] text-black/70">Orihinal na Katibayan Blg. (COLC No.):</span>
                    <span className="font-mono font-bold">{colcNumber}</span>
                  </div>
                </div>
              </div>

              {/* SECTION C: Destination & Verification Details */}
              <div className="border border-black p-3 space-y-1.5 bg-black/[0.02]">
                <p className="text-[10.5px] font-black uppercase tracking-wider border-b border-black/40 pb-1 mb-1">
                  III. PATUTUNAY AT DESTINASYON / RELEASE &amp; ROUTE CLEARANCE
                </p>
                <div className="text-[11px] space-y-1">
                  <div>
                    <span className="font-bold">Dahilan ng Paglalabas (Reason): </span>
                    <span className="font-semibold underline">
                      WALANG BUMILI SA SUBASTA (Unsold at Auction / Withdrawn by Registered Owner)
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">Babalikang Pasilidad / Destinasyon (Return Destination): </span>
                    <span className="font-bold underline uppercase">{destination}</span>
                  </div>
                  <div className="pt-1 flex items-center gap-2 text-[10.5px]">
                    <span className="size-3.5 border-2 border-black inline-flex items-center justify-center font-bold text-[10px]">✓</span>
                    <span className="font-bold">
                      Napag-alamang tugma ang Ear Tag at orihinal na COLC batay sa Pisikal na Pagsusuri sa Tarangkahan.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Signatories Grid (Owner, Gate Inspector, Market Administrator) */}
            <div className="grid grid-cols-3 gap-4 my-5 pt-3 border-t border-black/40">
              {/* Left: Owner / Custodian */}
              <div className="text-center">
                <div className="border-b border-black min-h-7 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                  {ownerName}
                </div>
                <p className="text-[10px] font-bold mt-1">Lagda ng May-ari / Naglalabas</p>
                <p className="text-[8.5px] text-black/70 italic">Signature of Registered Owner</p>
              </div>

              {/* Middle: Gate Inspector */}
              <div className="text-center">
                <div className="border-b border-black min-h-7 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                  {inspectorName}
                </div>
                <p className="text-[10px] font-bold mt-1">{inspectorTitle}</p>
                <p className="text-[8.5px] text-black/70 italic">Livestock Exit Gate Inspector</p>
              </div>

              {/* Right: Market Administrator */}
              <div className="text-center">
                <div className="border-b border-black min-h-7 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                  {adminName}
                </div>
                <p className="text-[10px] font-bold mt-1">{adminTitle}</p>
                <p className="text-[8.5px] text-black/70 italic">Auction Market Administrator</p>
              </div>
            </div>

            {/* 6. Legal / Checkpoint Security Notice */}
            <div className="border-t-2 border-black pt-2.5 mt-3 text-[8.5px] leading-tight text-black/85 space-y-1">
              <p className="text-justify font-sans leading-normal">
                <strong>MAHALAGANG PAALALA</strong> — Ang Katibayang ito (Gate Pass / Release Clearance) ay kinakailangang maipakita at isuko sa mga Kawani ng Tarangkahan at Checkpoint ng Pamilihang Bayan ng Padre Garcia bago ilabas, ikarga, o i-biyahe ang hayop alinsunod sa Municipal Ordinance No. 2018-04, Republic Act No. 8485 (Animal Welfare Act), at Presidential Decree No. 533 (Anti-Cattle Rustling Law).
              </p>
              <p className="text-justify font-sans leading-normal italic text-black/75">
                <strong>SECURITY NOTICE</strong> — This Gate Pass Clearance must be presented and verified by municipal exit checkpoint security before loading or transporting livestock outside the auction market facility pursuant to local ordinances and livestock transport laws.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
