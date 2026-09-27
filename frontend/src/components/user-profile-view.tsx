"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  User as UserIcon,
  Shield,
  Key,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Bell,
  Save,
  ShieldCheck,
  Activity,
  History,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

export function UserProfileView() {
  const { user, logout } = useAuth();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "overview";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "Municipal",
    lastName: user?.lastName || "Officer",
    email: user?.email || "officer@padregarcia.gov.ph",
    phone: "0917-555-8291",
    barangay: "Poblacion",
    department: "Municipal Agriculture Office (MAO)",
    title: user?.role === "FARMER" ? "Registered Raiser" : user?.role === "SIBAT" ? "Field Inspector" : "Agricultural Officer",
  });

  // Password fields
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);

  // Notification preferences
  const [notifs, setNotifs] = useState({
    emailAlerts: true,
    smsBiosecurity: true,
    weeklyDigest: false,
    auditNotifications: true,
  });

  const userDisplayName =
    formData.firstName && formData.lastName
      ? `${formData.firstName} ${formData.lastName}`
      : user?.email?.split("@")[0] || "Municipal User";

  const userInitials =
    formData.firstName && formData.lastName
      ? `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase()
      : user?.email ? user.email.slice(0, 2).toUpperCase() : "PG";

  const roleDisplay =
    user?.role === "MAO" || user?.role === "ADMIN"
      ? "LGU Agricultural Administrator"
      : user?.role === "FARMER"
      ? "Padre Garcia Livestock Raiser"
      : user?.role === "SIBAT"
      ? "SIBAT Meat & Movement Inspector"
      : user?.role === "AUCTION"
      ? "PGLAM Auction Officer"
      : "Municipal Agriculture Officer";

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
      toast.success("Profile information updated successfully!");
    }, 600);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.newPass || passwords.newPass.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setPasswords({ current: "", newPass: "", confirm: "" });
      toast.success("Security password updated successfully!");
    }, 600);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-3 sm:p-5 md:p-6 space-y-4">
      {/* ── Executive Cover Banner & Identity Header ── */}
      <div className="relative rounded-3xl bg-white border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Cover Landscape */}
        <div className="h-36 sm:h-44 bg-gradient-to-r from-emerald-950 via-[#1E3D1A] to-slate-900 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,90,39,0.5),transparent_60%)]" />
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-2">
            <Badge className="bg-emerald-500/25 text-emerald-200 border border-emerald-400/30 text-[10px] font-black uppercase px-2.5 py-1">
              Active Official Account
            </Badge>
          </div>
        </div>

        {/* Profile Info Row */}
        <div className="px-4 sm:px-6 pb-5 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14">
          <div className="flex items-end gap-3.5">
            {/* Avatar Pill */}
            <div className="size-20 sm:size-24 rounded-2xl bg-[#2D5A27] border-4 border-white shadow-md text-white font-black text-2xl sm:text-3xl flex items-center justify-center shrink-0">
              {userInitials}
            </div>

            <div className="space-y-1 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                  {userDisplayName}
                </h1>
                <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-black uppercase px-2 py-0.5">
                  {user?.role || "OFFICER"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 font-semibold">{roleDisplay}</p>
              <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3 text-emerald-700" />
                  <span>Brgy. {formData.barangay}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3 text-slate-400" />
                  <span>Padre Garcia MAO</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-end">
            <Button
              variant={isEditing ? "outline" : "default"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className={`rounded-xl text-xs font-bold h-8.5 px-3.5 ${
                !isEditing
                  ? "bg-[#2D5A27] hover:bg-[#23461f] text-white"
                  : "border-slate-200 text-slate-700"
              }`}
            >
              {isEditing ? "Cancel Editing" : "Edit Profile"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Tab Navigation & Content ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        {/* Tab switcher */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar">
          <TabsList className="bg-slate-100/90 p-1 rounded-xl h-auto flex gap-1 w-max sm:w-auto">
            <TabsTrigger
              value="overview"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center gap-1.5 text-slate-600 cursor-pointer"
            >
              <span>👤</span>
              <span>Account Details</span>
            </TabsTrigger>

            <TabsTrigger
              value="security"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-[#1E4D6B] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center gap-1.5 text-slate-600 cursor-pointer"
            >
              <span>🛡️</span>
              <span>Security & Password</span>
            </TabsTrigger>

            <TabsTrigger
              value="notifications"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center gap-1.5 text-slate-600 cursor-pointer"
            >
              <span>🔔</span>
              <span>Alert Preferences</span>
            </TabsTrigger>

            <TabsTrigger
              value="activity"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center gap-1.5 text-slate-600 cursor-pointer"
            >
              <span>⚡</span>
              <span>Session & Audit</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: ACCOUNT DETAILS ── */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Personal Information & Office Credentials
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official records for Padre Garcia municipal agricultural governance.
                  </p>
                </div>
                {isEditing && (
                  <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px] font-bold">
                    Editing Mode
                  </Badge>
                )}
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">First Name</Label>
                    <Input
                      disabled={!isEditing}
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="h-9 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Last Name</Label>
                    <Input
                      disabled={!isEditing}
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="h-9 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Email Address</Label>
                    <Input
                      disabled={!isEditing}
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-9 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Mobile Phone</Label>
                    <Input
                      disabled={!isEditing}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-9 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Assigned Barangay Origin</Label>
                    <Input
                      disabled={!isEditing}
                      value={formData.barangay}
                      onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                      className="h-9 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Department / Office</Label>
                    <Input
                      disabled
                      value={formData.department}
                      className="h-9 text-xs rounded-xl bg-slate-100 opacity-80"
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      className="text-xs font-bold rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSaving}
                      className="bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold text-xs rounded-xl gap-1.5 h-8.5 px-4 shadow-2xs"
                    >
                      <Save className="size-3.5" />
                      <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: SECURITY & PASSWORD ── */}
        <TabsContent value="security" className="space-y-4">
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Security Credentials & Password Management
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ensure your account is protected with strong password policies.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                  <ShieldCheck className="size-4" />
                  <span>2FA Protected</span>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Current Password</Label>
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Enter current password"
                    value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    className="h-9 text-xs rounded-xl bg-slate-50/80"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">New Password</Label>
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Minimum 6 characters"
                    value={passwords.newPass}
                    onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                    className="h-9 text-xs rounded-xl bg-slate-50/80"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Confirm New Password</Label>
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Repeat new password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    className="h-9 text-xs rounded-xl bg-slate-50/80"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    {showPass ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    <span>{showPass ? "Hide Passwords" : "Show Passwords"}</span>
                  </button>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSaving || !passwords.newPass}
                    className="bg-[#1E4D6B] hover:bg-[#16384f] text-white font-bold text-xs rounded-xl gap-1.5 h-8.5 px-4 shadow-2xs"
                  >
                    <Lock className="size-3.5" />
                    <span>{isSaving ? "Updating..." : "Update Password"}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: NOTIFICATION PREFERENCES ── */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Notification Dispatch Preferences
                </h3>
                <p className="text-xs text-slate-500">
                  Choose how and when Padre Garcia MAO alerts reach your devices.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Biosecurity & Disease Alerts</h4>
                    <p className="text-[11px] text-slate-500">
                      Emergency quarantine notices and outbreak warnings via SMS & Push.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifs.smsBiosecurity}
                    onChange={(e) => setNotifs({ ...notifs, smsBiosecurity: e.target.checked })}
                    className="size-4 accent-[#2D5A27] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Data Validation & Audit Updates</h4>
                    <p className="text-[11px] text-slate-500">
                      Email notifications whenever submissions are certified or need revision.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifs.auditNotifications}
                    onChange={(e) => setNotifs({ ...notifs, auditNotifications: e.target.checked })}
                    className="size-4 accent-[#2D5A27] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Weekly Agricultural Digest</h4>
                    <p className="text-[11px] text-slate-500">
                      Weekly recap of municipal livestock census and market transactions.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifs.weeklyDigest}
                    onChange={(e) => setNotifs({ ...notifs, weeklyDigest: e.target.checked })}
                    className="size-4 accent-[#2D5A27] cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: SESSION & AUDIT TRAIL ── */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    Active Session & Recent Security Events
                  </h3>
                  <p className="text-xs text-slate-500">
                    Monitored authentication activity for account governance.
                  </p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-bold">
                  Device Secure
                </Badge>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                      <Activity className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Current Active Session</p>
                      <p className="text-[11px] text-slate-500">Padre Garcia Network • Web Browser</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    Now Active
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                      <History className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Token Refreshed</p>
                      <p className="text-[11px] text-slate-500">Municipal API Token Auth (JWT)</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Today, 12:45 PM
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
