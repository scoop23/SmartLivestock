"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";


// Lucide Icons
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Calendar,
  Weight,
  Layers,
  Tag,
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  FileDown,
  Minus,
} from "lucide-react";

// shadcn/ui primitives (import from your components directory)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

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
import LivestockTypeCards from "./livestock-type-cards";
import api from "@/lib/axios";
import { Spinner } from "@/components/ui/spinner";

// --- TypeScript Interfaces matching Django Models ---

export type EntryType = "INDIVIDUAL" | "BATCH";
export type StatusType = "PENDING" | "APPROVED" | "REJECTED";

export interface LivestockInventoryItem {
  id: string;
  farmerName: string;
  livestockTypeName: string;
  entryType: EntryType;
  quantity: number;
  tagNumber: string;
  breed: string;
  sex: string;
  weight: number | null;
  lastVaccinationDate: string | null;
  status: StatusType;
  reviewRemarks?: string | null;
  createdAt: string;
}

export interface LivestockType {
  id: number;
  name: string;
}

interface InventoryApiItem {
  id: string;
  farmer_name: string;
  livestock_type_name: string;
  entry_type: EntryType;
  quantity: number;
  tag_number: string;
  breed: string;
  sex: string;
  weight: number | null;
  last_vaccination_date: string | null;
  status: StatusType;
  review_remarks: string | null;
  created_at: string;
}

export default function LivestockInventoryPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LivestockInventoryItem | null>(null);
  const [detailTarget, setDetailTarget] = useState<LivestockInventoryItem | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const mapInventory = (item: InventoryApiItem): LivestockInventoryItem => ({
    id: item.id,
    farmerName: item.farmer_name,
    livestockTypeName: item.livestock_type_name,
    entryType: item.entry_type,
    quantity: item.quantity,
    tagNumber: item.tag_number,
    breed: item.breed,
    sex: item.sex,
    weight: item.weight,
    lastVaccinationDate: item.last_vaccination_date,
    status: item.status,
    reviewRemarks: item.review_remarks,
    createdAt: item.created_at,
  });

  const { data: livestockTypes = {} } = useQuery<Record<string, number>>({
    queryKey: ["livestockTypes"],
    queryFn: async () => {
      const res = await api.get<LivestockType[]>("livestock/livestock_types/");
      const map: Record<string, number> = {};
      res.data.forEach((t) => { map[t.name] = t.id });
      return map;
    },
  });

  const { data: inventories = [], isLoading: IsLoading } = useQuery<LivestockInventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      const res = await api.get("livestock/inventory/");
      return res.data.map(mapInventory);
    },
  });

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
  const filteredInventories = inventories.filter((item) => {
    const matchesSearch =
      item?.tagNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.livestockTypeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    const matchesType = !selectedType || item.livestockTypeName === selectedType;
    return matchesSearch && matchesStatus && matchesType;
  });

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

  const getStatusBadge = (status: StatusType) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </Badge>
        );
      case "PENDING":
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Review
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 flex items-center gap-1 font-medium">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </Badge>
        );
    }
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
        maxWidthClass="max-w-5xl"
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
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
              disabled={inventories.length === 0}
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
          </div>
        </div>


        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-amber-900/10 shadow-sm bg-amber-50/30 border-2">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-950">
                Total Head Count
              </p>
              <p className="text-2xl font-black text-amber-950 mt-1">
                {inventories.reduce((acc, curr) => acc + curr.quantity, 0)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-900/10 shadow-sm bg-amber-50/30 border-2">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-950">
                Approved
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {inventories
                  .filter((i) => i.status === "APPROVED")
                  .reduce((acc, curr) => acc + curr.quantity, 0)}
              </p>
            </CardContent>
          </Card>
          <Card className={`border-2 border-amber-900/10 bg-gradient-to-br from-amber-50/40 to-stone-50 shadow-sm rounded-xl hover:shadow-md transition-all duration-200 min-w-0`}>
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-950">
                Pending Review
              </p>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {inventories.filter((i) => i.status === "PENDING").length} Records
              </p>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-900/10 shadow-sm bg-amber-50/30">
            <CardContent className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-950">
                Individual Tags
              </p>
              <p className="text-2xl font-black mt-1 text-amber-950">
                {inventories.filter((i) => i.entryType === "INDIVIDUAL").length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by breed, tag number, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50/50 border-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
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

            <div className="space-y-3">
              {IsLoading ? (
                <div className="flex justify-center py-16">
                  <Spinner className="size-16 text-emerald-600" />
                </div>
              ) : filteredInventories.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-slate-200">
                  <p className="text-slate-500">No livestock records match your query.</p>
                </Card>
              ) : (
                filteredInventories.map((item) => (
                  <Card
                    key={item.id}
                    className="border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-xl text-slate-900">
                              {item.entryType === "INDIVIDUAL"
                                ? item.tagNumber || "Un-tagged"
                                : `${item.quantity}x ${item.livestockTypeName} (Batch)`}
                            </h3>
                            <Badge variant="outline" className="text-xs uppercase border-slate-300">
                              {item.entryType}
                            </Badge>
                            {getStatusBadge(item.status)}
                          </div>

                          <p className="text-sm text-slate-600">
                            <span className="font-bold text-slate-800">
                              {item.livestockTypeName}
                            </span>{" "}
                            • {item.breed || "Standard Breed"} • {item.sex}
                          </p>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-xs">
                            {item.weight && (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Weight className="w-4 h-4 text-slate-400" />
                                <span>
                                  Weight:{" "}
                                  <strong className="text-slate-900">{item.weight} kg</strong>
                                </span>
                              </div>
                            )}
                            {item.lastVaccinationDate ? (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <span>
                                  Vaccinated:{" "}
                                  <strong className="text-slate-900">
                                    {item.lastVaccinationDate}
                                  </strong>
                                </span>
                              </div>
                            ) : (
                              <div className="text-amber-600">
                                Not Vaccinated
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Tag className="w-4 h-4 text-slate-400" />
                              <span>
                                Quantity: <strong className="text-slate-900">{item.quantity} head</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <CalendarDays className="w-4 h-4 text-slate-400" />
                              <span>
                                Date Created:{" "}
                                <strong className="text-slate-900">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                                </strong>
                              </span>
                            </div>
                          </div>

                          {item.reviewRemarks && (
                            <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-800">
                              <strong>Review Note:</strong> {item.reviewRemarks}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 self-end sm:self-start">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailTarget(item)}
                            className="text-slate-600 hover:text-[#2D5A27] hover:bg-[#2D5A27]/5 font-medium"
                          >
                            View Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(item)}
                            className="text-slate-700 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : (
          <LivestockTypeCards
            inventories={inventories}
            isLoading={IsLoading}
            onSelectType={setSelectedType}
          />
        )}

      </div>
    </>
  );
}
