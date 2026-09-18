"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  User,
  Phone,
  Tag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Copy,
  FileSpreadsheet,
  Layers,
  Milk,
  TrendingUp,
  Scale,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { DataTab } from "./data-overview-types";

interface DataOverviewDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any | null;
  domain: DataTab;
}

export function DataOverviewDetailModal({
  open,
  onOpenChange,
  record,
  domain,
}: DataOverviewDetailModalProps) {
  if (!record) return null;

  const handleCopyTag = () => {
    const textToCopy = record.cattleId || record.id || "";
    navigator.clipboard.writeText(textToCopy);
    toast.success(`Copied "${textToCopy}" to clipboard`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-3xl rounded-2xl p-0 overflow-hidden border border-slate-200/80 shadow-2xl bg-white">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-[#1E3D1A] text-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <Badge className="bg-white/20 text-white border-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
              {domain.toUpperCase()} MASTER RECORD
            </Badge>
            <span className="text-xs font-mono font-bold text-emerald-200">
              {record.id}
            </span>
          </div>

          <div className="mt-2.5">
            <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              {record.cattleId ? (
                <>
                  <Tag className="w-4 h-4 text-emerald-300" />
                  <span>{record.cattleId}</span>
                </>
              ) : (
                <span>{record.product || record.disease || record.quarter || record.id}</span>
              )}
            </h2>
            <p className="text-[11px] text-emerald-100/80 mt-0.5">
              Padre Garcia Municipal Agriculture Office — Official Certified Ledger Entry
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 max-h-[75vh] overflow-y-auto">
          {/* Farmer & Location Section */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Farmer / Registered Raiser
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#2D5A27]" />
                {record.farmerName || record.enumerator || record.buyer || "MAO Registry"}
              </p>
              {record.farmerContact && (
                <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {record.farmerContact}
                </p>
              )}
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Sector Location
              </span>
              <p className="text-sm font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2D5A27]" />
                Brgy. {record.barangay}
                {record.purok ? ` (${record.purok})` : ""}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Padre Garcia, Batangas
              </p>
            </div>
          </div>

          {/* Technical Specifications Grid */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Record Specification & Metrics
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {record.specie && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Specie</span>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{record.specie}</p>
                </div>
              )}

              {record.breed && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Breed</span>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{record.breed}</p>
                </div>
              )}

              {record.sex && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Sex / Gender</span>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{record.sex}</p>
                </div>
              )}

              {record.ageMonths !== undefined && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Age</span>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{record.ageMonths} Months</p>
                </div>
              )}

              {record.entryType && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Entry Type</span>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{record.entryType}</p>
                </div>
              )}

              {record.lastVaccinationDate && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Last Vaccination</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{record.lastVaccinationDate}</p>
                </div>
              )}

              {record.weightKg && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Live Weight</span>
                  <p className="text-xs font-black text-slate-900 mt-0.5">{record.weightKg} kg</p>
                </div>
              )}

              {record.rfidTag && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">RFID Tag No.</span>
                  <p className="text-xs font-mono font-black text-blue-700 mt-0.5">{record.rfidTag}</p>
                </div>
              )}

              {record.quantity && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Quantity / Heads</span>
                  <p className="text-xs font-black text-[#2D5A27] mt-0.5">{record.quantity}</p>
                </div>
              )}

              {record.estValuePhp !== undefined && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Est. Market Value</span>
                  <p className="text-xs font-black text-emerald-800 mt-0.5">
                    ₱{record.estValuePhp.toLocaleString()}
                  </p>
                </div>
              )}

              {record.amount && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Hammer / Sale Price</span>
                  <p className="text-xs font-black text-emerald-800 mt-0.5">{record.amount}</p>
                </div>
              )}

              {record.transportPermitNumber && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Transport Permit</span>
                  <p className="text-xs font-mono font-black text-slate-800 mt-0.5">
                    {record.transportPermitNumber}
                  </p>
                </div>
              )}

              {record.disease && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Reported Condition</span>
                  <p className="text-xs font-black text-rose-700 mt-0.5">{record.disease}</p>
                </div>
              )}

              {record.veterinarian && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Attending Vet</span>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{record.veterinarian}</p>
                </div>
              )}

              {record.inspectionCertNo && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Meat Cert #</span>
                  <p className="text-xs font-mono font-black text-amber-800 mt-0.5">
                    {record.inspectionCertNo}
                  </p>
                </div>
              )}

              {record.totalHeads && (
                <div className="p-3 rounded-lg bg-white border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400">Total Surveyed</span>
                  <p className="text-xs font-black text-emerald-800 mt-0.5">
                    {record.totalHeads.toLocaleString()} heads
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes or Symptoms */}
          {(record.notes || (record.symptoms && record.symptoms.length > 0)) && (
            <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-xs">
              <strong className="text-amber-900 font-bold block mb-1">
                Clinical Observations / Special Notes:
              </strong>
              {record.symptoms && record.symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {record.symptoms.map((sym: string) => (
                    <Badge key={sym} className="bg-amber-100 text-amber-900 border-0 text-[9px] px-1.5 py-0.2">
                      {sym}
                    </Badge>
                  ))}
                </div>
              )}
              {record.notes && <p className="text-amber-900/90">{record.notes}</p>}
            </div>
          )}

          {/* Verification Stamps */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Verified MAO Entry &bull; Date:{" "}
                <strong>
                  {record.date || record.registrationDate || record.submissionDate || "2026-04-20"}
                </strong>
              </span>
            </div>
            <Badge className="bg-emerald-100 text-emerald-900 border-0 text-[9px] font-black px-1.5 py-0.2">
              OFFICIALLY CERTIFIED
            </Badge>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyTag}
              className="rounded-lg text-xs font-bold border-slate-300 gap-1.5 h-8"
            >
              <Copy className="w-3 h-3" />
              <span>Copy Identifier</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-lg text-xs font-bold border-slate-300 gap-1.5 h-8"
            >
              <Printer className="w-3 h-3" />
              <span>Print Record</span>
            </Button>
          </div>

          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#2D5A27] hover:bg-[#23461f] text-white rounded-lg text-xs font-bold px-4 h-8"
          >
            Close Inspector
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
