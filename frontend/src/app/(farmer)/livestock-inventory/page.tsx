"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";


// Lucide Icons
import {
  ArrowLeft,
  Plus,
  Layers,
  FileDown,
  Minus,
} from "lucide-react";

// shadcn/ui primitives (import from your components directory)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import LivestockDetailsDialog from "./livestock-details-dialog";
import LivestockEditDialog from "./livestock-edit-dialog";
import LivestockRecordList from "./livestock-record-list";
import LivestockTypeCards from "./livestock-type-cards";
import InventoryStats from "./inventory-stats";
import api from "@/lib/axios";
import {
  type EntryType,
  type StatusType,
  type LivestockInventoryItem,
  type LivestockType,
  type InventoryApiItem,
  type CreateInventoryPayload,
  type UpdateInventoryPayload,
  mapInventory,
  useLivestockTypes,
  useUserInventory,
} from "./livestock-inventory";

// Re-export types for any existing child components importing from ./page
export type { EntryType, StatusType, LivestockInventoryItem, LivestockType, InventoryApiItem };

export default function LivestockInventoryPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [editTarget, setEditTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data: livestockTypes = {} } = useLivestockTypes();
  const { data: inventories = [], isLoading: IsLoading } = useUserInventory();

  // Form State matching Django LivestockInventory
  const initialFormData = {
    entryType: "BATCH" as EntryType,
    livestockType: "",
    quantity: 1,
    tagNumber: "",
    breed: "",
    sex: "Female",
    weight: "",
    isVaccinated: false,
    lastVaccinationDate: "",
  };
  const [formData, setFormData] = useState(initialFormData);

  // Filter handlers
  const typeFilteredInventories = selectedType
    ? inventories.filter((item) => item.livestockTypeName === selectedType)
    : inventories;

  const addMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/livestock/create/', {
        livestock_type: livestockTypes[formData.livestockType],
        entry_type: formData.entryType,
        quantity: formData.entryType === "INDIVIDUAL" ? 1 : Number(formData.quantity),
        tag_number: formData.tagNumber || "",
        breed: formData.breed,
        sex: formData.sex,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        last_vaccination_date: formData.lastVaccinationDate || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setIsAddOpen(false);
      setFormData(initialFormData);
      toast.success("Livestock entry submitted for approval");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to add livestock entry");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/livestock/inventory_delete/${id}/`, { data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Livestock record deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete livestock record");
    },
  });

  const updateMutation = useMutation({ // update mutation just like in production dashboard.
    mutationFn: async (payload: UpdateInventoryPayload) => {
      if (!editTarget) throw new Error("No record selected");
      const response = await api.put(
        `/livestock/inventory_update/${editTarget.id}`,
        payload
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setEditTarget(null);
      toast.success("Livestock entry updated successfully");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to update livestock entry");
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (formData.entryType === "INDIVIDUAL" && !formData.tagNumber.trim()) {
      setFormError("Tag number is required for individual entries.");
      return;
    }
    if (formData.entryType === "BATCH" && (!formData.quantity || formData.quantity < 1)) {
      setFormError("Quantity must be at least 1 for batch entries.");
      return;
    }
    if (!formData.breed.trim()) {
      setFormError("Breed is required.");
      return;
    }
    if (formData.isVaccinated && !formData.lastVaccinationDate) {
      setFormError("Please provide the last vaccination date or uncheck 'Vaccinated'.");
      return;
    }

    addMutation.mutate();
  };

  const exportCSV = () => {
    const headers = ["Tag Number", "Livestock Type", "Entry Type", "Quantity", "Breed", "Sex", "Weight (kg)", "Last Vaccination", "Status", "Review Remarks", "Created At"];
    const rows = inventories.map((item) => [
      item.tagNumber,
      item.livestockTypeName,
      item.entryType,
      item.quantity,
      item.breed,
      item.sex,
      item.weight ?? "",
      item.lastVaccinationDate ?? "",
      item.status,
      item.reviewRemarks ?? "",
      item.createdAt,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livestock_inventory_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Inventory exported as CSV");
  };

  return (
    <>
      <PageHeader
        title="Livestock Inventory"
        subtitle="Manage your livestock entries and track their status"
        variant="farmer"
        maxWidthClass="max-w-7xl"
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Livestock Records
          </h2>

          <div className="flex self-center items-center gap-2">

            <Button
              variant="outline"
              onClick={exportCSV}
              className="gap-2 border-slate-300 p-6 sm:p-8"
              // disabled={inventories.length === 0}
              disabled
            >
              <FileDown className="w-4 h-4" />
              Export CSV
            </Button>
            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setFormError(""); setFormData(initialFormData) } }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm p-6 sm:p-8">
                  <Plus className="w-4 h-4" />
                  Add Inventory
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">New Livestock Entry</DialogTitle>
                  <DialogDescription>
                    Submit new livestock entries for administrative approval.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
                  {formError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
                      {formError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="entryType">Entry Type</Label>
                      <Select
                        value={formData.entryType}
                        onValueChange={(val: EntryType) =>
                          setFormData({ ...formData, entryType: val })
                        }
                      >
                        <SelectTrigger id="entryType">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BATCH">Batch Entry</SelectItem>
                          <SelectItem value="INDIVIDUAL">Individual Tag</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="livestockType">Livestock Type</Label>
                      <Select
                        value={formData.livestockType}
                        onValueChange={(val) =>
                          setFormData({ ...formData, livestockType: val })
                        }
                      >
                        <SelectTrigger id="livestockType">
                          <SelectValue placeholder="Select animal" />
                        </SelectTrigger>
                        <SelectContent>
                          {
                            Object.entries(livestockTypes).map(([name, id]) => (
                              <SelectItem key={id} value={name}>{name}</SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {formData.entryType === "INDIVIDUAL" ? (
                    <div className="space-y-2">
                      <Label htmlFor="tagNumber">Ear Tag / ID Number</Label>
                      <Input
                        id="tagNumber"
                        placeholder="e.g. TAG-2026-88"
                        value={formData.tagNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, tagNumber: e.target.value })
                        }
                        required
                      />
                    </div>
                  ) : (
                    <div className="quantity-heads-main space-y-3 p-4 rounded-[10px] border-1">
                      <Label htmlFor="quantity">Number of Heads</Label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              quantity: Math.max(1, formData.quantity - 1),
                            })
                          }
                          className="size-12 flex items-center justify-center rounded-xl border-2 border-[#2D5A27] bg-white text-[#2D5A27] hover:bg-[#2D5A27] hover:text-white transition-colors active:scale-95"
                        >
                          <Minus className="w-5 h-5" />
                        </button>
                        <div className="flex-1 text-center">
                          <span className="text-4xl font-black text-slate-900 tabular-nums">
                            {formData.quantity}
                          </span>
                          <p className="text-xs text-slate-400 mt-0.5">head{formData.quantity !== 1 ? "s" : ""}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, quantity: formData.quantity + 1 })
                          }
                          className="size-12 flex items-center justify-center rounded-xl border-2 border-[#2D5A27] bg-[#2D5A27] text-white hover:bg-[#2D5A27]/90 transition-colors active:scale-95"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[1, 5, 10, 25, 50].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFormData({ ...formData, quantity: n })}
                            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 border-2 ${formData.quantity === n
                              ? "bg-[#2D5A27] text-white border-[#2D5A27]"
                              : "bg-white text-slate-600 border-slate-200 hover:border-[#2D5A27] hover:text-[#2D5A27]"
                              }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="breed">Breed</Label>
                      <Input
                        id="breed"
                        placeholder="e.g. Brahman, Holstein"
                        value={formData.breed}
                        onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sex">Sex / Gender</Label>
                      <Select
                        value={formData.sex}
                        onValueChange={(val) => setFormData({ ...formData, sex: val })}
                      >
                        <SelectTrigger id="sex">
                          <SelectValue placeholder="Select sex" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Mixed">Mixed (Batch)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {formData.entryType === "INDIVIDUAL" && (
                      <div className="space-y-2">
                        <Label htmlFor="weight">Weight (kg)</Label>
                        <Input

                          id="weight"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.weight}
                          onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isVaccinated"
                          checked={formData.isVaccinated}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              isVaccinated: !!checked,
                              lastVaccinationDate: checked ? formData.lastVaccinationDate : "",
                            })
                          }
                        />
                        <Label htmlFor="isVaccinated" className="text-sm font-medium cursor-pointer">
                          Vaccinated
                        </Label>
                      </div>
                      {formData.isVaccinated && (
                        <div className="space-y-2">
                          <Label htmlFor="vaxDate">Last Vaccination Date</Label>
                          <Input
                            id="vaxDate"
                            type="date"
                            max={new Date().toISOString().split("T")[0]}
                            className="flex w-full"
                            value={formData.lastVaccinationDate}
                            onChange={(e) =>
                              setFormData({ ...formData, lastVaccinationDate: e.target.value })
                            }
                            required
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setIsAddOpen(false); setFormData(initialFormData) }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 text-white">
                      Save Entry
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete Livestock Record</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this record? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                {deleteTarget && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <p><strong>{deleteTarget.entryType === "INDIVIDUAL" ? deleteTarget.tagNumber : `${deleteTarget.quantity}x ${deleteTarget.livestockTypeName} (Batch)`}</strong></p>
                    <p className="text-slate-500 mt-1">{deleteTarget.livestockTypeName} • {deleteTarget.breed} • {deleteTarget.sex}</p>
                  </div>
                )}
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!deleteTarget) return;
                      deleteMutation.mutate(deleteTarget.id);
                      setDeleteTarget(null);
                    }}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>


            <LivestockDetailsDialog
              livestock={detailTarget}
              open={!!detailTarget}
              onOpenChange={() => setDetailTarget(null)}
            />


            <LivestockEditDialog
              key={editTarget?.id ?? "closed"}
              item={editTarget}
              open={!!editTarget}
              onOpenChange={(open) => {
                if (!open) setEditTarget(null);
              }}
              livestockTypes={livestockTypes}
              isSubmitting={updateMutation.isPending}
              onSubmit={(payload) => updateMutation.mutate(payload)}
            />
          </div>
        </div>

        {/* Select Livestock Type first */}
        {selectedType ? (
          <>
            <div className="flex items-center justify-between gap-2 py-1.5">
              <button
                type="button"
                onClick={() => setSelectedType(null)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#2D5A27] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                All types
              </button>
              <p className="text-sm font-medium text-slate-500">
                {selectedType} •{" "}
                {inventories
                  .filter((i) => i.livestockTypeName === selectedType)
                  .reduce((acc, item) => acc + item.quantity, 0)}{" "}
                heads
              </p>
            </div>

            <LivestockRecordList
              items={typeFilteredInventories}
              isLoading={IsLoading}
              onView={(item) => setDetailTarget(item)}
              onEdit={(item) => setEditTarget(item)}
              onDelete={(item) => setDeleteTarget(item)}
            />
          </>
        ) : (
          <>
            {/* Summary Metric Cards */}
            <InventoryStats inventories={inventories} isLoading={IsLoading} />

            <LivestockTypeCards
              inventories={inventories}
              isLoading={IsLoading}
              onSelectType={setSelectedType}
            />
          </>
        )}

      </div>
    </>
  );
}
