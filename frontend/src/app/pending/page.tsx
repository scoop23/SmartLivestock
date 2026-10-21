'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RegistrationDocumentsPanel } from '@/components/registration-documents-panel';
import { cowHead } from '@lucide/lab';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  FileCheck,
  FileText,
  Fingerprint,
  Globe,
  HelpCircle,
  Icon,
  Info,
  Lock,
  Mail,
  MapPin,
  Phone,
  Radio,
  RefreshCw,
  Scan,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { OwnRegistrationDocumentsResponse } from '@/lib/registration-documents';

export default function PendingPage() {
  const router = useRouter();
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revisionRequested, setRevisionRequested] = useState(false);

  const handleDocumentsUpdated = useCallback((data: OwnRegistrationDocumentsResponse) => {
    setRevisionRequested(
      data.account_status === 'SUBJECT_TO_REVISION' ||
        data.documents.some((document) => document.verification_status === 'SUBJECT_TO_REVISION'),
    );
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      router.refresh();
    }, 800);
  };

  const auditSteps = [
    {
      num: '01',
      title: 'Personal & Farm Profile Declaration',
      desc: 'Owner details, RSBSA enrollment, and land coordinates submitted',
      status: 'VERIFIED',
      completed: true,
      icon: CheckCircle2,
    },
    {
      num: '02',
      title: 'Data Privacy Consent (RA 10173)',
      desc: 'Municipal data processing and audit authorization granted',
      status: 'CONSENTED',
      completed: true,
      icon: ShieldCheck,
    },
    {
      num: '03',
      title: revisionRequested ? 'MAO Requested Document Revision' : 'MAO Field Verification & ID Audit',
      desc: revisionRequested
        ? 'Review MAO’s remarks and upload a replacement document below.'
        : 'Agricultural technologist desk review and cross-matching',
      status: revisionRequested ? 'ACTION REQUIRED' : 'IN PROGRESS',
      current: true,
      icon: revisionRequested ? AlertCircle : Clock,
    },
    {
      num: '04',
      title: revisionRequested ? 'MAO Re-review & Portal Activation' : 'Portal Access & Agri-ID Activation',
      desc: revisionRequested
        ? 'MAO will review your replacement document before activating portal access.'
        : 'Issuance of livestock monitoring credentials and dashboard rights',
      status: 'PENDING',
      completed: false,
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen bg-[#051408] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950 relative overflow-x-hidden font-sans">
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
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="size-9 sm:size-10 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/25 border border-emerald-300/30">
              <Icon iconNode={cowHead} className="size-5 text-slate-950" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-white truncate">SmartLivestock</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-[9px] sm:text-[10px] text-amber-300 font-extrabold uppercase tracking-wider sm:tracking-widest bg-amber-500/15 border border-amber-500/30 px-1.5 sm:px-2 py-0.5 rounded-md">
                  AUDIT QUEUE
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/70 font-medium hidden sm:block">
                Padre Garcia Municipal Agriculture Office • Application Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold tracking-wider">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2 bg-amber-400"></span>
              </span>
              LGU AUDIT // IN PROGRESS
            </span>

            <Link
              href="/login"
              className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-white/10 hover:border-emerald-500/40 bg-white/[0.04] hover:bg-emerald-500/10 transition-all shadow-xs"
            >
              <ArrowLeft className="size-3.5 shrink-0" />
              <span className="sm:hidden">Sign In</span>
              <span className="hidden sm:inline">Back to Sign In</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Viewport Container ── */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-12 flex-1 flex flex-col justify-center relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* ═════════════════════════════════════════════════════════════
              LEFT COLUMN: TELEMETRY & AUDIT RADAR (Desktop Sidebar)
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-6">
            {/* Holographic Authority Card */}
            <div className={`rounded-3xl border ${revisionRequested ? 'border-rose-500/30' : 'border-emerald-500/20'} bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl p-5 sm:p-7 text-white shadow-2xl relative overflow-hidden`}>
              <div className={`absolute top-0 right-0 w-32 h-32 ${revisionRequested ? 'bg-rose-500/15' : 'bg-amber-500/10'} rounded-full blur-2xl pointer-events-none`} />

              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${revisionRequested ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'} border text-[11px] font-mono font-bold tracking-wider`}>
                <Radio className={`size-3 ${revisionRequested ? 'text-rose-400' : 'text-emerald-400'} animate-pulse`} />
                VERIFICATION RADAR
              </div>

              <h1 className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight mt-3 bg-gradient-to-r ${revisionRequested ? 'from-rose-100 via-red-100 to-white' : 'from-emerald-100 via-teal-100 to-white'} bg-clip-text text-transparent`}>
                {revisionRequested ? 'Action Required: Document Revision' : 'Application Under Review'}
              </h1>

              <p className="text-xs text-slate-300 leading-relaxed mt-2.5 font-normal">
                {revisionRequested
                  ? 'MAO requested a correction to one or more registration documents. Review the reason and upload a replacement below.'
                  : 'Your livestock raiser profile and farm holdings are currently being validated by Padre Garcia municipal agriculture officers.'}
              </p>

              {/* Status Pulse Visual Indicator */}
              <div className={`mt-5 sm:mt-6 p-3.5 sm:p-4 rounded-2xl bg-black/40 ${revisionRequested ? 'border-rose-500/30' : 'border-emerald-500/20'} border flex items-center gap-3.5 sm:gap-4`}>
                <div className="relative size-12 sm:size-14 shrink-0 flex items-center justify-center">
                  <div className={`absolute inset-0 rounded-2xl ${revisionRequested ? 'bg-rose-500/20' : 'bg-amber-500/20'} animate-ping opacity-60`} />
                  <div className={`relative size-11 sm:size-12 rounded-2xl bg-gradient-to-br ${revisionRequested ? 'from-rose-500/30 to-red-600/10 border-rose-400/40 text-rose-300 shadow-rose-950/40' : 'from-amber-500/30 to-amber-600/10 border-amber-400/40 text-amber-300 shadow-amber-950/40'} border flex items-center justify-center shadow-lg`}>
                    {revisionRequested
                      ? <AlertCircle className="size-5 sm:size-6" />
                      : <Clock className="size-5 sm:size-6 animate-pulse" />}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-mono font-black ${revisionRequested ? 'text-rose-300' : 'text-amber-300'} uppercase tracking-wide`}>
                    {revisionRequested ? 'QUEUE STATUS: REVISION REQUIRED' : 'QUEUE STATUS: REVIEWING'}
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    {revisionRequested
                      ? <>Upload the requested replacement so MAO can continue reviewing your application.</>
                      : <>Standard municipal turnaround is <strong>1 to 2 business days</strong>.</>}
                  </p>
                </div>
              </div>

              {/* Live Telemetry Diagnostics */}
              <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-xs sm:text-sm font-black text-emerald-400">RA 10173</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Compliant</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-xs sm:text-sm font-black text-teal-400">DA-BAI</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Standards</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <p className="font-mono text-xs sm:text-sm font-black text-emerald-400">SHA-256</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Encrypted</p>
                </div>
              </div>
            </div>

            {/* Support Desk Quick Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 text-slate-300 flex items-center justify-between gap-3 sm:gap-4 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                  <Phone className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white leading-snug">Need urgent verification?</p>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">MAO desk hotlines are open weekdays</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setContactDialogOpen(true)}
                className="shrink-0 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Helpdesk
              </Button>
            </div>
          </div>

          {/* ═════════════════════════════════════════════════════════════
              RIGHT COLUMN: AUDIT PIPELINE TERMINAL CARD
             ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7">
            <div className="rounded-[2rem] sm:rounded-[2.5rem] border border-emerald-500/25 bg-white shadow-2xl shadow-black/50 overflow-hidden relative">
              {/* Glowing Top Progress Line */}
              <div className="h-1.5 w-full bg-slate-100 relative overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${revisionRequested ? 'from-rose-600 via-rose-500 to-red-400 shadow-rose-500/50' : 'from-emerald-500 via-teal-400 to-amber-400 shadow-emerald-500/50'} ${revisionRequested ? 'w-1/2' : 'w-3/4'} transition-all duration-500 shadow-sm`} />
              </div>

              {/* Terminal Header Banner */}
              <div className="p-5 sm:p-8 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 sm:gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[10px] font-black uppercase tracking-wider ${revisionRequested ? 'text-rose-800 bg-rose-100 border-rose-200' : 'text-amber-800 bg-amber-100 border-amber-200'} px-2 py-0.5 rounded-md border`}>
                      {revisionRequested ? 'Action Required' : 'Phase 3 of 4'}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {revisionRequested ? 'MAO Document Revision' : 'Municipal Desk Audit'}
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight mt-1.5">
                    Registration Lifecycle Pipeline
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track the stages of your municipal agricultural raiser accreditation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className={`self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${revisionRequested ? 'border-rose-200 hover:border-rose-300 hover:bg-rose-50/50 hover:text-rose-800' : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800'} bg-white text-slate-600 text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50`}
                  title="Check latest status"
                >
                  <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
                </button>
              </div>

              {/* Terminal Pipeline Content */}
              <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
                {/* Steps List */}
                <div className="space-y-3">
                  {auditSteps.map((step) => {
                    const StepIcon = step.icon;

                    return (
                      <div
                        key={step.num}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start gap-3 sm:gap-3.5 ${
                          step.current
                            ? revisionRequested
                              ? 'bg-rose-50/80 border-rose-200/90 shadow-xs'
                              : 'bg-amber-50/80 border-amber-200/90 shadow-xs'
                            : step.completed
                            ? 'bg-emerald-50/60 border-emerald-100'
                            : 'bg-slate-50/60 border-slate-200/60 opacity-60'
                        }`}
                      >
                        <div
                          className={`size-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs ${
                            step.current
                              ? revisionRequested
                                ? 'bg-rose-600 text-white shadow-rose-600/20'
                                : 'bg-amber-500 text-white shadow-amber-500/20'
                              : step.completed
                              ? 'bg-[#2D5A27] text-white shadow-emerald-900/20'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <StepIcon className="size-4.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] text-slate-400 font-bold">
                              STEP {step.num}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                                step.current
                                  ? revisionRequested
                                    ? 'bg-rose-500/15 text-rose-800 border border-rose-300'
                                    : 'bg-amber-500/20 text-amber-800 border border-amber-300'
                                  : step.completed
                                  ? 'bg-emerald-600/15 text-emerald-800 border border-emerald-300'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {step.status}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-black text-slate-900 leading-snug mt-0.5">
                            {step.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed font-medium">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Registration Document Status & MAO Revision Replacement Flow */}
                <RegistrationDocumentsPanel variant="pending" onDocumentsUpdated={handleDocumentsUpdated} />

                {/* Biometric / Identity Verification Callout */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Scan className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900">
                        Identity Verification Session
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium mt-0.5">
                        If photo ID or facial selfie checks were requested, you can resume your live verification session.
                      </p>
                    </div>
                  </div>

                  <Link
                    href="/farmer-registration/identity"
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl bg-[#2D5A27] hover:bg-[#23471f] text-white text-xs font-black transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Resume Session</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>

                {/* Data Privacy RA 10173 Card */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-slate-700">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ShieldCheck className="size-5 text-[#2D5A27] shrink-0" />
                    <p className="text-xs text-slate-600 leading-snug font-medium">
                      Records protected under <strong className="text-slate-900">RA 10173 (Data Privacy Act)</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrivacyDialogOpen(true)}
                    className="text-xs font-bold text-[#2D5A27] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Read Policy</span>
                    <ExternalLink className="size-3" />
                  </button>
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => router.push('/login')}
                    className="w-full h-12 bg-[#2D5A27] hover:bg-[#23471f] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    <span>Back to Sign In</span>
                    <ArrowRight className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setContactDialogOpen(true)}
                    className="w-full h-12 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer"
                  >
                    <Phone className="size-3.5 mr-1 text-[#2D5A27]" />
                    <span>Contact MAO Desk</span>
                  </Button>
                </div>
              </div>

              {/* Card Footer */}
              <div className="bg-slate-50/80 p-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Need to make corrections?{' '}
                  <button
                    type="button"
                    onClick={() => setContactDialogOpen(true)}
                    className="text-[#2D5A27] font-black hover:underline cursor-pointer"
                  >
                    Contact Support
                  </button>{' '}
                  instead of re-registering.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-8 border-t border-emerald-500/10 bg-black/30 backdrop-blur-md py-4 text-center text-xs text-slate-400 font-medium relative z-10 space-y-1">
        <p>© {new Date().getFullYear()} Municipal Agriculture Office (MAO) • Padre Garcia, Batangas</p>
        <p className="text-[11px] text-slate-400/80">Cattle & Livestock Information System • Verification Protocol</p>
      </footer>

      {/* ═════════════════════════════════════════════════════════════
          DATA PRIVACY POLICY DIALOG
         ═════════════════════════════════════════════════════════════ */}
      <Dialog open={privacyDialogOpen} onOpenChange={setPrivacyDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-white border-slate-100 text-slate-800">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-800">
              <Shield className="size-5" />
              <DialogTitle className="text-base font-black">Padre Garcia Data Privacy Policy</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Republic Act No. 10173 (Data Privacy Act of 2012) Compliance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed pt-2">
            <div>
              <h4 className="font-bold text-slate-900 mb-1">1. Information We Collect</h4>
              <p>
                The Municipal Agriculture Office (MAO) collects personal identification details (full name,
                email, contact number), farm location and size, and livestock holding declarations solely
                for municipal monitoring and farmer support services.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">2. Purpose of Processing</h4>
              <p>
                Data is processed to maintain the Padre Garcia livestock raiser registry, issue municipal
                health and transport clearances, coordinate veterinary vaccination drives, and facilitate
                LGU agricultural assistance.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">3. Confidentiality & Storage</h4>
              <p>
                Your records are stored securely within the SmartLivestock municipal database and are only
                accessible by authorized MAO personnel and accredited SIBAT agricultural technologists.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">4. Your Rights as a Data Subject</h4>
              <p>
                Under RA 10173, you retain the right to access, verify, request corrections to, or withdraw
                consent regarding your stored records by visiting the Padre Garcia Municipal Agriculture
                Office during standard office hours.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setPrivacyDialogOpen(false)}
            className="w-full mt-4 h-11 rounded-2xl bg-[#2D5A27] hover:bg-[#23471f] text-white font-bold text-xs"
          >
            I Understand
          </Button>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════
          CONTACT MAO HELPDESK DIALOG
         ═════════════════════════════════════════════════════════════ */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border-slate-100 text-slate-800">
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-800">
              <HelpCircle className="size-5" />
              <DialogTitle className="text-base font-black">MAO Office Helpdesk</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Padre Garcia Municipal Agriculture Office Support
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
              <span className="font-extrabold uppercase text-[#2D5A27] text-[10px]">Central Office Hotline</span>
              <p className="text-sm font-black text-slate-900">(043) 515-2888</p>
              <p className="text-slate-600 font-medium">mao@padregarcia.gov.ph</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-extrabold uppercase text-slate-700 text-[10px]">Location & Hours</span>
              <p className="text-xs font-bold text-slate-900">Municipal Hall, Poblacion, Padre Garcia, Batangas</p>
              <p className="text-slate-500">Monday to Friday: 8:00 AM – 5:00 PM</p>
            </div>

            <Button
              type="button"
              onClick={() => setContactDialogOpen(false)}
              className="w-full mt-2 h-11 rounded-2xl bg-[#2D5A27] hover:bg-[#23471f] text-white font-bold text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
