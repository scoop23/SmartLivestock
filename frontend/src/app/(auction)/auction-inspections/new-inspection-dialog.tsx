"use client";

import { useState } from "react";
import { ClipboardCheck, Plus, Trash2 } from "lucide-react";
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
import { InspectionItem, InspectionRecord } from "./auction-analytics";

interface NewInspectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitSuccess: (newRecord: InspectionRecord) => void;
  nextId: number;
}

export function NewInspectionDialog({
  isOpen,
  onOpenChange,
  onSubmitSuccess,
  nextId,
}: NewInspectionDialogProps) {
  const [shipperName, setShipperName] = useState("");
  const [shipperAddress, setShipperAddress] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState<InspectionRecord["purpose"]>("SLAUGHTER");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [plateNumber, setPlateNumber] = useState("");
  const [handlerLicense, setHandlerLicense] = useState("");
  const [items, setItems] = useState<InspectionItem[]>([
    {
      livestock_type: "Cattle (Baka)",
      quantity: 1,
      sex: "MALE",
      classification: "SLAUGHTER",
      remarks: "",
    },
  ]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        livestock_type: "Cattle (Baka)",
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
    field: keyof InspectionItem,
    value: any
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: InspectionRecord = {
      id: Date.now(),
      control_number: `CLR-2026-${String(nextId).padStart(4, "0")}`,
      shipper_name: shipperName,
      shipper_address: shipperAddress || "Padre Garcia, Batangas",
      origin: "Padre Garcia, Batangas",
      destination: destination,
      purpose: purpose,
      inspection_date: inspectionDate,
      date_issued: inspectionDate,
      time_issued: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      vehicle_plate_number: plateNumber || "N/A",
      livestock_handler_license_no: handlerLicense || "N/A",
      status: "PENDING",
      items: items,
    };

    onSubmitSuccess(newRecord);
    onOpenChange(false);

    // Reset Form
    setShipperName("");
    setShipperAddress("");
    setDestination("");
    setItems([
      {
        livestock_type: "Cattle (Baka)",
        quantity: 1,
        sex: "MALE",
        classification: "SLAUGHTER",
        remarks: "",
      },
    ]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-0">
        <DialogHeader className="p-6 bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white rounded-t-3xl">
          <DialogTitle className="text-lg font-black flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-300" />
            New Livestock Inspection Clearance
          </DialogTitle>
          <DialogDescription className="text-purple-100 text-xs font-medium">
            Record live animal transit permits, shipper credentials, and veterinary health checks.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Shipper & Transit details */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              1. Shipper & Destination Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Shipper Name</label>
                <Input
                  placeholder="e.g. Juan Dela Cruz"
                  value={shipperName}
                  onChange={(e) => setShipperName(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-500">Destination</label>
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
                <label className="text-[10px] font-bold uppercase text-slate-500">Inspection Date</label>
                <Input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  required
                  className="h-10 rounded-xl bg-slate-50"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold uppercase text-slate-500">Shipper Address</label>
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
                className="rounded-xl text-xs font-bold gap-1 text-[#7C3AED] border-purple-200 hover:bg-purple-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add Animal
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-600">Animal #{idx + 1}</span>
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
                        onChange={(e) => handleUpdateItem(idx, "livestock_type", e.target.value)}
                        className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      >
                        <option value="Cattle (Baka)">Cattle (Baka)</option>
                        <option value="Carabao (Kalabaw)">Carabao (Kalabaw)</option>
                        <option value="Goat (Kambing)">Goat (Kambing)</option>
                        <option value="Sheep (Tupa)">Sheep (Tupa)</option>
                        <option value="Swine (Baboy)">Swine (Baboy)</option>
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

          <DialogFooter className="gap-2 pt-2 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold cursor-pointer"
            >
              Submit Inspection Clearance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
