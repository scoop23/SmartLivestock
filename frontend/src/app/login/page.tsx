'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sprout } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Mock login delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Route based on email
    if (email.includes('admin')) {
      router.push('/admin');  
    } else if (email.includes('lgu')) {
      router.push('/sibat');
    } else {
      router.push('/farmer');
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left Side - Branding */}
      <div className="bg-[#2D5A27] text-white p-8 md:p-12 md:w-1/2 flex flex-col justify-center">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Sprout className="w-12 h-12" />
            <div>
              <h1 className="text-3xl text-white">SmartLivestock</h1>
              <p className="text-white/90">Batangas</p>
            </div>
          </div>
          <h2 className="text-2xl mb-4 text-white">AI-Driven Livestock Information & Production Analytics System</h2>
          <p className="text-white/90 mb-6">
            Comprehensive livestock management for Padre Garcia, Batangas. 
            Track cattle inventory, monitor health, analyze production, and receive AI-powered insights.
          </p>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-white rounded-full mt-1.5"></div>
              <p className="text-white/90">Real-time livestock tracking and health monitoring</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-white rounded-full mt-1.5"></div>
              <p className="text-white/90">GIS mapping with disease heat maps</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-white rounded-full mt-1.5"></div>
              <p className="text-white/90">Predictive analytics and AI recommendations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="bg-white p-8 md:p-12 md:w-1/2 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">
          <h2 className="text-2xl mb-2">Welcome Back</h2>
          <p className="text-gray-600 mb-8">Sign in to access your dashboard</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D5A27] text-white py-3 rounded-lg hover:bg-[#3d7234] transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2D5A27] text-white py-3 rounded-lg hover:bg-[#3d7234] transition-colors disabled:opacity-50"
              onClick={() => router.push('/farmer-registration')}
            >
              {loading ? 'Signing in...' : 'Register'}
            </button>
          </form>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm mb-2">Demo Accounts:</p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Admin/LGU: <span className="text-[#2D5A27]">admin@padregarcia.gov.ph</span></li>
              <li>• Farmer: <span className="text-[#2D5A27]">farmer@example.com</span></li>
              <li>• DA Official: <span className="text-[#2D5A27]">da@da.gov.ph</span></li>
              <li className="pt-2 text-xs">Password: any</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}