'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { Sprout, TrendingUp, AlertTriangle, Package, Bell, Plus } from 'lucide-react';

export default function FarmerDashboard() {
  const router = useRouter();

  const myStats = [
    { label: 'My Cattle', value: '24', icon: Sprout, color: 'bg-[#2D5A27]' },
    { label: 'Avg. Daily Milk', value: '18.5L', icon: TrendingUp, color: 'bg-blue-600' },
    { label: 'Active Alerts', value: '1', icon: AlertTriangle, color: 'bg-[#D32F2F]' },
    { label: 'This Month Sales', value: '₱45,600', icon: Package, color: 'bg-green-600' },
  ];

  const recentAlerts = [
    {
      id: 1,
      type: 'warning',
      title: 'Vaccination Due',
      message: 'Annual vaccination scheduled for 5 cattle on April 30, 2026',
      date: '2 days ago',
    },
    {
      id: 2,
      type: 'info',
      title: 'Production Report',
      message: 'Your monthly milk production increased by 5%',
      date: '1 week ago',
    },
  ];

  const recentActivities = [
    { id: 1, action: 'Logged milk production', value: '450L', date: 'Today, 8:00 AM' },
    { id: 2, action: 'Updated cattle weight', value: 'Cattle #B-042', date: 'Yesterday' },
    { id: 3, action: 'Recorded birth', value: 'New calf - Female', date: '3 days ago' },
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>
      
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-[#2D5A27] text-white p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl mb-1 text-white">Welcome, Juan!</h1>
                <p className="text-white/90">San Roque, Padre Garcia</p>
              </div>
              <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                <Bell className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {myStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <div className={`${stat.color} text-white p-2 rounded-lg inline-block mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-xl mb-1">{stat.value}</p>
                  <p className="text-xs text-gray-600">{stat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 className="mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/livestock-inventory')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-[#2D5A27] hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-8 h-8 text-[#2D5A27]" />
                <span className="text-sm text-center">Add Livestock</span>
              </button>
              
              <button
                onClick={() => router.push('/production-logger')}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-lg hover:border-[#2D5A27] hover:bg-gray-50 transition-colors"
              >
                <Package className="w-8 h-8 text-[#2D5A27]" />
                <span className="text-sm text-center">Log Production</span>
              </button>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3>Recent Alerts</h3>
              <button
                onClick={() => router.push('/alerts')}
                className="text-sm text-[#2D5A27] hover:underline"
              >
                View All
              </button>
            </div>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.type === 'warning'
                      ? 'bg-yellow-50 border-yellow-500'
                      : 'bg-blue-50 border-blue-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="mb-1">{alert.title}</h4>
                      <p className="text-sm text-gray-600">{alert.message}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{alert.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <div className="w-2 h-2 bg-[#2D5A27] rounded-full mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm mb-1">{activity.action}</p>
                    <p className="text-sm text-[#2D5A27]">{activity.value}</p>
                  </div>
                  <p className="text-xs text-gray-500">{activity.date}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button onClick={() => router.push('/farmer')} className="flex flex-col items-center gap-1 text-[#2D5A27]">
            <Sprout className="w-6 h-6" />
            <span className="text-xs">Home</span>
          </button>
          <button onClick={() => router.push('/livestock-inventory')} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27]">
            <Package className="w-6 h-6" />
            <span className="text-xs">Inventory</span>
          </button>
          <button onClick={() => router.push('/production-logger')} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27]">
            <TrendingUp className="w-6 h-6" />
            <span className="text-xs">Logger</span>
          </button>
          <button onClick={() => router.push('/alerts')} className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#2D5A27] relative">
            <Bell className="w-6 h-6" />
            <span className="text-xs">Alerts</span>
            <span className="absolute top-0 right-2 w-2 h-2 bg-[#D32F2F] rounded-full"></span>
          </button>
        </div>
      </nav>
    </div>
  );
}