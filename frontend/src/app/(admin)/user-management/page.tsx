"use client";

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/app/components/page-header';
import api from '@/lib/axios';

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
  Key,
  UserMinus,
  UserCheck,
  Check,
  X,
  ChevronRight,
  Search,
  CheckCircle2,
  Loader2,
  Clock,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

export interface ApiUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string;
  role: string;
  account_status: "PENDING" | "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "SUSPENDED";
  created_at: string;
  approved_at: string | null;
  barangay: string;
  barangay_id: number | null;
  farm_size: number | null;
  address: string;
  cattle_count: number;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'farmer' | 'sibat'>('all');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users/directory/');
      setUsers(response.data);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      toast.error("Failed to load user directory. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleStatusUpdate = async (id: number, newStatus: "APPROVED" | "SUBJECT_TO_REVISION" | "REJECTED" | "SUSPENDED" | "PENDING") => {
    setActionLoadingId(id);
    try {
      const response = await api.patch(`/api/users/${id}/status/`, { status: newStatus });
      setUsers(prev => prev.map(u => u.id === id ? response.data : u));
      const verb = newStatus === 'APPROVED' ? 'approved' : (newStatus === 'REJECTED' || newStatus === 'SUBJECT_TO_REVISION') ? 'returned for revision' : newStatus === 'SUSPENDED' ? 'suspended' : 'updated';
      toast.success(`User account ${verb} successfully.`);
    } catch (err: any) {
      console.error("Status update error:", err);
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to update user status.";
      toast.error(errMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePasswordReset = (name: string) => {
    toast.info(`Password reset instruction triggered for ${name}`);
  };

  const pendingCount = users.filter(u => u.account_status === 'PENDING').length;

  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      user.full_name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      user.barangay.toLowerCase().includes(q);

    let matchesFilter = true;
    if (activeFilter === 'pending') {
      matchesFilter = user.account_status === 'PENDING';
    } else if (activeFilter === 'farmer') {
      matchesFilter = user.role?.toUpperCase() === 'FARMER';
    } else if (activeFilter === 'sibat') {
      matchesFilter = user.role?.toUpperCase() === 'SIBAT';
    }

    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: ApiUser['account_status']) => {
    switch (status) {
      case 'APPROVED':
        return (
          <Badge variant="outline" className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            Approved
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">
            <Clock size={10} /> Pending
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge variant="outline" className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
            Suspended
          </Badge>
        );
      case 'SUBJECT_TO_REVISION':
      case 'REJECTED':
        return (
          <Badge variant="outline" className="border-none text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
            For Revision
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-none text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-slate-100 text-slate-800">
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
        maxWidthClass="w-full"
      />

      <div className="w-full space-y-3.5 p-3 sm:p-4 md:p-5">
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
            <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)} className="w-full md:w-auto">
              <TabsList className="bg-slate-100/80 p-0.5 rounded-lg h-auto border border-slate-200/60 flex flex-wrap">
                <TabsTrigger
                  value="all"
                  className="px-3.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs text-slate-400"
                >
                  All ({users.length})
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
              onClick={fetchUsers}
              disabled={loading}
              title="Refresh Directory"
              className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-slate-50 shrink-0"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* List Table */}
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70 hover:bg-slate-50/70 border-b border-slate-200/70">
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  User / Role
                </TableHead>
                <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Barangay / Address
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
              {loading ? (
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
                      <p className="text-xs font-bold text-slate-600">No users found matching your filters</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your search query or tab filter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isPending = user.account_status === 'PENDING';
                  const isApproved = user.account_status === 'APPROVED';
                  const isSuspended = user.account_status === 'SUSPENDED';
                  const isActionLoading = actionLoadingId === user.id;

                  return (
                    <TableRow
                      key={user.id}
                      className="group hover:bg-slate-50/90 transition-colors border-none cursor-pointer"
                    >
                      <TableCell className="px-3.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              user.role?.toUpperCase() === "SIBAT"
                                ? "bg-blue-600 text-white"
                                : user.role?.toUpperCase() === "MAO"
                                ? "bg-amber-600 text-white"
                                : "bg-emerald-100 text-[#2D5A27]"
                            }`}
                          >
                            {user.role?.toUpperCase() === "SIBAT" ? (
                              <ShieldCheck size={14} />
                            ) : (
                              <Users size={14} />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-slate-800">{user.full_name}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase">
                                {user.role || 'User'}
                              </span>
                              <span className="text-[9px] text-slate-400">• {user.email}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-3.5 py-2 text-xs font-semibold text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#2D5A27] shrink-0" />
                          <span>{user.barangay || user.address || "Padre Garcia"}</span>
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
                                className="h-7 px-2 text-[10px] font-black text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-md gap-1 cursor-pointer"
                              >
                                <RotateCcw size={12} />
                                <span>Revision</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePasswordReset(user.full_name);
                                }}
                                title="Reset Password"
                                className="h-7 w-7 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                <Key size={13} />
                              </Button>

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
                          onClick={() => setSelectedUser(user)}
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
          <DialogContent className="sm:max-w-md rounded-[3rem] p-10 bg-white border-none shadow-2xl [&>button]:right-8 [&>button]:top-8 [&>button]:p-2 [&>button]:rounded-full [&>button]:hover:bg-gray-100">
            <DialogHeader className="text-center mb-4">
              <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 ${
                selectedUser.role?.toUpperCase() === 'SIBAT'
                  ? 'bg-blue-600 text-white'
                  : 'bg-green-100 text-[#2D5A27]'
              }`}>
                {selectedUser.role?.toUpperCase() === 'SIBAT' ? <ShieldCheck size={40} /> : <Users size={40} />}
              </div>
              <DialogTitle className="text-2xl font-black text-gray-900 text-center">{selectedUser.full_name}</DialogTitle>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mt-1">
                {selectedUser.username} • {selectedUser.role}
              </p>
            </DialogHeader>

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase">Email</span>
                <span className="text-sm font-bold">{selectedUser.email}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase">Contact Phone</span>
                <span className="text-sm font-bold">{selectedUser.phone_number || "Not provided"}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase">Barangay</span>
                <span className="text-sm font-bold">{selectedUser.barangay || "Padre Garcia"}</span>
              </div>
              {selectedUser.role?.toUpperCase() === 'FARMER' && (
                <>
                  <div className="p-4 bg-green-50 rounded-2xl flex justify-between">
                    <span className="text-[10px] font-black text-green-600 uppercase">Cattle Registered</span>
                    <span className="text-sm font-black text-green-700">{selectedUser.cattle_count} Heads</span>
                  </div>
                  {selectedUser.farm_size !== null && (
                    <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase">Farm Size</span>
                      <span className="text-sm font-bold">{selectedUser.farm_size} ha</span>
                    </div>
                  )}
                </>
              )}
              <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase">Account Status</span>
                <div>{getStatusBadge(selectedUser.account_status)}</div>
              </div>
            </div>

            {selectedUser.account_status === 'PENDING' ? (
              <div className="flex gap-2 mt-6">
                <Button
                  onClick={() => {
                    handleStatusUpdate(selectedUser.id, "APPROVED");
                    setSelectedUser(null);
                  }}
                  className="flex-1 py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-md"
                >
                  Approve Account
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleStatusUpdate(selectedUser.id, "SUBJECT_TO_REVISION");
                    setSelectedUser(null);
                  }}
                  className="flex-1 py-6 border-amber-300 text-amber-900 hover:bg-amber-50 rounded-2xl font-black uppercase text-xs tracking-widest gap-2"
                >
                  <RotateCcw className="size-4 text-amber-700" />
                  Return for Revision
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setSelectedUser(null)}
                className="w-full mt-6 py-6 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-800 hover:shadow-xl transition-all"
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
