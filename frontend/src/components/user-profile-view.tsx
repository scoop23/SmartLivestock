"use client";

import { QrCodePass } from "@/components/qr-code-pass";
import { RegistrationDocumentsPanel } from "@/components/registration-documents-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent } from "@/components/ui/card";
import {
Dialog,
DialogContent,
DialogDescription,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "@/components/ui/tabs";
import { TutorialAutoToggle } from "@/components/tutorial-auto-toggle";
import { useAccessibilitySettings } from "@/contexts/accessibility-settings-context";
import { useAuth } from "@/contexts/auth-context";
import api from "@/lib/axios";
import {
Activity,
AlertTriangle,
Award,
Bell,
Building2,
Camera,
Check,
CheckCircle,
CheckCircle2,
Copy,
Edit3,
Eye,
EyeOff,
FileText,
Globe,
Key,
Lock,
Mail,
MapPin,
Phone,
QrCode,
Save,
Settings,
Shield,
ShieldCheck,
Smartphone,
Trash2,
User as UserIcon,
X
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import React,{ useEffect,useRef,useState } from "react";
import { toast } from "sonner";

export function UserProfileView() {
  const { user, updateUser } = useAuth();
  const normalizedRole = user?.role?.toUpperCase();
  const isFarmer = normalizedRole === "FARMER";
  const isFieldReviewer = normalizedRole === "SIBAT" || normalizedRole === "CBAT";
  const isSlaughterhouse = normalizedRole === "SLAUGHTERHOUSESTAFF" || normalizedRole === "SLAUGHTERHOUSE";
  const isAuction = normalizedRole === "AUCTION";
  const isAdminOrMao = normalizedRole === "ADMIN" || normalizedRole === "MAO";

  const rolePillLabel = isFarmer
    ? "LIVESTOCK RAISER"
    : isFieldReviewer
    ? "SIBAT / CBAT VALIDATOR"
    : isSlaughterhouse
    ? "SLAUGHTERHOUSE STAFF"
    : isAuction
    ? "AUCTION PERSONNEL"
    : isAdminOrMao
    ? "SYSTEM ADMINISTRATOR"
    : "MUNICIPAL OFFICIAL";

  const roleVerifiedBadge = isFarmer
    ? "Verified by MAO"
    : isFieldReviewer
    ? "Authorized Validator"
    : isSlaughterhouse
    ? "Certified Operator"
    : isAuction
    ? "Authorized Marshall"
    : "Verified Official";
  const { fontScale, setFontScale, fontTheme, setFontTheme } = useAccessibilitySettings();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    const requestedTab = searchParams.get("tab") || "overview";
    const tabAliases: Record<string, string> = {
      alerts: "notifications",
      "text-size": "settings",
    };
    const resolvedTab = tabAliases[requestedTab] || requestedTab;
    const validTabs = isFarmer
      ? ["overview", "security", "notifications", "documents", "activity", "settings"]
      : ["overview", "security", "notifications", "activity", "settings"];
    setActiveTab(validTabs.includes(resolvedTab) ? resolvedTab : "overview");
  }, [searchParams, isFarmer]);
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
  const [photoDraft, setPhotoDraft] = useState<{ source: string | null; value: string | null } | null>(null);
  const sourcePhoto = user?.profileImage || null;
  const profilePhotoUrl = photoDraft?.source === sourcePhoto ? photoDraft.value : sourcePhoto;
  const setProfilePhotoUrl = (value: string | null) => setPhotoDraft({ source: sourcePhoto, value });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Profile Information State
  const [formData, setFormData] = useState({
    firstName: user?.firstName || (user?.role === "FARMER" ? "Mark Angelo" : "Municipal"),
    lastName: user?.lastName || (user?.role === "FARMER" ? "Bathan" : "Officer"),
    email: user?.email || (user?.role === "FARMER" ? "markangelo.bathan@smartlivestock.ph" : "officer@padregarcia.gov.ph"),
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
      device: "Windows PC - Chrome 129",
      location: "Padre Garcia, Batangas (LGU Fiber Network)",
      ip: "120.29.74.112",
      lastActive: "Active Now",
      current: true,
    },
    {
      id: "sess_2",
      device: "iPhone 15 Pro - Safari Mobile",
      location: "Lipa City, Batangas (Cellular 5G)",
      ip: "175.176.45.22",
      lastActive: "Yesterday at 4:21 PM",
      current: false,
    },
    {
      id: "sess_3",
      device: "Android Tablet - Chrome Mobile",
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
      action: "Certified Livestock Herd #BAT-2026-042",
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

  const roleFacilitySubtitle = isFarmer
    ? (formData.farmName || "Garcia Heritage Cattle & Swine Farm")
    : isFieldReviewer
    ? "Padre Garcia Livestock Biosecurity & Movement Office"
    : isSlaughterhouse
    ? "Padre Garcia Municipal Slaughterhouse Division"
    : isAuction
    ? "Padre Garcia Livestock Auction Market Facility"
    : isAdminOrMao
    ? "Padre Garcia Municipal Agriculture Office (MAO)"
    : (formData.department || "Municipal Agriculture Office (MAO)");

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
    } catch (err: unknown) {
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

  const renderSecurityContent = () => (
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
              className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 cursor-pointer"
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
                    <p className="text-[11px] text-slate-500">{session.location}</p>
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
  );

  const renderNotificationsContent = () => (
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
  );

  const renderDocumentsContent = () => (
    <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
      <CardContent className="p-5 sm:p-7 space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-black text-slate-900">Registration &amp; Accreditation Documents</h3>
          <p className="text-xs text-slate-500">Review your submitted Government ID and RSBSA files or upload a replacement if MAO requested a correction.</p>
        </div>
        <RegistrationDocumentsPanel variant="profile" />
      </CardContent>
    </Card>
  );

  const renderActivityContent = () => (
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
                  <p className="text-[11px] text-slate-500 font-mono">IP: {evt.ip} | Padre Garcia Server</p>
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
  );

  const renderSettingsContent = () => (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">Guided tutorials</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Turn tutorials on or off throughout SmartLivestock on this browser.
            </p>
          </div>
          <TutorialAutoToggle />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
        <CardContent className="p-5 sm:p-7 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              Make text easier to read
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Choose a size that feels comfortable. This setting applies throughout SmartLivestock on this browser.
            </p>
          </div>

          <div role="group" aria-label="Text size" className="grid gap-3 sm:grid-cols-3">
            {([
              {
                value: "standard",
                label: "Standard",
                description: "The usual text size",
              },
              {
                value: "comfortable",
                label: "Comfortable",
                description: "Recommended for easier reading",
              },
              {
                value: "extra-large",
                label: "Extra large",
                description: "The largest text size",
              },
            ] as const).map((option) => {
              const selected = fontScale === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFontScale(option.value)}
                  className={`min-h-24 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer ${
                    selected
                      ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/20"
                      : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-slate-900">{option.label}</span>
                    {option.value === "comfortable" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900">
                        Recommended
                      </span>
                    )}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-slate-600">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-600" aria-live="polite">
            Current text size: {fontScale === "extra-large" ? "Extra large" : fontScale === "standard" ? "Standard" : "Comfortable"}.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-200/90 bg-white shadow-xs">
        <CardContent className="p-5 sm:p-7 space-y-5">
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                Typography Style (Font Theme)
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Switch between the Nexus Modern font (Plus Jakarta Sans & Space Grotesk) and the classic system font (Inter).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="nexus-font-toggle" className="text-xs font-semibold text-slate-700 cursor-pointer">
                {fontTheme === "nexus" ? "Nexus Active" : "Classic Active"}
              </Label>
              <Switch
                id="nexus-font-toggle"
                checked={fontTheme === "nexus"}
                onCheckedChange={(checked) => setFontTheme(checked ? "nexus" : "inter")}
              />
            </div>
          </div>

          <div role="group" aria-label="Font Theme" className="grid gap-3 sm:grid-cols-2">
            {[
              {
                value: "nexus" as const,
                title: "Nexus Modern",
                subtitle: "Plus Jakarta Sans + Space Grotesk + JetBrains Mono",
                preview: "BIO-NODE PG-200 // Dairy & Livestock Telemetry Nexus",
                recommended: true,
              },
              {
                value: "inter" as const,
                title: "Classic Inter",
                subtitle: "Inter + System Sans-Serif & Monospace",
                preview: "Padre Garcia Municipal Agriculture Information System",
                recommended: false,
              },
            ].map((option) => {
              const selected = fontTheme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFontTheme(option.value)}
                  className={`min-h-24 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer ${
                    selected
                      ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-700/20"
                      : "border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-bold text-slate-900">{option.title}</span>
                    {option.recommended && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                        Active / Recommended
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-slate-500 font-medium">
                    {option.subtitle}
                  </span>
                  <span className={`mt-2 block text-xs p-2 rounded-lg border bg-white/70 text-slate-700 ${option.value === "nexus" ? "font-mono" : "font-sans"}`}>
                    {option.preview}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-600" aria-live="polite">
            Current active font: <strong className="text-slate-800">{fontTheme === "nexus" ? "Nexus Modern (Plus Jakarta Sans, Space Grotesk & JetBrains Mono)" : "Classic (Inter)"}</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="w-full space-y-5 relative">
      {/* Profile section. */}
      {isEditing && (
        <>
          {/* Ambient soft emerald wash backdrop over entire page */}
          <div
            className="fixed inset-0 bg-emerald-950/35 backdrop-blur-[2px] pointer-events-none z-20 transition-all duration-300 animate-in fade-in"
            aria-hidden="true"
          />
          {/* Glowing emerald perimeter frame indicating live edit session */}
          <div
            className="fixed inset-0 ring-[6px] ring-inset ring-emerald-500/40 pointer-events-none z-25 transition-all duration-300"
            aria-hidden="true"
          />
        </>
      )}

      {/* Universal Hero Banner matching the design for all roles */}
      <div
        className={`relative rounded-3xl bg-gradient-to-r from-[#041d13] via-[#092e1e] to-[#052317] border border-emerald-900/70 shadow-lg overflow-hidden w-full transition-all text-white p-5 sm:p-7 ${
          isEditing ? "z-30 ring-2 ring-emerald-400/50 shadow-xl" : ""
        }`}
      >
        {/* Subtle organic background patterns */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.18),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left side: Avatar + Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 min-w-0">
            {/* Avatar Square with Monogram & Camera Button */}
            <div className="relative shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <div className="size-24 sm:size-28 rounded-2xl bg-[#0f4d34] border border-[#1b6b49] shadow-xl text-white font-extrabold text-3xl sm:text-4xl flex items-center justify-center overflow-hidden relative">
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

              {/* Camera Button at Bottom Right */}
              <button
                type="button"
                title="Upload or Change Photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 size-8 rounded-full bg-white text-[#0f4d34] border border-slate-200 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform cursor-pointer disabled:pointer-events-none z-10"
              >
                <Camera className="size-4 text-[#0f4d34]" />
              </button>
            </div>

            {/* Identity Details */}
            <div className="space-y-2 min-w-0">
              {/* Row 1: Full Name + Role pill badge */}
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                  {formData.firstName || formData.lastName
                    ? `${formData.firstName} ${formData.lastName}`.trim()
                    : userDisplayName}
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[#106644] text-[#a7f3d0] border border-[#1d8258]/60 shadow-xs">
                  {rolePillLabel}
                </span>
              </div>

              {/* Row 2: Farm Name / Role Facility Subtitle */}
              <p className="text-sm font-medium text-white/90">
                {roleFacilitySubtitle}
              </p>

              {/* Row 3: Location */}
              <div className="flex items-center gap-1.5 text-xs text-emerald-100/80">
                <MapPin className="size-3.5 text-emerald-400 shrink-0" />
                <span>
                  {formData.sitio ? `${formData.sitio}, ` : ""}Brgy. {formData.barangay || "Poblacion"}, Padre Garcia, Batangas
                </span>
              </div>

              {/* Row 4: Phone & Email pills */}
              <div className="flex items-center gap-2.5 text-xs pt-1 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs border border-white/10 backdrop-blur-xs font-medium">
                  <Phone className="size-3 text-emerald-300 shrink-0" />
                  <span>{formData.phone || "0917-555-8291"}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs border border-white/10 backdrop-blur-xs font-medium">
                  <Mail className="size-3 text-emerald-300 shrink-0" />
                  <span>{formData.email || "markangelo.bathan@smartlivestock.ph"}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right side: Top Badges + Bottom Action Buttons */}
          <div className="flex flex-col justify-between items-start lg:items-end gap-5 self-stretch lg:self-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-white/15">
            {/* Top Badges */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-mono font-medium bg-white/10 text-white/90 border border-white/10 backdrop-blur-xs">
                {formData.rsbsaId || "RSBSA-04-10-18-00921"}
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-white text-[#083321] shadow-sm">
                <span className="size-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <Check className="size-2.5 stroke-[3]" />
                </span>
                <span>{roleVerifiedBadge}</span>
              </span>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex items-center gap-2.5">
              {!isFieldReviewer && (
                <Button
                  type="button"
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
                      ? "bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-xs rounded-xl h-9.5 px-4 gap-2 shadow-md transition-all cursor-pointer ring-2 ring-white/60"
                      : "bg-white hover:bg-emerald-50 text-[#0c3824] font-bold text-xs rounded-xl h-9.5 px-4 gap-2 shadow-md transition-all cursor-pointer"
                  }
                >
                  {isEditing ? (
                    <>
                      <X className="size-3.5 stroke-[3]" />
                      <span>Exit Edit</span>
                    </>
                  ) : (
                    <>
                      <Edit3 className="size-3.5 text-[#0c3824]" />
                      <span>Edit Profile</span>
                    </>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowIdPassModal(true)}
                className="rounded-xl text-xs font-semibold h-9.5 px-3.5 gap-2 bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-md transition-all cursor-pointer"
              >
                <QrCode className="size-3.5 text-white" />
                <span>Pass QR</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile section. */}
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
        <div className={`bg-white p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 shadow-2xs overflow-x-auto no-scrollbar w-full transition-all duration-300 ${
          isEditing ? "opacity-40 blur-[1px] pointer-events-none select-none" : "opacity-100"
        }`}>
          <TabsList className="bg-transparent p-0 h-auto w-full flex flex-wrap sm:flex-nowrap gap-1.5">
            <TabsTrigger
              value="overview"
              className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-emerald-50/70 data-[state=active]:text-emerald-800 data-[state=active]:border-emerald-500 border border-transparent flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all whitespace-nowrap flex-1"
            >
              <UserIcon className="size-4" />
              <span>{isFarmer ? "My Profile" : "Account Details"}</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-emerald-50/70 data-[state=active]:text-emerald-800 data-[state=active]:border-emerald-500 border border-transparent flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all whitespace-nowrap flex-1"
            >
              <Shield className="size-4" />
              <span>{isFarmer ? "Security & Password" : "Security & 2FA"}</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-emerald-50/70 data-[state=active]:text-emerald-800 data-[state=active]:border-emerald-500 border border-transparent flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all whitespace-nowrap flex-1"
            >
              <Bell className="size-4" />
              <span>Alert Preferences</span>
            </TabsTrigger>
            {isFarmer && (
              <TabsTrigger
                value="documents"
                className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-emerald-50/70 data-[state=active]:text-emerald-800 data-[state=active]:border-emerald-500 border border-transparent flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all whitespace-nowrap flex-1"
              >
                <FileText className="size-4" />
                <span>Registration Documents</span>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="activity"
              className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-emerald-50/70 data-[state=active]:text-emerald-800 data-[state=active]:border-emerald-500 border border-transparent flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all whitespace-nowrap flex-1"
            >
              <Activity className="size-4" />
              <span>{isFarmer ? "Activity History" : "Audit Logs"}</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold data-[state=active]:bg-emerald-50/70 data-[state=active]:text-emerald-800 data-[state=active]:border-emerald-500 border border-transparent flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer transition-all whitespace-nowrap flex-1"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content: Unified 2-Column Overview for All Roles */}
        <TabsContent value="overview" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 w-full items-start">
            {/* Left Column: Account Overview + Official Credentials */}
            <div className={`space-y-5 transition-all duration-300 ${
              isEditing ? "opacity-35 blur-[1.5px] pointer-events-none select-none" : "opacity-100"
            }`}>
              {/* Card 1: Account Overview */}
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Bell className="size-5 text-slate-700" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Account Overview</h3>
                      <p className="text-xs text-slate-500">Summary of your profile and registration status.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-center gap-3">
                      <div className="size-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <UserIcon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 font-medium">Profile Status</p>
                        <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <span className="size-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <Check className="size-2 stroke-[3]" />
                          </span>
                          Complete
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-center gap-3">
                      <div className="size-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 font-medium">
                          {isFarmer ? "RSBSA Registration" : "Accreditation"}
                        </p>
                        <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <span className="size-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <Check className="size-2 stroke-[3]" />
                          </span>
                          {roleVerifiedBadge}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-center gap-3">
                      <div className="size-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                        <ShieldCheck className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 font-medium">Account Security</p>
                        <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <span className="size-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <Check className="size-2 stroke-[3]" />
                          </span>
                          {securitySettings.twoFactorEnabled ? "2FA Active" : "Standard"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Agricultural / Official Credentials */}
              <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="size-5 text-emerald-700" />
                      <h3 className="text-base font-bold text-slate-900">
                        {isFarmer ? "Agricultural Credentials" : "Official Municipal Credentials"}
                      </h3>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      OFFICIAL
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                      <span className="text-slate-500 font-medium">
                        {isFarmer ? "RSBSA Identification No." : "Municipal Credential / ID No."}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{formData.rsbsaId}</span>
                        <button
                          type="button"
                          onClick={handleCopyRsbsa}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                          title="Copy ID"
                        >
                          {copiedId ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                      <span className="text-slate-500 font-medium">Assigned Office</span>
                      <span className="font-bold text-slate-900 text-right">{formData.department}</span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                      <span className="text-slate-500 font-medium">
                        {isFarmer ? "Cooperative / Association" : "Division / Operations Unit"}
                      </span>
                      <span className="font-bold text-slate-900 text-right">
                        {isFarmer
                          ? formData.cooperative
                          : isFieldReviewer
                          ? "Biosecurity & Surveillance Team (SIBAT/CBAT)"
                          : isSlaughterhouse
                          ? "Meat Inspection & Processing Division"
                          : isAuction
                          ? "Auction Floor Operations & Clearance"
                          : "Padre Garcia LGU Administration"}
                      </span>
                    </div>

                    {!isFarmer && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500 font-medium">Jurisdiction & Scope</span>
                        <span className="font-bold text-slate-900 text-right">
                          {isFieldReviewer
                            ? (user?.accessScope === "ALL_BARANGAYS" ? "All Barangays" : user?.assignedBarangayName || "Padre Garcia Sector")
                            : "Padre Garcia Municipal Coverage (18 Barangays)"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RA 10173 Data Governance Callout (System Access & Clearances removed) */}
                  <div className="rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] p-4 flex items-start gap-3 mt-4">
                    <span className="size-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="size-3 stroke-[3]" />
                    </span>
                    <div className="space-y-0.5 text-xs">
                      <p className="font-bold text-emerald-950">
                        Your account is linked to the official municipal registry.
                      </p>
                      <p className="text-emerald-800 leading-relaxed font-normal">
                        Your information and official records are protected under the Padre Garcia data governance policy and RA 10173 Data Privacy Act.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Personal Information + Farm/Office Information */}
            <div ref={detailsSectionRef} className="space-y-5 relative z-30 scroll-mt-20">
              {/* Live Edit Mode Status Banner */}
              {isEditing && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-[#1B3E18] to-emerald-950 border-2 border-emerald-400 shadow-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-3 duration-300">
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
                        Update your personal details, mobile contact, and farm records below.
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

              {/* Card 3: Personal Information */}
              <Card className={`rounded-2xl border bg-white transition-all duration-300 ${
                isEditing
                  ? "ring-4 ring-emerald-500/40 border-emerald-500 shadow-2xl scale-[1.005]"
                  : "border-slate-200/80 shadow-2xs overflow-hidden"
              }`}>
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <UserIcon className="size-5 text-emerald-700" />
                      <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
                    </div>
                    {isEditing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Editing Personal Info
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          scrollToDetails();
                        }}
                        className="h-7 px-2.5 text-xs font-semibold rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="size-3" />
                        <span>Edit</span>
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">First Name</Label>
                          <Input
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">Last Name</Label>
                          <Input
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-600">Email Address</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">Mobile Number</Label>
                          <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">Alternate Number (Optional)</Label>
                          <Input
                            value={formData.alternatePhone}
                            onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                      <div className="pt-2 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditing(false)}
                          className="h-8 px-3 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleSaveProfile()}
                          className="bg-[#2D5A27] hover:bg-[#23461f] text-white text-xs font-bold rounded-lg h-8 px-4 flex items-center gap-1.5 shadow-sm"
                        >
                          <Save className="size-3 mr-1" />
                          {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">First Name</span>
                        <span className="font-bold text-slate-900">{formData.firstName}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">Last Name</span>
                        <span className="font-bold text-slate-900">{formData.lastName}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">Email Address</span>
                        <span className="font-bold text-slate-900">{formData.email}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">Mobile Number</span>
                        <span className="font-bold text-slate-900">{formData.phone}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500 font-medium">Alternate Number</span>
                        <span className="font-bold text-slate-900">
                          {formData.alternatePhone ? `${formData.alternatePhone} (Optional)` : "0998-444-1280 (Optional)"}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Card 4: Farm Information (for Farmer) / Office & Facility Information (for non-farmer) */}
              <Card className={`rounded-2xl border bg-white transition-all duration-300 ${
                isEditing
                  ? "ring-4 ring-emerald-500/40 border-emerald-500 shadow-2xl scale-[1.005]"
                  : "border-slate-200/80 shadow-2xs overflow-hidden"
              }`}>
                <CardContent className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="size-5 text-emerald-700" />
                      <h3 className="text-base font-bold text-slate-900">
                        {isFarmer ? "Farm Information" : "Office & Facility Information"}
                      </h3>
                    </div>
                    {isEditing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Editing {isFarmer ? "Farm Details" : "Facility Details"}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsEditing(true);
                          scrollToDetails();
                        }}
                        className="h-7 px-2.5 text-xs font-semibold rounded-lg border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="size-3" />
                        <span>Edit</span>
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-600">
                          {isFarmer ? "Farm / Holding Facility Name" : "Office / Facility Name"}
                        </Label>
                        <Input
                          value={formData.farmName}
                          onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                          className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-slate-600">
                          {isFarmer ? "Operation Type" : "Operation Scope / Designation"}
                        </Label>
                        <Input
                          value={formData.farmType}
                          onChange={(e) => setFormData({ ...formData, farmType: e.target.value })}
                          className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">
                            {isFarmer ? "Sitio / Street / Zone" : "Station Address / Street"}
                          </Label>
                          <Input
                            value={formData.sitio}
                            onChange={(e) => setFormData({ ...formData, sitio: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">
                            {isFarmer ? "Barangay" : "Barangay Assignment"}
                          </Label>
                          <Input
                            value={formData.barangay}
                            onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">Municipality</Label>
                          <Input
                            value={formData.municipality}
                            onChange={(e) => setFormData({ ...formData, municipality: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-slate-600">ZIP Code</Label>
                          <Input
                            value={formData.zipCode}
                            onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                            className="h-9.5 text-xs rounded-xl bg-emerald-50/40 border-emerald-400 text-slate-900 font-semibold focus-visible:ring-emerald-600 focus-visible:border-emerald-600 transition-all shadow-2xs"
                          />
                        </div>
                      </div>
                      <div className="pt-2 flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditing(false)}
                          className="h-8 px-3 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleSaveProfile()}
                          className="bg-[#2D5A27] hover:bg-[#23461f] text-white text-xs font-bold rounded-lg h-8 px-4 flex items-center gap-1.5 shadow-sm"
                        >
                          <Save className="size-3 mr-1" />
                          {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">
                          {isFarmer ? "Farm / Holding Facility Name" : "Office / Facility Name"}
                        </span>
                        <span className="font-bold text-slate-900">
                          {isFarmer ? formData.farmName : (formData.farmName || roleFacilitySubtitle)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">
                          {isFarmer ? "Operation Type" : "Operation Scope"}
                        </span>
                        <span className="font-bold text-slate-900">
                          {isFarmer ? formData.farmType : (formData.farmType || "Municipal Regulatory & Field Operations")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">
                          {isFarmer ? "Sitio / Street / Zone" : "Station Address / Street"}
                        </span>
                        <span className="font-bold text-slate-900">{formData.sitio}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
                        <span className="text-slate-500 font-medium">
                          {isFarmer ? "Barangay" : "Barangay Assignment"}
                        </span>
                        <span className="font-bold text-slate-900">{formData.barangay}</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-500 font-medium">Municipality & ZIP</span>
                        <span className="font-bold text-slate-900">{formData.municipality}, Batangas ({formData.zipCode})</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-0">
          {renderSecurityContent()}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-0">
          {renderNotificationsContent()}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-0">
          {renderDocumentsContent()}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 mt-0">
          {renderActivityContent()}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 mt-0">
          {renderSettingsContent()}
        </TabsContent>
      </Tabs>

      {/* Profile QR Pass modal for all roles */}
      <Dialog open={showIdPassModal} onOpenChange={setShowIdPassModal}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl p-6 rounded-3xl bg-white border-0 shadow-2xl max-h-[94vh] overflow-y-auto">
          <DialogHeader className="space-y-1 text-center">
            <DialogTitle className="text-xl font-black text-slate-900">
              {isFarmer ? "Farmer Profile Identification" : `${rolePillLabel} Identification`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {isFarmer
                ? "Auction staff can scan this profile QR to find your registered livestock. It identifies your Farmer account; it does not prove that an animal or sale is approved."
                : "Official municipal personnel verification QR code for Padre Garcia MAO and livestock monitoring systems."}
            </DialogDescription>
          </DialogHeader>

          {isFarmer && user?.farmerId ? (
            <QrCodePass
              code={`SL-FARMER:${user.farmerId}`}
              qrPayload={`SL-FARMER:${user.farmerId}`}
              title="Farmer account QR"
              subtitle="Show this QR to Auction staff to look up your registered livestock."
              ownerName={`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || undefined}
              status="ACCOUNT ID"
              compact
            />
          ) : (
            <QrCodePass
              code={`SL-${user?.role || "OFFICIAL"}:${formData.rsbsaId || user?.username || "PGAMS-2026"}`}
              qrPayload={`SL-${user?.role || "OFFICIAL"}:${formData.rsbsaId || user?.username || "PGAMS-2026"}`}
              title={`${rolePillLabel} Identification`}
              subtitle="Official municipal verification QR code for Padre Garcia MAO livestock management system."
              ownerName={`${formData.firstName} ${formData.lastName}`.trim() || userDisplayName}
              status={roleVerifiedBadge.toUpperCase()}
              compact
            />
          )}

          <Button
            type="button"
            onClick={() => setShowIdPassModal(false)}
            className="w-full bg-[#2D5A27] hover:bg-[#23461f] text-white font-bold text-xs rounded-xl h-9.5 cursor-pointer mt-4"
          >
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
