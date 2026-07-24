"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import MobileNav from "@/app/components/mobilenav";

// Lucide Icons
import {
  Plus,
  Search,
  Trash2,
  Calendar,
  Weight,
  Layers,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react";

// shadcn/ui primitives (import from your components directory)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export interface CensusSubmissionItem {
  id: string;
  barangayName: string;
  reportYear: number;
  reportQuarter: number;
  submissionDate: string;
  status: StatusType;
  reviewRemarks?: string;
}

export default function LivestockInventoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State matching Django LivestockInventory
  const [formData, setFormData] = useState({
    entryType: "BATCH" as EntryType,
    livestockType: "Cattle",
    quantity: 1,
    tagNumber: "",
    breed: "",
    sex: "Female",
    weight: "",
    lastVaccinationDate: "",
  });

  // Mock data matching Django LivestockInventory
  const [inventories, setInventories] = useState<LivestockInventoryItem[]>([
    {
      id: "1",
      farmerName: "Juan Dela Cruz",
      livestockTypeName: "Cattle",
      entryType: "INDIVIDUAL",
      quantity: 1,
      tagNumber: "TAG-2026-001",
      breed: "Brahman",
      sex: "Male",
      weight: 480.5,
      lastVaccinationDate: "2026-01-15",
      status: "APPROVED",
      createdAt: "2026-02-01",
    },
    {
      id: "2",
      farmerName: "Juan Dela Cruz",
      livestockTypeName: "Goat",
      entryType: "BATCH",
      quantity: 15,
      tagNumber: "",
      breed: "Anglo-Nubian",
      sex: "Mixed",
      weight: null,
      lastVaccinationDate: "2026-02-10",
      status: "PENDING",
      createdAt: "2026-02-18",
    },
    {
      id: "3",
      farmerName: "Juan Dela Cruz",
      livestockTypeName: "Swine",
      entryType: "BATCH",
      quantity: 8,
      tagNumber: "",
      breed: "Landrace",
      sex: "Female",
      weight: null,
      lastVaccinationDate: null,
      status: "REJECTED",
      reviewRemarks: "Incomplete vaccination records provided.",
      createdAt: "2026-02-12",
    },
  ]);

  // Mock data matching Django CensusSubmission
  const [censusSubmissions] = useState<CensusSubmissionItem[]>([
    {
      id: "c1",
      barangayName: "San Isidro",
      reportYear: 2026,
      reportQuarter: 1,
      submissionDate: "2026-02-01",
      status: "APPROVED",
    },
    {
      id: "c2",
      barangayName: "San Isidro",
      reportYear: 2025,
      reportQuarter: 4,
      submissionDate: "2025-11-15",
      status: "APPROVED",
    },
  ]);

  // Filter handlers
  const filteredInventories = inventories.filter((item) => {
    const matchesSearch =
      item.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.livestockTypeName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this record?")) {
      setInventories((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem: LivestockInventoryItem = {
      id: Date.now().toString(),
      farmerName: "Current User",
      livestockTypeName: formData.livestockType,
      entryType: formData.entryType,
      quantity: formData.entryType === "INDIVIDUAL" ? 1 : Number(formData.quantity),
      tagNumber: formData.entryType === "INDIVIDUAL" ? formData.tagNumber : "",
      breed: formData.breed,
      sex: formData.sex,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      lastVaccinationDate: formData.lastVaccinationDate || null,
      status: "PENDING",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setInventories([newItem, ...inventories]);
    setIsAddOpen(false);
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push("/")} />
      </div>

      <main className="flex-1 overflow-auto pb-24 md:pb-10">
        <PageHeader
          title="Livestock & Census Inventory"
          subtitle="Manage individual livestock, batch entries, and quarterly census data"
          variant="farmer"
          maxWidthClass="max-w-5xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          <Tabs defaultValue="inventory" onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <TabsList className="bg-slate-200/60 p-1">
                <TabsTrigger value="inventory" className="gap-2 font-medium">
                  <Layers className="w-4 h-4" />
                  Livestock Records
                </TabsTrigger>
                <TabsTrigger value="census" className="gap-2 font-medium">
                  <FileSpreadsheet className="w-4 h-4" />
                  Barangay Census
                </TabsTrigger>
              </TabsList>

              {activeTab === "inventory" && (
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 font-medium shadow-sm">
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
                              <SelectItem value="Cattle">Cattle</SelectItem>
                              <SelectItem value="Goat">Goat</SelectItem>
                              <SelectItem value="Swine">Swine</SelectItem>
                              <SelectItem value="Carabao">Carabao</SelectItem>
                              <SelectItem value="Poultry">Poultry</SelectItem>
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
                        <div className="space-y-2">
                          <Label htmlFor="quantity">Quantity (Head Count)</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={formData.quantity}
                            onChange={(e) =>
                              setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                            }
                            required
                          />
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
                        <div className="space-y-2">
                          <Label htmlFor="vaxDate">Last Vaccination</Label>
                          <Input
                            id="vaxDate"
                            type="date"
                            value={formData.lastVaccinationDate}
                            onChange={(e) =>
                              setFormData({ ...formData, lastVaccinationDate: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <DialogFooter className="pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddOpen(false)}
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
              )}
            </div>

            {/* TAB 1: LIVESTOCK INVENTORY */}
            <TabsContent value="inventory" className="space-y-6">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Head Count
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {inventories.reduce((acc, curr) => acc + curr.quantity, 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Approved
                    </p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">
                      {inventories
                        .filter((i) => i.status === "APPROVED")
                        .reduce((acc, curr) => acc + curr.quantity, 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Pending Review
                    </p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">
                      {inventories.filter((i) => i.status === "PENDING").length} Records
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Individual Tags
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
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

              {/* Cards Listing */}
              <div className="space-y-4">
                {filteredInventories.length === 0 ? (
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
                              <h3 className="font-bold text-lg text-slate-900">
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
                              <span className="font-semibold text-slate-800">
                                {item.livestockTypeName}
                              </span>{" "}
                              • {item.breed || "Standard Breed"} • {item.sex}
                            </p>

                            {/* Details Grid */}
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
                              {item.lastVaccinationDate && (
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <Calendar className="w-4 h-4 text-slate-400" />
                                  <span>
                                    Vaccinated:{" "}
                                    <strong className="text-slate-900">
                                      {item.lastVaccinationDate}
                                    </strong>
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Tag className="w-4 h-4 text-slate-400" />
                                <span>
                                  Quantity: <strong className="text-slate-900">{item.quantity} head</strong>
                                </span>
                              </div>
                            </div>

                            {/* Admin Remarks callout if rejected */}
                            {item.reviewRemarks && (
                              <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-md text-xs text-rose-800">
                                <strong>Review Note:</strong> {item.reviewRemarks}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 self-end sm:self-start">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
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
            </TabsContent>

            {/* TAB 2: CENSUS SUBMISSIONS */}
            <TabsContent value="census" className="space-y-4">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Barangay Census Reports</CardTitle>
                  <CardDescription>
                    Quarterly submissions generated for municipal consolidation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {censusSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {submission.barangayName} — Q{submission.reportQuarter}{" "}
                          {submission.reportYear}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted on {submission.submissionDate}
                        </p>
                      </div>
                      <div>{getStatusBadge(submission.status)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
}
