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
import { Printer, FileText, CheckCircle2, SlidersHorizontal } from "lucide-react";

export type TransferCertificateData = {
  id: number;
  transfer_certificate_number: string;
  original_certificate_number?: string;
  transfer_date: string;
  livestock?: number | null;
  livestock_tag?: string;
  livestock_type_name?: string;
  breed_at_transfer?: string;
  sex_at_transfer?: string;
  age_at_transfer?: string;
  weight_at_transfer_kg?: string | number | null;
  animal_description?: string;
  purchase_price?: string | number | null;
  previous_owner_name?: string;
  previous_owner_address?: string;
  external_seller_name?: string;
  external_seller_address?: string;
  new_owner_name?: string;
  new_owner_address?: string;
  external_owner_name?: string;
  external_owner_address?: string;
  municipality?: string;
  province?: string;
  origin_municipality?: string;
  origin_province?: string;
  municipality_brand?: string;
  owner_brand?: string;
  status?: string;
};

interface OwnershipTransferCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: TransferCertificateData | null;
  allTransfers?: TransferCertificateData[];
}

/** Converts integer numbers to English words */
function numberToEnglishWords(num: number): string {
  if (num === 0) return "Zero";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? "-" + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + inWords(n % 100) : "");
    if (n < 1000000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + inWords(n % 1000) : "");
    if (n < 1000000000) return inWords(Math.floor(n / 1000000)) + " Million" + (n % 1000000 !== 0 ? " " + inWords(n % 1000000) : "");
    return n.toString();
  }
  return inWords(num);
}

/** Converts integer numbers to Filipino words */
function numberToFilipinoWords(num: number): string {
  if (num === 0) return "Wala";
  const ones = ["", "Isa", "Dalawa", "Tatlo", "Apat", "Lima", "Anim", "Pito", "Walo", "Siyam"];
  const teens = ["Sampu", "Labing-isa", "Labindalawa", "Labintatlo", "Labing-apat", "Labinlima", "Labing-anim", "Labimpito", "Labingwalo", "Labinsiyam"];
  const tens = ["", "Sampu", "Dalawampu", "Tatlumpu", "Apatnapu", "Limampu", "Animnapu", "Pitumpu", "Walumpu", "Siyamnapu"];

  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const rem = n % 10;
      return tens[Math.floor(n / 10)] + (rem ? "'t " + ones[rem] : "");
    }
    if (n < 1000) {
      const hundreds = Math.floor(n / 100);
      const rem = n % 100;
      const hWord = hundreds === 1 ? "Sandaan" : ones[hundreds] + " na raan";
      return hWord + (rem ? " at " + convert(rem) : "");
    }
    if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const rem = n % 1000;
      const tWord = thousands === 1 ? "Isang Libo" : convert(thousands) + "ng Libo";
      return tWord + (rem ? " at " + convert(rem) : "");
    }
    return numberToEnglishWords(n);
  }

  return convert(num);
}

export function OwnershipTransferCertificateDialog({
  open,
  onOpenChange,
  transfer: initialTransfer,
  allTransfers = [],
}: OwnershipTransferCertificateDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [copyType, setCopyType] = useState<"DUPLICATE" | "ORIGINAL" | "TRIPLICATE">("DUPLICATE");
  const [paperTheme, setPaperTheme] = useState<"pink" | "white">("pink");
  const [showSignatorySettings, setShowSignatorySettings] = useState(false);

  // Editable Municipal Officials
  const [treasurerName, setTreasurerName] = useState("CYNTHIA L. RAMOS");
  const [treasurerTitle, setTreasurerTitle] = useState("Ingat-yaman ng Bayan / Municipal Treasurer");
  const [mayorName, setMayorName] = useState("MICHAEL ANGELO C. RIVERA");
  const [secretaryName, setSecretaryName] = useState("ELIZABETH M. KALAW");

  const activeTransfer = useMemo(() => {
    if (selectedId && allTransfers.length > 0) {
      const found = allTransfers.find((t) => t.id === selectedId);
      if (found) return found;
    }
    return initialTransfer;
  }, [selectedId, allTransfers, initialTransfer]);

  // Serial Number parsing (e.g., "BTG-2026-000001", "1942301", or custom paper booklet)
  const serialNumberFormatted = useMemo(() => {
    if (!activeTransfer?.transfer_certificate_number) return "2026-000001";
    const cert = activeTransfer.transfer_certificate_number.trim();
    // If the certificate starts with "BTG-" or "BTG ", remove the prefix because the pre-printed template already has "NO. BTG "
    const cleanCert = cert
      .replace(/^(NO\.?\s*)?BTG[-\s]?/i, "")
      .replace(/^CTLC[-\s]?/i, "")
      .trim();
    return cleanCert || cert;
  }, [activeTransfer]);

  // Format Date (Petsa)
  const formattedDate = useMemo(() => {
    if (!activeTransfer?.transfer_date) {
      const today = new Date();
      return {
        month: String(today.getMonth() + 1),
        day: String(today.getDate()),
        year: String(today.getFullYear()),
        full: today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      };
    }
    const parts = activeTransfer.transfer_date.split("-");
    if (parts.length === 3) {
      return {
        month: parts[1].replace(/^0/, ""),
        day: parts[2].replace(/^0/, ""),
        year: parts[0],
        full: new Date(activeTransfer.transfer_date + "T00:00:00").toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    }
    return { month: "—", day: "—", year: "2026", full: activeTransfer.transfer_date };
  }, [activeTransfer]);

  // Seller Details
  const sellerName = activeTransfer?.previous_owner_name || activeTransfer?.external_seller_name || "G. A. Recto";
  const sellerAddress =
    activeTransfer?.previous_owner_address ||
    activeTransfer?.external_seller_address ||
    (activeTransfer?.origin_municipality
      ? `${activeTransfer.origin_municipality}, ${activeTransfer.origin_province || "Batangas"}`
      : "Brgy. San Jose, Padre Garcia, Batangas");

  // Buyer Details
  const buyerName = activeTransfer?.new_owner_name || activeTransfer?.external_owner_name || "Calamba Laguna Buyer";
  const buyerAddress =
    activeTransfer?.new_owner_address ||
    activeTransfer?.external_owner_address ||
    (activeTransfer?.municipality
      ? `${activeTransfer.municipality}, ${activeTransfer.province || "Batangas"}`
      : "Padre Garcia, Batangas");

  // Purchase Price & Words
  const priceValue = activeTransfer?.purchase_price ? Number(activeTransfer.purchase_price) : 0;
  const priceWords = useMemo(() => {
    if (priceValue > 0) {
      const filipino = numberToFilipinoWords(Math.round(priceValue));
      const english = numberToEnglishWords(Math.round(priceValue));
      return `${filipino} (${english})`.toUpperCase();
    }
    return "LABING-APAT NA LIBO (FOURTEEN THOUSAND)";
  }, [priceValue]);

  // Animal Characteristics
  const animalSex = (activeTransfer?.sex_at_transfer || "Female").toUpperCase();
  const animalAge = activeTransfer?.age_at_transfer || "3";
  const animalSpecies = activeTransfer?.livestock_type_name || "Baka (Cattle)";
  const animalBreed = activeTransfer?.breed_at_transfer || "Brahman Cross";
  const animalTag = activeTransfer?.livestock_tag || "";
  const animalWeight = activeTransfer?.weight_at_transfer_kg ? `${activeTransfer.weight_at_transfer_kg} kg` : "";
  const animalDescription =
    activeTransfer?.animal_description ||
    [animalSpecies, animalBreed, animalTag ? `Tag: ${animalTag}` : null, animalWeight]
      .filter(Boolean)
      .join(" · ");

  // Original COLC Certificate Reference
  const originalColc = activeTransfer?.original_certificate_number || "0194608";
  const originalBayan = activeTransfer?.origin_municipality || "Padre Garcia";
  const originalLalawigan = activeTransfer?.origin_province || "Batangas";

  // Brands
  const muniBrand = activeTransfer?.municipality_brand || "PG";
  const ownerBrand = activeTransfer?.owner_brand || "—";

  const handlePrint = () => {
    window.print();
  };

  if (!activeTransfer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96dvh] max-w-4xl overflow-y-auto p-4 sm:p-6 print:p-0 print:border-none print:shadow-none print:max-h-none print:max-w-none print:w-full print:m-0">
        {/* Dialog Header — Hidden during Print */}
        <DialogHeader className="print:hidden">
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <FileText className="size-5 text-emerald-700" />
            Official Certificate of Transfer of Large Cattle (COLC Transfer)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Accountable Form No. 52 (Revised January 1992) — Republic of the Philippines, Province of Batangas, Municipality of Padre Garcia.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar Controls — Hidden during Print */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Record Switcher Dropdown if allTransfers provided */}
            {allTransfers.length > 0 && (
              <div className="w-56">
                <Select
                  value={String(activeTransfer.id)}
                  onValueChange={(val) => setSelectedId(Number(val))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Record" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {allTransfers.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)} className="text-xs">
                        {t.transfer_certificate_number} · {t.livestock_tag || t.livestock_type_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Copy Type Badge Dropdown */}
            <div className="w-32">
              <Select
                value={copyType}
                onValueChange={(val) => setCopyType(val as "DUPLICATE" | "ORIGINAL" | "TRIPLICATE")}
              >
                <SelectTrigger className="h-9 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ORIGINAL" className="text-xs font-bold">
                    ORIGINAL
                  </SelectItem>
                  <SelectItem value="DUPLICATE" className="text-xs font-bold">
                    DUPLICATE
                  </SelectItem>
                  <SelectItem value="TRIPLICATE" className="text-xs font-bold">
                    TRIPLICATE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Paper Theme Toggle */}
            <div className="w-36">
              <Select
                value={paperTheme}
                onValueChange={(val) => setPaperTheme(val as "pink" | "white")}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pink" className="text-xs">
                    Authentic Pink Form
                  </SelectItem>
                  <SelectItem value="white" className="text-xs">
                    Plain White (Stationery)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Signatory Names Settings Toggle */}
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
              className="h-9 bg-[#1E4D2B] hover:bg-[#163a20] text-white text-xs font-bold px-4 gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Printer className="size-4" />
              Print / Save as PDF
            </Button>
          </div>
        </div>

        {/* Collapsible Signatory Customization Bar */}
        {showSignatorySettings && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5 print:hidden animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Custom Signatory Names for Padre Garcia
              </span>
              <span className="text-[11px] text-slate-500">Edit values before printing</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] text-slate-500 font-bold">Municipal Treasurer</Label>
                <Input
                  value={treasurerName}
                  onChange={(e) => setTreasurerName(e.target.value)}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 font-bold">Municipal Mayor</Label>
                <Input
                  value={mayorName}
                  onChange={(e) => setMayorName(e.target.value)}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 font-bold">Municipal Secretary</Label>
                <Input
                  value={secretaryName}
                  onChange={(e) => setSecretaryName(e.target.value)}
                  className="h-8 text-xs bg-white mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* PRINTABLE OFFICIAL CERTIFICATE CONTAINER                            */}
        {/* Exact Replica of Physical Accountable Form No. 52 (Pink Government Sheet) */}
        {/* =================================================================== */}
        <div className="w-full flex justify-center py-2 print:py-0 print:m-0">
          <div
            id="ownership-transfer-certificate-sheet"
            className={`w-full max-w-[760px] p-6 sm:p-8 font-serif text-[11px] leading-relaxed text-black shadow-md border print:shadow-none print:border-none print:p-4 print:max-w-none transition-colors ${
              paperTheme === "pink"
                ? "bg-[#fed7e2] print:bg-[#fed7e2] border-pink-200"
                : "bg-white print:bg-white border-slate-200"
            }`}
            style={{
              fontFamily: "'Times New Roman', Times, Georgia, serif",
              color: "#111827",
            }}
          >
            {/* 1. Header Bar: Form Metadata, Seals, and Duplicate / Serial Number */}
            <div className="flex items-start justify-between gap-2 border-b border-black/30 pb-2 mb-3">
              {/* Left: Accountable Form Metadata & Batangas Province Seal */}
              <div className="flex items-center gap-2.5">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold tracking-tight">Accountable Form No. 52</p>
                  <p className="text-[9px] italic text-black/80">Revised January 1992</p>
                  {/* Stylized BIR 10 Stamp */}
                  <div className="inline-flex items-center justify-center border border-black/60 px-1 py-0.2 rounded-xs mt-0.5">
                    <span className="text-[8px] font-bold font-mono">BIR ₱10 STAMP</span>
                  </div>
                </div>

                {/* Batangas Seal */}
                <div className="size-14 relative flex items-center justify-center">
                  <Image
                    src="/images/batangas-seal.png"
                    alt="Lalawigan ng Batangas Seal"
                    width={56}
                    height={56}
                    className="size-14 object-contain"
                    unoptimized
                  />
                </div>
              </div>

              {/* Center: LGU Header Titles */}
              <div className="text-center flex-1 px-1">
                <p className="text-[10px] italic">Republic of the Philippines</p>
                <p className="text-[13px] font-bold tracking-wide uppercase">PROVINCE OF BATANGAS</p>
                <p className="text-[11px] font-semibold uppercase">
                  MUNICIPALITY OF <span className="font-bold underline">PADRE GARCIA</span>
                </p>
              </div>

              {/* Right: Padre Garcia Seal, Copy Badge, and Red Serial Number */}
              <div className="flex items-center gap-2 text-right">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-black uppercase tracking-wider">{copyType}</p>
                  <p className="font-mono text-xs font-black tracking-tight text-[#b91c1c] print:text-[#b91c1c]">
                    NO. BTG <span className="text-sm">{serialNumberFormatted}</span>
                  </p>
                </div>

                {/* Padre Garcia Seal */}
                <div className="size-14 relative flex items-center justify-center">
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
            <div className="text-center my-3">
              <h1 className="text-base sm:text-[17px] font-black tracking-wide uppercase leading-tight">
                KATIBAYAN NG PAGLILIPAT NG PAGMAMAY-ARI NG MALALAKING BAKA
              </h1>
              <p className="text-[11px] font-bold uppercase tracking-wider text-black/90 mt-0.5">
                CERTIFICATE OF TRANSFER OF OWNERSHIP OF LARGE CATTLE
              </p>
            </div>

            {/* 3. Petsa (Date) */}
            <div className="flex justify-end mb-3 text-xs">
              <div className="text-center min-w-36">
                <p className="border-b border-black font-bold font-mono px-3 py-0.5">
                  {formattedDate.month} / {formattedDate.day} / {formattedDate.year}
                </p>
                <p className="text-[9px] text-black/80 font-sans tracking-wide mt-0.5">
                  (Petsa) · (Date)
                </p>
              </div>
            </div>

            {/* 4. Body Content Paragraphs with Authentic Underlined Blank Lines */}
            <div className="space-y-3 text-[11.5px] leading-[1.8]">
              {/* Seller */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">Pinatutunayan ng Katibayang ito na si G.</span>
                <span className="font-bold border-b border-black flex-1 min-w-56 px-2 text-center uppercase tracking-wide">
                  {sellerName}
                </span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                This Certificate witnesseth that Mr.
              </div>

              {/* Seller Address */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">na nakatira sa</span>
                <span className="font-semibold border-b border-black flex-1 min-w-64 px-2 text-center">
                  {sellerAddress}
                </span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                a resident of · (Tirahan / Address)
              </div>

              {/* Conveyance to Buyer */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">bilang may-ari, ay inililipat kay G.</span>
                <span className="font-bold border-b border-black flex-1 min-w-56 px-2 text-center uppercase tracking-wide">
                  {buyerName}
                </span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                as owner, has conveyed to Mr.
              </div>

              {/* Buyer Address */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">na nakatira sa</span>
                <span className="font-semibold border-b border-black flex-1 min-w-64 px-2 text-center">
                  {buyerAddress}
                </span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                a resident of · (Tirahan / Address)
              </div>

              {/* Purchase Price in Words */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">na siyang bumibili sa halagang</span>
                <span className="font-bold border-b border-black flex-1 min-w-64 px-2 text-center">
                  {priceWords}
                </span>
                <span className="font-medium">piso</span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                as purchaser, for the sum of · (pesos)
              </div>

              {/* Purchase Price in Figures & Intro to Description */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">(₱</span>
                <span className="font-bold font-mono border-b border-black min-w-32 px-3 text-center">
                  {priceValue > 0 ? priceValue.toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "14,000.00"}
                </span>
                <span className="font-medium">) na ang paglalarawan at katangian ay ayon sa sumusunod:</span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                and the description and characteristics of which are as follows:
              </div>

              {/* Animal Specifications: Sex, Age, Description */}
              <div className="pt-1.5 flex flex-wrap items-baseline gap-3">
                <div className="flex items-baseline gap-1 flex-1 min-w-36">
                  <span className="font-bold">Paglalarawan: Kasarian</span>
                  <span className="font-bold border-b border-black flex-1 px-2 text-center uppercase">
                    {animalSex}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 min-w-40">
                  <span className="font-bold">Gulang</span>
                  <span className="font-bold border-b border-black min-w-20 px-2 text-center font-mono">
                    {animalAge}
                  </span>
                  <span className="font-bold">Taon,</span>
                </div>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2 flex justify-between pr-8">
                <span>Description: Sex</span>
                <span>Age Years,</span>
              </div>

              {/* Detailed Animal Description / Breed / Ear Tag */}
              <div className="flex flex-wrap items-baseline gap-1 pt-0.5">
                <span className="font-medium">Katangian / Marka:</span>
                <span className="font-semibold border-b border-black flex-1 min-w-64 px-2">
                  {animalDescription}
                </span>
              </div>

              {/* Original COLC Reference Certificate */}
              <div className="flex flex-wrap items-baseline gap-1 pt-1.5">
                <span className="font-medium">na ang orihinal na Katibayan ng Pagmamay-ari Blg.</span>
                <span className="font-bold font-mono border-b border-black flex-1 min-w-40 px-2 text-center text-[12px]">
                  {originalColc}
                </span>
                <span className="font-medium">ay inilathala ng</span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                for which animal original Certificate Ownership No. was issued by the
              </div>

              {/* Issuing Municipality & Province */}
              <div className="flex flex-wrap items-baseline gap-2">
                <div className="flex items-baseline gap-1 flex-1 min-w-44">
                  <span className="font-medium">Bayan ng</span>
                  <span className="font-bold border-b border-black flex-1 px-2 text-center">
                    {originalBayan}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 flex-1 min-w-44">
                  <span className="font-medium">, Lalawigan ng</span>
                  <span className="font-bold border-b border-black flex-1 px-2 text-center">
                    {originalLalawigan}
                  </span>
                </div>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2 flex justify-around">
                <span>City of / Municipality of</span>
                <span>Province of</span>
              </div>

              {/* Issuance Date */}
              <div className="flex flex-wrap items-baseline gap-1">
                <span className="font-medium">sa ilalim ng petsang</span>
                <span className="font-bold font-mono border-b border-black min-w-28 px-2 text-center">
                  {formattedDate.month} / {formattedDate.day}
                </span>
                <span className="font-medium">, 20</span>
                <span className="font-bold font-mono border-b border-black min-w-14 px-1 text-center">
                  {formattedDate.year.slice(-2)}
                </span>
                <span className="font-medium">.</span>
              </div>
              <div className="text-[9px] italic text-black/70 -mt-2">
                Under the date of
              </div>
            </div>

            {/* 5. Brands Section (Palatandaan ng Bayan / May-ari) */}
            <div className="grid grid-cols-2 gap-8 my-5 pt-2">
              <div className="text-center">
                <div className="border-b border-black min-h-8 flex items-end justify-center font-bold text-xs pb-0.5">
                  {muniBrand}
                </div>
                <p className="text-[10.5px] font-bold mt-1">Palatandaan ng Bayan</p>
                <p className="text-[8.5px] text-black/70 italic">Brand of Municipality</p>
              </div>

              <div className="text-center">
                <div className="border-b border-black min-h-8 flex items-end justify-center font-bold text-xs pb-0.5">
                  {ownerBrand}
                </div>
                <p className="text-[10.5px] font-bold mt-1">Palatandaan ng May-ari</p>
                <p className="text-[8.5px] text-black/70 italic">Brand of Owner</p>
              </div>
            </div>

            {/* 6. Signatures Grid (Owner, Buyer, Treasurer, Mayor, Secretary) */}
            <div className="grid grid-cols-2 gap-8 my-4 pt-1">
              {/* Left Column: Signatures of Parties (Owner & Buyer) */}
              <div className="space-y-6">
                <div className="text-center pt-4">
                  <div className="border-b border-black min-h-7 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                    {sellerName}
                  </div>
                  <p className="text-[10.5px] font-bold mt-0.5">Lagda ng May-ari</p>
                  <p className="text-[8.5px] text-black/70 italic">Signature of Owner</p>
                </div>

                <div className="text-center pt-3">
                  <div className="border-b border-black min-h-7 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                    {buyerName}
                  </div>
                  <p className="text-[10.5px] font-bold mt-0.5">Lagda ng Bumibili</p>
                  <p className="text-[8.5px] text-black/70 italic">Signature of Buyer</p>
                </div>
              </div>

              {/* Right Column: Municipal Officials */}
              <div className="space-y-4">
                <div className="text-center">
                  <div className="border-b border-black min-h-7 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                    {treasurerName}
                  </div>
                  <p className="text-[10.5px] font-bold mt-0.5">Ingat-yaman ng Bayan</p>
                  <p className="text-[8.5px] text-black/70 italic">Municipal Treasurer</p>
                </div>

                <div className="text-center pt-1">
                  <p className="text-[9.5px] font-bold uppercase tracking-wide text-left mb-1">
                    Nilagdaan: <span className="font-normal italic text-[8.5px]">Countersigned:</span>
                  </p>
                  <div className="border-b border-black min-h-6 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                    {mayorName}
                  </div>
                  <p className="text-[10px] font-bold mt-0.5">Punong-Bayan</p>
                  <p className="text-[8.5px] text-black/70 italic">Municipal Mayor</p>
                </div>

                <div className="text-center pt-1">
                  <div className="border-b border-black min-h-6 flex items-end justify-center font-bold text-xs pb-0.5 uppercase tracking-wide">
                    {secretaryName}
                  </div>
                  <p className="text-[10px] font-bold mt-0.5">Kalihim ng Bayan</p>
                  <p className="text-[8.5px] text-black/70 italic">Municipal Secretary</p>
                </div>
              </div>
            </div>

            {/* 7. Bottom Legal Notice Box (Exact Reproduction of Historical Code Text) */}
            <div className="border-t border-black/30 pt-3 mt-4 text-[8.5px] leading-tight text-black/85 space-y-1">
              <p className="text-justify font-sans leading-normal">
                <strong>PABATID</strong> — Ang katibayang ito ay inilathala sa ilalim ng pagtatadhana ng mga Seksiyon 511-536, Alituntuning Pampangasiwaan, 1917. Ang halaga ng paglalathala at lahat ng paglilingkod ng mga pinuno at kawani ng lungsod na may kaugnayan dito ay sampung piso (₱10.00) at hindi hihigit dito. (Sek. 528 ng mga Alituntuning Pampangasiwaan na sinusugan ng mga Batas Panrepublika Blg. 231 at 568.)
              </p>
              <p className="text-justify font-sans leading-normal italic text-black/75">
                <strong>NOTICE</strong> — This certificate corresponding thereto is issued under the provisions of Sections 511-536, Administrative Code 1917. The charge for its issuance and all services of municipal officials and employees in connection therewith, is ten pesos (₱10.00) and no more. (Sec. 528 of the Administrative Code as amended by Republic Act Nos. 231 and 568.)
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
