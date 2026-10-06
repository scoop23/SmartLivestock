"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createInspection } from "./auction-analytics";
import api from "@/lib/axios";

interface NewInspectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess: () => void;
  nextId: number;
}

interface LivestockTypeOption {
  id: number;
  name: string;
}

export function NewInspectionDialog({
  isOpen,
  onOpenChange,
  onSubmitSuccess,
}: NewInspectionDialogProps) {
  const [shipperName, setShipperName] = useState("");
  const [shipperAddress, setShipperAddress] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState<"SLAUGHTER" | "BREEDING" | "FATTENING" | "OTHER">("SLAUGHTER");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [plateNumber, setPlateNumber] = useState("");
  const [handlerLicense, setHandlerLicense] = useState("");
  const [speciesOptions, setSpeciesOptions] = useState<LivestockTypeOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [items, setItems] = useState<
    {
      livestock_type: number;
      quantity: number;
      sex: "MALE" | "FEMALE" | "MIXED";
      classification: "SLAUGHTER" | "BREEDER" | "FATTENING" | "OTHER";
      remarks: string;
    }[]
  >([
    {
      livestock_type: 1,
      quantity: 1,
      sex: "MALE",
      classification: "SLAUGHTER",
      remarks: "",
    },
  ]);

  // Load available livestock types from backend
  useEffect(() => {
    async function loadTypes() {
      try {
        const res = await api.get<LivestockTypeOption[]>("/livestock/livestock_types/");
        if (Array.isArray(res.data) && res.data.length > 0) {
          setSpeciesOptions(res.data);
          setItems((prev) =>
            prev.map((it) => ({
              ...it,
              livestock_type: res.data[0].id,
            }))
          );
        }
      } catch {
        // Fallback default options
        setSpeciesOptions([
          { id: 1, name: "Cattle (Baka)" },
          { id: 2, name: "Carabao (Kalabaw)" },
          { id: 3, name: "Goat (Kambing)" },
          { id: 4, name: "Sheep (Tupa)" },
          { id: 5, name: "Swine (Baboy)" },
        ]);
      }
    }
    if (isOpen) {
      loadTypes();
    }
  }, [isOpen]);

  const handleAddItem = () => {
    const defaultTypeId = speciesOptions[0]?.id || 1;
    setItems((prev) => [
      ...prev,
      {
        livestock_type: defaultTypeId,
        quantity: 1,
        sex: "MIXED",
        classification: "SLAUGHTER",
        remarks: "",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (
    index: number,
    field: string,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createInspection({
        shipper_name: shipperName.trim(),
        shipper_address: shipperAddress.trim() || "Padre Garcia, Batangas",
        origin: shipperAddress.trim() || "Padre Garcia, Batangas",
        destination: destination.trim(),
        purpose: purpose,
        inspection_date: inspectionDate,
        vehicle_plate_number: plateNumber.trim() || "N/A",
        livestock_handler_license_no: handlerLicense.trim() || "N/A",
        items: items.map((it) => ({
          livestock_type: Number(it.livestock_type),
          quantity: Number(it.quantity) || 1,
          sex: it.sex,
          classification: it.classification,
          remarks: it.remarks.trim(),
        })),
      });

      onSubmitSuccess();
      onOpenChange(false);

      // Reset Form
      setShipperName("");
      setShipperAddress("");
      setDestination("");
      setPlateNumber("");
      setHandlerLicense("");
      setItems([
        {
          livestock_type: speciesOptions[0]?.id || 1,
          quantity: 1,
          sex: "MALE",
          classification: "SLAUGHTER",
          remarks: "",
        },
      ]);
    } catch (err: any) {
      const respData = err?.response?.data;
      if (typeof respData === "object" && respData !== null) {
        const firstErrorKey = Object.keys(respData)[0];
        const val = respData[firstErrorKey];
        setErrorMsg(Array.isArray(val) ? val[0] : String(val));
      } else {
        setErrorMsg("Failed to create inspection clearance. Please check your connection.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="p-5 sm:p-6 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-t-3xl">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-300" />
            New Livestock Inspection Clearance
          </DialogTitle>
          <DialogDescription className="text-purple-100 text-xs font-medium">
            Encode pre-movement animal inspection findings for municipal veterinary review.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Shipper & Transit details */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              1. Shipper & Destination Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Shipper Name *</label>
                <Input
                  placeholder="e.g. Juan Dela Cruz"
                  value={shipperName}
                  onChange={(e) => setShipperName(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Destination *</label>
                <Input
                  placeholder="e.g. Batangas City Slaughterhouse"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Purpose</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold"
                >
                  <option value="SLAUGHTER">Slaughter (Katayan)</option>
                  <option value="BREEDING">Breeding (Palahi)</option>
                  <option value="FATTENING">Fattening (Papatabain)</option>
                  <option value="OTHER">Other Purpose</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Inspection Date *</label>
                <Input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Shipper Origin / Address</label>
                <Input
                  placeholder="e.g. Purok 2, Brgy. Manggas, Padre Garcia"
                  value={shipperAddress}
                  onChange={(e) => setShipperAddress(e.target.value)}
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Vehicle Plate Number</label>
                <Input
                  placeholder="e.g. NDB-8421"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Handler License No.</label>
                <Input
                  placeholder="e.g. LHL-2026-4412"
                  value={handlerLicense}
                  onChange={(e) => setHandlerLicense(e.target.value)}
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Livestock items breakdown */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                2. Inspected Livestock Items ({items.length})
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="rounded-xl text-xs font-bold gap-1 text-[#7C3AED] border-purple-200 hover:bg-purple-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Animal
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700">Animal Line #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Species</label>
                      <select
                        value={item.livestock_type}
                        onChange={(e) => handleUpdateItem(idx, "livestock_type", Number(e.target.value))}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        {speciesOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Head Count</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(idx, "quantity", Number(e.target.value))}
                        className="h-9 rounded-lg bg-white text-xs font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Sex</label>
                      <select
                        value={item.sex}
                        onChange={(e) => handleUpdateItem(idx, "sex", e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="MIXED">Mixed</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Class</label>
                      <select
                        value={item.classification}
                        onChange={(e) => handleUpdateItem(idx, "classification", e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="SLAUGHTER">Slaughter</option>
                        <option value="BREEDER">Breeder</option>
                        <option value="FATTENING">Fattening</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  <Input
                    placeholder="Optional animal health remarks / ear tags"
                    value={item.remarks}
                    onChange={(e) => handleUpdateItem(idx, "remarks", e.target.value)}
                    className="h-8 rounded-lg bg-white text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-200 flex-col sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl cursor-pointer w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold cursor-pointer w-full sm:w-auto gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : (
                "Submit Inspection Clearance"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
