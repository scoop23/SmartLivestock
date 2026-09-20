'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Shield,
  Phone,
  MapPin,
  HelpCircle,
  ExternalLink,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function PendingPage() {
  const router = useRouter();
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 py-10 selection:bg-emerald-600 selection:text-white">
      <div className="w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#244b1f] via-[#2D5A27] to-[#1f421a] p-8 text-white text-center space-y-1 relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-wider text-emerald-200 mb-1">
            <Sparkles className="size-3 text-emerald-300" />
            <span>Padre Garcia Municipal Agriculture Office</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Registration Submitted</h2>
          <p className="text-emerald-100/75 text-xs font-medium">
            Livestock Raiser Profile Awaiting Verification
          </p>
        </div>

        <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
          {/* Status Icon */}
          <div className="relative">
            <div className="size-20 bg-amber-50 rounded-3xl flex items-center justify-center border-2 border-amber-200/80 shadow-inner">
              <Clock className="size-10 text-amber-500 animate-pulse" />
            </div>
            <div className="absolute -bottom-2 -right-2 size-8 bg-[#2D5A27] rounded-2xl flex items-center justify-center shadow-md text-white">
              <CheckCircle2 className="size-5" />
            </div>
          </div>

          {/* Status Message */}
          <div className="space-y-2 max-w-sm">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Application Under Review
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Your registration application was received and is currently being verified by the Municipal Agriculture Office (MAO) in accordance with municipal livestock guidelines.
            </p>
          </div>

          {/* Steps Progress Verification Cards */}
          <div className="w-full space-y-2.5 text-left">
            <div className="flex items-center gap-3 p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <div className="size-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">Step 1: Personal & Farm Identity</p>
                <p className="text-[11px] text-emerald-700 font-medium">Submitted & recorded in LGU registry</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
              <div className="size-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">Step 2: Data Privacy & Terms Consent</p>
                <p className="text-[11px] text-emerald-700 font-medium">Consented under RA 10173 protocols</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
              <div className="size-7 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Clock className="size-4" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">Step 3: MAO Official Approval</p>
                <p className="text-[11px] text-amber-700 font-medium">Pending administrator review</p>
              </div>
            </div>
          </div>

          {/* Data Privacy Protection Notice Card */}
          <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3 text-left">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="size-5 text-[#2D5A27] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-black text-slate-900">Protected under RA 10173</p>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Your submitted farm records and contact information are protected and encrypted.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPrivacyDialogOpen(true)}
              className="text-[11px] font-black text-[#2D5A27] hover:underline shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <span>Policy</span>
              <ExternalLink className="size-3" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="w-full space-y-2.5 pt-1">
            <Button
              onClick={() => router.push('/login')}
              className="w-full py-6 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Back to Sign In</span>
              <ArrowRight className="size-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setContactDialogOpen(true)}
              className="w-full py-5 border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer"
            >
              <Phone className="size-3.5 mr-1 text-[#2D5A27]" />
              <span>Contact MAO Support Desk</span>
            </Button>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400 font-medium text-center">
        © {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas
      </p>

      {/* ═════════════════════════════════════════════════════════════════════
          DATA PRIVACY POLICY DIALOG
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
                  Data Privacy Policy & Terms
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  Republic Act No. 10173 (Data Privacy Act of 2012)
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3 text-slate-700 text-xs sm:text-sm leading-relaxed">
            <p>
              Your personal identification, farm geolocation coordinates, and livestock herd inventory records are collected solely for official LGU programs, animal health disease containment, and agricultural subsidy grants in the Municipality of Padre Garcia.
            </p>
            <p>
              All records are stored securely in encrypted databases and are accessible only to accredited MAO personnel and veterinary inspectors.
            </p>
            <Button
              type="button"
              onClick={() => setPrivacyDialogOpen(false)}
              className="w-full py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black rounded-2xl text-xs uppercase tracking-wider mt-2"
            >
              Close Policy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════
          CONTACT MAO DIALOG
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-6 sm:p-8 bg-white border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="size-11 rounded-2xl bg-emerald-100 text-[#2D5A27] flex items-center justify-center">
              <HelpCircle className="size-6" />
            </div>
            <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
              MAO Office Helpdesk
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Get assistance regarding your registration status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-extrabold uppercase text-[#2D5A27] text-[10px]">Central Office Hotline</span>
              <p className="text-sm font-bold text-slate-900">(043) 515-2888</p>
              <p className="text-slate-500">mao@padregarcia.gov.ph</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-extrabold uppercase text-slate-700 text-[10px]">Location & Hours</span>
              <p className="text-xs font-bold text-slate-900">Municipal Hall, Poblacion, Padre Garcia</p>
              <p className="text-slate-500">Monday to Friday: 8:00 AM - 5:00 PM</p>
            </div>

            <Button
              type="button"
              onClick={() => setContactDialogOpen(false)}
              className="w-full py-5 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black rounded-2xl text-xs uppercase tracking-wider mt-2"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
