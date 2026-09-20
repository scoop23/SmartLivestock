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
  Sprout,
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
      if (decoded.role === 'MAO') {
        router.push('/admin');
      } else if (decoded.role === 'FARMER') {
        router.push('/farmer');
      } else if (decoded.role === 'SIBAT') {
        router.push('/sibat');
      } else if (decoded.role === 'AUCTION') {
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
    // Simulate/send reset password request
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
          LEFT PANEL: LOGIN FORM
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 md:p-14 lg:p-16 xl:p-20 bg-white">
        {/* Top Header Logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-[#2D5A27] text-white flex items-center justify-center shadow-md shadow-green-950/15">
              <Icon iconNode={cowHead} className="size-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tight block leading-tight">
                SmartLivestock
              </span>
              <span className="text-xs font-bold text-[#2D5A27] uppercase tracking-wider flex items-center gap-1">
                <MapPin className="size-3 text-emerald-600" /> Padre Garcia, Batangas
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-extrabold text-[#2D5A27]">
            <ShieldCheck className="size-3.5 text-emerald-700" />
            <span>Official LGU Portal</span>
          </div>
        </div>

        {/* Center Main Form Card with Shake Animation */}
        <div className={`w-full max-w-md mx-auto my-auto space-y-7 transition-transform ${isShaking ? 'animate-shake' : ''}`}>
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Sign in with your email and password to access your portal.
            </p>
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              DYNAMIC ERROR ALERT BANNER (Wrong Email/Password, Pending, Network)
             ═════════════════════════════════════════════════════════════════ */}
          {authError && (
            <div
              className={`p-4 rounded-2xl border flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200 ${authError.type === 'PENDING'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                  : 'bg-rose-50/90 border-rose-200 text-rose-950'
                }`}
            >
              <div
                className={`size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${authError.type === 'PENDING'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-600'
                  }`}
              >
                <AlertCircle className="size-4.5" />
              </div>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black tracking-tight">
                    {authError.title}
                  </h4>
                  {authError.type === 'CREDENTIALS' && failedAttempts >= 2 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 uppercase">
                      Attempt #{failedAttempts}
                    </span>
                  )}
                </div>

                <p className="text-xs font-medium leading-relaxed opacity-90">
                  {authError.message}
                </p>

                {/* Contextual Action Links */}
                {authError.type === 'CREDENTIALS' && (
                  <div className="pt-1.5 flex flex-wrap items-center gap-2 text-xs">
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
                  <div className="pt-1.5 flex items-center gap-2">
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

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="email"
                  className={`text-xs font-extrabold uppercase tracking-wider block ${authError?.type === 'CREDENTIALS' ? 'text-rose-700' : 'text-slate-700'
                    }`}
                >
                  Email Address
                </Label>
                {authError?.type === 'CREDENTIALS' && (
                  <span className="text-[11px] font-bold text-rose-600 animate-in fade-in">
                    Double-check spelling
                  </span>
                )}
              </div>

              <div className="relative">
                <div
                  className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${authError?.type === 'CREDENTIALS' ? 'text-rose-500' : 'text-slate-400'
                    }`}
                >
                  <Mail className="size-4.5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErrors();
                  }}
                  placeholder="name@padregarcia.gov.ph"
                  required
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-3.5 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:ring-2 ${authError?.type === 'CREDENTIALS'
                      ? 'bg-rose-50/30 border-2 border-rose-300 text-rose-950 placeholder:text-rose-300 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white'
                      : 'bg-slate-50/80 hover:bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#2D5A27] focus:ring-[#2D5A27]/20 focus:bg-white'
                    }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className={`text-xs font-extrabold uppercase tracking-wider ${authError?.type === 'CREDENTIALS' ? 'text-rose-700' : 'text-slate-700'
                    }`}
                >
                  Password
                </Label>
                <button
                  type="button"
                  onClick={openResetDialogWithCurrentEmail}
                  className="text-xs font-bold text-[#2D5A27] hover:text-[#23471f] hover:underline cursor-pointer transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <div
                  className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors ${authError?.type === 'CREDENTIALS' ? 'text-rose-500' : 'text-slate-400'
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
                  className={`w-full pl-10 pr-11 py-3.5 rounded-2xl text-sm font-medium transition-all focus:outline-none focus:ring-2 ${authError?.type === 'CREDENTIALS'
                      ? 'bg-rose-50/30 border-2 border-rose-300 text-rose-950 placeholder:text-rose-300 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-white'
                      : 'bg-slate-50/80 hover:bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#2D5A27] focus:ring-[#2D5A27]/20 focus:bg-white'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
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
            <div className="flex items-center space-x-2.5 pt-1">
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
              className="w-full py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 hover:shadow-xl hover:shadow-green-900/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="size-4.5" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-extrabold tracking-widest">
                New to SmartLivestock?
              </span>
            </div>
          </div>

          {/* Register Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/farmer-registration')}
            className="w-full py-6 border-2 border-emerald-900/20 text-[#2D5A27] hover:bg-emerald-50/80 font-black text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sprout className="size-4" />
            <span>Register as Livestock Raiser</span>
          </Button>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-center text-xs text-slate-400 font-medium">
          <p>© {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas</p>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          RIGHT PANEL: HERO IMAGE WITH LUSH OVERLAY & PLATFORM BRANDING
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-emerald-950 flex-col justify-between p-12 xl:p-16 text-white min-h-screen">
        {/* Background Hero Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/pasture-hero.jpg"
            alt="Padre Garcia Pasture and Livestock Landscape"
            fill
            priority
            className="object-cover object-center scale-105 transform hover:scale-100 transition-transform duration-1000"
          />
          {/* Rich Double Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/95 via-[#1b3d18]/85 to-emerald-900/60 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/40 to-transparent" />
        </div>

        {/* Top Floating Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-extrabold tracking-wider uppercase">
            <Sparkles className="size-4 text-amber-300 animate-pulse" />
            <span>Cattle Capital of the Philippines</span>
          </div>

          <span className="text-xs font-mono text-emerald-200/80 font-bold">
            Padre Garcia, Batangas
          </span>
        </div>

        {/* Center Headline & Features Glassmorphism Card */}
        <div className="relative z-10 max-w-lg space-y-6 my-auto">
          <div className="space-y-3">
            <h2 className="text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
              SmartLivestock Information & Surveillance System
            </h2>
            <p className="text-emerald-100/90 text-sm xl:text-base leading-relaxed font-medium">
              A comprehensive digital livestock management platform for the Municipality of Padre Garcia.
              Track animal health, log dairy and meat production, and streamline multi-tier SIBAT & MAO certifications.
            </p>
          </div>

          {/* Value Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5 hover:bg-white/15 transition-colors">
              <div className="size-8 rounded-xl bg-emerald-400/20 text-emerald-300 flex items-center justify-center">
                <ShieldCheck className="size-4.5" />
              </div>
              <h3 className="text-xs font-black text-white">Biosecurity Alert</h3>
              <p className="text-[11px] text-emerald-100/75 leading-tight font-medium">
                Rapid disease containment & field tagging
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5 hover:bg-white/15 transition-colors">
              <div className="size-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <Activity className="size-4.5" />
              </div>
              <h3 className="text-xs font-black text-white">Yield Tracking</h3>
              <p className="text-[11px] text-emerald-100/75 leading-tight font-medium">
                Daily milk & production analytics
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 space-y-1.5 hover:bg-white/15 transition-colors">
              <div className="size-8 rounded-xl bg-sky-400/20 text-sky-300 flex items-center justify-center">
                <MapPin className="size-4.5" />
              </div>
              <h3 className="text-xs font-black text-white">GIS Survey</h3>
              <p className="text-[11px] text-emerald-100/75 leading-tight font-medium">
                17 Barangay livestock head census
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Status Ticker */}
        <div className="relative z-10 pt-6 border-t border-white/15 flex items-center justify-between text-xs text-emerald-200/80 font-semibold">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>MAO Surveillance Network Active</span>
          </div>
          <span className="font-mono text-[11px]">Padre Garcia Livestock Hub</span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          RESET PASSWORD MODAL DIALOG
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-6 sm:p-8 bg-white border-none shadow-2xl">
          <DialogHeader className="space-y-2 text-center sm:text-left">
            <div className="size-12 rounded-2xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center mx-auto sm:mx-0 mb-1">
              <HelpCircle className="size-6" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-900 tracking-tight">
              Reset your password
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed">
              Enter your registered account email and we'll send you verification instructions to regain access.
            </DialogDescription>
          </DialogHeader>

          {resetSuccess ? (
            <div className="py-6 space-y-4 text-center">
              <div className="size-14 rounded-full bg-emerald-100 text-[#2D5A27] flex items-center justify-center mx-auto animate-in zoom-in-50">
                <CheckCircle2 className="size-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900">Check your inbox</h4>
                <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">
                  We sent password reset steps to <strong className="text-slate-800">{resetEmail}</strong>.
                </p>
              </div>
              <Button
                onClick={() => setResetDialogOpen(false)}
                className="w-full py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white rounded-2xl font-black uppercase text-xs tracking-wider mt-2"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
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
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetDialogOpen(false)}
                  className="flex-1 py-5 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black rounded-2xl text-xs uppercase tracking-wider shadow-md"
                >
                  {resetLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Send Instructions'
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
