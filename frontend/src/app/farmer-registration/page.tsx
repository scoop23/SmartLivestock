'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, 
  MapPin, 
  FileText, 
  Upload, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Camera
} from 'lucide-react';

export default function FarmerRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Registration submitted for MAO Review!");
      router.push('/login');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-4">
      {/* Progress Bar */}
      <div className="w-full max-w-md mb-8 flex items-center justify-between px-2">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
              step >= num ? 'bg-[#2D5A27] text-white shadow-lg' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
            </div>
            {num < 3 && (
              <div className={`w-16 h-1 transition-all ${step > num ? 'bg-[#2D5A27]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#2D5A27] p-8 text-white text-center">
          <h2 className="text-2xl font-black italic">MAO JOIN</h2>
          <p className="text-white/70 text-xs mt-1 uppercase tracking-widest font-bold">Farmer Registration</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          
          {/* STEP 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-[#2D5A27]" /> Personal Identity
              </h3>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Full Name</label>
                <input type="text" placeholder="Juan Dela Cruz" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">RSBSA Number (If available)</label>
                <input type="text" placeholder="00-00-00-000-00000" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" />
              </div>
              <button type="button" onClick={nextStep} className="w-full bg-[#2D5A27] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#1e3d1a] transition-all flex items-center justify-center gap-2">
                Next: Farm Details <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: Farm Details */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-[#2D5A27]" /> Farm Location
              </h3>
              <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm">
                <option>Select Barangay</option>
                <option>Barangay Bukal</option>
                <option>Barangay Ipilan</option>
                <option>Barangay May-it</option>
              </select>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Farm Size (Hectares)</label>
                <input type="number" step="0.1" placeholder="1.5" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={prevStep} className="flex-1 border border-gray-200 py-4 rounded-2xl font-bold text-gray-500">Back</button>
                <button type="button" onClick={nextStep} className="flex-[2] bg-[#2D5A27] text-white py-4 rounded-2xl font-bold shadow-lg">Next: Documents</button>
              </div>
            </div>
          )}

          {/* STEP 3: Document Upload */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#2D5A27]" /> Required Documents
              </h3>
              
              {/* Document Slots */}
              {['Government ID', 'Land Title / Lease'].map((doc) => (
                <div key={doc} className="p-4 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-between hover:border-[#2D5A27] transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="bg-gray-100 p-2 rounded-lg group-hover:bg-green-50">
                      <Camera className="w-5 h-5 text-gray-400 group-hover:text-[#2D5A27]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">{doc}</p>
                      <p className="text-[10px] text-gray-400">Click to upload photo</p>
                    </div>
                  </div>
                  <Upload className="w-4 h-4 text-gray-300" />
                </div>
              ))}

              <div className="flex items-start gap-2 bg-blue-50 p-4 rounded-2xl">
                <ShieldCheck className="w-8 h-8 text-blue-600" />
                <p className="text-[10px] text-blue-800 leading-relaxed">
                  By submitting, you agree that all information provided is true and will be subject to verification by the MAO office.
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={prevStep} className="flex-1 border border-gray-200 py-4 rounded-2xl font-bold text-gray-500">Back</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-[2] bg-[#2D5A27] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#1e3d1a] disabled:bg-gray-300"
                >
                  {isSubmitting ? 'Verifying...' : 'Finish Registration'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
      
      <p className="mt-8 text-xs text-gray-400">
        Already registered? <span className="text-[#2D5A27] font-bold cursor-pointer hover:underline">Log in here</span>
      </p>
    </div>
  );
}