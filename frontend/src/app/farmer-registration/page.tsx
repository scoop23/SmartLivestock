'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '@/lib/axios';
import { identityClient, saveRegistrationIdentitySession } from '@/lib/identity-verification';
import { cowHead } from '@lucide/lab';
import axios from 'axios';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  FileCheck,
  FileText,
  Fingerprint,
  Globe,
  Icon,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Radio,
  Scan,
  Shield,
  ShieldCheck,
  Sparkles,
  Upload,
  User,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { IdentityConfig } from '@/lib/identity-verification';

interface BarangayOption {
  id: number;
  barangay_name: string;
}

// 17 official barangays in Padre Garcia, Batangas as baseline fallback
const DEFAULT_BARANGAYS: BarangayOption[] = [
  { id: 1, barangay_name: 'Banaba' },
  { id: 2, barangay_name: 'Manggas' },
  { id: 3, barangay_name: 'Pansol' },
  { id: 4, barangay_name: 'Cawongan' },
  { id: 5, barangay_name: 'Banay-Banay' },
  { id: 6, barangay_name: 'Bawi' },
  { id: 7, barangay_name: 'San Miguel' },
  { id: 8, barangay_name: 'Poblacion' },
  { id: 9, barangay_name: 'Quilo-quilo North' },
  { id: 10, barangay_name: 'Quilo-quilo South' },
  { id: 11, barangay_name: 'San Felipe' },
  { id: 12, barangay_name: 'Castillo' },
  { id: 13, barangay_name: 'Galamay-Amo' },
  { id: 14, barangay_name: 'Maugat West' },
  { id: 15, barangay_name: 'Maugat East' },
  { id: 16, barangay_name: 'Payapa' },
  { id: 17, barangay_name: 'Tangob' },
];

export default function FarmerRegistrationPage() {
  const router = useRouter();
  const identityConfig = useQuery({
    queryKey: ['identity-config'],
    queryFn: async () => (await identityClient().get<IdentityConfig>('/api/users/identity/config/')).data,
    retry: false,
  });
  const identityEnabled = identityConfig.data?.enabled === true;
  const providerCapture = identityEnabled && identityConfig.data?.available === true;

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    rsbsaNumber: '',
    barangay: '',
    farmSize: '',
    address: '',
  });

  const [barangays, setBarangays] = useState<BarangayOption[]>(DEFAULT_BARANGAYS);
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Registration agreement states
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);

  // Document uploads
  const [governmentIdType, setGovernmentIdType] = useState('');
  const [documents, setDocuments] = useState<{
    governmentIdFront: File | null;
    governmentIdBack: File | null;
    governmentIdPdf: File | null;
    rsbsa: File | null;
  }>({ governmentIdFront: null, governmentIdBack: null, governmentIdPdf: null, rsbsa: null });

  const [previews, setPreviews] = useState<{
    governmentIdFront: string;
    governmentIdBack: string;
    governmentIdPdf: string;
    rsbsa: string;
  }>({ governmentIdFront: '', governmentIdBack: '', governmentIdPdf: '', rsbsa: '' });

  const govIdFrontRef = useRef<HTMLInputElement>(null);
  const govIdBackRef = useRef<HTMLInputElement>(null);
  const govIdPdfRef = useRef<HTMLInputElement>(null);
  const rsbsaRef = useRef<HTMLInputElement>(null);

  // Fetch real barangays on mount from backend
  useEffect(() => {
    async function loadBarangays() {
      setIsLoadingBarangays(true);
      try {
        let response;
        try {
          response = await api.get('/api/livestock/barangays/');
        } catch {
          response = await api.get('/livestock/barangays/');
        }

        if (Array.isArray(response.data) && response.data.length > 0) {
          setBarangays(response.data);
        }
      } catch (err) {
        console.warn('Using local Padre Garcia barangay list fallback:', err);
      } finally {
        setIsLoadingBarangays(false);
      }
    }
    loadBarangays();
  }, []);

  const passwordRequirements = [
    { label: 'At least 8 characters', met: formData.password.length >= 8 },
    { label: 'One uppercase character (A–Z)', met: /[A-Z]/.test(formData.password) },
    { label: 'One lowercase character (a–z)', met: /[a-z]/.test(formData.password) },
    { label: 'One number (0–9)', met: /[0-9]/.test(formData.password) },
    { label: 'One special character (e.g. !@#$%)', met: /[^A-Za-z0-9]/.test(formData.password) },
  ];
  const passwordMeetsRequirements = passwordRequirements.every((req) => req.met);
  const passwordStrengthScore = passwordRequirements.filter((req) => req.met).length;

  const nextStep = () => {
    setError('');
    setFieldErrors({});

    if (step === 1) {
      const errors: Record<string, string> = {};
      if (!formData.firstName.trim()) errors.firstName = 'First name is required.';
      if (!formData.lastName.trim()) errors.lastName = 'Last name is required.';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim()) {
        errors.email = 'Email address is required.';
      } else if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address.';
      }

      const cleanPhone = formData.phoneNumber.replace(/\D/g, '');
      if (!cleanPhone) {
        errors.phoneNumber = 'Mobile number is required.';
      } else if (cleanPhone.length < 10) {
        errors.phoneNumber = 'Enter a valid 10-digit mobile number (e.g. 912 345 6789).';
      }

      if (!formData.password) {
        errors.password = 'Password is required.';
      } else if (!passwordMeetsRequirements) {
        errors.password = 'Password must meet all listed requirements.';
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match.';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please fix the errors above before proceeding.');
        return;
      }

      if (!termsAgreed || !privacyAgreed) {
        setError('Please read and accept the Terms and Conditions and Privacy Policy before proceeding.');
        return;
      }
    } else if (step === 2) {
      const errors: Record<string, string> = {};
      if (!formData.barangay) errors.barangay = 'Please select your barangay.';
      if (!formData.farmSize || Number(formData.farmSize) <= 0) {
        errors.farmSize = 'Please enter a valid farm size in hectares.';
      }
      if (!formData.address.trim()) errors.address = 'Detailed address / sitio is required.';

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError('Please complete the required farm location details.');
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setError('');
    setFieldErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: 'governmentIdFront' | 'governmentIdBack' | 'governmentIdPdf' | 'rsbsa'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isGovernmentIdPhoto = key === 'governmentIdFront' || key === 'governmentIdBack';
    const isGovernmentIdPdf = key === 'governmentIdPdf';
    const isAllowedIdPhoto = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (isGovernmentIdPhoto && (!isAllowedIdPhoto || documents.governmentIdPdf)) {
      setError(
        documents.governmentIdPdf
          ? 'Use either one ID PDF or two ID photos, not both.'
          : 'Front and back ID uploads must be image files.'
      );
      e.target.value = '';
      return;
    }
    if (
      isGovernmentIdPdf &&
      (file.type !== 'application/pdf' || documents.governmentIdFront || documents.governmentIdBack)
    ) {
      setError(
        documents.governmentIdFront || documents.governmentIdBack
          ? 'Use either one ID PDF or two ID photos, not both.'
          : 'The government ID document must be a PDF.'
      );
      e.target.value = '';
      return;
    }
    if (key === 'rsbsa' && !file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Only image files (JPG, PNG, WEBP) or PDFs are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be 10MB or less.');
      e.target.value = '';
      return;
    }

    if (previews[key] && previews[key] !== 'pdf') URL.revokeObjectURL(previews[key]);
    setError('');
    setDocuments((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({
      ...prev,
      [key]: file.type === 'application/pdf' ? 'pdf' : URL.createObjectURL(file),
    }));
    toast.success(`${key === 'rsbsa' ? 'RSBSA document' : 'Government ID file'} attached!`);
  };

  const removeDocument = (key: 'governmentIdFront' | 'governmentIdBack' | 'governmentIdPdf' | 'rsbsa') => {
    if (previews[key] && previews[key] !== 'pdf') URL.revokeObjectURL(previews[key]);
    const inputRefs = {
      governmentIdFront: govIdFrontRef,
      governmentIdBack: govIdBackRef,
      governmentIdPdf: govIdPdfRef,
      rsbsa: rsbsaRef,
    };
    if (inputRefs[key].current) inputRefs[key].current.value = '';
    setDocuments((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || identityConfig.isPending || identityConfig.isError) return;
    setError('');
    setFieldErrors({});

    const hasGovernmentId = Boolean(
      documents.governmentIdFront || documents.governmentIdBack || documents.governmentIdPdf
    );
    if (!providerCapture && !governmentIdType) {
      setError('Select your government ID type.');
      return;
    }
    if (!providerCapture && !hasGovernmentId) {
      setError('Upload one complete ID PDF or both front and back ID photos.');
      return;
    }
    if (!providerCapture && Boolean(documents.governmentIdFront) !== Boolean(documents.governmentIdBack)) {
      setError('Please upload both the front and back photos of your ID.');
      return;
    }

    if (!termsAgreed || !privacyAgreed) {
      setError('Please read and accept both the Terms and Conditions and Privacy Policy to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionData = new FormData();
      submissionData.append('first_name', formData.firstName.trim());
      submissionData.append('last_name', formData.lastName.trim());
      submissionData.append('email', formData.email.trim().toLowerCase());
      submissionData.append('password', formData.password);

      const cleanDigits = formData.phoneNumber.replace(/\D/g, '');
      const formattedPhone = cleanDigits.startsWith('63')
        ? `+${cleanDigits}`
        : cleanDigits.startsWith('0')
        ? `+63${cleanDigits.slice(1)}`
        : `+63${cleanDigits}`;
      submissionData.append('phone_number', formattedPhone);

      submissionData.append('barangay', formData.barangay);
      submissionData.append('farm_size', formData.farmSize);
      submissionData.append('address', formData.address.trim());

      if (formData.rsbsaNumber.trim()) {
        submissionData.append('rsbsa_number', formData.rsbsaNumber.trim());
      }

      if (providerCapture) {
        submissionData.append('provider_capture', 'true');
      } else {
        if (governmentIdType) submissionData.append('government_id_type', governmentIdType);
        if (documents.governmentIdFront) submissionData.append('government_id_front', documents.governmentIdFront);
        if (documents.governmentIdBack) submissionData.append('government_id_back', documents.governmentIdBack);
        if (documents.governmentIdPdf) submissionData.append('government_id_pdf', documents.governmentIdPdf);
      }
      if (documents.rsbsa) {
        submissionData.append('rsbsa_document', documents.rsbsa);
      }

      const registrationClient = identityClient();
      const registration = await registrationClient.post<{
        identity_verification?: { required: boolean; access_token: string };
      }>('/api/users/register/', submissionData, {
        timeout: 30 * 60 * 1000,
      });

      if (registration.data.identity_verification?.required) {
        try {
          saveRegistrationIdentitySession(
            registration.data.identity_verification.access_token,
            String(registrationClient.defaults.baseURL)
          );
          router.push('/farmer-registration/identity');
        } catch {
          toast.error(
            'Registration saved. This browser could not continue identity verification. Contact MAO for manual assistance; do not register again.'
          );
          router.push('/pending');
        }
      } else {
        toast.success('Registration Submitted!', {
          description: 'Your application is pending MAO verification.',
        });
        router.push('/pending');
      }
      setFormData((previous) => ({ ...previous, password: '', confirmPassword: '' }));
    } catch (err: unknown) {
      if (axios.isAxiosError<Record<string, unknown>>(err) && err.response?.data) {
        const data = err.response.data;
        const newFieldErrors: Record<string, string> = {};
        const generalMessages: string[] = [];

        Object.entries(data).forEach(([key, val]) => {
          const messageStr = Array.isArray(val) ? val.join(' ') : String(val);
          if (
            [
              'email',
              'password',
              'phone_number',
              'first_name',
              'last_name',
              'barangay',
              'farm_size',
              'address',
            ].includes(key)
          ) {
            newFieldErrors[key] = messageStr;
          } else {
            generalMessages.push(messageStr);
          }
        });

        setFieldErrors(newFieldErrors);
        setError(
          generalMessages.join(' ') ||
            'Registration failed. Please correct the highlighted fields and try again.'
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to connect to registration server. Please check your connection.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepsList = [
    {
      num: 1,
      phase: '01',
      title: 'Step 1: Personal Credentials',
      short: 'Credentials',
      sub: 'Enter your name and secure account details',
      icon: User,
    },
    {
      num: 2,
      phase: '02',
      title: 'Step 2: Farm Location & Size',
      short: 'Farm Details',
      sub: 'Record your livestock holding parcel in Padre Garcia',
      icon: MapPin,
    },
    {
      num: 3,
      phase: '03',
      title: 'Step 3: Verification Documents',
      short: 'Documents',
      sub: 'Attach verification IDs and consent under RA 10173',
      icon: Shield,
    },
    ...(identityEnabled ? [{
      num: 4, phase: '04', title: 'Step 4: ID & Selfie Verification',
      short: 'ID & Selfie', sub: 'Complete Didit capture before finishing registration', icon: Scan,
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#051408] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950 relative overflow-x-hidden">
      {/* ── Background Tech Mesh & Luminous Orbs ── */}
      <div
        aria-hidden
        className="fixed inset-0 bg-[radial-gradient(rgba(16,185,129,0.12)_1px,transparent_1px)] [background-size:28px_28px] pointer-events-none [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,#000_40%,transparent_100%)] opacity-80"
      />
      <div
        aria-hidden
        className="fixed -top-40 -left-40 size-[36rem] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none animate-pulse"
      />
      <div
        aria-hidden
        className="fixed -bottom-40 -right-40 size-[36rem] rounded-full bg-teal-500/12 blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden
        className="fixed top-1/3 left-1/2 -translate-x-1/2 size-[42rem] rounded-full bg-emerald-600/10 blur-[150px] pointer-events-none"
      />

      {/* ── Top Floating Navigation Header ── */}
      <header className="border-b border-emerald-500/15 bg-black/40 backdrop-blur-xl px-4 sm:px-8 py-3.5 sticky top-0 z-50">
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="size-9 sm:size-10 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/25 border border-emerald-300/30">
              <Icon iconNode={cowHead} className="size-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-white truncate">SmartLivestock</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  AGRI-ID
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/70 font-medium hidden sm:block">
                Padre Garcia Municipal Agriculture Office • Livestock Raiser Terminal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold tracking-wider">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-emerald-400"></span>
              </span>
              LGU NETWORK // ONLINE
            </span>

            <Link
              href="/login"
              className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-white/[0.04] hover:bg-emerald-500/10 transition-all shadow-xs"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <span>Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Two-Column Viewport Container ── */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 flex flex-col justify-center relative z-10">
        <div className="lg:grid lg:grid-cols-12 gap-8 xl:gap-12 items-start">
          {/* ═════════════════════════════════════════════════════════════
              LEFT COLUMN: COMMAND & TELEMETRY TERMINAL (Desktop Sticky)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 hidden lg:block sticky top-24 space-y-6">
            {/* Holographic Authority Card */}
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl p-7 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-bold tracking-wider">
                <Radio className="size-3 text-emerald-400 animate-pulse" />
                OFFICIAL MUNICIPAL PORTAL
              </div>

              <h1 className="text-2xl xl:text-3xl font-black tracking-tight leading-tight mt-3 bg-gradient-to-r from-emerald-100 via-teal-100 to-white bg-clip-text text-transparent">
                Farmer Registration
              </h1>

              <p className="text-xs text-slate-300 leading-relaxed mt-2.5 font-normal">
                Create an accredited raiser account with the Municipal Agriculture Office.
              </p>

              {/* Interactive Step Navigator */}
              <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  REGISTRATION STEPS
                </p>

                <div className="space-y-2.5">
                  {stepsList.map((item) => {
                    const IconComponent = item.icon;
                    const isCompleted = step > item.num;
                    const isCurrent = step === item.num;

                    return (
                      <button
                        key={item.num}
                        type="button"
                        onClick={() => {
                          if (item.num < step) setStep(item.num);
                        }}
                        disabled={item.num > step}
                        className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'border-emerald-400/50 bg-emerald-500/15 text-white shadow-lg shadow-emerald-950/40'
                            : isCompleted
                            ? 'border-emerald-500/20 bg-white/[0.04] text-slate-300 hover:border-emerald-400/30 cursor-pointer'
                            : 'border-white/5 bg-transparent text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                              isCompleted
                                ? 'bg-[#1A3D22] text-emerald-300 border border-emerald-500/40'
                                : isCurrent
                                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/40'
                                : 'bg-white/10 text-slate-400'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="size-4 stroke-[3]" />
                            ) : (
                              <IconComponent className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              <span className="font-mono text-[10px] text-emerald-400/90 mr-1.5">
                                {item.phase} //
                              </span>
                              {item.title}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{item.sub}</p>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isCompleted
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isCurrent
                              ? 'bg-emerald-400 text-slate-950 font-black'
                              : 'text-slate-600'
                          }`}
                        >
                          {isCompleted ? 'DONE' : isCurrent ? 'ACTIVE' : 'PENDING'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Network Grid Diagnostics */}
              <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-sm font-black text-emerald-400">17 / 17</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Barangays</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-sm font-black text-teal-400">DA-BAI</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Compliant</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-sm font-black text-emerald-400">256-BIT</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Encrypted</p>
                </div>
              </div>
            </div>

            {/* Municipal Security Stamp */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-[11px] text-slate-400 flex items-center gap-3">
              <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
              <span>
                Accredited under the Padre Garcia Municipal Agriculture Office Livestock Framework &
                Republic Act 10173.
              </span>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════
              RIGHT COLUMN: REGISTRATION TERMINAL CARD (Desktop & Mobile)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 w-full max-w-2xl mx-auto lg:max-w-none">
            {/* Card Container */}
            <div className="rounded-[2rem] border border-emerald-500/25 bg-white shadow-2xl shadow-black/40 overflow-hidden relative">
              {/* Glowing Top Progress Line */}
              <div className="h-1.5 w-full bg-slate-100 relative overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 transition-all duration-500 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${(step / (identityEnabled ? 4 : 3)) * 100}%` }}
                />
              </div>

              {/* Mobile Stepper Bar (visible on sm/md screens) */}
              <div className="lg:hidden px-3 sm:px-6 py-4 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-start justify-between relative">
                  {stepsList.map((item, idx) => {
                    const isCompleted = step > item.num;
                    const isCurrent = step === item.num;
                    const isLast = idx === stepsList.length - 1;

                    return (
                      <div key={item.num} className="flex-1 flex flex-col items-center relative min-w-0">
                        {/* Connector Line to Next Step */}
                        {!isLast && (
                          <div
                            aria-hidden
                            className={`absolute top-4 left-1/2 w-full h-0.5 transition-colors duration-300 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                            }`}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (item.num < step) setStep(item.num);
                          }}
                          disabled={item.num > step}
                          className="relative z-10 flex flex-col items-center gap-1.5 group w-full px-1 disabled:cursor-not-allowed"
                        >
                          <span
                            className={`size-8 rounded-full flex items-center justify-center font-mono text-xs font-black transition-all border ${
                              isCurrent
                                ? 'bg-[#2D5A27] text-white border-[#2D5A27] shadow-sm ring-4 ring-emerald-500/15'
                                : isCompleted
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 cursor-pointer'
                                : 'bg-white text-slate-400 border-slate-200'
                            }`}
                          >
                            {isCompleted ? <Check className="size-3.5 stroke-[3]" /> : item.phase}
                          </span>

                          <span
                            className={`text-[11px] leading-tight text-center whitespace-nowrap transition-colors ${
                              isCurrent
                                ? 'font-extrabold text-[#2D5A27]'
                                : isCompleted
                                ? 'font-bold text-emerald-800'
                                : 'font-semibold text-slate-400'
                            }`}
                          >
                            {item.short}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Terminal Step Header Banner */}
              <div className="p-5 sm:p-7 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                      Step {step} of {identityEnabled ? 4 : 3}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {step === 1 ? 'Credentials' : step === 2 ? 'Farm Details' : 'Documents'}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1.5">
                    {step === 1
                      ? 'Step 1: Personal Credentials'
                      : step === 2
                      ? 'Step 2: Farm Location & Size'
                      : 'Step 3: Verification Documents'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {step === 1
                      ? 'Enter your name and secure account details'
                      : step === 2
                      ? 'Record your livestock holding parcel in Padre Garcia'
                      : 'Attach verification IDs and consent under RA 10173'}
                  </p>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-5">
                {/* ═════════════════════════════════════════════════════════════
                    STEP 1: PERSONAL IDENTITY & CREDENTIALS
                   ═════════════════════════════════════════════════════════════ */}
                {step === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    {/* First & Last Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <Label htmlFor="firstName" className="text-[11px] font-extrabold text-slate-700 uppercase">
                          First Name <span className="text-rose-500">*</span>
                        </Label>
                        <div className="relative">
                          <input
                            id="firstName"
                            type="text"
                            placeholder="e.g. Juan"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className={`w-full pl-10 pr-3.5 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                              fieldErrors.firstName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                            }`}
                            required
                          />
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                        {fieldErrors.firstName && (
                          <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.firstName}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="lastName" className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Last Name <span className="text-rose-500">*</span>
                        </Label>
                        <div className="relative">
                          <input
                            id="lastName"
                            type="text"
                            placeholder="e.g. Dela Cruz"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className={`w-full pl-10 pr-3.5 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                              fieldErrors.lastName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                            }`}
                            required
                          />
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                        {fieldErrors.lastName && (
                          <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.lastName}</p>
                        )}
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                        <span>Email Address <span className="text-rose-500">*</span></span>
                        <span className="text-[10px] text-slate-400 font-normal">Used to sign in</span>
                      </Label>
                      <div className="relative">
                        <input
                          id="email"
                          type="email"
                          placeholder="juan.delacruz@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full pl-10 pr-3.5 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                            fieldErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                          }`}
                          required
                        />
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                      {fieldErrors.email && (
                        <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.email}</p>
                      )}
                    </div>

                    {/* Mobile Number with +63 Prefix */}
                    <div className="space-y-1">
                      <Label htmlFor="phone" className="text-[11px] font-extrabold text-slate-700 uppercase">
                        Mobile Number <span className="text-rose-500">*</span>
                      </Label>
                      <div className="flex rounded-2xl overflow-hidden border border-slate-200 focus-within:border-[#2D5A27] focus-within:ring-2 focus-within:ring-[#2D5A27]/20 transition-all">
                        <span className="inline-flex items-center px-3.5 bg-slate-100 text-xs text-slate-700 font-black border-r border-slate-200 shrink-0">
                          🇵🇭 +63
                        </span>
                        <input
                          id="phone"
                          type="tel"
                          placeholder="912 345 6789"
                          maxLength={13}
                          value={formData.phoneNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setFormData({ ...formData, phoneNumber: val });
                          }}
                          className={`w-full px-3.5 h-12 bg-slate-50 hover:bg-white text-sm font-medium text-black placeholder:text-black/40 outline-none ${
                            fieldErrors.phone_number || fieldErrors.phoneNumber ? 'bg-rose-50/30' : ''
                          }`}
                          required
                        />
                      </div>
                      {(fieldErrors.phoneNumber || fieldErrors.phone_number) && (
                        <p className="text-[11px] text-rose-600 font-bold">
                          {fieldErrors.phoneNumber || fieldErrors.phone_number}
                        </p>
                      )}
                    </div>

                    {/* Password Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Account Password <span className="text-rose-500">*</span>
                        </Label>
                        <div className="relative">
                          <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className={`w-full pl-10 pr-11 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                              fieldErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                            }`}
                            required
                          />
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                          <span>Confirm Password <span className="text-rose-500">*</span></span>
                        </Label>
                        <div className="relative">
                          <input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className={`w-full pl-10 pr-11 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                              fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                            }`}
                            required
                          />
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
                          >
                            {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {formData.confirmPassword && (
                      formData.password === formData.confirmPassword ? (
                        <p className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600">
                          <Check className="size-3" /> Passwords Match
                        </p>
                      ) : (
                        <p className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-500">
                          <X className="size-3" /> Does Not Match
                        </p>
                      )
                    )}

                    {/* Password Requirements Diagnostic Gauge */}
                    {formData.password && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Password Requirements</span>
                          <span
                            className={`font-mono font-bold text-[11px] ${
                              passwordStrengthScore <= 2
                                ? 'text-rose-600'
                                : passwordStrengthScore <= 4
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {passwordStrengthScore <= 2
                              ? 'Weak'
                              : passwordStrengthScore <= 4
                              ? 'Moderate'
                              : 'Strong'}
                          </span>
                        </div>

                        {/* Multi-segment strength bar */}
                        <div className="grid grid-cols-5 gap-1.5 h-1.5">
                          {[1, 2, 3, 4, 5].map((idx) => (
                            <div
                              key={idx}
                              className={`rounded-full transition-all duration-300 ${
                                idx <= passwordStrengthScore
                                  ? passwordStrengthScore <= 2
                                    ? 'bg-rose-500'
                                    : passwordStrengthScore <= 4
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-600'
                                  : 'bg-slate-200'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Requirement Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {passwordRequirements.map((req, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                                req.met
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-white text-slate-400 border-slate-200'
                              }`}
                            >
                              {req.met ? <Check className="size-3 text-emerald-600" /> : '•'}
                              <span>{req.label}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {fieldErrors.password && (
                      <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.password}</p>
                    )}
                    {fieldErrors.confirmPassword && (
                      <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.confirmPassword}</p>
                    )}

                    {/* Registration Terms and Privacy Agreement */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Shield className="size-4.5 text-[#2D5A27] shrink-0 mt-0.5" />
                          <h3 className="text-xs font-black uppercase tracking-wider text-[#2D5A27] leading-snug">
                            Terms and Privacy Agreement
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 pl-6.5 sm:pl-0">
                          <button
                            type="button"
                            onClick={() => setTermsDialogOpen(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#2D5A27] hover:underline cursor-pointer shrink-0"
                          >
                            <span>Read Terms</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrivacyDialogOpen(true)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#2D5A27] hover:underline cursor-pointer shrink-0"
                          >
                            <span>Read Privacy Policy</span>
                            <ExternalLink className="size-3 shrink-0" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Review how your account and farm records may be used for Padre Garcia municipal agriculture services, and the rules for accessing SmartLivestock.
                      </p>

                      <div className="flex items-start gap-3 pt-1 border-t border-emerald-200/60">
                        <Checkbox
                          id="registration-agreement"
                          checked={termsAgreed && privacyAgreed}
                          onCheckedChange={(checked) => {
                            const accepted = Boolean(checked);
                            setTermsAgreed(accepted);
                            setPrivacyAgreed(accepted);
                            if (error) setError('');
                          }}
                          className="mt-0.5 shrink-0 rounded-lg border-emerald-600 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                        />
                        <Label
                          htmlFor="registration-agreement"
                          className="block text-xs font-bold text-slate-800 leading-relaxed cursor-pointer select-none"
                        >
                          I have read and agree to the <strong className="text-[#2D5A27]">Terms and Conditions</strong> and acknowledge the <strong className="text-[#2D5A27]">Privacy Policy</strong>. <span className="text-rose-500">*</span>
                        </Label>
                      </div>
                    </div>

                    {error && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                        <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        <p>{error}</p>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={nextStep}
                      className="w-full py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 mt-3 cursor-pointer"
                    >
                      <span>Proceed to Farm Details</span>
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                )}

                {/* ═════════════════════════════════════════════════════════════
                    STEP 2: FARM LOCATION & SIZE
                   ═════════════════════════════════════════════════════════════ */}
                {step === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    {/* Barangay Dropdown */}
                    <div className="space-y-1">
                      <Label htmlFor="barangay" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                        <span>
                          Barangay in Padre Garcia <span className="text-rose-500">*</span>
                        </span>
                        {isLoadingBarangays && (
                          <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-bold">
                            <Loader2 className="size-3 animate-spin" /> Loading barangays...
                          </span>
                        )}
                      </Label>
                      <div className="relative">
                        <Select
                          value={formData.barangay ? String(formData.barangay) : undefined}
                          onValueChange={(val) => {
                            setFormData({ ...formData, barangay: val });
                            if (fieldErrors.barangay) {
                              setFieldErrors((prev) => ({ ...prev, barangay: '' }));
                            }
                          }}
                        >
                          <SelectTrigger
                            id="barangay"
                            className={`w-full pl-10 pr-3.5 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black data-[placeholder]:!text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                              fieldErrors.barangay ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                            }`}
                          >
                            <SelectValue placeholder="Select your barangay" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl max-h-72">
                            {barangays.map((b) => (
                              <SelectItem key={b.id} value={String(b.id)} className="rounded-xl text-sm font-medium py-2">
                                {b.barangay_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                      </div>
                      {fieldErrors.barangay && (
                        <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.barangay}</p>
                      )}
                    </div>

                    {/* Farm Size in Hectares & Presets */}
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <Label htmlFor="farmSize" className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Farm / Pasture Size (Hectares) <span className="text-rose-500">*</span>
                        </Label>
                        <span className="text-[10px] text-slate-400 shrink-0">1 ha = 10,000 sqm</span>
                      </div>
                      <input
                        id="farmSize"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="e.g. 1.50"
                        value={formData.farmSize}
                        onChange={(e) => setFormData({ ...formData, farmSize: e.target.value })}
                        className={`w-full px-3.5 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                          fieldErrors.farmSize || fieldErrors.farm_size ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                        }`}
                        required
                      />

                      {/* Quick preset chips */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Presets:</span>
                        {[
                          { label: 'Backyard (0.2 ha)', val: '0.2' },
                          { label: 'Smallholder (0.5 ha)', val: '0.5' },
                          { label: 'Medium (1.5 ha)', val: '1.5' },
                          { label: 'Pasture (3.0 ha)', val: '3.0' },
                        ].map((preset) => (
                          <button
                            key={preset.val}
                            type="button"
                            onClick={() => setFormData({ ...formData, farmSize: preset.val })}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-600 hover:text-emerald-800 transition-colors cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      {(fieldErrors.farmSize || fieldErrors.farm_size) && (
                        <p className="text-[11px] text-rose-600 font-bold">
                          {fieldErrors.farmSize || fieldErrors.farm_size}
                        </p>
                      )}
                    </div>

                    {/* Detailed Street Address / Sitio */}
                    <div className="space-y-1">
                      <Label htmlFor="address" className="text-[11px] font-extrabold text-slate-700 uppercase">
                        Detailed Address / Sitio <span className="text-rose-500">*</span>
                      </Label>
                      <div className="relative">
                        <input
                          id="address"
                          type="text"
                          placeholder="e.g. Sitio Ilaya, Purok 3, Near Barangay Hall"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className={`w-full pl-10 pr-3.5 h-12 bg-slate-50 hover:bg-white border rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20 ${
                            fieldErrors.address ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                          }`}
                          required
                        />
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                      {fieldErrors.address && (
                        <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.address}</p>
                      )}
                    </div>

                    {/* Optional RSBSA Number */}
                    <div className="space-y-1 pt-1">
                      <Label htmlFor="rsbsaNumber" className="text-[11px] font-extrabold text-slate-700 uppercase flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="shrink-0">RSBSA Reference Number</span>
                        <span className="text-slate-400 font-normal text-[10px] shrink-0">Optional (if already enrolled)</span>
                      </Label>
                      <div className="relative">
                        <input
                          id="rsbsaNumber"
                          type="text"
                          placeholder="e.g. 04-10-18-000-00000"
                          value={formData.rsbsaNumber}
                          onChange={(e) => setFormData({ ...formData, rsbsaNumber: e.target.value })}
                          className="w-full pl-10 pr-3.5 h-12 bg-slate-50 hover:bg-white border border-slate-200 rounded-2xl text-sm font-medium text-black placeholder:text-black/40 transition-all focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20"
                        />
                        <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Registry System for Basic Sectors in Agriculture (DA-RSBSA identifier)
                      </p>
                    </div>

                    {error && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                        <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        <p>{error}</p>
                      </div>
                    )}

                    {/* Step 2 Actions */}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-stretch gap-2.5 sm:gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        className="w-full sm:w-auto shrink-0 px-5 min-h-12 h-auto py-3.5 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer hover:bg-slate-50"
                      >
                        <ArrowLeft className="size-4 mr-1 shrink-0" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={nextStep}
                        className="w-full sm:flex-1 shrink min-w-0 whitespace-normal h-auto min-h-12 py-3.5 px-4 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-1.5 text-center leading-tight cursor-pointer"
                      >
                        <span>Proceed to Documents & Consent</span>
                        <ArrowRight className="size-4 shrink-0" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* ═════════════════════════════════════════════════════════════
                    STEP 3: DOCUMENT VERIFICATION & DATA PRIVACY AGREEMENT
                   ═════════════════════════════════════════════════════════════ */}
                {step === 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    {/* Guided ID capture */}
                    {providerCapture ? <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-slate-900">
                      <h3 className="flex items-center gap-2 font-bold"><Scan className="size-5 text-emerald-700" />Government ID and selfie with Didit</h3>
                      <p className="text-sm">Didit will guide you through government ID capture, a selfie, and a separate liveness check. You do not need to upload ID photos here as well.</p>
                      <p className="text-sm">Keep your government ID ready. Continue below to read the biometric notice and open the capture page. MAO will still review your application.</p>
                      {identityConfig.data?.environment === 'sandbox' && <p className="text-xs font-semibold">Sandbox testing only — this does not verify a real identity.</p>}
                    </section> : <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                      {identityEnabled && <p role="status" className="text-sm text-amber-800">Didit is not configured for capture. Submit your ID here for manual review; no automated face or liveness result will be claimed.</p>}
                      <div className="space-y-1.5">
                        <Label htmlFor="governmentIdType" className="text-[11px] font-extrabold uppercase text-slate-700">
                          Government ID type <span className="text-rose-500">*</span> <span className="font-medium normal-case text-slate-400">(required)</span>
                        </Label>
                        <Select
                          value={governmentIdType || undefined}
                          onValueChange={(val) => {
                            setGovernmentIdType(val);
                            setError('');
                          }}
                        >
                          <SelectTrigger
                            id="governmentIdType"
                            className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white px-3.5 text-sm font-medium text-black data-[placeholder]:!text-black/40 transition focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/20"
                          >
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="PHILID" className="text-sm font-medium py-2 rounded-lg">PhilID / National ID</SelectItem>
                            <SelectItem value="DRIVERS_LICENSE" className="text-sm font-medium py-2 rounded-lg">Driver’s License</SelectItem>
                            <SelectItem value="VOTERS_ID" className="text-sm font-medium py-2 rounded-lg">Voter’s ID</SelectItem>
                            <SelectItem value="PASSPORT" className="text-sm font-medium py-2 rounded-lg">Passport</SelectItem>
                            <SelectItem value="UMID" className="text-sm font-medium py-2 rounded-lg">UMID</SelectItem>
                            <SelectItem value="POSTAL_ID" className="text-sm font-medium py-2 rounded-lg">Postal ID</SelectItem>
                            <SelectItem value="PRC_ID" className="text-sm font-medium py-2 rounded-lg">PRC ID</SelectItem>
                            <SelectItem value="OTHER_GOV_ID" className="text-sm font-medium py-2 rounded-lg">Other Government ID</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] leading-relaxed text-slate-500">
                          Take a clear photo of the front, then the back, or upload one PDF containing both sides.
                        </p>
                      </div>

                      {governmentIdType && (
                        <div className="space-y-3 border-t border-slate-100 pt-3">
                          <input
                            ref={govIdFrontRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, 'governmentIdFront')}
                          />
                          <input
                            ref={govIdBackRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, 'governmentIdBack')}
                          />
                          <input
                            ref={govIdPdfRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, 'governmentIdPdf')}
                          />

                          {documents.governmentIdPdf ? (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-[10px] font-black text-rose-700">
                                  PDF
                                </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-emerald-900">Complete ID PDF attached</p>
                                  <p className="truncate text-[10px] text-slate-600">{documents.governmentIdPdf.name}</p>
                                  <p className="text-[10px] text-slate-500">Make sure the PDF shows both sides.</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDocument('governmentIdPdf')}
                                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          ) : documents.governmentIdFront && documents.governmentIdBack ? (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-slate-900">Both sides captured</p>
                                  <p className="text-[10px] text-slate-500">Check each photo before continuing.</p>
                                </div>
                                <Badge variant="secondary" className="text-[10px]">2 of 2 complete</Badge>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {[
                                  { key: 'governmentIdFront' as const, label: 'Front', ref: govIdFrontRef },
                                  { key: 'governmentIdBack' as const, label: 'Back', ref: govIdBackRef },
                                ].map(({ key, label, ref }) => (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2"
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      <img
                                        src={previews[key]}
                                        alt={`${label} of ${governmentIdType}`}
                                        className="size-11 shrink-0 rounded-md border border-emerald-200 object-cover"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-semibold text-emerald-800">{label} side captured</p>
                                        <p className="truncate text-[10px] text-slate-500">{documents[key]?.name}</p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (ref.current) {
                                            ref.current.value = '';
                                            ref.current.click();
                                          }
                                        }}
                                        className="text-[10px] font-semibold text-[#2D5A27] hover:underline cursor-pointer"
                                      >
                                        Retake
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeDocument(key)}
                                        className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                      <Check className="size-4 shrink-0 text-emerald-700" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : !documents.governmentIdFront ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-slate-900">Step 1 of 2 · Front side</p>
                                  <p className="text-[10px] text-slate-500">Place the front of your ID inside the frame and take a clear photo.</p>
                                </div>
                                <Badge variant="outline" className="shrink-0 text-[10px]">Front</Badge>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (govIdFrontRef.current) {
                                    govIdFrontRef.current.value = '';
                                    govIdFrontRef.current.click();
                                  }
                                }}
                                className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-[#2D5A27] hover:bg-emerald-50/40 cursor-pointer"
                              >
                                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-[#2D5A27]">
                                  <Camera className="size-5" />
                                </span>
                                <span className="text-xs font-semibold text-slate-800">Take or upload front photo</span>
                                <span className="text-[10px] text-slate-500">JPG, PNG, or WEBP · Max 10MB</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-slate-900">Step 2 of 2 · Back side</p>
                                  <p className="text-[10px] text-slate-500">Front saved. Turn the ID over and capture the back.</p>
                                </div>
                                <Badge variant="outline" className="shrink-0 text-[10px]">Back</Badge>
                              </div>
                              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
                                <img
                                  src={previews.governmentIdFront}
                                  alt={`Front of ${governmentIdType}`}
                                  className="size-11 shrink-0 rounded-md border border-emerald-200 object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-semibold text-emerald-800">Front side captured</p>
                                  <p className="truncate text-[10px] text-slate-500">{documents.governmentIdFront?.name}</p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (govIdFrontRef.current) {
                                        govIdFrontRef.current.value = '';
                                        govIdFrontRef.current.click();
                                      }
                                    }}
                                    className="text-[10px] font-semibold text-[#2D5A27] hover:underline cursor-pointer"
                                  >
                                    Retake
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeDocument('governmentIdFront')}
                                    className="text-[10px] font-semibold text-rose-600 hover:underline cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (govIdBackRef.current) {
                                    govIdBackRef.current.value = '';
                                    govIdBackRef.current.click();
                                  }
                                }}
                                className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-[#2D5A27] hover:bg-emerald-50/40 cursor-pointer"
                              >
                                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-[#2D5A27]">
                                  <Camera className="size-5" />
                                </span>
                                <span className="text-xs font-semibold text-slate-800">Take or upload back photo</span>
                                <span className="text-[10px] text-slate-500">JPG, PNG, or WEBP · Max 10MB</span>
                              </button>
                            </div>
                          )}

                          <div className="border-t border-slate-100 pt-3">
                            {documents.governmentIdFront || documents.governmentIdBack ? (
                              <p className="text-center text-[10px] text-slate-500">To use a PDF instead, remove the captured photo(s) first.</p>
                            ) : (
                              <button
                                type="button"
                                onClick={() => govIdPdfRef.current?.click()}
                                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                              >
                                <FileText className="size-4 text-rose-600" />Upload one complete PDF instead
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    }
                    {/* RSBSA Certificate / Barangay Clearance (Optional) */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                        <span>RSBSA Stub / Barangay Certificate</span>
                        <span className="text-[10px] text-slate-400">Optional</span>
                      </Label>
                      <input
                        ref={rsbsaRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'rsbsa')}
                      />
                      {previews.rsbsa ? (
                        <div className="relative border-2 border-emerald-600 bg-emerald-50/30 rounded-2xl p-3 flex items-center justify-between shadow-xs">
                          <div className="flex items-center gap-3">
                            {previews.rsbsa === 'pdf' ? (
                              <div className="size-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xs">
                                PDF
                              </div>
                            ) : (
                              <img
                                src={previews.rsbsa}
                                alt="RSBSA Document"
                                className="size-12 rounded-xl object-cover border border-emerald-300"
                              />
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                                {documents.rsbsa?.name}
                              </p>
                              <p className="text-[10px] text-emerald-700 font-extrabold">
                                Attached for expedited review
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDocument('rsbsa')}
                            className="px-2.5 py-1 text-[10px] font-black uppercase text-rose-600 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => rsbsaRef.current?.click()}
                          className="p-4 border-2 border-dashed border-slate-200 hover:border-[#2D5A27] rounded-2xl flex items-center justify-between transition-colors cursor-pointer bg-slate-50/60 hover:bg-emerald-50/20 group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-[#2D5A27] flex items-center justify-center transition-colors">
                              <FileText className="size-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">Upload RSBSA Stub or Certificate</p>
                              <p className="text-[10px] text-slate-400">Speeds up MAO field audit verification</p>
                            </div>
                          </div>
                          <Upload className="size-4 text-slate-400 group-hover:text-[#2D5A27]" />
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                        <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                        <p>{error}</p>
                      </div>
                    )}

                    {/* Step 3 Actions */}
                    {identityEnabled && <p className="text-sm text-slate-600">Next: ID and selfie checks with Didit. We save one pending application before capture so you can resume without registering again. MAO still makes the approval decision.</p>}
                    {identityConfig.isError && <p role="alert" className="text-sm text-rose-700">Cannot load registration requirements. Check your connection and retry before submitting. <button type="button" className="underline" onClick={() => void identityConfig.refetch()}>Retry</button></p>}
                    <div className="flex flex-col-reverse sm:flex-row sm:items-stretch gap-2.5 sm:gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={prevStep}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto shrink-0 px-5 min-h-12 h-auto py-3.5 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer hover:bg-slate-50"
                      >
                        <ArrowLeft className="size-4 mr-1 shrink-0" />
                        <span>Back</span>
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || identityConfig.isPending || identityConfig.isError}
                        className="w-full sm:flex-1 shrink min-w-0 whitespace-normal h-auto min-h-12 py-3.5 px-4 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-green-900/25 flex items-center justify-center gap-2 text-center leading-tight cursor-pointer disabled:opacity-70"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="size-4.5 animate-spin shrink-0" />
                            <span>Submitting Registration...</span>
                          </>
                        ) : (
                          <>
                            <BadgeCheck className="size-4.5 shrink-0" />
                            <span>{identityConfig.isPending ? 'Loading requirements...' : identityEnabled ? 'Continue to ID & Selfie' : 'Complete Registration'}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </form>

              {/* Card Footer */}
              <div className="bg-slate-50/80 p-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Already registered?{' '}
                  <Link href="/login" className="text-[#2D5A27] font-black hover:underline">
                    Log In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-emerald-500/10 bg-black/30 backdrop-blur-md py-4 text-center text-xs text-slate-400 font-medium relative z-10 space-y-1">
        <p>© {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas</p>
        <p className="text-[11px] text-slate-400/80">Cattle & Livestock Information System</p>
      </footer>

      {/* ── Terms and Conditions Modal Dialog ── */}
      <Dialog open={termsDialogOpen} onOpenChange={setTermsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-800">
              <FileText className="size-5" />
              <DialogTitle className="text-base font-black">SmartLivestock Terms and Conditions</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Farmer registration and use of the Municipality of Padre Garcia agricultural information system
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs text-slate-600 leading-relaxed pt-2">
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
              SmartLivestock supports municipal agriculture services. Creating an account or submitting information does not by itself approve your application, certify livestock ownership, or guarantee eligibility for a program or assistance.
            </p>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">1. Registration and accurate information</h4>
              <p>Provide information that is complete and accurate to the best of your knowledge, use your own identity and contact details, and keep your farm and livestock information current. Upload only documents that you are authorized to provide. Tell the Municipal Agriculture Office (MAO) if information changes or you discover an error.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">2. Review and account status</h4>
              <p>Registration is an application for access. MAO personnel may verify submitted details and documents and may request clarification or correction. Your account may remain pending until the required review is complete. Approval, rejection, or a request for more information is made through the applicable municipal process; SmartLivestock does not promise a particular result or timeline.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">3. Permitted use</h4>
              <p>Use the service only for legitimate agricultural and livestock activities connected to your account and municipal services. Do not impersonate another person, submit forged or misleading records, access another person's account or information, probe or disrupt the system, upload malicious files, or use information obtained through the system for harassment, discrimination, or unauthorized disclosure.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">4. Account security</h4>
              <p>Keep your password private, use a secure device, and sign out when finished on a shared device. You are responsible for activity performed through your credentials unless you promptly report suspected access or compromise to MAO. MAO may restrict access when reasonably necessary to protect accounts, records, the service, or a lawful review.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">5. Records, services, and communications</h4>
              <p>You remain responsible for the accuracy of information you submit. You allow the Municipality, through authorized personnel and service providers, to use and store that information as described in the Privacy Policy and for the municipal services you request. System notices may relate to registration review, record corrections, inspections, agricultural programs, or livestock services. A system entry is not a permit, veterinary diagnosis, or official certificate unless issued through the relevant authorized process.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">6. Service availability and changes</h4>
              <p>Features may be updated, temporarily unavailable, or changed to support municipal operations, security, or legal requirements. Keep copies of important documents and contact MAO if you cannot access the service or need help with a submission. These terms do not remove rights or remedies provided by applicable law.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">7. Questions and reports</h4>
              <p>For account access, correction requests, or questions about these terms, contact the Padre Garcia Municipal Agriculture Office through the municipal office. Report suspected unauthorized account access promptly.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button type="button" onClick={() => setTermsDialogOpen(false)} className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold rounded-xl">
              Close Terms
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Data Privacy Policy Modal Dialog ── */}
      <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-800">
              <Shield className="size-5" />
              <DialogTitle className="text-base font-black">SmartLivestock Privacy Policy</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Republic Act No. 10173 (Data Privacy Act of 2012) Compliance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs text-slate-600 leading-relaxed pt-2">
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              This notice explains how the Municipality of Padre Garcia, through the Municipal Agriculture Office (MAO), handles information submitted through farmer registration and SmartLivestock. Processing is subject to Republic Act No. 10173, its implementing rules, other applicable laws, and the purposes explained below.
            </p>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">1. Information covered</h4>
              <p>Depending on the service you use, information may include your name, email address, telephone number, account and application status; farm address, barangay, farm size, and livestock or production declarations; government-issued identification and optional RSBSA documents you upload; and information you later provide for inspections, census, production, disease, mortality, movement, or assistance records. The system also processes technical account and activity information needed to operate and protect the service.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">2. Why information is used</h4>
              <p>MAO uses relevant information to create and review your farmer application; maintain farmer, farm, and livestock records; conduct censuses, inspections, and authorized agricultural monitoring; plan or administer municipal and government agriculture, veterinary, disease-surveillance, or disaster-assistance services; communicate about your application and services; prepare appropriately protected reports and statistics; investigate errors or misuse; and meet applicable legal, audit, and public-record duties. Information should be relevant and limited to the stated purpose and applicable lawful basis.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">3. Identity checks</h4>
              <p>If the optional hosted identity-verification feature is enabled for your registration, you will receive a separate notice and must provide separate consent before that check starts. The identity provider may process your government ID, selfie, and face comparison for verification. SmartLivestock stores verification outcome categories and related review records; it is designed not to import provider images or face templates. You may contact MAO about an alternative human review if the automated check is unavailable or cannot be completed. Declining this separate check does not itself determine whether your municipal application is approved.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">4. Who may receive information</h4>
              <p>Access is limited by assigned system roles to authorized municipal personnel who need the information for their duties. Relevant information may be shared with another government office or authorized program partner when needed for a stated public service, allowed by law, or otherwise supported by a valid lawful basis and safeguards. Technology and identity-verification providers may process information needed to deliver their services under applicable arrangements. Information is not intended for sale or unrelated advertising.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">5. Storage, retention, and protection</h4>
              <p>Records are kept for as long as needed for the purposes above and for applicable municipal, audit, legal, and public-record retention requirements. The exact retention period depends on the record and the approved records schedule; records are not promised to be deleted on a fixed timeline. MAO and its providers use organizational, physical, and technical safeguards appropriate to the information, but no online service can guarantee that transmission or storage is completely risk-free. Records no longer required are handled under the applicable retention and disposal rules.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">6. Your data privacy rights</h4>
              <p>Subject to the Data Privacy Act and other applicable laws, you may ask whether your personal information is being processed, request access to or a copy of it, seek correction of inaccurate or incomplete information, object to or request blocking/erasure where applicable, withdraw consent where consent is the basis for processing, and seek available remedies or file a complaint. Some requests may be limited where the Municipality has a legal duty to retain or process records. Withdrawal does not undo processing already lawfully performed or necessarily remove records that must be retained.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">7. How to contact us</h4>
              <p>For a privacy request or concern, contact the Padre Garcia Municipal Agriculture Office through the municipal office and identify the SmartLivestock record involved. MAO may need to verify your identity before acting on a request. You may also contact the National Privacy Commission through its official channels regarding data privacy concerns.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-1">8. Updates to this notice</h4>
              <p>This notice may be updated when the system, purposes, providers, or legal requirements change. Material changes should be communicated through the registration page or another appropriate municipal channel before they apply to new processing.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              onClick={() => setPrivacyDialogOpen(false)}
              className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold rounded-xl"
            >
              Close Privacy Policy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
