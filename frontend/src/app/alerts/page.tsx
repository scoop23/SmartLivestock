'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../components/sidebar';
import { PageHeader } from '../components/page-header';
import { AlertTriangle, Info, CheckCircle, Bell, Calendar } from 'lucide-react';
import { Sprout, TrendingUp, Package, } from 'lucide-react';
import MobileNav from '../components/mobilenav';
interface Alert {
  id: string;
  type: 'disease' | 'vaccination' | 'production' | 'mortality';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export default function AlertsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread' | 'high'>('all');

  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: '1',
      type: 'vaccination',
      priority: 'high',
      title: 'Vaccination Due',
      message: 'Annual FMD vaccination scheduled for 5 cattle on April 30, 2026. Please prepare your animals.',
      date: '2026-04-21',
      read: false,
    },
    {
      id: '2',
      type: 'disease',
      priority: 'high',
      title: 'Disease Alert - Banaba Ibaba',
      message: 'Suspected Foot-and-Mouth Disease outbreak reported in neighboring barangay. Monitor your cattle for symptoms: fever, blisters, lameness.',
      date: '2026-04-20',
      read: false,
    },
    {
      id: '3',
      type: 'production',
      priority: 'medium',
      title: 'Production Milestone',
      message: 'Congratulations! Your monthly milk production increased by 5% compared to last month.',
      date: '2026-04-18',
      read: true,
    },
    {
      id: '4',
      type: 'vaccination',
      priority: 'medium',
      title: 'Deworming Schedule',
      message: 'Quarterly deworming recommended for all cattle. Contact MAO for assistance.',
      date: '2026-04-15',
      read: true,
    },
    {
      id: '5',
      type: 'production',
      priority: 'low',
      title: 'Weather Advisory',
      message: 'Hot weather expected next week. Ensure adequate water supply and shade for your cattle.',
      date: '2026-04-14',
      read: true,
    },
  ]);

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'unread') return !alert.read;
    if (filter === 'high') return alert.priority === 'high';
    return true;
  });

  const markAsRead = (alertId: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'disease': return AlertTriangle;
      case 'vaccination': return Calendar;
      case 'production': return Info;
      case 'mortality': return AlertTriangle;
      default: return Bell;
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-red-500 bg-red-50';
      case 'medium': return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-4 border-blue-500 bg-blue-50';
      default: return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  const getIconColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <PageHeader
          title="Alerts & Notifications"
          subtitle="Important updates and reminders"
          variant="farmer"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 text-[#2D5A27]" />
                <p className="text-xl">{alerts.length}</p>
              </div>
              <p className="text-xs text-gray-600">Total Alerts</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-xl">{alerts.filter(a => !a.read).length}</p>
              </div>
              <p className="text-xs text-gray-600">Unread</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-5 h-5 text-blue-600" />
                <p className="text-xl">{alerts.filter(a => a.priority === 'high').length}</p>
              </div>
              <p className="text-xs text-gray-600">High Priority</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'all', label: 'All Alerts' },
                { value: 'unread', label: 'Unread' },
                { value: 'high', label: 'High Priority' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-4 py-2 rounded-lg transition-colors ${filter === value
                      ? 'bg-[#2D5A27] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts List */}
          <div className="space-y-4">
            {filteredAlerts.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="mb-2">No Alerts</h3>
                <p className="text-gray-600">You're all caught up!</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <div
                    key={alert.id}
                    className={`bg-white rounded-lg shadow-sm overflow-hidden ${getAlertColor(alert.priority)} ${!alert.read ? 'ring-2 ring-[#2D5A27]' : ''
                      }`}
                  >
                    <div className="p-6">
                      <div className="flex items-start gap-4">
                        <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${getIconColor(alert.priority)}`} />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="mb-1">{alert.title}</h4>
                              <div className="flex items-center gap-2 mb-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs uppercase ${alert.priority === 'high'
                                      ? 'bg-red-100 text-red-800'
                                      : alert.priority === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                >
                                  {alert.priority}
                                </span>
                                <span className="text-xs text-gray-500 capitalize">{alert.type}</span>
                              </div>
                            </div>
                            {!alert.read && (
                              <span className="inline-block w-3 h-3 bg-[#2D5A27] rounded-full"></span>
                            )}
                          </div>
                          <p className="text-gray-700 mb-3">{alert.message}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                              {new Date(alert.date).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            {!alert.read && (
                              <button
                                onClick={() => markAsRead(alert.id)}
                                className="text-sm text-[#2D5A27] hover:underline"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav />
    </div>
  );
}
