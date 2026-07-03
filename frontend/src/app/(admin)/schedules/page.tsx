'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/app/components/sidebar';
import { PageHeader } from '@/app/components/page-header';
import {
  Calendar,
  Plus,
  Trash2,
  Building2,
  Syringe,
  Bug,
  Sprout,
  Milk,
  ChevronRight,
  CheckCircle2,
  X,
  User,
  Clock,
  Send
} from 'lucide-react';
import MobileNav from '@/app/components/mobilenav';

interface FarmerAppointment {
  id: string;
  farmerName: string;
  program: string;
  time: string;
}

interface DailyProgram {
  date: string;
  programs: string[];
  appointments: FarmerAppointment[];
}

export default function AdminAvailabilityPage() {
  const router = useRouter();

  // Configuration for Activity Types
  const availableActivityTypes = [
    { id: 'vac', name: 'Vaccination', icon: Syringe, color: 'text-orange-600 bg-orange-50' },
    { id: 'dew', name: 'Deworming', icon: Bug, color: 'text-amber-600 bg-amber-50' },
    { id: 'sed', name: 'Agricultural Assistance', icon: Sprout, color: 'text-green-600 bg-green-50' },
    { id: 'mil', name: 'Milking Supervision', icon: Milk, color: 'text-blue-600 bg-blue-50' },
  ];

  // Main Schedule State
  const [scheduleData, setScheduleData] = useState<DailyProgram[]>([
    {
      date: '2026-04-28',
      programs: ['Vaccination', 'Deworming'],
      appointments: [
        { id: '1', farmerName: 'Juan Dela Cruz', program: 'Vaccination', time: '08:30 AM' },
        { id: '2', farmerName: 'Maria Santos', program: 'Deworming', time: '10:00 AM' },
      ]
    },
    {
      date: '2026-04-30',
      programs: ['Agricultural Assistance'],
      appointments: [
        { id: '4', farmerName: 'Elena Vilia', program: 'Agricultural Assistance', time: '09:00 AM' },
      ]
    }
  ]);

  // Form States
  const [selectedDateDetails, setSelectedDateDetails] = useState<DailyProgram | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);

  // Manual Booking States
  const [newFarmerName, setNewFarmerName] = useState('');
  const [selectedProgramForFarmer, setSelectedProgramForFarmer] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Handlers
  const handleAddSchedule = () => {
    if (!selectedDate || selectedPrograms.length === 0) return;

    const existingIndex = scheduleData.findIndex(s => s.date === selectedDate);
    if (existingIndex > -1) {
      const updated = [...scheduleData];
      updated[existingIndex].programs = selectedPrograms;
      setScheduleData(updated);
    } else {
      setScheduleData([...scheduleData, { date: selectedDate, programs: selectedPrograms, appointments: [] }]);
    }

    // Logic Note: In a real app, this is where you'd trigger a 
    // notification to the Farmers' Alert Page.
    alert(`Global Alert Sent: ${selectedPrograms.join(', ')} is now available for ${selectedDate}`);

    setSelectedDate('');
    setSelectedPrograms([]);
  };

  const handleManualBook = () => {
    if (!newFarmerName || !selectedProgramForFarmer || !selectedTime || !selectedDateDetails) return;

    const newAppt: FarmerAppointment = {
      id: Math.random().toString(36).substr(2, 9),
      farmerName: newFarmerName,
      program: selectedProgramForFarmer,
      time: selectedTime,
    };

    const updatedSchedule = scheduleData.map(day => {
      if (day.date === selectedDateDetails.date) {
        return { ...day, appointments: [...day.appointments, newAppt] };
      }
      return day;
    });

    setScheduleData(updatedSchedule);
    setSelectedDateDetails({
      ...selectedDateDetails,
      appointments: [...selectedDateDetails.appointments, newAppt]
    });

    setNewFarmerName('');
    setSelectedProgramForFarmer('');
    setSelectedTime('');
  };

  const removeSchedule = (date: string) => {
    if (confirm("Are you sure you want to delete this schedule window?")) {
      setScheduleData(scheduleData.filter(s => s.date !== date));
    }
  };

  const toggleProgramSelection = (name: string) => {
    setSelectedPrograms(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="lgu" onLogout={() => router.push('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <PageHeader
          title="MAO Admin Console"
          subtitle="Global Program Availability & Farmer Scheduling"
          icon={<Building2 className="h-7 w-7" />}
          variant="admin"
          maxWidthClass="max-w-6xl"
          mobileMenuOffset={false}
        />

        <div className="p-4 md:p-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left: Schedule Window Creation */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-6">
                <Send className="w-5 h-5 text-[#2D5A27]" />
                Broadcast Availability
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Target Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#2D5A27] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Select Programs to Open</label>
                  <div className="grid grid-cols-1 gap-2">
                    {availableActivityTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => toggleProgramSelection(type.name)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${selectedPrograms.includes(type.name)
                            ? 'border-[#2D5A27] bg-green-50'
                            : 'border-gray-100 bg-white hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${type.color}`}>
                            <type.icon className="w-4 h-4" />
                          </div>
                          <span className={`text-sm font-bold ${selectedPrograms.includes(type.name) ? 'text-[#2D5A27]' : 'text-gray-600'}`}>
                            {type.name}
                          </span>
                        </div>
                        {selectedPrograms.includes(type.name) && <CheckCircle2 className="w-5 h-5 text-[#2D5A27]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAddSchedule}
                  disabled={!selectedDate || selectedPrograms.length === 0}
                  className="w-full bg-[#2D5A27] text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-[#1e3d1a] disabled:bg-gray-200 transition-all mt-4"
                >
                  Notify Farmers & Set Available
                </button>
              </div>
            </section>
          </div>

          {/* Right: Active Windows List */}
          <div className="lg:col-span-7">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4 px-2">
              <Calendar className="w-5 h-5 text-[#2D5A27]" />
              Current Schedule Windows
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {scheduleData.length > 0 ? (
                scheduleData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((item) => (
                  <div key={item.date} className="bg-white rounded-2xl border border-gray-200 shadow-sm group">
                    <div className="p-5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="bg-gray-50 p-3 rounded-2xl text-center min-w-[70px]">
                          <p className="text-[10px] font-bold text-gray-400 uppercase">
                            {new Date(item.date).toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-xl font-black text-gray-800">
                            {new Date(item.date).toLocaleDateString('en-US', { day: '2-digit' })}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-[#2D5A27]" />
                            <span className="text-xs font-bold text-gray-700 uppercase">
                              {item.appointments.length} Scheduled
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.programs.map((p) => (
                              <span key={p} className="px-2 py-0.5 bg-green-50 text-[#2D5A27] text-[9px] font-bold rounded border border-green-100 uppercase">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedDateDetails(item)}
                          className="bg-gray-50 text-gray-500 font-bold text-[10px] uppercase px-4 py-2 rounded-lg hover:bg-[#2D5A27] hover:text-white transition-all flex items-center gap-1"
                        >
                          Manage List <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeSchedule(item.date)}
                          className="p-2 text-red-300 hover:text-red-500 rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-2xl p-20 text-center border-2 border-dashed">
                  <p className="text-gray-400 font-bold">No active programs.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DETAILS & MANUAL BOOKING MODAL */}
        {selectedDateDetails && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-[#2D5A27] p-6 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-xl font-bold italic">Schedule Management</h2>
                  <p className="text-white/80 text-sm">Window for: {selectedDateDetails.date}</p>
                </div>
                <button onClick={() => setSelectedDateDetails(null)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-8">
                {/* MANUAL ADDITION FORM */}
                <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl">
                  <h4 className="text-xs font-bold text-blue-800 uppercase mb-4 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Manual Farmer Registration (Walk-in/Call-in)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <input
                        placeholder="Farmer Full Name"
                        value={newFarmerName}
                        onChange={(e) => setNewFarmerName(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <select
                      value={selectedProgramForFarmer}
                      onChange={(e) => setSelectedProgramForFarmer(e.target.value)}
                      className="px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none bg-white"
                    >
                      <option value="">Select Activity</option>
                      {selectedDateDetails.programs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white"
                    />
                    <button
                      onClick={handleManualBook}
                      disabled={!newFarmerName || !selectedProgramForFarmer || !selectedTime}
                      className="md:col-span-2 bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-blue-700 disabled:bg-blue-300 transition-all"
                    >
                      Add Farmer to Masterlist
                    </button>
                  </div>
                </div>

                {/* CURRENT APPOINTMENT LIST */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Confirmed Appointments ({selectedDateDetails.appointments.length})
                    </label>
                  </div>

                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    {selectedDateDetails.appointments.length > 0 ? (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100 text-[10px] uppercase text-gray-400 font-bold">
                          <tr>
                            <th className="px-4 py-3">Farmer</th>
                            <th className="px-4 py-3">Activity</th>
                            <th className="px-4 py-3 text-right">Schedule</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {selectedDateDetails.appointments.map((apt) => (
                            <tr key={apt.id}>
                              <td className="px-4 py-3 font-medium text-gray-700">{apt.farmerName}</td>
                              <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">{apt.program}</td>
                              <td className="px-4 py-3 text-right">
                                <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                                  <Clock className="w-3 h-3" /> {apt.time}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-10 text-center text-gray-400 text-sm">
                        No appointments registered for this window.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex gap-3">
                <button
                  onClick={() => setSelectedDateDetails(null)}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-100 transition-all"
                >
                  Close Manager
                </button>
                <button
                  className="flex-1 bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-all"
                >
                  Cancel All & Broadcast
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
