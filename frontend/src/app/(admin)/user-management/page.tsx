"use client";

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';

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
  Edit3,
  ChevronRight,
  Search,
  CheckCircle2,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  barangay: string;
  role: 'Farmer' | 'Barangay Rep' | 'SIBAT';
  status: 'active' | 'suspended';
  cattleCount: number;
  phone: string;
}

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'farmer' | 'sibat'>('all');

  // Notification state for quick actions
  const [notification, setNotification] = useState<string | null>(null);

  const barangays = [
    "San Roque", "Banaba Ibaba", "Quilo-quilo", "Castillo", "Maugat",
    "Bukal", "Balagtas", "Concepcion", "Dagatan", "Ilang-Ilang",
    "Lumbang", "Malaking Pook", "Poblacion", "Sampaga", "Talisay",
    "Ulong Tubig", "Wawa", "Zalaza"
  ];

  const [users, setUsers] = useState<User[]>(
    barangays.map((bgry, index) => {
      let role: 'Farmer' | 'Barangay Rep' | 'SIBAT' = 'Farmer';
      if (index % 6 === 0) role = 'SIBAT';
      else if (index % 3 === 0) role = 'Barangay Rep';

      return {
        id: `ID-2026-${index + 100}`,
        name: `${role === 'SIBAT' ? 'Officer' : role} ${index + 1}`,
        barangay: bgry,
        role: role,
        status: 'active',
        cattleCount: role === 'Farmer' ? Math.floor(Math.random() * 10) + 1 : 0,
        phone: `0917-555-${index + 1000}`,
      };
    })
  );

  // Quick Action Handlers
  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStatusToggle = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u));
    triggerNotification("User status updated successfully");
  };

  const handlePasswordReset = (name: string) => {
    triggerNotification(`Password reset link sent to ${name}`);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.barangay.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = activeFilter === 'all' || user.role.toLowerCase() === activeFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <>
      {/* Floating Notification Toast */}
        {notification && (
          <div className="fixed top-8 right-8 z-[100] animate-in slide-in-from-right-full duration-300">
            <div className="bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <CheckCircle2 className="text-green-400" size={20} />
              <p className="text-sm font-bold">{notification}</p>
            </div>
          </div>
        )}

        <PageHeader
          title="Personnel Directory"
          subtitle="Manage 18 Barangay Personnel & SIBAT Audit Officers"
          maxWidthClass="w-full"
        />

        <div className="w-full space-y-3.5 p-3 sm:p-4 md:p-5">
          {/* Controls Area */}
          <div className="flex flex-col md:flex-row gap-2.5 items-center justify-between bg-white p-3 rounded-xl shadow-2xs border border-slate-200/80">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input
                type="text"
                placeholder="Search name or barangay..."
                className="w-full pl-9 pr-3 py-1.5 h-8 bg-slate-50/80 border-slate-200/80 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#2D5A27] transition-all text-xs font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)} className="w-full md:w-auto">
              <TabsList className="bg-slate-100/80 p-0.5 rounded-lg h-auto border border-slate-200/60">
                {['all', 'farmer', 'sibat'].map((filter) => (
                  <TabsTrigger
                    key={filter}
                    value={filter}
                    className="px-3.5 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs text-slate-400"
                  >
                    {filter}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
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
                    Barangay
                  </TableHead>
                  <TableHead className="px-3.5 py-2.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    Status
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
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="group hover:bg-slate-50/90 transition-colors border-none cursor-pointer"
                  >
                    <TableCell className="px-3.5 py-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${user.role === "SIBAT"
                            ? "bg-blue-600 text-white"
                            : "bg-emerald-100 text-[#2D5A27]"
                            }`}
                        >
                          {user.role === "SIBAT" ? (
                            <ShieldCheck size={14} />
                          ) : (
                            <Users size={14} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-xs text-slate-800">{user.name}</p>
                          <span className="text-[9px] font-black text-slate-400 uppercase">
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-3.5 py-2 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} className="text-[#2D5A27] shrink-0" /> {user.barangay}
                      </div>
                    </TableCell>

                    <TableCell className="px-3.5 py-2">
                      <Badge
                        variant="outline"
                        className={`border-none text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${user.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                          }`}
                      >
                        {user.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="px-3.5 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePasswordReset(user.name)}
                          title="Reset Password"
                          className="h-7 w-7 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          <Key size={13} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStatusToggle(user.id)}
                          title={
                            user.status === "active" ? "Suspend User" : "Activate User"
                          }
                          className={`h-7 w-7 hover:bg-slate-100 rounded-md transition-colors cursor-pointer ${user.status === "active"
                            ? "text-slate-400 hover:text-rose-600"
                            : "text-rose-600 hover:text-emerald-600"
                            }`}
                        >
                          <UserMinus size={13} />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit Basic Info"
                          className="h-7 w-7 hover:bg-slate-100 rounded-md text-slate-400 hover:text-[#2D5A27] transition-colors cursor-pointer"
                        >
                          <Edit3 size={13} />
                        </Button>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* PROFILE MODAL (shadcn Dialog) */}
        <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          {selectedUser && (
            <DialogContent className="sm:max-w-md rounded-[3rem] p-10 bg-white border-none shadow-2xl [&>button]:right-8 [&>button]:top-8 [&>button]:p-2 [&>button]:rounded-full [&>button]:hover:bg-gray-100">
              <DialogHeader className="text-center mb-4">
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 ${selectedUser.role === 'SIBAT' ? 'bg-blue-600 text-white' : 'bg-green-100 text-[#2D5A27]'
                  }`}>
                  {selectedUser.role === 'SIBAT' ? <ShieldCheck size={40} /> : <Users size={40} />}
                </div>
                <DialogTitle className="text-2xl font-black text-gray-900 text-center">{selectedUser.name}</DialogTitle>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mt-1">{selectedUser.id}</p>
              </DialogHeader>

              <div className="space-y-3">
                <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Contact</span>
                  <span className="text-sm font-bold">{selectedUser.phone}</span>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl flex justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Barangay</span>
                  <span className="text-sm font-bold">{selectedUser.barangay}</span>
                </div>
                {selectedUser.role === 'Farmer' && (
                  <div className="p-4 bg-green-50 rounded-2xl flex justify-between">
                    <span className="text-[10px] font-black text-green-600 uppercase">Cattle Registered</span>
                    <span className="text-sm font-black text-green-700">{selectedUser.cattleCount} Heads</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setSelectedUser(null)}
                className="w-full mt-6 py-6 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-800 hover:shadow-xl transition-all"
              >
                Done
              </Button>
            </DialogContent>
          )}
        </Dialog>
    </>
  );
}
