'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import {
  User,
  MapPin,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Shield,
  Camera,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  FileCheck,
  Check,
  X,
  FileText,
  BadgeCheck,
  Lock,
  Phone,
  Mail,
  Building2,
} from 'lucide-react';
import { Icon } from 'lucide-react';
import { cowHead } from '@lucide/lab';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
  { id: 8, barangay_name: 'Bukal' },
  { id: 9, barangay_name: 'San Felipe' },
  { id: 10, barangay_name: 'Maugat West' },
  { id: 11, barangay_name: 'Tamak' },
  { id: 12, barangay_name: 'Quilo Quilo North' },
  { id: 13, barangay_name: 'Quilo Quilo South' },
  { id: 14, barangay_name: 'Castillo' },
  { id: 15, barangay_name: 'Maugat East' },
  { id: 16, barangay_name: 'Payapa' },
  { id: 17, barangay_name: 'Tangob' },
];

export default function FarmerRegistrationPage() {
  const router = useRouter();

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

  // Privacy Policy states
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);

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
        // Try /api/livestock/barangays/ first, then fallback to /livestock/barangays/
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
  const passwordMeetsRequirements = passwordRequirements.every((requirement) => requirement.met);

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
      setError(documents.governmentIdPdf
        ? 'Use either one ID PDF or two ID photos, not both.'
        : 'Front and back ID uploads must be image files.');
      e.target.value = '';
      return;
    }
    if (isGovernmentIdPdf && (file.type !== 'application/pdf' || documents.governmentIdFront || documents.governmentIdBack)) {
      setError(documents.governmentIdFront || documents.governmentIdBack
        ? 'Use either one ID PDF or two ID photos, not both.'
        : 'The government ID document must be a PDF.');
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
    setPreviews((prev) => ({ ...prev, [key]: file.type === 'application/pdf' ? 'pdf' : URL.createObjectURL(file) }));
    toast.success(`${key === 'rsbsa' ? 'RSBSA document' : 'Government ID file'} attached!`);
  };

  const removeDocument = (key: 'governmentIdFront' | 'governmentIdBack' | 'governmentIdPdf' | 'rsbsa') => {
    if (previews[key] && previews[key] !== 'pdf') URL.revokeObjectURL(previews[key]);
    const inputRefs = { governmentIdFront: govIdFrontRef, governmentIdBack: govIdBackRef, governmentIdPdf: govIdPdfRef, rsbsa: rsbsaRef };
    if (inputRefs[key].current) inputRefs[key].current.value = '';
    setDocuments((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!privacyAgreed) {
      setError('You must agree to the Data Privacy Policy before submitting your registration.');
      return;
    }

    const hasGovernmentId = Boolean(
      documents.governmentIdFront || documents.governmentIdBack || documents.governmentIdPdf
    );
    if (governmentIdType && !hasGovernmentId) {
      setError('Upload one PDF or both front and back ID photos for the selected ID type.');
      return;
    }
    if (hasGovernmentId && !governmentIdType) {
      setError('Choose your government ID type before uploading its document.');
      return;
    }
    if (Boolean(documents.governmentIdFront) !== Boolean(documents.governmentIdBack)) {
      setError('Please upload both the front and back photos of your ID.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build standard FormData object to carry text & files seamlessly
      const submissionData = new FormData();
      submissionData.append('first_name', formData.firstName.trim());
      submissionData.append('last_name', formData.lastName.trim());
      submissionData.append('email', formData.email.trim().toLowerCase());
      submissionData.append('password', formData.password);

      // Clean phone number (format as standard +639XXXXXXXXX)
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

      // Include the selected ID type and either a two-photo set or one PDF.
      if (governmentIdType) submissionData.append('government_id_type', governmentIdType);
      if (documents.governmentIdFront) submissionData.append('government_id_front', documents.governmentIdFront);
      if (documents.governmentIdBack) submissionData.append('government_id_back', documents.governmentIdBack);
      if (documents.governmentIdPdf) submissionData.append('government_id_pdf', documents.governmentIdPdf);
      if (documents.rsbsa) {
        submissionData.append('rsbsa_document', documents.rsbsa);
      }

      // Allow extra time for large ID photos on slower connections.
      await api.post('/api/users/register/', submissionData, {
        timeout: 30 * 60 * 1000,
      });

      toast.success('Registration Submitted!', {
        description: 'Your application has been received and is pending MAO verification.',
      });

      router.push('/pending');
    } catch (err: any) {
      console.error('Registration error:', err);
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data;
        const newFieldErrors: Record<string, string> = {};
        const generalMessages: string[] = [];

        Object.entries(data).forEach(([key, val]) => {
          const messageStr = Array.isArray(val) ? val.join(' ') : String(val);
          if (['email', 'password', 'phone_number', 'first_name', 'last_name', 'barangay', 'farm_size', 'address'].includes(key)) {
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
        setError(err instanceof Error ? err.message : 'Unable to connect to registration server. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-3 sm:p-6 py-8 sm:py-12 selection:bg-emerald-600 selection:text-white">
      {/* Top Bar with Home / Back Link */}
      <div className="w-full max-w-xl mb-4 flex items-center justify-between px-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-800 transition-colors py-1.5 px-3 rounded-xl hover:bg-slate-200/60"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Sign In</span>
        </Link>
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200">
          Official LGU Portal
        </span>
      </div>

      {/* Top Stepper Indicator */}
      <div className="w-full max-w-xl mb-6 px-4">
        <div className="flex items-center justify-between relative">
          {[
            { num: 1, label: 'Identity', icon: User },
            { num: 2, label: 'Farm Info', icon: MapPin },
            { num: 3, label: 'Documents & Consent', icon: Shield },
          ].map((item, idx) => {
            const Icon = item.icon;
            const isCompleted = step > item.num;
            const isCurrent = step === item.num;

            return (
              <div key={item.num} className="flex-1 flex flex-col items-center relative">
                {/* Connecting Line */}
                {idx > 0 && (
                  <div
                    className={`absolute top-4 right-1/2 left-[-50%] h-1 transition-all duration-300 -z-0 ${
                      step >= item.num ? 'bg-[#2D5A27]' : 'bg-slate-200'
                    }`}
                  />
                )}

                {/* Step Circle */}
                <button
                  type="button"
                  onClick={() => {
                    // Allow clicking back to earlier steps
                    if (item.num < step) setStep(item.num);
                  }}
                  className={`size-9 sm:size-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all z-10 shadow-sm ${
                    isCompleted
                      ? 'bg-[#2D5A27] text-white ring-4 ring-emerald-600/15'
                      : isCurrent
                        ? 'bg-[#2D5A27] text-white ring-4 ring-emerald-600/30 shadow-md scale-105'
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isCompleted ? <Check className="size-4.5 stroke-[3]" /> : <Icon className="size-4" />}
                </button>

                {/* Step Title */}
                <span
                  className={`text-[11px] font-bold mt-1.5 transition-colors text-center ${
                    isCurrent ? 'text-[#2D5A27]' : isCompleted ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Registration Card */}
      <div className="w-full max-w-xl bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-xl shadow-slate-200/70 border border-slate-100 overflow-hidden">
        {/* Card Banner Header */}
        <div className="bg-gradient-to-r from-[#1f421a] via-[#2D5A27] to-[#1a3816] p-6 sm:p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 size-36 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 size-36 bg-emerald-300/10 rounded-full blur-2xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-wider text-emerald-200 mb-2">
            <Icon iconNode={cowHead} className="size-3 text-emerald-300" />
            <span>Municipality of Padre Garcia • MAO Registry</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Livestock Raiser Registration</h1>
          <p className="text-emerald-100/80 text-xs sm:text-sm font-medium mt-1 max-w-md mx-auto">
            Enroll your farm holding in the digital livestock census and veterinary monitoring ledger
          </p>
        </div>

        {/* Multi-Step Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-6">
          {/* ═════════════════════════════════════════════════════════════
              STEP 1: PERSONAL IDENTITY & CREDENTIALS
             ═════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                  <User className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Step 1: Personal Identification</h2>
                  <p className="text-[11px] text-slate-500">Your official government name and login credentials</p>
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-[11px] font-extrabold text-slate-700 uppercase">
                    First Name <span className="text-rose-500">*</span>
                  </Label>
                  <input
                    id="firstName"
                    type="text"
                    placeholder="e.g. Juan"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={`w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.firstName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  />
                  {fieldErrors.firstName && (
                    <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.firstName}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-[11px] font-extrabold text-slate-700 uppercase">
                    Last Name <span className="text-rose-500">*</span>
                  </Label>
                  <input
                    id="lastName"
                    type="text"
                    placeholder="e.g. Dela Cruz"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={`w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.lastName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  />
                  {fieldErrors.lastName && (
                    <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1">
                <Label htmlFor="email" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                  <span>Email Address (Login ID) <span className="text-rose-500">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">Used to sign in</span>
                </Label>
                <div className="relative">
                  <input
                    id="email"
                    type="email"
                    placeholder="juan.delacruz@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full pl-10 pr-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.email ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.email}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Mobile Number <span className="text-rose-500">*</span>
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-2xl text-xs text-slate-700 font-black">
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
                    className={`w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-r-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.phone_number ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  />
                </div>
                {fieldErrors.phone_number && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.phone_number}</p>
                )}
              </div>

              {/* Password and Strength Meter */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Account Password <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={`w-full pl-10 pr-11 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                    minLength={8}
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-bold text-slate-700">Password requirements</p>
                  <ul className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2" aria-label="Password requirements">
                    {passwordRequirements.map((requirement) => (
                      <li
                        key={requirement.label}
                        className={`inline-flex items-center gap-1.5 text-[11px] ${requirement.met ? 'font-medium text-emerald-700' : 'text-slate-500'}`}
                      >
                        {requirement.met ? (
                          <Check className="size-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <span className="size-3.5 shrink-0 rounded-full border border-slate-300" aria-hidden="true" />
                        )}
                        {requirement.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] leading-relaxed text-slate-500">Avoid common or easy-to-guess passwords.</p>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.password}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                  <span>Confirm Password <span className="text-rose-500">*</span></span>
                </Label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-type your password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={`w-full pl-10 pr-11 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.confirmPassword ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
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
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.confirmPassword}</p>
                )}
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
              STEP 2: FARM LOCATION & HOLDING SIZE
             ═════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                  <MapPin className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Step 2: Farm Location & Size</h2>
                  <p className="text-[11px] text-slate-500">Record your livestock holding parcel in Padre Garcia</p>
                </div>
              </div>

              {/* Barangay Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="barangay" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                  <span>Barangay in Padre Garcia <span className="text-rose-500">*</span></span>
                  {isLoadingBarangays && (
                    <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-bold">
                      <Loader2 className="size-3 animate-spin" /> Loading barangays...
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <select
                    id="barangay"
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className={`w-full pl-10 pr-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.barangay ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  >
                    <option value="">Select Barangay ({barangays.length} available)</option>
                    {barangays.map((b) => (
                      <option key={b.id} value={b.id}>
                        Barangay {b.barangay_name}
                      </option>
                    ))}
                  </select>
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                </div>
                {fieldErrors.barangay && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.barangay}</p>
                )}
              </div>

              {/* Farm Size in Hectares */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="farmSize" className="text-[11px] font-extrabold text-slate-700 uppercase">
                    Farm / Pasture Size (Hectares) <span className="text-rose-500">*</span>
                  </Label>
                  <span className="text-[10px] text-slate-400">1 ha = 10,000 sqm</span>
                </div>
                <input
                  id="farmSize"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 1.50"
                  value={formData.farmSize}
                  onChange={(e) => setFormData({ ...formData, farmSize: e.target.value })}
                  className={`w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                    fieldErrors.farm_size ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
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
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-600 hover:text-emerald-800 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {fieldErrors.farm_size && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.farm_size}</p>
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
                    className={`w-full pl-10 pr-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all ${
                      fieldErrors.address ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200'
                    }`}
                    required
                  />
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                </div>
                {fieldErrors.address && (
                  <p className="text-[11px] text-rose-600 font-bold">{fieldErrors.address}</p>
                )}
              </div>

              {/* Optional RSBSA Number */}
              <div className="space-y-1 pt-1">
                <Label htmlFor="rsbsaNumber" className="text-[11px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                  <span>RSBSA Reference Number</span>
                  <span className="text-slate-400 font-normal text-[10px]">Optional (if already enrolled)</span>
                </Label>
                <div className="relative">
                  <input
                    id="rsbsaNumber"
                    type="text"
                    placeholder="e.g. 04-10-18-000-00000"
                    value={formData.rsbsaNumber}
                    onChange={(e) => setFormData({ ...formData, rsbsaNumber: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium transition-all"
                  />
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
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

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="flex-1 py-6 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer"
                >
                  <ArrowLeft className="size-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  className="flex-2 py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Proceed to Documents & Consent</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════
              STEP 3: DOCUMENT VERIFICATION & DATA PRIVACY AGREEMENT
             ═════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                  <FileCheck className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Step 3: Verification Documents & Agreement</h2>
                  <p className="text-[11px] text-slate-500">Attach verification IDs and consent under RA 10173</p>
                </div>
              </div>

              {/* Guided ID capture: front first, then back, with one complete PDF as an alternative. */}
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="governmentIdType" className="text-[11px] font-extrabold uppercase text-slate-700">
                    Government ID type <span className="font-medium normal-case text-slate-400">(optional)</span>
                  </Label>
                  <select
                    id="governmentIdType"
                    value={governmentIdType}
                    onChange={(e) => {
                      setGovernmentIdType(e.target.value);
                      setError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[#2D5A27] focus:ring-2 focus:ring-[#2D5A27]/15"
                  >
                    <option value="">Choose an ID before uploading</option>
                    <option value="PHILID">PhilID / National ID</option>
                    <option value="DRIVERS_LICENSE">Driver’s License</option>
                    <option value="VOTERS_ID">Voter’s ID</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="UMID">UMID</option>
                    <option value="POSTAL_ID">Postal ID</option>
                    <option value="PRC_ID">PRC ID</option>
                    <option value="OTHER_GOV_ID">Other Government ID</option>
                  </select>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    Optional. Take a clear photo of the front, then the back, or upload one PDF containing both sides.
                  </p>
                </div>

                {governmentIdType && (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <input ref={govIdFrontRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => handleFileSelect(e, 'governmentIdFront')} />
                    <input ref={govIdBackRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => handleFileSelect(e, 'governmentIdBack')} />
                    <input ref={govIdPdfRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFileSelect(e, 'governmentIdPdf')} />

                    {documents.governmentIdPdf ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                        <div className="flex min-w-0 items-center gap-2.5"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-[10px] font-black text-rose-700">PDF</span><div className="min-w-0"><p className="text-xs font-semibold text-emerald-900">Complete ID PDF attached</p><p className="truncate text-[10px] text-slate-600">{documents.governmentIdPdf.name}</p><p className="text-[10px] text-slate-500">Make sure the PDF shows both sides.</p></div></div>
                        <button type="button" onClick={() => removeDocument('governmentIdPdf')} className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 hover:bg-rose-100">Remove</button>
                      </div>
                    ) : documents.governmentIdFront && documents.governmentIdBack ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold text-slate-900">Both sides captured</p><p className="text-[10px] text-slate-500">Check each photo before continuing.</p></div><Badge variant="secondary" className="text-[10px]">2 of 2 complete</Badge></div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {([
                            { key: 'governmentIdFront' as const, label: 'Front', ref: govIdFrontRef },
                            { key: 'governmentIdBack' as const, label: 'Back', ref: govIdBackRef },
                          ]).map(({ key, label, ref }) => (
                            <div key={key} className="flex min-w-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2">
                              <img src={previews[key]} alt={`${label} of ${governmentIdType}`} className="size-14 shrink-0 rounded-lg border border-emerald-200 object-cover" />
                              <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{label} side</p><p className="truncate text-[10px] text-slate-500">{documents[key]?.name}</p><div className="mt-1 flex gap-3"><button type="button" onClick={() => { if (ref.current) { ref.current.value = ''; ref.current.click(); } }} className="text-[10px] font-semibold text-[#2D5A27] hover:underline">Retake</button><button type="button" onClick={() => removeDocument(key)} className="text-[10px] font-semibold text-rose-600 hover:underline">Remove</button></div></div>
                              <Check className="size-4 shrink-0 text-emerald-700" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : !documents.governmentIdFront ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-900">Step 1 of 2 · Front side</p><p className="text-[10px] text-slate-500">Place the front of your ID inside the frame and take a clear photo.</p></div><Badge variant="outline" className="shrink-0 text-[10px]">Front</Badge></div>
                        <button type="button" onClick={() => { if (govIdFrontRef.current) { govIdFrontRef.current.value = ''; govIdFrontRef.current.click(); } }} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-[#2D5A27] hover:bg-emerald-50/40">
                          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-[#2D5A27]"><Camera className="size-5" /></span><span className="text-xs font-semibold text-slate-800">Take or upload front photo</span><span className="text-[10px] text-slate-500">JPG, PNG, or WEBP · Max 10MB</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-900">Step 2 of 2 · Back side</p><p className="text-[10px] text-slate-500">Front saved. Turn the ID over and capture the back.</p></div><Badge variant="outline" className="shrink-0 text-[10px]">Back</Badge></div>
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2"><img src={previews.governmentIdFront} alt={`Front of ${governmentIdType}`} className="size-11 shrink-0 rounded-md border border-emerald-200 object-cover" /><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-emerald-800">Front side captured</p><p className="truncate text-[10px] text-slate-500">{documents.governmentIdFront.name}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><button type="button" onClick={() => { if (govIdFrontRef.current) { govIdFrontRef.current.value = ''; govIdFrontRef.current.click(); } }} className="text-[10px] font-semibold text-[#2D5A27] hover:underline">Retake</button><button type="button" onClick={() => removeDocument('governmentIdFront')} className="text-[10px] font-semibold text-rose-600 hover:underline">Remove</button></div></div>
                        <button type="button" onClick={() => { if (govIdBackRef.current) { govIdBackRef.current.value = ''; govIdBackRef.current.click(); } }} className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-[#2D5A27] hover:bg-emerald-50/40">
                          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-[#2D5A27]"><Camera className="size-5" /></span><span className="text-xs font-semibold text-slate-800">Take or upload back photo</span><span className="text-[10px] text-slate-500">JPG, PNG, or WEBP · Max 10MB</span>
                        </button>
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-3">
                      {documents.governmentIdFront || documents.governmentIdBack ? (
                        <p className="text-center text-[10px] text-slate-500">To use a PDF instead, remove the captured photo(s) first.</p>
                      ) : (
                        <button type="button" onClick={() => govIdPdfRef.current?.click()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"><FileText className="size-4 text-rose-600" />Upload one complete PDF instead</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

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

              {/* Data Privacy Act Agreement Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4.5 text-[#2D5A27] shrink-0" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#2D5A27]">
                      Data Privacy Act of 2012 (RA 10173) Consent
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrivacyDialogOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-[#2D5A27] hover:underline cursor-pointer shrink-0"
                  >
                    <span>Read Policy</span>
                    <ExternalLink className="size-3" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  By registering, you authorize the <strong>Municipal Agriculture Office (MAO)</strong> of Padre Garcia, Batangas to collect, process, and retain your personal and farm information strictly for official agricultural programs, quarterly livestock censuses, vaccine assistance, and disease surveillance.
                </p>

                <div className="flex items-start space-x-3 pt-1 border-t border-emerald-200/60">
                  <Checkbox
                    id="privacy-consent"
                    checked={privacyAgreed}
                    onCheckedChange={(checked) => {
                      setPrivacyAgreed(Boolean(checked));
                      if (error) setError('');
                    }}
                    className="mt-0.5 rounded-lg border-emerald-600 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
                  />
                  <Label
                    htmlFor="privacy-consent"
                    className="text-xs font-bold text-slate-800 leading-snug cursor-pointer select-none"
                  >
                    I have read and agree to the <strong className="text-[#2D5A27]">Data Privacy Policy</strong> and hereby submit my registration for municipal validation. <span className="text-rose-500">*</span>
                  </Label>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="size-4 text-rose-600 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={isSubmitting}
                  className="flex-1 py-6 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer"
                >
                  <ArrowLeft className="size-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-green-900/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4.5 animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="size-4.5" />
                      <span>Complete Registration</span>
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
              Sign In to Your Account
            </Link>
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-slate-400 font-medium space-y-1">
        <p>© {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas</p>
        <p className="text-[11px] text-slate-400/80">Cattle & Livestock Information System</p>
      </div>

      {/* ═════════════════════════════════════════════════════════════
          DATA PRIVACY POLICY MODAL DIALOG
         ═════════════════════════════════════════════════════════════ */}
      <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-800">
              <Shield className="size-5" />
              <DialogTitle className="text-base font-black">
                Padre Garcia Data Privacy Policy
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Republic Act No. 10173 (Data Privacy Act of 2012) Compliance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs text-slate-600 leading-relaxed pt-2">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">1. Information We Collect</h4>
              <p>
                The Municipal Agriculture Office (MAO) collects personal identification details (full name, email, contact number), farm location and size, and livestock holding declarations solely for municipal monitoring and farmer support services.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">2. Purpose of Processing</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Issuance of municipal livestock clearances and inspection certificates.</li>
                <li>Conduct of quarterly livestock censuses and agricultural surveys.</li>
                <li>Distribution of government veterinary aid, vaccines, and calamity assistance.</li>
                <li>Biosecurity monitoring and disease surveillance.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">3. Confidentiality & Storage</h4>
              <p>
                Your records are stored securely within the SmartLivestock municipal database and are only accessible by authorized MAO personnel and accredited SIBAT agricultural technologists.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">4. Your Rights as a Data Subject</h4>
              <p>
                Under RA 10173, you retain the right to access, verify, request corrections to, or withdraw consent regarding your stored records by visiting the Padre Garcia Municipal Agriculture Office during standard office hours.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setPrivacyAgreed(true);
                setPrivacyDialogOpen(false);
              }}
              className="bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-bold rounded-xl"
            >
              I Understand & Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
