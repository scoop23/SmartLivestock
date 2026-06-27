"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { PageHeader } from '../components/page-header';
import {
  Search,
  X,
  MapPin,
  Users,
  ShieldCheck,
  ChevronRight,
  Key,
  UserMinus,
  Edit3,
  CheckCircle2
} from 'lucide-react';

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
  const router = useRouter();
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
    <div className="flex min-h-screen bg-[#F9FAFB]">
      <div className='hidden md:block'>
        <Sidebar role="lgu" onLogout={() => router.push('/')} />

      </div>

      <main className="flex-1 overflow-auto relative">

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
        />

        <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-8">
          {/* Controls Area */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search name or barangay..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex bg-gray-100 p-1 rounded-2xl overflow-hidden">
              {['all', 'farmer', 'sibat'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter as any)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === filter ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* List Table */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 text-left">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">User / Role</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Barangay</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Quick Actions</th>
                  <th className="px-8 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-gray-50/80 transition-all">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.role === 'SIBAT' ? 'bg-blue-600 text-white' : 'bg-green-100 text-[#2D5A27]'
                          }`}>
                          {user.role === 'SIBAT' ? <ShieldCheck size={20} /> : <Users size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{user.name}</p>
                          <span className="text-[9px] font-black text-gray-400 uppercase">{user.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm font-bold text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-gray-300" /> {user.barangay}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        {/* Quick Action Buttons */}
                        <button
                          onClick={() => handlePasswordReset(user.name)}
                          title="Reset Password"
                          className="p-2 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-blue-600 transition-all"
                        >
                          <Key size={16} />
                        </button>
                        <button
                          onClick={() => handleStatusToggle(user.id)}
                          title={user.status === 'active' ? 'Suspend User' : 'Activate User'}
                          className={`p-2 hover:bg-white hover:shadow-md rounded-lg transition-all ${user.status === 'active' ? 'text-gray-400 hover:text-red-600' : 'text-red-600 hover:text-green-600'
                            }`}
                        >
                          <UserMinus size={16} />
                        </button>
                        <button
                          title="Edit Basic Info"
                          className="p-2 hover:bg-white hover:shadow-md rounded-lg text-gray-400 hover:text-[#2D5A27] transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 bg-gray-100 rounded-xl text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PROFILE MODAL (Remains as Detail View) */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[3rem] p-10 relative shadow-2xl">
              <button onClick={() => setSelectedUser(null)} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full">
                <X size={24} className="text-gray-400" />
              </button>

              <div className="text-center mb-8">
                <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 ${selectedUser.role === 'SIBAT' ? 'bg-blue-600 text-white' : 'bg-green-100 text-[#2D5A27]'
                  }`}>
                  {selectedUser.role === 'SIBAT' ? <ShieldCheck size={40} /> : <Users size={40} />}
                </div>
                <h2 className="text-2xl font-black text-gray-900">{selectedUser.name}</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{selectedUser.id}</p>
              </div>

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

              <button
                onClick={() => setSelectedUser(null)}
                className="w-full mt-8 py-5 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:shadow-xl transition-all"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
