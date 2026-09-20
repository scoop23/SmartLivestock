'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  User,
  MapPin,
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Camera,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  ExternalLink,
  HelpCircle,
  Loader2,
  Sprout,
  FileCheck,
} from 'lucide-react';
import api from '@/lib/axios';
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

interface BarangayOption {
  id: number;
  barangay_name: string;
}

const DEFAULT_BARANGAYS: BarangayOption[] = [
  { id: 1, barangay_name: 'Banaba' },
  { id: 2, barangay_name: 'Bukal' },
  { id: 3, barangay_name: 'Castillo' },
  { id: 4, barangay_name: 'Cawongan' },
  { id: 5, barangay_name: 'Manggas' },
  { id: 6, barangay_name: 'Maugat East' },
  { id: 7, barangay_name: 'Maugat West' },
  { id: 8, barangay_name: 'Pansol' },
  { id: 9, barangay_name: 'Payapa' },
  { id: 10, barangay_name: 'Poblacion' },
  { id: 11, barangay_name: 'Quilo-quilo North' },
  { id: 12, barangay_name: 'Quilo-quilo South' },
  { id: 13, barangay_name: 'San Felipe' },
  { id: 14, barangay_name: 'San Miguel' },
  { id: 15, barangay_name: 'Tamayo' },
  { id: 16, barangay_name: 'Tangob' },
];

export default function FarmerRegistrationPage() {
  const router = useRouter();

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phoneNumber: '',
    rsbsaNumber: '',
    barangay: '',
    farmSize: '',
    address: '',
  });

  const [barangays, setBarangays] = useState<BarangayOption[]>(DEFAULT_BARANGAYS);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Privacy Policy states
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);

  // Document uploads
  const [documents, setDocuments] = useState<{
    governmentId: File | null;
    rsbsa: File | null;
  }>({ governmentId: null, rsbsa: null });

  const [previews, setPreviews] = useState<{
    governmentId: string;
    rsbsa: string;
  }>({ governmentId: '', rsbsa: '' });

  const govIdRef = useRef<HTMLInputElement>(null);
  const rsbsaRef = useRef<HTMLInputElement>(null);

  // Fetch real barangays on mount
  useEffect(() => {
    async function loadBarangays() {
      try {
        const response = await api.get('/api/livestock/barangays/');
        if (Array.isArray(response.data) && response.data.length > 0) {
          setBarangays(response.data);
        }
      } catch (err) {
        // Keep default list on error
        console.warn('Using fallback barangay list:', err);
      }
    }
    loadBarangays();
  }, []);

  const nextStep = () => {
    setError('');
    // Validation per step
    if (step === 1) {
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password || !formData.phoneNumber.trim()) {
        setError('Please fill in all required personal identification fields.');
        return;
      }
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
    } else if (step === 2) {
      if (!formData.barangay || !formData.farmSize || !formData.address.trim()) {
        setError('Please complete the farm location and address details.');
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, key: 'governmentId' | 'rsbsa') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Only image files (JPG, PNG) are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be 5MB or less');
      return;
    }

    setError('');
    setDocuments((prev) => ({ ...prev, [key]: file }));
    setPreviews((prev) => ({ ...prev, [key]: URL.createObjectURL(file) }));
  };

  const removeDocument = (key: 'governmentId' | 'rsbsa') => {
    if (previews[key]) URL.revokeObjectURL(previews[key]);
    setDocuments((prev) => ({ ...prev, [key]: null }));
    setPreviews((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!privacyAgreed) {
      setError('You must read and agree to the Data Privacy Policy before submitting your registration.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.post('/api/users/register/', {
        username: formData.email.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone_number: `+63${formData.phoneNumber.trim()}`,
        barangay: Number(formData.barangay),
        farm_size: formData.farmSize,
        address: formData.address.trim(),
      });

      router.push('/pending');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data;
        const messages = Object.values(data)
          .map((msgs) => (Array.isArray(msgs) ? msgs.join(', ') : String(msgs)))
          .join(', ');
        setError(messages || 'Registration failed. Please check your inputs.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong during registration.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 py-10 selection:bg-emerald-600 selection:text-white">
      {/* Top Header Stepper */}
      <div className="w-full max-w-lg mb-8 flex items-center justify-between px-6">
        {[1, 2, 3].map((num) => (
          <div key={num} className={`flex items-center relative ${num < 3 ? 'flex-1' : ''}`}>
            {/* Step Circle */}
            <div
              className={`size-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all z-10 shrink-0 shadow-md ${
                step >= num
                  ? 'bg-[#2D5A27] text-white ring-4 ring-emerald-600/20'
                  : 'bg-white text-slate-400 border border-slate-200'
              }`}
            >
              {step > num ? <CheckCircle2 className="size-5 text-emerald-300" /> : num}
            </div>

            {/* Connecting Bar */}
            {num < 3 && (
              <div
                className={`absolute w-full h-1.5 left-10 right-2 top-1/2 -translate-y-1/2 transition-all rounded-full ${
                  step > num ? 'bg-[#2D5A27]' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Main Registration Card */}
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-[#244b1f] via-[#2D5A27] to-[#1f421a] p-8 text-white text-center space-y-1 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-wider text-emerald-200 mb-1">
            <Sprout className="size-3 text-emerald-300" />
            <span>Official LGU Padre Garcia Registry</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Livestock Raiser Registration</h2>
          <p className="text-emerald-100/75 text-xs font-medium">
            Join the Municipal Agriculture Office digital livestock monitoring system
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {/* STEP 1: Personal Identity */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                  <User className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Personal Identity</h3>
                  <p className="text-[11px] text-slate-500">Provide your official name and contact info</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-[11px] font-extrabold text-slate-700 uppercase">
                    First Name *
                  </Label>
                  <input
                    id="firstName"
                    type="text"
                    placeholder="Juan"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-[11px] font-extrabold text-slate-700 uppercase">
                    Last Name *
                  </Label>
                  <input
                    id="lastName"
                    type="text"
                    placeholder="Dela Cruz"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Email Address (Login ID) *
                </Label>
                <input
                  id="email"
                  type="email"
                  placeholder="juan.delacruz@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Mobile Number *
                </Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-2xl text-xs text-slate-700 font-black">
                    +63
                  </span>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="912 345 6789"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-r-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Account Password *
                </Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3.5 pr-11 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rsbsa" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  RSBSA Number <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </Label>
                <input
                  id="rsbsa"
                  type="text"
                  placeholder="04-10-18-000-00000"
                  value={formData.rsbsaNumber}
                  onChange={(e) => setFormData({ ...formData, rsbsaNumber: e.target.value })}
                  className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                />
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
                className="w-full py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 mt-2"
              >
                <span>Proceed to Farm Details</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}

          {/* STEP 2: Farm Location */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                  <MapPin className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Farm Location & Size</h3>
                  <p className="text-[11px] text-slate-500">Record your livestock holding parcel</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="barangay" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Barangay in Padre Garcia *
                </Label>
                <select
                  id="barangay"
                  value={formData.barangay}
                  onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                  required
                >
                  <option value="">Select Barangay</option>
                  {barangays.map((b) => (
                    <option key={b.id} value={b.id}>
                      Barangay {b.barangay_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="farmSize" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Farm / Pasture Size (Hectares) *
                </Label>
                <input
                  id="farmSize"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="e.g. 1.5"
                  value={formData.farmSize}
                  onChange={(e) => setFormData({ ...formData, farmSize: e.target.value })}
                  className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Detailed Address / Sitio *
                </Label>
                <input
                  id="address"
                  type="text"
                  placeholder="Sitio Ilaya, Lot 4"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-3 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/20 focus:border-[#2D5A27] font-medium"
                  required
                />
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
                  className="flex-1 py-6 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase"
                >
                  <ArrowLeft className="size-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button
                  type="button"
                  onClick={nextStep}
                  className="flex-2 py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-1.5"
                >
                  <span>Proceed to Documents & Policy</span>
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Documents & Data Privacy Agreement */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="size-8 rounded-xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center font-bold">
                  <FileCheck className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Verification & Policy</h3>
                  <p className="text-[11px] text-slate-500">Attach verification ID and review consent</p>
                </div>
              </div>

              {/* Government ID Upload */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-extrabold text-slate-700 uppercase">
                  Valid Government ID (Optional for fast-track)
                </Label>
                <input
                  ref={govIdRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, 'governmentId')}
                />
                {previews.governmentId ? (
                  <div className="relative border-2 border-[#2D5A27] rounded-2xl overflow-hidden shadow-xs">
                    <img src={previews.governmentId} alt="Government ID" className="w-full h-32 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeDocument('governmentId')}
                      className="absolute top-2 right-2 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow hover:bg-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => govIdRef.current?.click()}
                    className="p-3.5 border-2 border-dashed border-slate-200 hover:border-[#2D5A27] rounded-2xl flex items-center justify-between transition-colors cursor-pointer bg-slate-50/50 hover:bg-emerald-50/20 group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-slate-100 group-hover:bg-emerald-100 text-slate-500 group-hover:text-[#2D5A27] flex items-center justify-center transition-colors">
                        <Camera className="size-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Upload Valid ID Photo</p>
                        <p className="text-[10px] text-slate-400">PhilID, Driver's License, or Voter's ID (Max 5MB)</p>
                      </div>
                    </div>
                    <Upload className="size-4 text-slate-400 group-hover:text-[#2D5A27]" />
                  </div>
                )}
              </div>

              {/* ═════════════════════════════════════════════════════════════
                  DATA PRIVACY POLICY & CONSENT AGREEMENT CARD
                 ═════════════════════════════════════════════════════════════ */}
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/90 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="size-4.5 text-[#2D5A27]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#2D5A27]">
                      Data Privacy Act (RA 10173) Agreement
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrivacyDialogOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#2D5A27] hover:underline cursor-pointer"
                  >
                    <span>Read Policy</span>
                    <ExternalLink className="size-3" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  By registering, you consent to the collection, processing, and storage of your personal and farm data by the Municipal Agriculture Office (MAO) of Padre Garcia strictly for official agricultural programs, livestock census, and disease surveillance.
                </p>

                <div className="flex items-start space-x-2.5 pt-1">
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
                    I have read and agree to the <strong className="text-[#2D5A27]">Data Privacy Policy</strong> and authorize the MAO to process my farm records. *
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
                  className="flex-1 py-6 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase"
                >
                  <ArrowLeft className="size-4 mr-1" />
                  <span>Back</span>
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !privacyAgreed}
                  className="flex-2 py-6 bg-[#2D5A27] hover:bg-[#23471f] disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4.5 animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Application</span>
                      <CheckCircle2 className="size-4.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Back to Login link */}
      <p className="mt-8 text-xs text-slate-500 font-medium">
        Already registered?{' '}
        <button
          onClick={() => router.push('/login')}
          className="text-[#2D5A27] font-bold hover:underline cursor-pointer"
        >
          Sign in here
        </button>
      </p>

      {/* ═════════════════════════════════════════════════════════════════════
          DATA PRIVACY POLICY MODAL DIALOG (RA 10173)
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center shrink-0">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Data Privacy Policy & Terms of Consent
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  Compliance with Republic Act No. 10173 (Data Privacy Act of 2012)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-3 text-slate-700 text-xs sm:text-sm leading-relaxed">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-950 font-medium">
              The Local Government Unit (LGU) of Padre Garcia, Batangas through the Municipal Agriculture Office (MAO) is committed to safeguarding the confidentiality, integrity, and security of your personal data.
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                1. Scope of Information Collected
              </h4>
              <p className="text-slate-600">
                During registration and ongoing use of the SmartLivestock system, the MAO collects:
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1">
                <li>Personal identification details: Full Name, Address, Contact Number, and Email Address.</li>
                <li>Agricultural identifiers: RSBSA Number and Barangay accreditation.</li>
                <li>Geographic data: Farm lot location, pasture boundaries, and herd GIS coordinates.</li>
                <li>Livestock production records: Head counts, dairy/milk yields, and disease/mortality observations.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                2. Purpose of Data Processing
              </h4>
              <p className="text-slate-600">
                Your information is collected and processed exclusively for legitimate municipal agricultural purposes:
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1">
                <li>Issuance of official farmer certifications, livestock ownership IDs, and transit clearances.</li>
                <li>Rapid biosecurity containment, vaccination deployment, and disease outbreak surveillance.</li>
                <li>Verification and distribution of government subsidies, feeds, and breeding assistance.</li>
                <li>Compiling accurate municipal livestock census data for LGU planning.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                3. Confidentiality and Information Security
              </h4>
              <p className="text-slate-600">
                All records are stored securely in encrypted databases. Access is strictly restricted to authorized MAO personnel, SIBAT inspectors, and accredited municipal veterinarians. Your personal information will never be sold, leased, or shared with unauthorized commercial entities.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                4. Farmer Rights under RA 10173
              </h4>
              <p className="text-slate-600">
                As a registered data subject, you have the right to:
              </p>
              <ul className="list-disc list-inside text-slate-600 space-y-1 pl-1">
                <li>Access and review your registered personal and livestock records.</li>
                <li>Request correction of inaccurate or outdated information.</li>
                <li>Inquire directly with the MAO Data Protection Officer regarding your stored records.</li>
              </ul>
            </div>

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                onClick={() => {
                  setPrivacyAgreed(true);
                  setPrivacyDialogOpen(false);
                }}
                className="flex-1 py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black rounded-2xl text-xs uppercase tracking-wider"
              >
                I Understand & Agree to Policy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
