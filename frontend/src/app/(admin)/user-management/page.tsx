"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/page-header";
import {
  ApiUser,
  UserAccountStatus,
  useUsersDirectory,
  useUpdateUserStatus,
  useUpdateSibatAssignment,
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
} from "lucide-react";
import { useAdminBarangays } from "../admin/admin-charts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export type { ApiUser, UserAccountStatus };

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "pending" | "farmer" | "sibat">("all");
  const [barangayFilter, setBarangayFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [assignment, setAssignment] = useState("unassigned");
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
  const pendingCount = users.filter((u) => u.account_status === "PENDING").length;
  const handleStatusUpdate = (id: number, newStatus: UserAccountStatus) => {
    updateStatusMutation.mutate({ userId: id, status: newStatus }, {
      onSuccess: (updated) => setSelectedUser((current) => current?.id === id ? updated : current),
    });
  };
  const openProfile = (user: ApiUser) => {
    setSelectedUser(user);
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
                              <span className="text-[9px] text-slate-400">• {user.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2 text-xs font-semibold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#2D5A27] shrink-0" />
                          <span>{userBarangayLabel(user)}</span>
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

      {/* PROFILE MODAL (shadcn Dialog) */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        {selectedUser && (
          <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:p-6 bg-white border-none shadow-2xl [&>button]:right-8 [&>button]:top-8 [&>button]:p-2 [&>button]:rounded-full [&>button]:hover:bg-gray-100">
            <DialogHeader className="text-center mb-4">
              <div
                className={`size-20 mx-auto rounded-3xl flex items-center justify-center mb-4 overflow-hidden ${
                  selectedUser.role?.toUpperCase() === "SIBAT"
                    ? "bg-blue-600 text-white"
                    : "bg-green-100 text-[#2D5A27]"
                }`}
              >
                {selectedUser.profile_image ? (
                  <img
                    src={selectedUser.profile_image}
                    alt={selectedUser.full_name}
                    className="size-full object-cover"
                  />
                ) : selectedUser.role?.toUpperCase() === "SIBAT" ? (
                  <ShieldCheck size={40} />
                ) : (
                  <Users size={40} />
                )}
              </div>
              <DialogTitle className="text-2xl font-black text-gray-900 text-center">
                {selectedUser.full_name}
              </DialogTitle>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mt-1">
                {selectedUser.username} • {selectedUser.role}
              </p>
            </DialogHeader>

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-2xl flex flex-wrap justify-between gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">Email</span>
                <span className="text-sm font-bold break-all">{selectedUser.email}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl flex flex-wrap justify-between gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">
                  Contact Phone
                </span>
                <span className="text-sm font-bold">
                  {selectedUser.phone_number || "Not provided"}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl flex flex-wrap justify-between gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">{selectedUser.role === "SIBAT" ? "Assigned Barangay" : "Barangay"}</span>
                <span className="text-sm font-bold">
                  {userBarangayLabel(selectedUser)}
                </span>
              </div>
              {selectedUser.role === "SIBAT" && (
                <div className="space-y-2 rounded-xl bg-blue-50 p-3">
                  <Label htmlFor="sibat-assignment">SIBAT review barangay</Label>
                  <Select value={assignment} onValueChange={setAssignment} disabled={barangaysQuery.isLoading || barangaysQuery.isError || assignmentMutation.isPending}>
                    <SelectTrigger id="sibat-assignment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(barangaysQuery.data || []).map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.barangay_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-600">An unassigned SIBAT cannot access private barangay review records.</p>
                  <Button size="sm" disabled={assignmentMutation.isPending || barangaysQuery.isError || barangaysQuery.isLoading} onClick={() => assignmentMutation.mutate({ userId: selectedUser.id, barangayId: assignment === "unassigned" ? null : Number(assignment) }, { onSuccess: setSelectedUser })}>
                    {assignmentMutation.isPending ? "Saving..." : "Save Assignment"}
                  </Button>
                </div>
              )}
              <p className="text-xs text-slate-500">Registered: {new Date(selectedUser.created_at).toLocaleDateString()}</p>
              {(selectedUser.documents || []).length > 0 && <div className="space-y-2">
                <p className="text-xs font-semibold">Registration documents</p>
                {selectedUser.documents.map((doc) => <a key={doc.id} href={doc.document_file} target="_blank" rel="noopener noreferrer" className="block text-xs text-emerald-800 underline">
                  {doc.document_type.replaceAll("_", " ")} · {doc.verification_status.replaceAll("_", " ")}
                </a>)}
              </div>}
              {selectedUser.role?.toUpperCase() === "FARMER" && (
                <>
                  <div className="p-4 bg-green-50 rounded-2xl flex justify-between">
                    <span className="text-[10px] font-black text-green-600 uppercase">
                      Active Livestock
                    </span>
                    <span className="text-sm font-black text-green-700">
                      {selectedUser.cattle_count} Heads
                    </span>
                  </div>
                  {selectedUser.farm_size !== null && (
                    <div className="p-4 bg-gray-50 rounded-2xl flex flex-wrap justify-between gap-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase">
                        Farm Size
                      </span>
                      <span className="text-sm font-bold">{selectedUser.farm_size} ha</span>
                    </div>
                  )}
                </>
              )}
              <div className="p-4 bg-gray-50 rounded-2xl flex flex-wrap justify-between gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase">
                  Account Status
                </span>
                <div>{getStatusBadge(selectedUser.account_status)}</div>
              </div>
            </div>

            {selectedUser.account_status === "PENDING" || selectedUser.account_status === "SUBJECT_TO_REVISION" ? (
              <div className="flex gap-2 mt-6">
                <Button
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    handleStatusUpdate(selectedUser.id, "APPROVED");
                  }}
                  className="flex-1 py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-md cursor-pointer disabled:opacity-50"
                >
                  Approve Account
                </Button>
                <Button
                  variant="outline"
                  disabled={updateStatusMutation.isPending}
                  onClick={() => {
                    handleStatusUpdate(selectedUser.id, "SUBJECT_TO_REVISION");
                  }}
                  className="flex-1 py-6 border-rose-300 text-rose-900 hover:bg-rose-50 rounded-2xl font-black uppercase text-xs tracking-widest gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="size-4 text-rose-700" />
                  Return for Revision
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setSelectedUser(null)}
                className="w-full mt-6 py-6 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-800 hover:shadow-xl transition-all cursor-pointer"
              >
                Close
              </Button>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
