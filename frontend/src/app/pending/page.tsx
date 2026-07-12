'use client';

import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, Mail } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#2D5A27] p-8 text-white text-center">
          <h2 className="text-2xl font-black italic">MAO JOIN</h2>
          <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">Farmer Registration</p>
        </div>

        <div className="p-8 flex flex-col items-center text-center space-y-6">
          {/* Icon */}
          <div className="relative">
            <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow">
              <CheckCircle2 className="w-5 h-5 text-[#2D5A27]" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-800">Registration Submitted!</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your account is currently <span className="font-bold text-amber-600">pending approval</span> by the MAO office.
              You will receive a notification once your account has been verified.
            </p>
          </div>

          {/* Info Cards */}
          <div className="w-full space-y-3">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl text-left">
              <CheckCircle2 className="w-5 h-5 text-[#2D5A27] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-700">Step 1 Complete</p>
                <p className="text-[10px] text-gray-400">Personal information submitted</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl text-left">
              <CheckCircle2 className="w-5 h-5 text-[#2D5A27] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-700">Step 2 Complete</p>
                <p className="text-[10px] text-gray-400">Farm details recorded</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-2xl text-left">
              <CheckCircle2 className="w-5 h-5 text-[#2D5A27] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-gray-700">Step 3 Complete</p>
                <p className="text-[10px] text-gray-400">Documents uploaded</p>
              </div>
            </div>
          </div>

          {/* Email Notice */}
          <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-2xl w-full">
            <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-blue-800 leading-relaxed text-left">
              A confirmation email has been sent to your registered email address. Please keep it for your records.
            </p>
          </div>

          {/* Back to Login */}
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-[#2D5A27] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#1e3d1a] transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400">
        Need help? <span className="text-[#2D5A27] font-bold cursor-pointer hover:underline">Contact MAO Office</span>
      </p>
    </div>
  );
}
