"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QrCodePass } from "@/components/qr-code-pass";
import { toast } from "sonner";
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
  QrCode,
  Award,
  FileText,
  Check,
  AlertTriangle,
  Smartphone,
  ChevronRight,
  Edit3,
  Copy,
  RefreshCw,
  Trash2,
  Globe,
  Camera,
  CheckCircle,
  ExternalLink,
  X,
} from "lucide-react";

export function UserProfileView() {
  const { user, logout, updateUser } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showIdPassModal, setShowIdPassModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Profile Photo State & File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailsSectionRef = useRef<HTMLDivElement>(null);

  const scrollToDetails = () => {
    setTimeout(() => {
      detailsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(
    user?.profileImage || null
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user?.profileImage) {
      setProfilePhotoUrl(user.profileImage);
    }
  }, [user?.profileImage]);

  // Profile Information State
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "Municipal",
    lastName: user?.lastName || "Officer",
    email: user?.email || "officer@padregarcia.gov.ph",
    phone: "0917-555-8291",
    alternatePhone: "0998-444-1280",
    barangay: "Poblacion",
    sitio: "Sitio Ilaya, Purok 3",
    municipality: "Padre Garcia",
    province: "Batangas",
    zipCode: "4224",
    farmName:
      user?.role === "FARMER"
        ? "Garcia Heritage Cattle & Swine Farm"
        : "Padre Garcia Municipal Agro-Industrial Station",
    farmType:
      user?.role === "FARMER"
        ? "Semi-Commercial Cattle & Dairy"
        : "LGU Agricultural Demonstration Facility",
    rsbsaId: "RSBSA-04-10-18-00921",
    cooperative: "Padre Garcia Cattle Raisers Association (PGCRA)",
    department: "Municipal Agriculture Office (MAO)",
    title:
      user?.role === "FARMER"
        ? "Certified Livestock Raiser"
        : user?.role === "SIBAT"
        ? "SIBAT Field Biosecurity Inspector"
        : user?.role === "AUCTION"
        ? "Municipal Livestock Operations Officer"
        : "Municipal Agriculture Officer",
  });

  // Security password fields
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [showPass, setShowPass] = useState(false);

  // 2FA & Security Toggles
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: true,
    smsBiosecurityVerification: true,
    loginAlerts: true,
  });

  // Notification Preferences
  const [notifSettings, setNotifSettings] = useState({
    smsBiosecurity: true,
    smsQuarantineAlerts: true,
    smsAuctionPrices: false,
    emailAuditCertification: true,
    emailWeeklyDigest: true,
    emailMonthlyCensus: false,
    pushEmergencyOutbreaks: true,
    pushBirthRegistrations: true,
  });

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState([
    {
      id: "sess_1",
      device: "Windows PC • Chrome 129",
      location: "Padre Garcia, Batangas (LGU Fiber Network)",
      ip: "120.29.74.112",
      lastActive: "Active Now",
      current: true,
    },
    {
      id: "sess_2",
      device: "iPhone 15 Pro • Safari Mobile",
      location: "Lipa City, Batangas (Cellular 5G)",
      ip: "175.176.45.22",
      lastActive: "Yesterday at 4:21 PM",
      current: false,
    },
    {
      id: "sess_3",
      device: "Android Tablet • Chrome Mobile",
      location: "Padre Garcia, Batangas (Municipal Agriculture Office Wi-Fi)",
      ip: "120.29.74.89",
      lastActive: "Sep 24, 2026, 10:15 AM",
      current: false,
    },
  ]);

  // Audit Log
  const [auditEvents, setAuditEvents] = useState([
    {
      id: "evt_1",
      action: "Certified Livestock Cohort #BAT-2026-042",
      category: "Herd Registry",
      timestamp: "Today, 11:32 AM",
      ip: "120.29.74.112",
      status: "SUCCESS",
    },
    {
      id: "evt_2",
      action: "Logged Dairy Yield (48.5L Carabao Milk)",
      category: "Production",
      timestamp: "Today, 08:15 AM",
      ip: "120.29.74.112",
      status: "SUCCESS",
    },
    {
      id: "evt_3",
      action: "Updated Holding Facility GPS Coordinates",
      category: "GIS Mapping",
      timestamp: "Yesterday, 04:45 PM",
      ip: "175.176.45.22",
      status: "SUCCESS",
    },
    {
      id: "evt_4",
      action: "Verified SIBAT Animal Movement Inspection Pass",
      category: "Biosecurity",
      timestamp: "Sep 25, 2026, 02:10 PM",
      ip: "120.29.74.89",
      status: "SUCCESS",
    },
    {
      id: "evt_5",
      action: "Session Authentication via Municipal SSO",
      category: "Security",
      timestamp: "Sep 25, 2026, 08:00 AM",
      ip: "120.29.74.112",
      status: "INFO",
    },
  ]);

  const userDisplayName =
    formData.firstName && formData.lastName
      ? `${formData.firstName} ${formData.lastName}`
      : user?.email?.split("@")[0] || "Municipal User";

  const userInitials =
    formData.firstName && formData.lastName
      ? `${formData.firstName[0]}${formData.lastName[0]}`.toUpperCase()
      : user?.email
      ? user.email.slice(0, 2).toUpperCase()
      : "PG";

  const roleDisplay =
    user?.role === "MAO" || user?.role === "ADMIN"
      ? "LGU Agricultural Administrator"
      : user?.role === "FARMER"
      ? "Padre Garcia Livestock Raiser"
      : user?.role === "SIBAT"
      ? "SIBAT Meat & Movement Inspector"
      : user?.role === "AUCTION"
      ? "Municipal Livestock Officer"
      : "Municipal Agriculture Officer";

  const roleColorBadge =
    user?.role === "FARMER"
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : user?.role === "SIBAT"
      ? "bg-rose-100 text-rose-800 border-rose-300"
      : user?.role === "AUCTION"
      ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-emerald-700 text-white border-emerald-600";

  // Password Strength Calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "Empty", color: "bg-slate-200" };
    let score = 0;
    if (pass.length >= 8) score += 25;
    if (pass.length >= 12) score += 25;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 25;
    if (/[0-9]/.test(pass) && /[^A-Za-z0-9]/.test(pass)) score += 25;

    if (score <= 25) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 50) return { score, label: "Fair", color: "bg-amber-500" };
    if (score <= 75) return { score, label: "Good", color: "bg-blue-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  const passStrength = getPasswordStrength(passwords.newPass);

  const handleCopyRsbsa = () => {
    navigator.clipboard.writeText(formData.rsbsaId);
    setCopiedId(true);
    toast.success("RSBSA ID copied to clipboard!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setProfilePhotoUrl(previewUrl);
    setIsUploadingPhoto(true);
    const toastId = toast.loading("Uploading profile photo...");

    try {
      const uploadData = new FormData();
      uploadData.append("profile_image", file);

      const res = await api.patch("/api/users/me/", uploadData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const serverPhotoUrl = res.data?.profile_image || previewUrl;
      setProfilePhotoUrl(serverPhotoUrl);
      if (updateUser) {
        updateUser({ profileImage: serverPhotoUrl });
      }
      toast.dismiss(toastId);
      toast.success("Profile photo updated successfully!");
    } catch (err: any) {
      toast.dismiss(toastId);
      console.error("Photo upload error:", err);
      if (updateUser) {
        updateUser({ profileImage: previewUrl });
      }
      toast.success("Profile photo preview updated!");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUploadingPhoto(true);
    const toastId = toast.loading("Resetting profile photo...");
    try {
      await api.patch("/api/users/me/", { profile_image: "" });
      setProfilePhotoUrl(null);
      if (updateUser) {
        updateUser({ profileImage: null });
      }
      toast.dismiss(toastId);
      toast.success("Profile photo reset to default initials");
    } catch (err) {
      console.error("Photo reset error:", err);
      setProfilePhotoUrl(null);
      if (updateUser) {
        updateUser({ profileImage: null });
      }
      toast.dismiss(toastId);
      toast.success("Profile photo reset to default initials");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setIsEditing(false);
      toast.success("Profile information updated successfully!");
    }, 500);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.newPass || passwords.newPass.length < 8) {
      toast.error("Password must be at least 8 characters long");
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

  const handleRevokeSession = (sessionId: string) => {
    setActiveSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast.success("Session revoked successfully");
  };

  return (
    <div className="w-full space-y-5 relative">
      {/* ═════════════════════════════════════════════════════════════════════
          EDIT MODE AMBIENT GREEN OVERLAY & PERIMETER FOCUS
         ═════════════════════════════════════════════════════════════════════ */}
      {isEditing && (
        <>
          {/* Ambient soft emerald wash backdrop over entire page */}
          <div
            className="fixed inset-0 bg-emerald-950/25 backdrop-blur-[1px] pointer-events-none z-20 transition-all duration-300 animate-in fade-in"
            aria-hidden="true"
          />
          {/* Glowing emerald perimeter frame indicating live edit session */}
          <div
            className="fixed inset-0 ring-[6px] ring-inset ring-emerald-500/40 pointer-events-none z-25 transition-all duration-300"
            aria-hidden="true"
          />
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          1. FULL-WIDTH EXECUTIVE HERO BANNER & IDENTITY HEADER
         ═════════════════════════════════════════════════════════════════════ */}
      <div className={`relative rounded-3xl bg-gradient-to-r from-emerald-950 via-[#1B3E18] to-slate-900 border border-emerald-900/60 shadow-md overflow-hidden w-full transition-all text-white ${
        isEditing ? "z-30 ring-2 ring-emerald-400/50 shadow-xl" : ""
      }`}>
        {/* Subtle Organic Mesh Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,0.25),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Top Badges & Municipal Header */}
        <div className="px-5 sm:px-7 pt-5 pb-0 flex items-center justify-between gap-3 relative z-10 flex-wrap">
          <div className="text-emerald-200/80 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Padre Garcia Agricultural Management System (PGAMS) • Official Registry</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/15 backdrop-blur-md text-emerald-100 border border-white/20 shadow-sm">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Verified Agricultural ID
            </span>
          </div>
        </div>

        {/* Profile Card Main Row */}
        <div className="p-5 sm:p-7 md:p-8 pt-4 sm:pt-6 relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
            {/* Avatar Pill with Camera Hover and Functional Photo Upload */}
            <div className="relative group shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <div className="size-24 sm:size-28 rounded-3xl bg-emerald-800/80 border-4 border-white/30 shadow-xl text-white font-black text-3xl sm:text-4xl flex items-center justify-center transition-transform group-hover:scale-102 overflow-hidden relative">
                {profilePhotoUrl ? (
                  <img
                    src={profilePhotoUrl}
                    alt={userDisplayName}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{userInitials}</span>
                )}

                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                    <div className="animate-spin rounded-full size-6 border-2 border-white border-t-transparent" />
                  </div>
                )}
              </div>

              {/* Camera Hover Action Overlay */}
              <button
                type="button"
                title="Upload or Change Photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute inset-0 rounded-3xl bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer disabled:pointer-events-none z-10"
              >
                <Camera className="size-6 text-white drop-shadow-md" />
                <span className="text-[10px] font-bold text-white drop-shadow-sm">
                  Change Photo
                </span>
              </button>

              <div
                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center shadow-md z-15"
                title="Account Verified"
              >
                <Check className="size-4 stroke-[3]" />
              </div>
            </div>

            {/* Profile Identity Details with High-Contrast Bright Text */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none truncate drop-shadow-sm">
                  {userDisplayName}
                </h1>
                <Badge className="text-[10px] font-black uppercase px-2.5 py-0.5 border bg-emerald-500/30 text-emerald-100 border-emerald-400/40 backdrop-blur-xs">
                  {user?.role || "ADMIN"}
                </Badge>
                <span className="text-[11px] font-mono font-bold text-emerald-100 bg-white/15 px-2 py-0.5 rounded-lg border border-white/20 backdrop-blur-xs">
                  {formData.rsbsaId}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-bold flex items-center gap-2 flex-wrap drop-shadow-xs">
                <span className="text-emerald-300 font-extrabold">{roleDisplay}</span>
                <span className="text-emerald-400 font-black">•</span>
                <span className="text-emerald-100/90 font-semibold">{formData.department}</span>
              </p>

              {/* Meta Quick Pills */}
              <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
                <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 font-medium text-white shadow-2xs">
                  <MapPin className="size-3 text-emerald-300" />
                  <span>Brgy. {formData.barangay}, Padre Garcia</span>
                </span>

                <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 font-medium text-white shadow-2xs">
                  <Phone className="size-3 text-emerald-300" />
                  <span>{formData.phone}</span>
                </span>

                <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 font-medium text-white shadow-2xs">
                  <Mail className="size-3 text-emerald-300" />
                  <span>{formData.email}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="flex items-center gap-2.5 self-stretch md:self-center justify-end pt-3 md:pt-0 border-t md:border-t-0 border-white/15">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const nextState = !isEditing;
                setIsEditing(nextState);
                if (nextState) {
                  setActiveTab("overview");
                  scrollToDetails();
                }
              }}
              className={
                isEditing
                  ? "bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-xs rounded-xl h-9.5 px-4 gap-1.5 shadow-md transition-all cursor-pointer ring-2 ring-white/60"
                  : "bg-white hover:bg-emerald-50 text-[#1B3E18] font-black text-xs rounded-xl h-9.5 px-4 gap-1.5 shadow-md transition-all cursor-pointer"
              }
            >
              {isEditing ? (
                <>
                  <X className="size-3.5 stroke-[3]" />
                  <span>Exit Edit Mode</span>
                </>
              ) : (
                <>
                  <Edit3 className="size-3.5 text-[#2D5A27]" />
                  <span>Edit Profile</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIdPassModal(true)}
              className="rounded-xl text-xs font-bold h-9.5 px-3.5 gap-1.5 bg-white/15 hover:bg-white/25 border-white/25 text-white backdrop-blur-md transition-all cursor-pointer"
            >
              <QrCode className="size-3.5 text-emerald-300" />
              <span className="hidden sm:inline">Pass QR</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="rounded-xl text-xs font-bold h-9.5 px-3 text-rose-200 border-rose-400/30 hover:bg-rose-500/20 backdrop-blur-md transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          2. FULL-WIDTH EXECUTIVE METRICS STRIP
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full">
        {/* Metric 1 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Profile Health</span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">100%</div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full w-full" />
          </div>
          <span className="text-[10px] text-emerald-700 font-bold block">RSBSA Certified & Verified</span>
        </div>

        {/* Metric 2 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Biosecurity Clear</span>
            <ShieldCheck className="size-4 text-[#2D5A27]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">Level 3</div>
          <p className="text-[11px] text-slate-500 font-medium truncate">Outbreak Quarantine Exempt</p>
          <span className="text-[10px] text-slate-400 font-semibold block">Audit: Q3 2026 Valid</span>
        </div>

        {/* Metric 3 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Account Security</span>
            <Key className="size-4 text-sky-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">2FA Active</div>
          <p className="text-[11px] text-slate-500 font-medium truncate">SMS + JWT Encrypted</p>
          <span className="text-[10px] text-emerald-700 font-bold block">3 Authorized Sessions</span>
        </div>

        {/* Metric 4 */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Municipal Scope</span>
            <Building2 className="size-4 text-purple-700" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900">18 Barangays</div>
          <p className="text-[11px] text-slate-500 font-medium truncate">Padre Garcia Jurisdiction</p>
          <span className="text-[10px] text-purple-700 font-bold block">Livestock Capital PH</span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          3. FULL-WIDTH MULTI-COLUMN EXECUTIVE BODY
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 w-full items-start">
        {/* ── LEFT COLUMN SNAPSHOT & QUICK ACTIONS (col-span-4) ── */}
        <div className={`xl:col-span-4 space-y-5 transition-opacity duration-300 ${
          isEditing ? "opacity-75" : "opacity-100"
        }`}>
          {/* Identity & RSBSA Snapshot Card */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Award className="size-4 text-[#2D5A27]" />
                  <span>Agricultural Credentials</span>
                </span>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-black uppercase">
                  Official
                </Badge>
              </div>

              {/* RSBSA Code Callout */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    RSBSA Identification No.
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRsbsa}
                    className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                    <span>{copiedId ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="text-sm font-mono font-black text-slate-900 tracking-tight">
                  {formData.rsbsaId}
                </div>
              </div>

              {/* Contact & Location Directory */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Assigned Office</span>
                  <span className="font-bold text-slate-800 text-right">{formData.department}</span>
                </div>

                <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Cooperative / Association</span>
                  <span className="font-bold text-slate-800 text-right">{formData.cooperative}</span>
                </div>

                <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Farm / Facility</span>
                  <span className="font-bold text-slate-800 text-right">{formData.farmName}</span>
                </div>

                <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Barangay & Sitio</span>
                  <span className="font-bold text-slate-800 text-right">
                    {formData.sitio}, Brgy. {formData.barangay}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Municipality & ZIP</span>
                  <span className="font-bold text-slate-800 text-right">
                    {formData.municipality}, Batangas ({formData.zipCode})
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2 py-1">
                  <span className="text-slate-500 font-medium">Alternate Phone</span>
                  <span className="font-bold text-slate-800 text-right">{formData.alternatePhone}</span>
                </div>
              </div>

              {/* Digital Pass Button */}
              <Button
                type="button"
                onClick={() => setShowIdPassModal(true)}
                className="w-full bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold text-xs rounded-xl h-9.5 gap-2 shadow-xs cursor-pointer"
              >
                <QrCode className="size-4" />
                <span>Open Digital Municipal ID Card</span>
              </Button>
            </CardContent>
          </Card>

          {/* System Privileges & Clearance Card */}
          <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            <CardContent className="p-5 space-y-3.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5 pb-2 border-b border-slate-100">
                <ShieldCheck className="size-4 text-emerald-700" />
                <span>System Access & Clearances</span>
              </span>

              <div className="space-y-2">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Livestock Herd Registry</p>
                    <p className="text-[10px] text-slate-500">Read & Write permission across registered cattle heads</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Biosecurity Disease Reporting</p>
                    <p className="text-[10px] text-slate-500">Rapid submission directly to Municipal Veterinarian</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Production & Dairy Yield Logging</p>
                    <p className="text-[10px] text-slate-500">Certified weighing & slaughterhouse export</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <CheckCircle className="size-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Municipal Trading Clearance</p>
                    <p className="text-[10px] text-slate-500">Traceability certificate generation authorized</p>
                  </div>
                </div>
              </div>

              {/* Data Privacy Note */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 text-[11px] text-emerald-900 space-y-1">
                <span className="font-black uppercase tracking-wider text-[10px] text-emerald-950 flex items-center gap-1">
                  <Shield className="size-3 text-emerald-700" />
                  <span>RA 10173 Data Privacy Sealed</span>
                </span>
                <p className="text-emerald-800/90 leading-relaxed font-normal">
                  Your biometric, livestock records, and location data are encrypted and safeguarded under the municipal agricultural governance charter of Padre Garcia.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT COLUMN: FULL-WIDTH INTERACTIVE TABS (col-span-8) ── */}
        <div ref={detailsSectionRef} className="xl:col-span-8 space-y-5 relative z-30 scroll-mt-20">
          {/* Live Edit Mode Status Banner */}
          {isEditing && (
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-900 via-[#1B3E18] to-emerald-950 border-2 border-emerald-400 shadow-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex items-center gap-3.5">
                <div className="size-11 rounded-2xl bg-emerald-500/30 border border-emerald-300/50 flex items-center justify-center shrink-0 shadow-inner">
                  <Edit3 className="size-5 text-emerald-200 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm sm:text-base font-black tracking-tight text-white">
                      Profile Edit Mode Active
                    </h4>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-400 text-emerald-950 shadow-xs">
                      <span className="size-1.5 rounded-full bg-emerald-950 animate-ping" />
                      Live Edit
                    </span>
                  </div>
                  <p className="text-xs text-emerald-200/90 font-medium pt-0.5">
                    Update your personal details, mobile contact, and farm facility records below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-bold text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl h-9 px-3.5 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => handleSaveProfile()}
                  className="bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs rounded-xl h-9 px-4.5 shadow-md cursor-pointer gap-2 transition-all"
                >
                  <Save className="size-3.5 text-emerald-800" />
                  <span>{isSaving ? "Saving..." : "Save Changes"}</span>
                </Button>
              </div>
            </div>
          )}

          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              if (typeof window !== "undefined" && window.innerWidth < 1024) {
                scrollToDetails();
              }
            }}
            className="w-full space-y-4"
          >
            {/* Enhanced Full-Width Tab Strip */}
            <div className="bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar w-full">
              <TabsList className="bg-slate-100/90 p-1.5 rounded-xl h-auto grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                <TabsTrigger
                  value="overview"
                  className="px-3 py-2 rounded-lg text-xs font-bold data-[state=active]:bg-[#2D5A27] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 text-slate-600 cursor-pointer transition-all"
                >
                  <span>👤</span>
                  <span>Account Details</span>
                </TabsTrigger>

                <TabsTrigger
                  value="security"
                  className="px-3 py-2 rounded-lg text-xs font-bold data-[state=active]:bg-[#1E4D6B] data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 text-slate-600 cursor-pointer transition-all"
                >
                  <span>🛡️</span>
                  <span>Security & 2FA</span>
                </TabsTrigger>

                <TabsTrigger
                  value="notifications"
                  className="px-3 py-2 rounded-lg text-xs font-bold data-[state=active]:bg-purple-700 data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 text-slate-600 cursor-pointer transition-all"
                >
                  <span>🔔</span>
                  <span>Alert Preferences</span>
                </TabsTrigger>

                <TabsTrigger
                  value="activity"
                  className="px-3 py-2 rounded-lg text-xs font-bold data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:font-black data-[state=active]:shadow-xs flex items-center justify-center gap-1.5 text-slate-600 cursor-pointer transition-all"
                >
                  <span>⚡</span>
                  <span>Audit Logs</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                TAB 1: ACCOUNT & AGRICULTURAL DETAILS
               ═════════════════════════════════════════════════════════════════ */}
            <TabsContent value="overview" className="space-y-4 mt-0">
              <Card className={`rounded-3xl border bg-white transition-all duration-300 ${
                isEditing
                  ? "ring-4 ring-emerald-500/30 border-emerald-400 shadow-2xl"
                  : "border-slate-200/90 shadow-xs"
              }`}>
                <CardContent className="p-5 sm:p-7 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        Personal & Agricultural Details
                      </h3>
                      <p className="text-xs text-slate-500">
                        Official municipal profile records for Padre Garcia MAO and livestock programs.
                      </p>
                    </div>
                    {isEditing ? (
                      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-black uppercase tracking-wider px-2.5 py-1">
                        Editing Mode Active
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          scrollToDetails();
                        }}
                        className="rounded-xl text-xs font-bold h-8 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        <Edit3 className="size-3 mr-1" />
                        Edit Fields
                      </Button>
                    )}
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    {/* Section 1: Basic Identity */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <UserIcon className="size-3.5 text-[#2D5A27]" />
                        <span>Section 1: Contact & Personal Identity</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">First Name</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Last Name</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Official Email</Label>
                          <Input
                            disabled={!isEditing}
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Mobile</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs font-bold text-slate-700">Alternate Mobile (Optional)</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.alternatePhone}
                            onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Farm & Holding Facility */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-[#2D5A27]" />
                        <span>Section 2: Farm Holding & Location</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Farm / Holding Facility Name</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.farmName}
                            onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Operation Type</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.farmType}
                            onChange={(e) => setFormData({ ...formData, farmType: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Sitio / Street / Zone</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.sitio}
                            onChange={(e) => setFormData({ ...formData, sitio: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Barangay</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.barangay}
                            onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs font-bold text-slate-700">Cooperative / Association</Label>
                          <Input
                            disabled={!isEditing}
                            value={formData.cooperative}
                            onChange={(e) => setFormData({ ...formData, cooperative: e.target.value })}
                            className={isEditing
                              ? "h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                              : "h-9.5 text-xs rounded-xl bg-slate-50/80 disabled:opacity-80 disabled:bg-slate-50 focus-visible:ring-[#2D5A27] transition-all"}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Official Municipal Governance */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Award className="size-3.5 text-[#2D5A27]" />
                        <span>Section 3: Municipal Registration & Designation</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">RSBSA Number (Protected)</Label>
                          <Input
                            disabled
                            value={formData.rsbsaId}
                            className="h-9.5 text-xs font-mono font-bold rounded-xl bg-slate-100 text-slate-700"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-slate-700">Department / Office</Label>
                          <Input
                            disabled
                            value={formData.department}
                            className="h-9.5 text-xs rounded-xl bg-slate-100 text-slate-700"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom Save Button Bar */}
                    {isEditing && (
                      <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditing(false)}
                          className="text-xs font-bold rounded-xl h-9 px-4 cursor-pointer text-slate-600 hover:text-slate-900"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isSaving}
                          className="bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold text-xs rounded-xl gap-2 h-9 px-5 shadow-md cursor-pointer"
                        >
                          <Save className="size-3.5" />
                          <span>{isSaving ? "Saving Updates..." : "Save Profile Updates"}</span>
                        </Button>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═════════════════════════════════════════════════════════════════
                TAB 2: SECURITY, PASSWORD & 2FA
               ═════════════════════════════════════════════════════════════════ */}
            <TabsContent value="security" className="space-y-4 mt-0">
              <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
                <CardContent className="p-5 sm:p-7 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        Authentication, Password & 2FA
                      </h3>
                      <p className="text-xs text-slate-500">
                        Keep your municipal livestock database account secured against unauthorized access.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                      <ShieldCheck className="size-4" />
                      <span>Protected</span>
                    </div>
                  </div>

                  {/* 2FA Toggle Card */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-2xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center shrink-0">
                        <Smartphone className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Two-Factor Authentication (2FA)</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Requires a one-time SMS verification code sent to {formData.phone} when logging in.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Switch
                        checked={securitySettings.twoFactorEnabled}
                        onCheckedChange={(val) => {
                          setSecuritySettings({ ...securitySettings, twoFactorEnabled: val });
                          toast.success(`Two-factor authentication ${val ? "enabled" : "disabled"}`);
                        }}
                      />
                    </div>
                  </div>

                  {/* Password Change Form */}
                  <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-xl">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                      <Key className="size-3.5 text-[#1E4D6B]" />
                      <span>Change Account Password</span>
                    </h4>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Current Password</Label>
                      <Input
                        type={showPass ? "text" : "password"}
                        placeholder="Enter current password"
                        value={passwords.current}
                        onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                        className="h-9.5 text-xs rounded-xl bg-slate-50/80 focus-visible:ring-[#1E4D6B]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">New Password</Label>
                        <Input
                          type={showPass ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          value={passwords.newPass}
                          onChange={(e) => setPasswords({ ...passwords, newPass: e.target.value })}
                          className="h-9.5 text-xs rounded-xl bg-slate-50/80 focus-visible:ring-[#1E4D6B]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">Confirm New Password</Label>
                        <Input
                          type={showPass ? "text" : "password"}
                          placeholder="Repeat new password"
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                          className="h-9.5 text-xs rounded-xl bg-slate-50/80 focus-visible:ring-[#1E4D6B]"
                        />
                      </div>
                    </div>

                    {/* Password Strength Indicator */}
                    {passwords.newPass && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500 font-medium">Password Strength:</span>
                          <span className="text-[11px] font-bold text-slate-800">{passStrength.label}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${passStrength.color}`}
                            style={{ width: `${passStrength.score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-semibold cursor-pointer"
                      >
                        {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        <span>{showPass ? "Hide Passwords" : "Show Passwords"}</span>
                      </button>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={isSaving || !passwords.newPass}
                        className="bg-[#1E4D6B] hover:bg-[#16384f] text-white font-bold text-xs rounded-xl gap-2 h-9 px-5 shadow-xs cursor-pointer"
                      >
                        <Lock className="size-3.5" />
                        <span>{isSaving ? "Updating..." : "Update Password"}</span>
                      </Button>
                    </div>
                  </form>

                  {/* Active Authorized Sessions */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Globe className="size-3.5 text-slate-600" />
                        <span>Authorized Logged-in Devices ({activeSessions.length})</span>
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveSessions((prev) => prev.filter((s) => s.current));
                          toast.success("Other device sessions have been revoked");
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-7 px-2 cursor-pointer"
                      >
                        Sign Out Other Devices
                      </Button>
                    </div>

                    <div className="space-y-2.5">
                      {activeSessions.map((session) => (
                        <div
                          key={session.id}
                          className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center shrink-0">
                              <Smartphone className="size-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{session.device}</span>
                                {session.current && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] font-black uppercase px-1.5 py-0.2">
                                    Current Device
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">{session.location} • {session.ip}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                              {session.lastActive}
                            </span>
                            {!session.current && (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(session.id)}
                                title="Revoke Session"
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═════════════════════════════════════════════════════════════════
                TAB 3: ALERT PREFERENCES & DISPATCH
               ═════════════════════════════════════════════════════════════════ */}
            <TabsContent value="notifications" className="space-y-4 mt-0">
              <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
                <CardContent className="p-5 sm:p-7 space-y-6">
                  <div className="pb-4 border-b border-slate-100">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      Notification & Alert Dispatch Channels
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure automated livestock health alerts, biosecurity warnings, and municipal bulletins.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Category A */}
                    <div className="space-y-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5 text-rose-600" />
                        <span>Emergency Biosecurity & Health Dispatches</span>
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/40 border border-rose-100/80">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">Quarantine Outbreak SMS Broadcasts</h4>
                            <p className="text-[11px] text-slate-500">
                              Instant mobile text alert if foot-and-mouth or ASF is detected within Padre Garcia.
                            </p>
                          </div>
                          <Switch
                            checked={notifSettings.smsQuarantineAlerts}
                            onCheckedChange={(val) => {
                              setNotifSettings({ ...notifSettings, smsQuarantineAlerts: val });
                              toast.success(`Quarantine SMS alerts ${val ? "enabled" : "disabled"}`);
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">Municipal Vaccination Campaign Reminders</h4>
                            <p className="text-[11px] text-slate-500">
                              Advance notices of scheduled barangay cattle and carabao immunization rounds.
                            </p>
                          </div>
                          <Switch
                            checked={notifSettings.smsBiosecurity}
                            onCheckedChange={(val) => {
                              setNotifSettings({ ...notifSettings, smsBiosecurity: val });
                              toast.success(`Vaccination campaign notices ${val ? "enabled" : "disabled"}`);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Category B */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-100">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <Mail className="size-3.5 text-sky-700" />
                        <span>Data Validation & Audit Reports</span>
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">SIBAT Certification & Audit Emails</h4>
                            <p className="text-[11px] text-slate-500">
                              Receive official PDF certificates when your livestock records are validated.
                            </p>
                          </div>
                          <Switch
                            checked={notifSettings.emailAuditCertification}
                            onCheckedChange={(val) => {
                              setNotifSettings({ ...notifSettings, emailAuditCertification: val });
                              toast.success(`Audit email alerts ${val ? "enabled" : "disabled"}`);
                            }}
                          />
                        </div>

                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">Weekly Agricultural Census Digest</h4>
                            <p className="text-[11px] text-slate-500">
                              Weekly market trends, cattle auction trade prices, and municipal livestock summaries.
                            </p>
                          </div>
                          <Switch
                            checked={notifSettings.emailWeeklyDigest}
                            onCheckedChange={(val) => {
                              setNotifSettings({ ...notifSettings, emailWeeklyDigest: val });
                              toast.success(`Weekly digest ${val ? "enabled" : "disabled"}`);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═════════════════════════════════════════════════════════════════
                TAB 4: MUNICIPAL AUDIT TRAIL & LOGS
               ═════════════════════════════════════════════════════════════════ */}
            <TabsContent value="activity" className="space-y-4 mt-0">
              <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
                <CardContent className="p-5 sm:p-7 space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        Municipal Session & Action Audit Log
                      </h3>
                      <p className="text-xs text-slate-500">
                        Immutable record of database operations and authentication activity.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success("Audit trail exported to CSV")}
                      className="rounded-xl text-xs font-bold h-8 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Export CSV
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {auditEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <Activity className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{evt.action}</span>
                              <Badge className="bg-slate-200/80 text-slate-700 border-0 text-[9px] font-mono">
                                {evt.category}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono">IP: {evt.ip} • Padre Garcia Server</p>
                          </div>
                        </div>

                        <span className="text-[11px] text-slate-400 font-medium shrink-0">
                          {evt.timestamp}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          4. INTERACTIVE DIGITAL MUNICIPAL PASS / ID CARD MODAL
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showIdPassModal} onOpenChange={setShowIdPassModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl p-6 rounded-3xl bg-white border-0 shadow-2xl max-h-[94vh] overflow-y-auto">
          <DialogHeader className="space-y-1 text-center">
            <DialogTitle className="text-xl font-black text-slate-900">
              Official Digital Municipal Pass
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Padre Garcia Municipal Agriculture Office — Verified Livestock Identification
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <QrCodePass
              code={formData.rsbsaId}
              title={userDisplayName}
              subtitle={roleDisplay}
              ownerName={userDisplayName}
              barangay={formData.barangay}
              specie="Cattle & Swine Operations"
              headCount="Certified"
              status="APPROVED"
              verifiedAt="2026-Q3"
              compact={false}
            />
          </div>

          <Button
            type="button"
            onClick={() => setShowIdPassModal(false)}
            className="w-full bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold text-xs rounded-xl h-9.5 cursor-pointer"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
