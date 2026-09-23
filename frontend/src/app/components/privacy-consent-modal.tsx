'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Lock,
  Eye,
  AlertCircle,
  Sparkles,
  LogOut,
  MapPin,
  Shield,
  Sprout,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function PrivacyConsentModal() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!user || !user.email) {
      setOpen(false);
      return;
    }

    // Only display the onboarding privacy consent popup for FARMER users
    const isFarmer = user.role?.toUpperCase() === 'FARMER';
    if (!isFarmer) {
      setOpen(false);
      return;
    }

    try {
      const storageKey = `smartlivestock_privacy_agreed_${user.email.toLowerCase()}`;
      const hasAgreed = localStorage.getItem(storageKey);

      // If farmer has not accepted policy yet, display the mandatory onboarding consent modal
      if (!hasAgreed) {
        setOpen(true);
        setAgreed(false);
      } else {
        setOpen(false);
      }
    } catch {
      // Ignore storage read errors
    }
  }, [user]);

  const handleAccept = () => {
    if (!agreed || !user?.email) return;

    try {
      const storageKey = `smartlivestock_privacy_agreed_${user.email.toLowerCase()}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          agreedAt: new Date().toISOString(),
          email: user.email,
          role: user.role,
        })
      );

      setOpen(false);
      toast.success('Privacy Agreement Confirmed', {
        description: 'Thank you for acknowledging the Data Privacy Act (RA 10173) policy.',
      });
    } catch {
      setOpen(false);
    }
  };

  if (!open || !user || user.role?.toUpperCase() !== 'FARMER') return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-6 sm:p-8 bg-white border-none shadow-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-black uppercase tracking-wider text-[#2D5A27]">
              <Sparkles className="size-3.5 text-emerald-600 animate-pulse" />
              <span>New User First-Time Consent</span>
            </div>

            <span className="text-xs font-mono font-bold text-slate-400">
              RA 10173 Compliance
            </span>
          </div>

          <div className="flex items-start gap-3.5 pt-1">
            <div className="size-12 rounded-2xl bg-[#2D5A27] text-white flex items-center justify-center shrink-0 shadow-lg shadow-green-950/20">
              <ShieldCheck className="size-6 text-emerald-300" />
            </div>
            <div>
              <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Data Privacy Policy & Usage Terms
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                Municipality of Padre Garcia • SmartLivestock Information & Surveillance System
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-3 text-slate-700 text-xs sm:text-sm leading-relaxed">
          {/* Welcome Alert Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 space-y-1">
            <h4 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
              <Sprout className="size-4 text-emerald-700" />
              Welcome, {user.firstName || user.email}!
            </h4>
            <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
              Before accessing your portal, the Municipal Agriculture Office (MAO) requires all new users to review and consent to our livestock data protection guidelines in compliance with Republic Act No. 10173.
            </p>
          </div>

          {/* Scrollable Terms Content */}
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
            <div className="space-y-1.5">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <FileText className="size-3.5 text-[#2D5A27]" />
                1. Information Collected & Processed
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                SmartLivestock collects your full name, contact information, barangay, farm parcel coordinates, livestock inventory counts, dairy/milk yields, and disease observation reports.
              </p>
            </div>

            <div className="space-y-1.5">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Shield className="size-3.5 text-[#2D5A27]" />
                2. Purpose of Collection
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                Data is utilized strictly for municipal livestock census, issuance of veterinary certificates, rapid outbreak quarantine containment, and distribution of government subsidies and feeds.
              </p>
            </div>

            <div className="space-y-1.5">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Lock className="size-3.5 text-[#2D5A27]" />
                3. Security & Confidentiality
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your data is stored in encrypted databases accessible only to accredited MAO personnel and veterinary inspectors. Your records will never be commercialized or shared without authorization.
              </p>
            </div>

            <div className="space-y-1.5">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Eye className="size-3.5 text-[#2D5A27]" />
                4. Your Rights as a Data Subject
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                You retain the right to inspect, update, and request corrections to your recorded livestock holdings through the MAO Helpdesk.
              </p>
            </div>
          </div>

          {/* Agreement Checkbox */}
          <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200 space-y-2">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="modal-privacy-agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(Boolean(checked))}
                className="mt-0.5 rounded-lg border-slate-400 data-[state=checked]:bg-[#2D5A27] data-[state=checked]:border-[#2D5A27]"
              />
              <Label
                htmlFor="modal-privacy-agree"
                className="text-xs font-bold text-slate-900 leading-snug cursor-pointer select-none"
              >
                I have read, understood, and agree to the <strong className="text-[#2D5A27]">Data Privacy Policy</strong> and consent to the municipal livestock surveillance & processing of my farm records. *
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={logout}
              className="sm:w-1/3 py-6 border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 font-bold rounded-2xl text-xs uppercase cursor-pointer"
            >
              <LogOut className="size-3.5 mr-1" />
              <span>Decline & Exit</span>
            </Button>

            <Button
              type="button"
              disabled={!agreed}
              onClick={handleAccept}
              className="sm:w-2/3 py-6 bg-[#2D5A27] hover:bg-[#23471f] disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <span>Accept & Continue to Portal</span>
              <CheckCircle2 className="size-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
