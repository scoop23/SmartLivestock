"use client";

import { PageHeader } from "@/app/components/page-header";
import { useEffect,useState } from "react";
import {
ApiUser,
UserAccountStatus,
UserDocumentItem,
useDeletePendingUser,
useUpdateSibatAssignment,
useUpdateUserStatus,
useUsersDirectory,
useVerifyUserDocument,
userBarangayLabel,
} from "./user-management";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import {
Table,
TableBody,
TableCell,
TableHead,
TableHeader,
TableRow,
} from "@/components/ui/table";
import { Tabs,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
AlertTriangle,
Building2,
Calendar,
Check,
ChevronRight,
Clock,
Eye,
FileText,
Fingerprint,
Loader2,
Mail,
MapPin,
Phone,
RefreshCw,
RotateCcw,
Search,
ShieldCheck,
Sparkles,
Trash2,
UserCheck,
UserMinus,
Users,
} from "lucide-react";
import { useAdminBarangays } from "../admin/admin-charts";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { IdentityEvidencePanel } from "@/components/identity-evidence";

export type { ApiUser,UserAccountStatus,UserDocumentItem };

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [previewDoc, setPreviewDoc] = useState<UserDocumentItem | null>(null);
  const [revisionDoc, setRevisionDoc] = useState<UserDocumentItem | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null);
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
    role: activeFilter === "farmer" ? "FARMER" : undefined,
    account_status: activeFilter === "pending" ? "PENDING" : statusFilter === "ALL" ? undefined : statusFilter,
    barangay_id: barangayFilter === "ALL" ? undefined : barangayFilter,
    search: debouncedSearch || undefined,
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const filteredDirectory = useUsersDirectory({ enabled: hasFilters }, filters);
  const query = hasFilters ? filteredDirectory : directory;
  const { data: filteredUsers = [], isLoading, isFetching, isError, refetch } = query;
  const matchingUsers = activeFilter === "sibat"
    ? filteredUsers.filter((user) => user.role === "SIBAT" || user.role === "CBAT")
    : filteredUsers;
  const users = directory.data || [];
  const barangaysQuery = useAdminBarangays();
  const updateStatusMutation = useUpdateUserStatus();
  const assignmentMutation = useUpdateSibatAssignment();
  const verifyDocMutation = useVerifyUserDocument();
  const deleteUserMutation = useDeletePendingUser();
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
            const updatedDocuments = current.documents.map((d) =>
              d.id === docId ? updatedDoc : d
            );
            const anyNeedsRevision = updatedDocuments.some(
              (d) => d.verification_status === "SUBJECT_TO_REVISION"
            );
            const nextAccountStatus =
              updatedDoc.verification_status === "SUBJECT_TO_REVISION" &&
              current.account_status === "PENDING"
                ? "SUBJECT_TO_REVISION"
                : !anyNeedsRevision && current.account_status === "SUBJECT_TO_REVISION"
                ? "PENDING"
                : current.account_status;
            return {
              ...current,
              account_status: nextAccountStatus,
              documents: updatedDocuments,
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
        subtitle="Manage registered farmers and field reviewers, and approve pending accounts"
        variant="admin"
        maxWidthClass="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        icon={<Users className="size-5 text-slate-800" />}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-16 sm:pb-6">
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
                  Field Reviewers
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
              <SelectItem value="unassigned">Unassigned Farmer / Field Reviewer</SelectItem>
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
          <span className="text-xs text-slate-500">{matchingUsers.length} matching users</span>
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
              ) : matchingUsers.length === 0 ? (
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
                matchingUsers.map((user) => {
                  const isPending = user.account_status === "PENDING" || user.account_status === "SUBJECT_TO_REVISION";
                  const isUnderRevision =
                    user.account_status === "SUBJECT_TO_REVISION" ||
                    (user.documents || []).some((d) => d.verification_status === "SUBJECT_TO_REVISION");
                  const hasUnapprovedDocs = (user.documents || []).some(
                    (d) => d.verification_status !== "APPROVED"
                  );
                  const isApproved = user.account_status === "APPROVED";
                  const isSuspended = user.account_status === "SUSPENDED";
                  const isActionLoading =
                    (updateStatusMutation.isPending &&
                      updateStatusMutation.variables?.userId === user.id) ||
                    (deleteUserMutation.isPending &&
                      deleteUserMutation.variables === user.id);

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
                        {getStatusBadge(
                          isUnderRevision && user.account_status === "PENDING"
                            ? "SUBJECT_TO_REVISION"
                            : user.account_status
                        )}
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
                                disabled={isUnderRevision || hasUnapprovedDocs}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(user.id, "APPROVED");
                                }}
                                title={
                                  isUnderRevision
                                    ? "Cannot approve while account or documents are marked Subject to Revision"
                                    : hasUnapprovedDocs
                                    ? "Review and approve all registration documents in Profile first"
                                    : "Approve Registration"
                                }
                                className="h-7 px-2.5 text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md gap-1 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                              >
                                <Check size={12} />
                                <span>Approve</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isUnderRevision}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusUpdate(user.id, "SUBJECT_TO_REVISION");
                                }}
                                title={
                                  isUnderRevision
                                    ? "Already returned for revision — waiting for farmer resubmission"
                                    : "Return for Revision"
                                }
                                className="h-7 px-2 text-[10px] font-black text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-md gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RotateCcw size={12} />
                                <span>{isUnderRevision ? "In Revision" : "Revision"}</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUserToDelete(user);
                                }}
                                title="Delete Pending Registration"
                                className="h-7 w-7 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
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
          <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] sm:max-w-4xl lg:max-w-6xl flex-col gap-0 overflow-hidden rounded-3xl border border-emerald-500/25 bg-slate-50 p-0 shadow-2xl shadow-black/40 [&>button]:right-3.5 [&>button]:top-3.5 sm:[&>button]:right-5 sm:[&>button]:top-5 [&>button]:z-20 [&>button]:rounded-xl [&>button]:border [&>button]:border-white/15 [&>button]:bg-white/10 [&>button]:p-2 [&>button]:text-white [&>button]:backdrop-blur-md hover:[&>button]:bg-white/20">
            {/* ── Futuristic Command Header ── */}
            <DialogHeader className="relative shrink-0 overflow-hidden border-b border-emerald-500/20 bg-gradient-to-br from-[#051408] via-[#0d2613] to-[#16381d] px-4 py-4 text-left text-white sm:px-6 sm:py-5">
              {/* Tech Mesh & Luminous Accent */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(16,185,129,0.16)_1px,transparent_1px)] [background-size:20px_20px] opacity-60"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-emerald-500/20 blur-2xl"
              />

              {/* Top Telemetry Bar */}
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pr-10">
                <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  <Sparkles className="size-3 text-emerald-400" />
                  <span>AGRI-ID // DOSSIER #{String(selectedUser.id).padStart(4, "0")}</span>
                </div>
                <div className="shrink-0">
                  {getStatusBadge(
                    selectedUser.account_status === "PENDING" &&
                      (selectedUser.documents || []).some(
                        (d) => d.verification_status === "SUBJECT_TO_REVISION"
                      )
                      ? "SUBJECT_TO_REVISION"
                      : selectedUser.account_status
                  )}
                </div>
              </div>

              {/* Identity & Role Block */}
              <div className="relative z-10 mt-3 flex items-center gap-3.5 pr-4">
                <div
                  className={`flex size-12 sm:size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-lg ${
                    selectedUser.role?.toUpperCase() === "SIBAT"
                      ? "border-blue-400/40 bg-gradient-to-br from-blue-500/30 to-indigo-700/30 text-blue-200 shadow-blue-950/40"
                      : "border-emerald-400/40 bg-gradient-to-br from-emerald-400/25 to-teal-700/30 text-emerald-200 shadow-emerald-950/40"
                  }`}
                >
                  {selectedUser.profile_image ? (
                    <img src={selectedUser.profile_image} alt={selectedUser.full_name} className="size-full object-cover" />
                  ) : selectedUser.role?.toUpperCase() === "SIBAT" ? (
                    <ShieldCheck className="size-6 sm:size-7" />
                  ) : (
                    <Users className="size-6 sm:size-7" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <DialogTitle className="break-words text-base font-black tracking-tight text-white sm:text-xl leading-snug">
                    {selectedUser.full_name}
                  </DialogTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-emerald-100/80">
                    <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                      {selectedUser.role || "USER"}
                    </span>
                    <span className="font-mono text-emerald-200/80">@{selectedUser.username}</span>
                    <span aria-hidden="true" className="text-emerald-400/50">•</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
                      <MapPin className="size-3 text-emerald-400 shrink-0" />
                      {userBarangayLabel(selectedUser)}
                    </span>
                  </div>
                </div>
              </div>
            </DialogHeader>

            {/* ── Scrollable Dossier Body (1-col on mobile, 2-col command layout on desktop) ── */}
            <div className="min-h-0 flex-1 space-y-3.5 sm:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 overflow-y-auto p-3.5 sm:p-6">
              {/* Left Column: Account Telemetry & Farm/SIBAT Profile */}
              <div className="space-y-3.5 sm:space-y-4 lg:col-span-5">
              {/* Account Telemetry Grid */}
              <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-2xs">
                <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
                        <Fingerprint className="size-4 text-[#2D5A27]" />
                        <span>Account Telemetry</span>
                      </CardTitle>
                      <CardDescription className="text-[11px]">Verified contact and municipal enrollment metadata</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2.5 p-3.5 sm:grid-cols-2 sm:p-4">
                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-[#2D5A27]">
                      <Mail className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Address</p>
                      <p className="mt-0.5 break-all text-xs sm:text-sm font-bold text-slate-900">{selectedUser.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-[#2D5A27]">
                      <Phone className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Phone</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900">{selectedUser.phone_number || "Not provided"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-[#2D5A27]">
                      <MapPin className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {selectedUser.role === "SIBAT" || selectedUser.role === "CBAT" ? "Assigned Barangay" : "Barangay"}
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900">{userBarangayLabel(selectedUser)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100/80 text-[#2D5A27]">
                      <Calendar className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Registered Date</p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900">
                        {new Date(selectedUser.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SIBAT Assignment Matrix */}
              {(selectedUser.role === "SIBAT" || selectedUser.role === "CBAT") && (
                <Card className="gap-0 overflow-hidden rounded-2xl border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-white to-white shadow-2xs">
                  <CardHeader className="border-b border-blue-100/80 bg-blue-50/40 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-950">
                      <ShieldCheck className="size-4 text-blue-700" />
                      <span>Field Reviewer Jurisdiction & Scope</span>
                    </CardTitle>
                    <CardDescription className="text-[11px]">Set the field barangay and record visibility scope</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3.5 p-3.5 sm:p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="sibat-assignment" className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Assigned barangay
                        </Label>
                        <Select
                          value={assignment}
                          onValueChange={setAssignment}
                          disabled={barangaysQuery.isLoading || barangaysQuery.isError || assignmentMutation.isPending}
                        >
                          <SelectTrigger id="sibat-assignment" className="h-10 rounded-xl bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {(barangaysQuery.data || []).map((b) => (
                              <SelectItem key={b.id} value={String(b.id)}>
                                {b.barangay_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="sibat-access-scope" className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Access scope
                        </Label>
                        <Select
                          value={accessScope}
                          onValueChange={(value) => setAccessScope(value as ApiUser["access_scope"])}
                          disabled={assignmentMutation.isPending}
                        >
                          <SelectTrigger id="sibat-access-scope" className="h-10 rounded-xl bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="ASSIGNED_ONLY">Assigned Barangay</SelectItem>
                            <SelectItem value="ALL_BARANGAYS">All Barangays</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Assigned scope requires a barangay. All Barangays expands visibility and verification while retaining the primary barangay and field reviewer role. Final approval remains with MAO/Admin.
                    </p>
                    <Button
                      size="sm"
                      disabled={assignmentMutation.isPending || barangaysQuery.isError || barangaysQuery.isLoading}
                      onClick={() =>
                        assignmentMutation.mutate(
                          { userId: selectedUser.id, barangayId: assignment === "unassigned" ? null : Number(assignment), accessScope },
                          { onSuccess: setSelectedUser }
                        )
                      }
                      className="w-full sm:w-auto min-h-10 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white font-bold text-xs px-4"
                    >
                      {assignmentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Saving assignment...
                        </>
                      ) : (
                        "Save assignment and scope"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Farmer Holding Profile */}
              {selectedUser.role?.toUpperCase() === "FARMER" && (
                <Card className="gap-0 overflow-hidden rounded-2xl border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-white to-white shadow-2xs">
                  <CardHeader className="border-b border-emerald-100/80 bg-emerald-50/40 px-4 py-3">
                    <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-950">
                      <Building2 className="size-4 text-[#2D5A27]" />
                      <span>Farm Holding Profile</span>
                    </CardTitle>
                    <CardDescription className="text-[11px]">Farmer parcel and herd declaration submitted during registration</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-3 sm:p-4">
                    <div className="rounded-xl border border-emerald-100 bg-white p-3">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Registered Cattle</p>
                      <p className="mt-1 font-mono text-sm sm:text-base font-black text-[#2D5A27]">{selectedUser.cattle_count} heads</p>
                    </div>

                    {selectedUser.farm_size !== null && (
                      <div className="rounded-xl border border-emerald-100 bg-white p-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Farm Size</p>
                        <p className="mt-1 font-mono text-sm sm:text-base font-black text-slate-900">{selectedUser.farm_size} ha</p>
                      </div>
                    )}

                    {selectedUser.rsbsa_number && (
                      <div className="col-span-2 sm:col-span-1 rounded-xl border border-emerald-100 bg-white p-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">RSBSA Number</p>
                        <p className="mt-1 break-all font-mono text-xs sm:text-sm font-black text-slate-900">{selectedUser.rsbsa_number}</p>
                      </div>
                    )}

                    {selectedUser.address && (
                      <div className="col-span-2 sm:col-span-3 rounded-xl border border-emerald-100 bg-white p-3">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">Farm Address / Sitio</p>
                        <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900 leading-snug">{selectedUser.address}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              </div>

              {/* Right Column: Registration Documents & Biometric Evidence */}
              <div className="lg:col-span-7">
              <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-2xs">
                <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
                        <FileText className="size-4 text-[#2D5A27] shrink-0" />
                        <span>Registration Documents</span>
                      </CardTitle>
                      <CardDescription className="mt-0.5 text-[11px]">Preview and verify each uploaded registration file</CardDescription>
                    </div>
                    <Badge variant="secondary" className="shrink-0 rounded-lg font-mono text-[11px] font-bold">
                      {(selectedUser.documents || []).length} {selectedUser.documents?.length === 1 ? "file" : "files"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-3.5 sm:p-4">
                  {selectedUser.role === "FARMER" ? (
                    <IdentityEvidencePanel
                      userId={selectedUser.id}
                      canAssess
                      onSelectUserId={(targetId) => {
                        const match = users.find((u) => u.id === targetId);
                        if (match) setSelectedUser(match);
                      }}
                    />
                  ) : null}
                  {(selectedUser.documents || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-7 text-center">
                      <FileText className="mx-auto size-6 text-slate-400" />
                      <p className="mt-2 text-xs sm:text-sm font-bold text-slate-700">No documents attached</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">No files were uploaded during registration.</p>
                    </div>
                  ) : (
                    selectedUser.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/50 p-3.5 transition-all hover:border-emerald-300/80 hover:bg-white"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100/80 text-[#2D5A27]">
                              <FileText className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-black text-slate-900 leading-snug">{getDocTypeLabel(doc)}</p>
                              <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">
                                {doc.file_name?.replace(/^(front|back)_/i, "") || "Attachment"}
                              </p>
                              <p className="mt-1 text-[10px] font-semibold text-slate-400">
                                Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0">{getDocStatusBadge(doc.verification_status)}</div>
                        </div>

                        {doc.review_remarks && (
                          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-800">
                            <p className="flex items-center gap-1.5 font-bold">
                              <AlertTriangle className="size-3.5 shrink-0" />
                              <span>Review remarks</span>
                            </p>
                            <p className="mt-1 pl-5 leading-relaxed">{doc.review_remarks}</p>
                          </div>
                        )}

                        {doc.approved_by_name && doc.verification_status === "APPROVED" && (
                          <p className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <Check className="size-3.5" />
                            <span>Verified by {doc.approved_by_name}</span>
                          </p>
                        )}

                        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPreviewDoc(doc)}
                            className="w-full sm:w-auto h-9 gap-1.5 rounded-xl bg-white text-xs font-bold"
                          >
                            <Eye className="size-3.5 shrink-0" />
                            <span>Preview file</span>
                          </Button>

                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                verifyDocMutation.isPending ||
                                doc.verification_status === "APPROVED" ||
                                doc.verification_status === "SUBJECT_TO_REVISION"
                              }
                              onClick={() => handleVerifyDocument(doc.id, "APPROVED")}
                              className="h-9 w-full sm:w-auto shrink min-w-0 whitespace-normal gap-1.5 rounded-xl bg-[#2D5A27] text-xs font-bold text-white hover:bg-[#23471f] disabled:opacity-50"
                            >
                              {doc.verification_status === "SUBJECT_TO_REVISION" ? (
                                <>
                                  <Clock className="size-3.5 shrink-0" />
                                  <span>Awaiting Replacement</span>
                                </>
                              ) : (
                                <>
                                  <Check className="size-3.5 shrink-0" />
                                  <span>
                                    {doc.verification_status === "APPROVED"
                                      ? "Approved"
                                      : "Approve file"}
                                  </span>
                                </>
                              )}
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                verifyDocMutation.isPending ||
                                doc.verification_status === "SUBJECT_TO_REVISION"
                              }
                              onClick={() => {
                                setRevisionDoc(doc);
                                setRevisionReason(doc.review_remarks || "");
                              }}
                              className="h-9 w-full sm:w-auto shrink min-w-0 whitespace-normal gap-1.5 rounded-xl border-rose-200 bg-white text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <RotateCcw className="size-3.5 shrink-0" />
                              <span>
                                {doc.verification_status === "SUBJECT_TO_REVISION"
                                  ? "Revision Requested"
                                  : "Request revision"}
                              </span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Documents are manually verified by MAO officers. Each file keeps its own review status.
                  </p>
                </CardContent>
              </Card>
              </div>
            </div>

            {/* ── Sticky Action Footer ── */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
              {selectedUser.account_status === "PENDING" || selectedUser.account_status === "SUBJECT_TO_REVISION" ? (
                (() => {
                  const hasDocRevision = (selectedUser.documents || []).some(
                    (d) => d.verification_status === "SUBJECT_TO_REVISION"
                  );
                  const hasDocPending = (selectedUser.documents || []).some(
                    (d) => d.verification_status === "PENDING"
                  );
                  const isAccountUnderRevision =
                    selectedUser.account_status === "SUBJECT_TO_REVISION" || hasDocRevision;

                  return (
                    <div className="space-y-2.5">
                      {isAccountUnderRevision && (
                        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold leading-relaxed text-rose-800">
                          Returned for Revision — Approval and revision actions are locked until the farmer uploads a replacement document.
                        </p>
                      )}
                      {!isAccountUnderRevision && hasDocPending && (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-800">
                          Review all pending documents before approving this account.
                        </p>
                      )}
                      <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={deleteUserMutation.isPending || updateStatusMutation.isPending}
                          onClick={() => setUserToDelete(selectedUser)}
                          className="w-full sm:w-auto shrink-0 min-h-11 py-2.5 px-4 gap-1.5 rounded-xl border-rose-200 font-bold text-xs uppercase tracking-wider text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="size-4 shrink-0" />
                          <span>Delete</span>
                        </Button>
                        <Button
                          variant="outline"
                          disabled={
                            isAccountUnderRevision ||
                            updateStatusMutation.isPending ||
                            deleteUserMutation.isPending
                          }
                          onClick={() => handleStatusUpdate(selectedUser.id, "SUBJECT_TO_REVISION")}
                          className="w-full sm:flex-1 shrink min-w-0 whitespace-normal h-auto min-h-11 py-2.5 gap-2 rounded-xl border-amber-300 font-bold text-xs uppercase tracking-wider text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          <RotateCcw className="size-4 shrink-0" />
                          <span>
                            {isAccountUnderRevision
                              ? "Returned for Revision"
                              : "Return for revision"}
                          </span>
                        </Button>
                        <Button
                          disabled={
                            isAccountUnderRevision ||
                            hasDocPending ||
                            updateStatusMutation.isPending ||
                            deleteUserMutation.isPending
                          }
                          onClick={() => handleStatusUpdate(selectedUser.id, "APPROVED")}
                          className="w-full sm:flex-1 shrink min-w-0 whitespace-normal h-auto min-h-11 py-2.5 gap-2 rounded-xl bg-[#2D5A27] font-black text-xs uppercase tracking-wider text-white hover:bg-[#23471f] disabled:opacity-50"
                        >
                          <Check className="size-4 shrink-0" />
                          <span>
                            {isAccountUnderRevision
                              ? "Awaiting Farmer Revision"
                              : "Approve account"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setSelectedUser(null)}
                  className="w-full min-h-11 rounded-xl font-bold text-xs uppercase tracking-wider"
                >
                  Close review
                </Button>
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

      {/* Delete Pending Registration Confirmation Dialog */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        {userToDelete && (
          <DialogContent className="max-w-md rounded-3xl p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-black text-rose-900">
                <Trash2 className="size-5 text-rose-600 shrink-0" />
                <span>Delete Pending Registration?</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed pt-1">
              <p>
                You are about to permanently remove the unapproved registration for{" "}
                <strong className="text-slate-900">{userToDelete.full_name}</strong> (
                <span className="font-mono text-slate-700">{userToDelete.email}</span>).
              </p>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-1.5 text-rose-900">
                <p className="font-bold text-[11px] uppercase tracking-wider">What this action does:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>Deletes the pending user account and farmer registration profile.</li>
                  <li>Purges uploaded registration documents (ID / RSBSA files) and identity attempt metadata.</li>
                  <li>Frees up their email address so they can register again if needed.</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={deleteUserMutation.isPending}
                onClick={() => setUserToDelete(null)}
                className="flex-1 rounded-xl font-bold text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={deleteUserMutation.isPending}
                onClick={() => {
                  deleteUserMutation.mutate(userToDelete.id, {
                    onSuccess: () => {
                      if (selectedUser?.id === userToDelete.id) {
                        setSelectedUser(null);
                      }
                      setUserToDelete(null);
                    },
                  });
                }}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5"
              >
                {deleteUserMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    <span>Permanently Delete</span>
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

    </>
  );
}
