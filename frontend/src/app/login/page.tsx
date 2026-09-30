'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Activity,
  MapPin,
  ArrowRight,
  Sparkles,
  HelpCircle,
  Loader2,
  Radio,
  TrendingUp,
  Wifi,
} from 'lucide-react';
import { Icon } from 'lucide-react';
import { cowHead } from '@lucide/lab';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'sonner';

import api from '@/lib/axios';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface DecodedJWT {
  email: string;
  role: "MAO" | "FARMER" | "SIBAT" | "AUCTION" | "SLAUGHTERHOUSESTAFF";
}

type AuthErrorType = 'CREDENTIALS' | 'PENDING' | 'NETWORK' | 'GENERAL';

interface AuthErrorState {
  type: AuthErrorType;
  title: string;
  message: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { fetchUser } = useAuth();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorState | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Forgot password modal states
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('smartlivestock_remember_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  const handlePasswordKeyEvents = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  const clearErrors = () => {
    if (authError) setAuthError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    // Basic client-side check
    if (!email.trim() || !password) {
      setAuthError({
        type: 'GENERAL',
        title: 'Missing Required Fields',
        message: 'Please enter both your email address and password.',
      });
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      // POST to Django backend at /api/token/ with email + password
      const response = await api.post('/api/token/', {
        email: email.trim().toLowerCase(),
        password: password,
      });

      const { access, refresh } = response.data;

      // Handle remember me preference
      try {
        if (rememberMe) {
          localStorage.setItem('smartlivestock_remember_email', email.trim().toLowerCase());
        } else {
          localStorage.removeItem('smartlivestock_remember_email');
        }
      } catch {
        // Ignore storage errors
      }

      // Decode the JWT to get the user's role for frontend routing
      const decoded: DecodedJWT = jwtDecode(access);
      localStorage.setItem('access', access);
      localStorage.setItem('refresh', refresh);
      await fetchUser();

      toast.success('Welcome back!', {
        description: `Signed in successfully as ${decoded.role}.`,
      });

      // Role-based redirect to the appropriate dashboard
      const normalizedRole = decoded.role?.toUpperCase();
      if (normalizedRole === 'MAO' || normalizedRole === 'ADMIN') {
        router.push('/admin');
      } else if (normalizedRole === 'FARMER') {
        router.push('/farmer');
      } else if (normalizedRole === 'SIBAT') {
        router.push('/sibat');
      } else if (normalizedRole === 'AUCTION') {
        router.push('/auction');
      } else {
        router.push('/farmer');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;

      triggerShake();

      // 1. Check if the account is pending approval or not approved yet
      const accountStatusStr = typeof data?.account_status === 'string'
        ? data.account_status
        : Array.isArray(data?.account_status)
          ? data.account_status[0]
          : '';

      const detailStr = typeof data?.detail === 'string' ? data.detail : '';

      if (
        accountStatusStr.toLowerCase().includes('not approved') ||
        accountStatusStr.toUpperCase() === 'PENDING' ||
        detailStr.toUpperCase().includes('PENDING') ||
        detailStr.toLowerCase().includes('approved')
      ) {
        setAuthError({
          type: 'PENDING',
          title: 'Account Awaiting MAO Approval',
          message: 'Your account registration has been received and is currently under review by the Municipal Agriculture Office. You will be notified once approved.',
        });
        toast.info('Account Pending Verification', {
          description: 'Your registration is awaiting approval by the MAO office.',
        });
        return;
      }

      // 2. Check for invalid email or password (401 Unauthorized or 400 Bad Request with credentials error)
      if (status === 401 || status === 400) {
        setFailedAttempts((prev) => prev + 1);
        setAuthError({
          type: 'CREDENTIALS',
          title: 'Incorrect Email or Password',
          message: 'The email or password you entered does not match our records. Please double-check your spelling and try again.',
        });
        toast.error('Authentication Failed', {
          description: 'Invalid email or password. Please try again.',
        });
      } else if (err.code === 'ERR_NETWORK') {
        setAuthError({
          type: 'NETWORK',
          title: 'Server Connection Error',
          message: 'Unable to reach the SmartLivestock authentication server. Please check your network connection.',
        });
        toast.error('Network Error', { description: 'Cannot reach server. Please check your connection.' });
      } else {
        const errorDetail = data?.detail || 'An unexpected error occurred during sign in. Please try again.';
        setAuthError({
          type: 'GENERAL',
          title: 'Sign In Failed',
          message: errorDetail,
        });
        toast.error('Sign In Error', { description: errorDetail });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setResetLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setResetLoading(false);
    setResetSuccess(true);
    toast.success('Password Reset Email Sent', {
      description: `Instructions have been sent to ${resetEmail}.`,
    });
  };

  const openResetDialogWithCurrentEmail = () => {
    setResetEmail(email.trim());
    setResetSuccess(false);
    setResetDialogOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 selection:bg-emerald-600 selection:text-white">
      {/* ═════════════════════════════════════════════════════════════════════
          LEFT PANEL: ULTRA-MODERN HERO, LIVE TELEMETRY & BRANDING
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-7/12 relative overflow-hidden bg-[#071907] flex-col justify-between p-10 xl:p-14 2xl:p-16 text-white min-h-screen">
        {/* Background Layer 1: Pastoral Image with Cinematic Slow Zoom */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src="/images/pasture-hero.jpg"
            alt="Padre Garcia Pasture and Livestock Landscape"
            fill
            priority
            className="object-cover object-center animate-hero-zoom filter brightness-[0.78] contrast-[1.05]"
          />

          {/* Deep Emerald Multi-Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/98 via-[#0b220a]/88 to-emerald-900/65 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071907] via-emerald-950/40 to-transparent" />

          {/* Background Layer 2: High-Tech Geometric Coordinate Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,#000_50%,transparent_100%)] opacity-70" />

          {/* Background Layer 3: Organic Luminous Aurora Mesh Orbs */}
          <div className="absolute -top-28 -left-28 size-[34rem] rounded-full bg-gradient-to-br from-emerald-400/25 via-teal-400/18 to-transparent blur-3xl animate-aurora-1 pointer-events-none" />
          <div className="absolute top-1/2 -right-36 size-[32rem] rounded-full bg-gradient-to-tl from-emerald-500/25 via-lime-300/15 to-transparent blur-3xl animate-aurora-2 pointer-events-none" />
          <div className="absolute -bottom-24 left-1/3 size-[26rem] rounded-full bg-emerald-400/12 blur-3xl animate-glow-pulse pointer-events-none" />
        </div>

        {/* Top Floating Badge Bar with Live Ping */}
        <div className="relative z-10 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="group/badge inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/20 text-xs font-extrabold tracking-wider uppercase shadow-xl shadow-black/20 hover:bg-white/[0.14] transition-all">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-amber-400"></span>
            </span>
            <Sparkles className="size-3.5 text-amber-300 animate-pulse" />
            <span className="text-white/95 tracking-wide">Cattle Capital of the Philippines</span>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.08] backdrop-blur-xl border border-white/15 text-xs font-mono text-emerald-200/90 font-bold shadow-sm">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-2 bg-emerald-400"></span>
            </span>
            <MapPin className="size-3 text-emerald-300 shrink-0" />
            <span>Padre Garcia, Batangas</span>
          </div>
        </div>

        {/* Center Section: Animated Title & Dynamic Telemetry HUD */}
        <div className="relative z-10 max-w-xl space-y-6 my-auto py-4">
          <div className="space-y-4 animate-in fade-in slide-in-from-left-6 duration-700">
            {/* LGU Telemetry Pill Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/35 text-emerald-300 text-[11px] font-bold tracking-wide uppercase shadow-lg shadow-emerald-950/40">
              <Radio className="size-3.5 text-emerald-400 animate-pulse" />
              <span>Official Municipal Agriculture Office Platform</span>
            </div>

            {/* Glowing Gradient Title */}
            <h1 className="text-3xl sm:text-4xl xl:text-5xl 2xl:text-[3.15rem] font-black text-white tracking-tight leading-[1.12] drop-shadow-md">
              SmartLivestock{' '}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-100 bg-clip-text text-transparent">
                Information &amp; Surveillance
              </span>{' '}
              System
            </h1>

            {/* Comprehensive Platform Description */}
            <p className="text-emerald-100/90 text-sm sm:text-base xl:text-lg leading-relaxed font-normal">
              A comprehensive digital livestock management platform for the Municipality of Padre Garcia.
              Track animal health, log dairy and meat production, and streamline multi-tier SIBAT &amp; MAO certifications.
            </p>
          </div>

          {/* Real-time Telemetry HUD Glassmorphic Widget */}
          <div className="p-4 rounded-2xl bg-white/[0.07] backdrop-blur-2xl border border-white/20 shadow-2xl shadow-black/25 hover:border-emerald-400/40 hover:bg-white/[0.10] transition-all duration-300 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2 text-emerald-300 font-extrabold tracking-wider uppercase text-[11px]">
                <Activity className="size-3.5 text-emerald-400 animate-pulse" />
                <span>Live Bio-Surveillance Telemetry</span>
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-200/90 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/30 font-semibold shadow-xs">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                100% OPERATIONAL
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/70">Tagged Heads</span>
                  <TrendingUp className="size-3 text-emerald-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight">14,820</div>
                <div className="text-[9px] text-emerald-300 font-semibold">+142 this week</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/70">Barangays</span>
                  <Wifi className="size-3 text-sky-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight">17 / 17</div>
                <div className="text-[9px] text-sky-300 font-semibold">GIS Census Active</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-200/70">Biosecurity</span>
                  <ShieldCheck className="size-3 text-emerald-400" />
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-300 font-mono tracking-tight">Tier 1</div>
                <div className="text-[9px] text-emerald-300 font-semibold">Zero Active Outbreaks</div>
              </div>
            </div>
          </div>

          {/* 3 Staggered Organic Floating Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            {/* Card 1: Float Rhythm 1 */}
            <div className="animate-float-1 group p-4 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 space-y-2 hover:bg-white/[0.15] hover:border-emerald-300/50 hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 shadow-xl shadow-black/15">
              <div className="size-9 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-400/30 group-hover:shadow-[0_0_15px_rgba(52,211,153,0.4)] transition-all">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-emerald-200 transition-colors">
                Biosecurity Alert
              </h3>
              <p className="text-[11px] text-emerald-100/75 leading-tight font-medium">
                Rapid containment &amp; quarantine tagging
              </p>
            </div>

            {/* Card 2: Float Rhythm 2 (Asynchronous Rhythm) */}
            <div className="animate-float-2 group p-4 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 space-y-2 hover:bg-white/[0.15] hover:border-amber-300/50 hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 shadow-xl shadow-black/15">
              <div className="size-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-400/30 group-hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all">
                <Activity className="size-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-amber-200 transition-colors">
                Yield Tracking
              </h3>
              <p className="text-[11px] text-emerald-100/75 leading-tight font-medium">
                Daily milk &amp; meat production analytics
              </p>
            </div>

            {/* Card 3: Float Rhythm 3 (Asynchronous Rhythm) */}
            <div className="animate-float-3 group p-4 rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/15 space-y-2 hover:bg-white/[0.15] hover:border-sky-300/50 hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 shadow-xl shadow-black/15">
              <div className="size-9 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center group-hover:scale-110 group-hover:bg-sky-400/30 group-hover:shadow-[0_0_15px_rgba(56,189,248,0.4)] transition-all">
                <MapPin className="size-5" />
              </div>
              <h3 className="text-xs sm:text-sm font-black text-white group-hover:text-sky-200 transition-colors">
                GIS Survey
              </h3>
              <p className="text-[11px] text-emerald-100/75 leading-tight font-medium">
                17 Barangay livestock head census
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Status Ticker with Live Sonar Pulse */}
        <div className="relative z-10 pt-5 border-t border-white/15 flex items-center justify-between text-xs text-emerald-200/90 font-semibold animate-in fade-in slide-in-from-bottom-3 duration-700">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-3">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50"></span>
              <span className="relative inline-flex rounded-full size-3 bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
            </span>
            <span className="tracking-wide font-medium">MAO Surveillance Network Active • Live Stream</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300/80 bg-white/[0.06] px-2.5 py-1 rounded-lg border border-white/10">
            Padre Garcia Livestock Hub
          </span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          RIGHT PANEL: LOGIN FORM (Swapped to Right)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-between p-5 xs:p-7 sm:p-10 md:p-12 lg:p-12 xl:p-16 2xl:p-20 bg-white min-h-screen overflow-y-auto animate-in fade-in slide-in-from-right-8 duration-700 ease-out">
        {/* Top Header Logo */}
        <div className="flex items-center justify-between mb-5 sm:mb-8">
          <div className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="size-10 sm:size-11 rounded-2xl bg-[#2D5A27] text-white flex items-center justify-center shadow-md shadow-green-950/15 shrink-0 group-hover:scale-105 transition-transform">
              <Icon iconNode={cowHead} className="size-5 sm:size-6 text-white" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight block leading-tight">
                SmartLivestock
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-[#2D5A27] uppercase tracking-wider flex items-center gap-1">
                <MapPin className="size-3 text-emerald-600 shrink-0" /> Padre Garcia, Batangas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] sm:text-[11px] font-extrabold text-[#2D5A27] shrink-0">
            <ShieldCheck className="size-3 sm:size-3.5 text-emerald-700 shrink-0" />
            <span>LGU Portal</span>
          </div>
        </div>

        {/* Mobile-only LGU Identity Banner */}
        <div className="lg:hidden p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-[#1E3D1A] to-emerald-900 text-white mb-6 shadow-md space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-extrabold tracking-wide uppercase text-amber-300">
              <Sparkles className="size-3 animate-pulse" />
              <span>Cattle Capital of the Philippines</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-200/90 font-bold shrink-0">
              MAO Portal
            </span>
          </div>
          <h2 className="text-sm font-black text-white leading-tight">
            SmartLivestock Information &amp; Surveillance System
          </h2>
          <p className="text-[11px] text-emerald-100/80 font-medium leading-relaxed">
            Livestock health tracking, production logs, and multi-tier certifications for Padre Garcia.
          </p>
        </div>

        {/* Center Main Form Card with Shake Animation */}
        <div className={`w-full max-w-md mx-auto my-auto space-y-5 sm:space-y-6 transition-all duration-300 ${isShaking ? 'animate-shake' : ''}`}>
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Sign in with your email and password to access your portal.
            </p>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              DYNAMIC ERROR ALERT BANNER (Wrong Email/Password, Pending, Network)
             ═════════════════════════════════════════════════════════════════ */}
          {authError && (
            <div
              className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
                authError.type === 'PENDING'
                  ? 'bg-amber-50/95 border-amber-200 text-amber-950'
                  : 'bg-rose-50/95 border-rose-200 text-rose-950'
              }`}
            >
              <div
                className={`size-7 sm:size-8 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                  authError.type === 'PENDING'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                <AlertCircle className="size-4 sm:size-4.5" />
              </div>

              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-black tracking-tight truncate">
                    {authError.title}
                  </h4>
                  {authError.type === 'CREDENTIALS' && failedAttempts >= 2 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-700 uppercase shrink-0">
                      Attempt #{failedAttempts}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium leading-relaxed opacity-90 break-words">
                  {authError.message}
                </p>

                {/* Contextual Action Links */}
                {authError.type === 'CREDENTIALS' && (
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={openResetDialogWithCurrentEmail}
                      className="inline-flex items-center gap-1 font-black text-rose-800 hover:text-rose-950 underline underline-offset-2 cursor-pointer transition-colors"
                    >
                      Forgot your password? Click to reset
                    </button>
                  </div>
                )}

                {authError.type === 'PENDING' && (
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push('/pending')}
                      className="inline-flex items-center gap-1 text-xs font-black text-amber-800 hover:text-amber-950 underline underline-offset-2 cursor-pointer"
                    >
                      View Registration Status Details →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="email"
                  className={`text-xs font-extrabold uppercase tracking-wider block ${
                    authError?.type === 'CREDENTIALS' ? 'text-rose-700' : 'text-slate-700'
                  }`}
                >
                  Email Address
                </Label>
                {authError?.type === 'CREDENTIALS' && (
                  <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 animate-in fade-in">
                    Check spelling
                  </span>
                )}
              </div>

              <div className="relative group">
                <div
                  className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                    authError?.type === 'CREDENTIALS' ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-[#2D5A27]'
                  }`}
                >
                  <Mail className="size-4.5" />
                </div>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErrors();
                  }}
                  placeholder="name@padregarcia.gov.ph"
                  required
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 h-11.5 sm:h-12 rounded-xl sm:rounded-2xl text-base sm:text-sm font-medium transition-all focus:outline-none focus:ring-4 ${
                    authError?.type === 'CREDENTIALS'
                      ? 'bg-rose-50/30 border-2 border-rose-300 text-rose-950 placeholder:text-rose-300 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white'
                      : 'bg-slate-50/80 hover:bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#2D5A27] focus:ring-[#2D5A27]/15 focus:bg-white'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className={`text-xs font-extrabold uppercase tracking-wider ${
                    authError?.type === 'CREDENTIALS' ? 'text-rose-700' : 'text-slate-700'
                  }`}
                >
                  Password
                </Label>
                <button
                  type="button"
                  onClick={openResetDialogWithCurrentEmail}
                  className="text-xs font-bold text-[#2D5A27] hover:text-[#23471f] hover:underline cursor-pointer transition-colors py-0.5"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative group">
                <div
                  className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${
                    authError?.type === 'CREDENTIALS' ? 'text-rose-500' : 'text-slate-400 group-focus-within:text-[#2D5A27]'
                  }`}
                >
                  <Lock className="size-4.5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearErrors();
                  }}
                  onKeyDown={handlePasswordKeyEvents}
                  onKeyUp={handlePasswordKeyEvents}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-12 h-11.5 sm:h-12 rounded-xl sm:rounded-2xl text-base sm:text-sm font-medium transition-all focus:outline-none focus:ring-4 ${
                    authError?.type === 'CREDENTIALS'
                      ? 'bg-rose-50/30 border-2 border-rose-300 text-rose-950 placeholder:text-rose-300 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white'
                      : 'bg-slate-50/80 hover:bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#2D5A27] focus:ring-[#2D5A27]/15 focus:bg-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 w-11 h-full flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-transform cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>

              {/* Caps Lock Active Warning */}
              {capsLockOn && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold animate-in fade-in">
                  <span className="font-mono text-xs">⚠️</span>
                  <span>Caps Lock is ON — check your password casing</span>
                </div>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center space-x-2.5 pt-0.5">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                className="rounded-lg border-slate-300 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
              />
              <Label
                htmlFor="remember"
                className="text-xs font-semibold text-slate-600 cursor-pointer select-none"
              >
                Remember my email on this device
              </Label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="group w-full h-12 sm:h-13 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl sm:rounded-2xl shadow-lg shadow-green-900/20 hover:shadow-xl hover:shadow-green-900/30 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="size-4.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-4 sm:my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-extrabold tracking-widest text-[10px] sm:text-xs">
                New to SmartLivestock?
              </span>
            </div>
          </div>

          {/* Register Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/farmer-registration')}
            className="group w-full h-12 sm:h-13 border-2 border-emerald-900/20 text-[#2D5A27] hover:bg-emerald-50/80 font-black text-xs uppercase tracking-widest rounded-xl sm:rounded-2xl active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Icon iconNode={cowHead} className="size-4 group-hover:rotate-12 transition-transform" />
            <span>Register as Livestock Raiser</span>
          </Button>
        </div>

        {/* Footer info */}
        <div className="pt-6 sm:pt-8 text-center text-[11px] sm:text-xs text-slate-400 font-medium">
          <p>© {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas</p>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          RESET PASSWORD MODAL DIALOG (Mobile Optimized)
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="w-[94vw] max-w-md mx-auto rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-7 bg-white border-none shadow-2xl">
          <DialogHeader className="space-y-1.5 text-center sm:text-left">
            <div className="size-11 sm:size-12 rounded-2xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center mx-auto sm:mx-0 mb-1">
              <HelpCircle className="size-5 sm:size-6" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed">
              Enter your registered account email and we'll send you verification instructions to regain access.
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            <div className="py-4 sm:py-6 space-y-3 sm:space-y-4 text-center">
              <div className="size-12 sm:size-14 rounded-full bg-emerald-100 text-[#2D5A27] flex items-center justify-center mx-auto animate-in zoom-in-50">
                <CheckCircle2 className="size-7 sm:size-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-black text-slate-900">Check your inbox</h4>
                <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto leading-relaxed break-words">
                  We sent password reset steps to <strong className="text-slate-800">{resetEmail}</strong>.
                </p>
              </div>
              <Button
                onClick={() => setResetDialogOpen(false)}
                className="w-full h-11 sm:h-12 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-xl sm:rounded-2xl font-black uppercase text-xs tracking-wider mt-2"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Email Address
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="size-4.5" />
                  </div>
                  <input
                    id="reset-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    className="w-full pl-10 pr-4 h-11.5 sm:h-12 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetDialogOpen(false)}
                  className="flex-1 h-11 sm:h-12 border-slate-200 text-slate-700 font-bold rounded-xl sm:rounded-2xl text-xs uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 h-11 sm:h-12 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black rounded-xl sm:rounded-2xl text-xs uppercase tracking-wider shadow-md"
                >
                  {resetLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Send Steps'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
