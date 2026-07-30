'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/app/components/page-header';
import { AlertTriangle, Info, CheckCircle, Bell, Calendar } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  const getAlertBorder = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-red-500 bg-red-50';
      case 'medium': return 'border-l-4 border-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-4 border-blue-500 bg-blue-50';
      default: return 'border-l-4 border-slate-500 bg-slate-50';
    }
  };

  const getIconColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-slate-600';
    }
  };

  const getBadgeClass = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200';
      case 'medium': return 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200';
    }
  };

  return (
    <>
      <PageHeader
        title="Alerts & Notifications"
        subtitle="Important updates and reminders"
        variant="farmer"
        maxWidthClass="max-w-5xl"
        mobileMenuOffset={false}
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 text-[#2D5A27]" />
                <p className="text-2xl font-black text-slate-900">{alerts.length}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Alerts</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <p className="text-2xl font-black text-slate-900">{alerts.filter(a => !a.read).length}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unread</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-5 h-5 text-blue-600" />
                <p className="text-2xl font-black text-slate-900">{alerts.filter(a => a.priority === 'high').length}</p>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">High Priority</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'all', label: 'All Alerts' },
                { value: 'unread', label: 'Unread' },
                { value: 'high', label: 'High Priority' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filter === value
                      ? 'bg-[#2D5A27] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-12 text-center">
                <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 mb-1">No Alerts</h3>
                <p className="text-slate-500">You&apos;re all caught up!</p>
              </CardContent>
            </Card>
          ) : (
            filteredAlerts.map((alert) => {
              const Icon = getAlertIcon(alert.type);
              return (
                <Card
                  key={alert.id}
                  className={`border-slate-200 shadow-sm overflow-hidden ${getAlertBorder(alert.priority)} ${
                    !alert.read ? 'ring-2 ring-[#2D5A27] ring-offset-2' : ''
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Icon className={`w-6 h-6 flex-shrink-0 mt-1 ${getIconColor(alert.priority)}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <h4 className="text-lg font-bold text-slate-900 mb-1">{alert.title}</h4>
                            <div className="flex items-center gap-2">
                              <Badge className={getBadgeClass(alert.priority)}>
                                {alert.priority}
                              </Badge>
                              <span className="text-xs text-slate-400 capitalize">{alert.type}</span>
                            </div>
                          </div>
                          {!alert.read && (
                            <span className="w-3 h-3 bg-[#2D5A27] rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-slate-600 mb-3">{alert.message}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-400">
                            {new Date(alert.date).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          {!alert.read && (
                            <Button
                              variant="link"
                              className="text-sm text-[#2D5A27] font-bold p-0 h-auto"
                              onClick={() => markAsRead(alert.id)}
                            >
                              Mark as read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
