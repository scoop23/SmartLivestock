"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/page-header";
import {
  ApiUser,
  UserAccountStatus,
  UserDocumentItem,
  useUsersDirectory,
  useUpdateUserStatus,
  useUpdateSibatAssignment,
  useVerifyUserDocument,
  userBarangayLabel,
} from "./user-management";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Users,
  MapPin,
  UserMinus,
  UserCheck,
  Check,
  ChevronRight,
  Search,
  Loader2,
  Clock,
  RefreshCw,
  RotateCcw,
  Eye,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useAdminBarangays } from "../admin/admin-charts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentPreviewDialog } from "./document-preview-dialog";

export type { ApiUser, UserAccountStatus, UserDocumentItem };

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [previewDoc, setPreviewDoc] = useState<UserDocumentItem | null>(null);
  const [revisionDoc, setRevisionDoc] = useState<UserDocumentItem | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "farmer" | "sibat">("all");
  const [barangayFilter, setBarangayFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignment, setAssignment] = useState("unassigned");
  const [accessScope, setAccessScope] = useState<ApiUser["access_scope"]>("ASSIGNED_ONLY");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Municipal tab counts use the complete directory, never a filtered subset.
  const directory = useUsersDirectory();
  const filters = {
    role: activeFilter === "farmer" ? "FARMER" : activeFilter === "sibat" ? "SIBAT" : undefined,
    account_status: activeFilter === "pending" ? "PENDING" : statusFilter === "ALL" ? undefined : statusFilter,
    barangay_id: barangayFilter === "ALL" ? undefined : barangayFilter,
    search: debouncedSearch || undefined,
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const filteredDirectory = useUsersDirectory({ enabled: hasFilters }, filters);
  const query = hasFilters ? filteredDirectory : directory;
  const { data: filteredUsers = [], isLoading, isFetching, isError, refetch } = query;
  const users = directory.data || [];
  const barangaysQuery = useAdminBarangays();
  const updateStatusMutation = useUpdateUserStatus();
  const assignmentMutation = useUpdateSibatAssignment();
  const verifyDocMutation = useVerifyUserDocument();
  const pendingCount = users.filter((u) => u.account_status === "PENDING").length;

  const handleStatusUpdate = (id: number, newStatus: UserAccountStatus) => {
    updateStatusMutation.mutate({ userId: id, status: newStatus }, {
      onSuccess: (updated) => setSelectedUser((current) => current?.id === id ? updated : current),
    });
  };

  const handleVerifyDocument = (docId: number, newStatus: "APPROVED" | "SUBJECT_TO_REVISION", reason?: string) => {
    verifyDocMutation.mutate(
      { documentId: docId, status: newStatus, reason },
      {
        onSuccess: (updatedDoc) => {
          setSelectedUser((current) => {
            if (!current) return current;
            return {
              ...current,
              documents: current.documents.map((d) => (d.id === docId ? updatedDoc : d)),
            };
          });
          setRevisionDoc(null);
          setRevisionReason("");
        },
      }
    );
  };

  const getDocTypeLabel = (doc: UserDocumentItem) => {
    let typeLabel = doc.document_type_display;
    if (!typeLabel) {
      switch (doc.document_type) {
        case "GOVERNMENT_ID":
          typeLabel = "Government ID";
          break;
        case "RSBSA":
          typeLabel = "RSBSA Certificate";
          break;
        case "BARANGAY_CLEARANCE":
          typeLabel = "Barangay Clearance";
          break;
        default:
          typeLabel = doc.document_type.replaceAll("_", " ");
      }
    }
    const side = doc.file_name?.match(/^(front|back)_/i)?.[1];
    return side ? `${typeLabel} · ${side} side` : typeLabel;
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold border-0">
            Approved
          </Badge>
        );
      case "SUBJECT_TO_REVISION":
        return (
          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[10px] font-bold border-0">
            Needs Revision
          </Badge>
        );
      case "PENDING":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-bold border-0">
            Pending Review
          </Badge>
        );
    }
  };

  const openProfile = (user: ApiUser) => {
    setSelectedUser(user);
    setAccessScope(user.access_scope);
    setAssignment(user.assigned_barangay_id == null ? "unassigned" : String(user.assigned_barangay_id));
  };


  const getStatusBadge = (status: ApiUser["account_status"]) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge
            variant="outline"
            className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800"
          >
            Approved
          </Badge>
        );
      case "PENDING":
        return (
          <Badge
            variant="outline"
            className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse"
          >
            <Clock size={10} /> Pending
          </Badge>
        );
      case "SUSPENDED":
        return (
          <Badge
            variant="outline"
            className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800"
          >
            Suspended
          </Badge>
        );
      case "SUBJECT_TO_REVISION":
        return (
          <Badge
            variant="outline"
            className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"
          >
            Subject to Revision
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-none text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-slate-100 text-slate-800"
          >
            {status}
          </Badge>
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Personnel & Farmer Directory"
        subtitle="Manage registered Farmers, SIBAT Audit Officers, and approve pending accounts"
        variant="admin"
        maxWidthClass="w-full"
        icon={<Users className="size-5 text-slate-800" />}
      />

      <div className="p-3 sm:p-4 md:p-5 w-full space-y-3.5 pb-16 sm:pb-6">
        {/* Controls Area */}
        <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between bg-white p-3 rounded-xl shadow-2xs border border-slate-200/80">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input
              type="text"
              placeholder="Search name, email, or barangay..."
              className="w-full pl-9 pr-3 py-1.5 h-8 bg-slate-50/80 border-slate-200/80 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-xs font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Tabs
              value={activeFilter}
              onValueChange={(v) => setActiveFilter(v as typeof activeFilter)}
              className="w-full md:w-auto"
            >
              <TabsList className="bg-slate-100/80 p-0.5 rounded-lg h-auto border border-slate-200/60 flex flex-wrap">
                <TabsTrigger
                  value="all"
                  className="px-3.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs text-slate-400"
                >
                  All ({directory.isError ? "Unavailable" : users.length})
                </TabsTrigger>
                <TabsTrigger
                  value="pending"
                  className="px-3.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-2xs text-slate-400 flex items-center gap-1"
                >
                  Pending
                  {pendingCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-black">
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="farmer"
                  className="px-3.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs text-slate-400"
                >
                  Farmers
                </TabsTrigger>
                <TabsTrigger
                  value="sibat"
                  className="px-3.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs text-slate-400"
                >
                  SIBAT
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh Directory"
              className="h-10 w-10 rounded-xl border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-slate-50 shrink-0 cursor-pointer active:scale-95 transition-all shadow-xs"
            >
              <RefreshCw size={17} className={isFetching ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={barangayFilter} onValueChange={setBarangayFilter} disabled={barangaysQuery.isError}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filter by barangay"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Barangays</SelectItem>
              <SelectItem value="unassigned">Unassigned Farmer / SIBAT</SelectItem>
              {(barangaysQuery.data || []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.barangay_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeFilter === "pending" ? "PENDING" : statusFilter} onValueChange={setStatusFilter} disabled={activeFilter === "pending"}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filter by account status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Account Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="SUBJECT_TO_REVISION">Subject to Revision</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-500">{filteredUsers.length} matching users</span>
          {barangaysQuery.isError && <p role="alert" className="text-xs text-rose-700">Barangays could not be loaded. <button className="underline" onClick={() => barangaysQuery.refetch()}>Retry</button></p>}
        </div>
        {isError && <p role="alert" className="text-sm text-rose-700">Could not load the directory. Check your access or try refreshing.</p>}

        {/* List Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200/70">
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  User / Role
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Barangay / Assignment
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Account Status
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider text-center">
                  Quick Actions
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-right text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Details
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-[#2D5A27]" size={24} />
                      <p className="text-xs font-bold">Loading users from backend...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Users size={28} className="text-slate-300 mb-1" />
                      <p className="text-xs font-bold text-slate-600">
                        No users found matching your filters
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Try adjusting your search query or tab filter.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isPending = user.account_status === "PENDING" || user.account_status === "SUBJECT_TO_REVISION";
                  const isApproved = user.account_status === "APPROVED";
                  const isSuspended = user.account_status === "SUSPENDED";
                  const isActionLoading =
                    updateStatusMutation.isPending &&
                    updateStatusMutation.variables?.userId === user.id;

                  return (
                    <TableRow
                      key={user.id}
                      className="group hover:bg-slate-50/90 transition-colors border-none cursor-pointer"
                    >
                      <TableCell className="px-3.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`size-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${
                              user.role?.toUpperCase() === "SIBAT"
                                ? "bg-blue-600 text-white"
                                : user.role?.toUpperCase() === "MAO"
                                ? "bg-amber-600 text-white"
                                : "bg-emerald-100 text-[#2D5A27]"
                            }`}
                          >
                            {user.profile_image ? (
                              <img
                                src={user.profile_image}
                                alt={user.full_name}
                                className="size-full object-cover"
                              />
                            ) : user.role?.toUpperCase() === "SIBAT" ? (
                              <ShieldCheck size={14} />
                            ) : (
                              <Users size={14} />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800">{user.full_name}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase">
                                {user.role || "User"}
                              </span>
                              <span className="text-[9px] text-slate-400">â€¢ {user.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2 text-xs font-semibold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#2D5A27] shrink-0" />
                          <div>
                            <span>{userBarangayLabel(user)}</span>
                            {user.role === "SIBAT" && <p className="text-xs text-slate-500">{user.access_scope === "ALL_BARANGAYS" ? "All Barangays access" : "Assigned scope"}</p>}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2">
                        {getStatusBadge(user.account_status)}
                      </TableCell>

                      <TableCell className="px-3.5 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {isActionLoading ? (
                            <Loader2 className="animate-spin text-slate-400 size-4" />
                          ) : isPending ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(user.id, "APPROVED");
                                }}
                                title="Approve Registration"
                                className="h-7 px-2.5 text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md gap-1 cursor-pointer"
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(user.id, "SUBJECT_TO_REVISION");
                                }}
                                title="Return for Revision"
                                className="h-7 px-2 text-[10px] font-black text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-md gap-1 cursor-pointer"
                              >
                                <RotateCcw size={12} />
                                <span>Revision</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              {isApproved ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(user.id, "SUSPENDED");
                                  }}
                                  title="Suspend User Account"
                                  className="h-7 w-7 hover:bg-slate-100 rounded-md text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                >
                                  <UserMinus size={13} />
                                </Button>
                              ) : isSuspended ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusUpdate(user.id, "APPROVED");
                                  }}
                                  title="Reactivate User Account"
                                  className="h-7 w-7 hover:bg-slate-100 rounded-md text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                                >
                                  <UserCheck size={13} />
                                </Button>
                              ) : null}
                            </>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProfile(user)}
                          className="h-7 px-2 text-xs font-bold text-[#2D5A27] hover:bg-emerald-50 rounded-md gap-0.5 cursor-pointer"
                        >
                          <span>Profile</span>
                          <ChevronRight size={13} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* User account and registration document review */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        {selectedUser && (
          <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-white/90 [&>button]:p-2 [&>button]:shadow-sm">
            <DialogHeader className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-5 py-4 text-left sm:px-6">
              <div className="flex items-center gap-3 pr-8">
                <div className={`flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${selectedUser.role?.toUpperCase() === "SIBAT" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {selectedUser.profile_image ? (
                    <img src={selectedUser.profile_image} alt={selectedUser.full_name} className="size-full object-cover" />
                  ) : selectedUser.role?.toUpperCase() === "SIBAT" ? (
                    <ShieldCheck className="size-6" />
                  ) : (
                    <Users className="size-6" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl">{selectedUser.full_name}</DialogTitle>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{selectedUser.username} <span aria-hidden="true">·</span> {selectedUser.role}</p>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              <Card className="gap-0 rounded-xl border-slate-200 shadow-none">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <CardTitle className="text-sm font-semibold text-slate-900">Account details</CardTitle>
                  <CardDescription className="text-xs">Contact and registration information</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                  <div className="min-w-0"><p className="text-[11px] font-medium text-slate-500">Email</p><p className="mt-1 break-all text-sm font-medium text-slate-900">{selectedUser.email}</p></div>
                  <div><p className="text-[11px] font-medium text-slate-500">Contact phone</p><p className="mt-1 text-sm font-medium text-slate-900">{selectedUser.phone_number || "Not provided"}</p></div>
                  <div><p className="text-[11px] font-medium text-slate-500">{selectedUser.role === "SIBAT" ? "Assigned barangay" : "Barangay"}</p><p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900"><MapPin className="size-3.5 text-slate-400" />{userBarangayLabel(selectedUser)}</p></div>
                  <div><p className="text-[11px] font-medium text-slate-500">Registered</p><p className="mt-1 text-sm font-medium text-slate-900">{new Date(selectedUser.created_at).toLocaleDateString()}</p></div>
                </CardContent>
              </Card>

              {selectedUser.role === "SIBAT" && (
                <Card className="gap-0 rounded-xl border-slate-200 shadow-none">
                  <CardHeader className="border-b border-slate-100 px-4 py-3">
                    <CardTitle className="text-sm font-semibold text-slate-900">SIBAT assignment</CardTitle>
                    <CardDescription className="text-xs">Set the field barangay and record visibility scope</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5"><Label htmlFor="sibat-assignment" className="text-xs text-slate-600">Assigned barangay</Label><Select value={assignment} onValueChange={setAssignment} disabled={barangaysQuery.isLoading || barangaysQuery.isError || assignmentMutation.isPending}><SelectTrigger id="sibat-assignment" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{(barangaysQuery.data || []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.barangay_name}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-1.5"><Label htmlFor="sibat-access-scope" className="text-xs text-slate-600">Access scope</Label><Select value={accessScope} onValueChange={(value) => setAccessScope(value as ApiUser["access_scope"])} disabled={assignmentMutation.isPending}><SelectTrigger id="sibat-access-scope" className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ASSIGNED_ONLY">Assigned Barangay</SelectItem><SelectItem value="ALL_BARANGAYS">All Barangays</SelectItem></SelectContent></Select></div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">Assigned scope requires a barangay. All Barangays expands visibility and verification while retaining the primary barangay and SIBAT role. Final approval remains with MAO/Admin.</p>
                    <Button size="sm" variant="outline" disabled={assignmentMutation.isPending || barangaysQuery.isError || barangaysQuery.isLoading} onClick={() => assignmentMutation.mutate({ userId: selectedUser.id, barangayId: assignment === "unassigned" ? null : Number(assignment), accessScope }, { onSuccess: setSelectedUser })}>
                      {assignmentMutation.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Saving assignment...</> : "Save assignment and scope"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {selectedUser.role?.toUpperCase() === "FARMER" && (
                <Card className="gap-0 rounded-xl border-slate-200 shadow-none">
                  <CardHeader className="border-b border-slate-100 px-4 py-3">
                    <CardTitle className="text-sm font-semibold text-slate-900">Farm profile</CardTitle>
                    <CardDescription className="text-xs">Farmer information submitted during registration</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                    {selectedUser.rsbsa_number && <div><p className="text-[11px] font-medium text-slate-500">RSBSA number</p><p className="mt-1 font-mono text-sm font-medium text-slate-900">{selectedUser.rsbsa_number}</p></div>}
                    <div><p className="text-[11px] font-medium text-slate-500">Registered cattle</p><p className="mt-1 text-sm font-medium text-slate-900">{selectedUser.cattle_count} heads</p></div>
                    {selectedUser.farm_size !== null && <div><p className="text-[11px] font-medium text-slate-500">Farm size</p><p className="mt-1 text-sm font-medium text-slate-900">{selectedUser.farm_size} ha</p></div>}
                    {selectedUser.address && <div className="sm:col-span-2"><p className="text-[11px] font-medium text-slate-500">Farm address</p><p className="mt-1 text-sm font-medium text-slate-900">{selectedUser.address}</p></div>}
                  </CardContent>
                </Card>
              )}

              <Card className="gap-0 rounded-xl border-slate-200 shadow-none">
                <CardHeader className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div><CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="size-4 text-slate-500" />Registration documents</CardTitle><CardDescription className="mt-1 text-xs">Preview and review each uploaded file</CardDescription></div>
                    <Badge variant="secondary" className="shrink-0 text-xs">{(selectedUser.documents || []).length} {selectedUser.documents?.length === 1 ? "file" : "files"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {(selectedUser.documents || []).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center"><FileText className="mx-auto size-5 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">No documents attached</p><p className="mt-1 text-xs text-slate-500">No files were uploaded during registration.</p></div>
                  ) : selectedUser.documents.map((doc) => (
                    <div key={doc.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><FileText className="size-4" /></span>
                          <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{getDocTypeLabel(doc)}</p><p className="mt-0.5 break-all text-xs text-slate-500">{doc.file_name?.replace(/^(front|back)_/i, "") || "Attachment"}</p><p className="mt-1 text-[11px] text-slate-400">Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</p></div>
                        </div>
                        {getDocStatusBadge(doc.verification_status)}
                      </div>
                      {doc.review_remarks && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800"><p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" />Review remarks</p><p className="mt-1 pl-5 leading-relaxed">{doc.review_remarks}</p></div>}
                      {doc.approved_by_name && doc.verification_status === "APPROVED" && <p className="text-xs text-emerald-700">Verified by {doc.approved_by_name}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPreviewDoc(doc)} className="h-8 gap-1.5 text-xs"><Eye className="size-3.5" />Preview file</Button>
                        <div className="flex flex-wrap items-center gap-2">
                          {doc.verification_status !== "APPROVED" && <Button type="button" size="sm" disabled={verifyDocMutation.isPending} onClick={() => handleVerifyDocument(doc.id, "APPROVED")} className="h-8 gap-1.5 bg-emerald-700 text-xs text-white hover:bg-emerald-800"><Check className="size-3.5" />Approve file</Button>}
                          {doc.verification_status !== "SUBJECT_TO_REVISION" && <Button type="button" size="sm" variant="outline" disabled={verifyDocMutation.isPending} onClick={() => { setRevisionDoc(doc); setRevisionReason(doc.review_remarks || ""); }} className="h-8 gap-1.5 border-rose-200 text-xs text-rose-700 hover:bg-rose-50"><RotateCcw className="size-3.5" />Request revision</Button>}
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs leading-relaxed text-slate-500">Documents are manually verified by MAO officers. Each file keeps its own review status.</p>
                </CardContent>
              </Card>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="text-[11px] font-medium text-slate-500">Account status</p><div className="mt-1 sm:hidden">{getStatusBadge(selectedUser.account_status)}</div></div>
                <p className="hidden text-xs text-slate-500 sm:block">{getStatusBadge(selectedUser.account_status)}</p>
              </div>
              {selectedUser.account_status === "PENDING" || selectedUser.account_status === "SUBJECT_TO_REVISION" ? (
                <div className="space-y-3">
                  {(selectedUser.documents || []).some((d) => d.verification_status === "SUBJECT_TO_REVISION") && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">One or more documents need revision before the account can be approved.</p>}
                  {(selectedUser.documents || []).some((d) => d.verification_status === "PENDING") && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">Review all pending documents before approving this account.</p>}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="outline" disabled={updateStatusMutation.isPending} onClick={() => handleStatusUpdate(selectedUser.id, "SUBJECT_TO_REVISION")} className="min-h-10 flex-1 gap-2 border-rose-200 text-rose-700 hover:bg-rose-50"><RotateCcw className="size-4" />Return for revision</Button>
                    <Button disabled={updateStatusMutation.isPending || (selectedUser.documents || []).some((d) => d.verification_status === "SUBJECT_TO_REVISION" || d.verification_status === "PENDING")} onClick={() => handleStatusUpdate(selectedUser.id, "APPROVED")} className="min-h-10 flex-1 gap-2 bg-[#2D5A27] text-white hover:bg-[#23471f]"><Check className="size-4" />Approve account</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setSelectedUser(null)} className="w-full">Close review</Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Document Preview Dialog with authenticated file streaming */}
      <DocumentPreviewDialog
        document={previewDoc}
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        getDocTypeLabel={getDocTypeLabel}
        getDocStatusBadge={getDocStatusBadge}
      />

      {/* Document Return for Revision Dialog */}
      <Dialog open={!!revisionDoc} onOpenChange={(open) => !open && setRevisionDoc(null)}>
        {revisionDoc && (
          <DialogContent className="max-w-md p-4 sm:p-6 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-rose-900 flex items-center gap-2">
                <RotateCcw className="size-5 text-rose-600" />
                Return Document for Revision
              </DialogTitle>
              <p className="text-xs text-slate-500">
                {getDocTypeLabel(revisionDoc)} • Explain clearly what needs correction
              </p>
            </DialogHeader>

            <div className="space-y-3 mt-3">
              <Label htmlFor="revision-reason" className="text-xs font-semibold">
                Reason for Revision <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="revision-reason"
                placeholder="e.g. The submitted ID is blurry. Please upload a clearer copy with readable name and ID number."
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                className="min-h-[100px] text-sm"
              />
              <p className="text-[11px] text-slate-500">
                This feedback will be notified directly to the farmer so they can re-upload their document.
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setRevisionDoc(null);
                  setRevisionReason("");
                }}
                className="flex-1"
                disabled={verifyDocMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleVerifyDocument(revisionDoc.id, "SUBJECT_TO_REVISION", revisionReason)}
                disabled={!revisionReason.trim() || verifyDocMutation.isPending}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
              >
                {verifyDocMutation.isPending ? "Submitting..." : "Return for Revision"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

    </>
  );
}
