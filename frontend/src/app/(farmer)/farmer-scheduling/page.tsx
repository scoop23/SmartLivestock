'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from "@/app/components/page-header";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Syringe,
  Bell,
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


// This would normally come from your database/API
// It represents the data the MAO sent out
interface MaoBroadcast {
  id: string;
  date: string;
  programs: string[];
  isNew: boolean;
}

export default function FarmerSchedulingPage() {
  const router = useRouter();

  // 1. DATA FROM MAO: This is what the MAO "Notified" the farmer about
  const [maoNotifications, setMaoNotifications] = useState<MaoBroadcast[]>([
    { id: '1', date: '2026-04-28', programs: ['Vaccination', 'Deworming'], isNew: true },
    { id: '2', date: '2026-04-30', programs: ['Agricultural Assistance'], isNew: false },
  ]);

  const [myAppointments, setMyAppointments] = useState([
    { id: 'a1', date: '2026-04-21', time: '08:30 AM', program: 'Vaccination', status: 'completed' }
  ]);

  // Form States
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Find the programs for the selected date
  const availableProgramsForDate = maoNotifications.find(n => n.date === selectedDate)?.programs || [];

  const handleBook = () => {
    if (!selectedDate || !selectedProgram || !selectedTime) return;

    const newApt = {
      id: Math.random().toString(36).substr(2, 9),
      date: selectedDate,
      time: selectedTime,
      program: selectedProgram,
      status: 'upcoming' as const
    };

    setMyAppointments([newApt, ...myAppointments]);
    // Reset Form
    setSelectedDate('');
    setSelectedProgram('');
    setSelectedTime('');
    alert("Booking Confirmed! You are now on the MAO Masterlist.");
  };

  return (
    <>
      <PageHeader
        title="Program Scheduling"
        subtitle="Book slots for active MAO programs"
        icon={<Calendar className="h-7 w-7" />}
        variant="farmer"
        maxWidthClass="max-w-5xl"
        mobileMenuOffset={false}
        action={maoNotifications.some(n => n.isNew) ? (
          <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0 animate-pulse gap-1">
            <Bell className="h-3 w-3" /> NEW
          </Badge>
        ) : null}
      />

      <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Schedule Your Appointment */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-[#2D5A27]" />
              </div>
              Schedule Your Appointment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Date Selection */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1. Select Available Date</p>
                <div className="space-y-2">
                  {maoNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => setSelectedDate(notif.date)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        selectedDate === notif.date
                          ? 'border-[#2D5A27] bg-emerald-50'
                          : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-bold text-slate-800">{notif.date}</p>
                      {notif.isNew && (
                        <Badge className="bg-orange-500 hover:bg-orange-500 text-white border-0 mt-1 text-[9px]">
                          Just Announced
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program Selection */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Select Program</p>
                <div className="space-y-2">
                  {selectedDate ? (
                    availableProgramsForDate.map((prog) => (
                      <button
                        key={prog}
                        onClick={() => setSelectedProgram(prog)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          selectedProgram === prog
                            ? 'border-[#2D5A27] bg-emerald-50'
                            : 'border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <p className="font-bold text-slate-700 text-sm">{prog}</p>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl text-center">
                      <p className="text-xs text-slate-400 italic">Select a date first</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3. Preferred Time</p>
                <select
                  disabled={!selectedProgram}
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#2D5A27] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Choose Time</option>
                  <option value="08:00 AM">08:00 AM</option>
                  <option value="09:30 AM">09:30 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="01:30 PM">01:30 PM</option>
                </select>

                <Button
                  onClick={handleBook}
                  disabled={!selectedTime}
                  className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium shadow-sm"
                >
                  Book Appointment
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My Schedule */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2D5A27]" />
            My Schedule
          </h3>

          {myAppointments.map((apt) => (
            <Card key={apt.id} className="border-slate-200 shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    apt.status === 'upcoming' ? 'bg-emerald-50 text-[#2D5A27]' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Syringe className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{apt.program}</h4>
                    <p className="text-xs text-slate-500 font-medium">{apt.date} • {apt.time}</p>
                  </div>
                </div>
                <Badge className={
                  apt.status === 'upcoming'
                    ? 'bg-[#2D5A27] text-white border-0'
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-200 border-0'
                }>
                  {apt.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
