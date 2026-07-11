'use client';
import api from '@/lib/axios';
import axios from 'axios';

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
  Camera,
  AlertCircle
} from 'lucide-react';

export default function FarmerRegistrationPage() {
  const router = useRouter();
  // set state for the info
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
    rsbsaNumber: "",
    barangay: "",
    farmSize: "",
    address: ""
  })

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nextStep = () => {
    setError('');
    setStep(step + 1);
  };
  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const nameParts = formData.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    try {
      await api.post('/users/register/', {
        username: formData.email,
        email: formData.email,
        password: formData.password,
        first_name: firstName,
        last_name: lastName,
        phone_number: `+63${formData.phoneNumber}`,
        barangay: formData.barangay,
        farm_size: formData.farmSize,
        address: formData.address,
      });

      router.push('/login?registered=true');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        const data = err.response.data;
        const messages = Object.values(data)
          .map((msgs) => (Array.isArray(msgs) ? msgs.join(', ') : String(msgs)))
          .join(', ');
        setError(messages || 'Registration failed');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-4">
      {/* Progress Bar */}
      <div className="w-full max-w-md mb-8 flex items-center justify-between px-4">
        {[1, 2, 3].map((num) => (
          <div key={num} className={`flex items-center relative ${num < 3 ? 'flex-1' : ''}`}>

            {/* Circle Indicator */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all z-10 shrink-0 ${step >= num ? 'bg-[#2D5A27] text-white shadow-lg' : 'bg-gray-200 text-gray-500'
              }`}>
              {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
            </div>

            {/* Connector Line */}
            {num < 3 && (
              <div className={`absolute w-full h-1.5 left-8 right-2 top-1/2 -translate-y-1/2 transition-all ${step > num ? 'bg-[#2D5A27]' : 'bg-gray-200'
                }`} />
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
                <input type="text" placeholder="Juan Dela Cruz" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Email Address</label>
                <input type="email" placeholder="your@email.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 bg-gray-100 border border-r-0 border-gray-200 rounded-l-2xl text-sm text-gray-600 font-bold">+63</span>
                  <input type="tel" placeholder="912 345 6789" value={formData.phoneNumber} onChange={e => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-r-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Password</label>
                <input type="password" placeholder="Min. 8 characters" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required minLength={8} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">RSBSA Number (If available)</label>
                <input type="text" placeholder="00-00-00-000-00000" value={formData.rsbsaNumber} onChange={e => setFormData({ ...formData, rsbsaNumber: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" />
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
              <select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" value={formData.barangay} onChange={e => setFormData({ ...formData, barangay: e.target.value })} required>
                <option value="">Select Barangay</option>
                <option value="Barangay Bukal">Barangay Bukal</option>
                <option value="Barangay Ipilan">Barangay Ipilan</option>
                <option value="Barangay May-it">Barangay May-it</option>
              </select>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Farm Size (Hectares)</label>
                <input type="number" step="0.1" placeholder="1.5" value={formData.farmSize} onChange={e => setFormData({ ...formData, farmSize: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Address</label>
                <input type="text" placeholder="Street, sitio, or lot number" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-[#2D5A27] text-sm" required />
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

              {error && (
                <div className="flex items-start gap-2 bg-red-50 p-4 rounded-2xl">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={prevStep} className="flex-1 border border-gray-200 py-4 rounded-2xl font-bold text-gray-500">Back</button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-[#2D5A27] text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-[#1e3d1a] disabled:bg-gray-300 transition-all"
                >
                  {isSubmitting ? 'Verifying...' : 'Finish Registration'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      <p className="mt-8 text-xs text-gray-400">
        Already registered? <span className="text-[#2D5A27] font-bold cursor-pointer hover:underline" onClick={() => router.push('/login')}>Log in here</span>
      </p>
    </div>
  );
}
