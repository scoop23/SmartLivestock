'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MobileNav from "@/app/components/mobilenav";
import { Sidebar } from "@/app/components/sidebar";
import { PageHeader } from "@/app/components/page-header";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Syringe,
  Bug,
  Sprout,
  Milk,
  Bell,
  ArrowRight
} from 'lucide-react';


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
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <PageHeader
          title="Program Scheduling"
          subtitle="Book slots for active MAO programs"
          icon={<Calendar className="h-7 w-7" />}
          variant="farmer"
          maxWidthClass="max-w-4xl"
          mobileMenuOffset={false}
          action={maoNotifications.some(n => n.isNew) ? (
            <div className="flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1 text-xs font-black text-white animate-pulse">
              <Bell className="h-3 w-3" /> NEW PROGRAMS OPEN
            </div>
          ) : null}
        />

        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">

          {/* STEP 1: SELECT FROM MAO ANNOUNCEMENTS */}
          <section className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
              <div className="bg-green-100 p-2 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-[#2D5A27]" />
              </div>
              Schedule Your Appointment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Date Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">1. Select Available Date</label>
                <div className="space-y-2">
                  {maoNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => setSelectedDate(notif.date)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedDate === notif.date
                        ? 'border-[#2D5A27] bg-green-50 ring-2 ring-[#2D5A27]/10'
                        : 'border-gray-100 hover:border-gray-300'
                        }`}
                    >
                      <p className="font-bold text-gray-800">{notif.date}</p>
                      {notif.isNew && <span className="text-[9px] text-orange-600 font-bold uppercase tracking-tighter">Just Announced</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Program Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">2. Select Program</label>
                <div className="space-y-2">
                  {selectedDate ? (
                    availableProgramsForDate.map((prog) => (
                      <button
                        key={prog}
                        onClick={() => setSelectedProgram(prog)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${selectedProgram === prog
                          ? 'border-[#2D5A27] bg-green-50'
                          : 'border-gray-100 hover:border-gray-300'
                          }`}
                      >
                        <p className="font-bold text-gray-700 text-sm">{prog}</p>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 border border-dashed rounded-xl text-center">
                      <p className="text-xs text-gray-400 italic">Select a date first</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">3. Preferred Time</label>
                <select
                  disabled={!selectedProgram}
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full bg-gray-50 border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#2D5A27] disabled:opacity-40"
                >
                  <option value="">Choose Time</option>
                  <option value="08:00 AM">08:00 AM</option>
                  <option value="09:30 AM">09:30 AM</option>
                  <option value="11:00 AM">11:00 AM</option>
                  <option value="01:30 PM">01:30 PM</option>
                </select>

                <button
                  onClick={handleBook}
                  disabled={!selectedTime}
                  className="w-full bg-[#2D5A27] text-white font-bold py-4 rounded-xl mt-4 shadow-lg hover:shadow-xl hover:bg-[#1e3d1a] transition-all disabled:bg-gray-200"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          </section>

          {/* MY SCHEDULED APPOINTMENTS */}
          <section className="space-y-4">
            <h3 className="font-bold text-gray-800 px-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2D5A27]" />
              My Schedule
            </h3>

            {myAppointments.map((apt) => (
              <div key={apt.id} className="bg-white p-5 rounded-2xl border border-gray-200 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${apt.status === 'upcoming' ? 'bg-green-50 text-[#2D5A27]' : 'bg-gray-100 text-gray-400'}`}>
                    <Syringe className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800">{apt.program}</h4>
                    <p className="text-xs text-gray-500 font-medium">{apt.date} • {apt.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${apt.status === 'upcoming' ? 'bg-[#2D5A27] text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                    {apt.status}
                  </span>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
