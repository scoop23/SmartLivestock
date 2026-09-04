'use client';

import { useState } from 'react';
import { PageHeader } from '@/app/components/page-header';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

interface PendingRecord {
  id: string;
  type: 'slaughter' | 'mortality' | 'birth' | 'sale';
  farmer: string;
  barangay: string;
  details: string;
  date: string;
  status: 'pending' | 'approved' | 'flagged';
}

export default function DataValidationPage() {
  const [filter, setFilter] = useState<'all' | 'slaughter' | 'mortality' | 'birth' | 'sale'>('all');

  const [records, setRecords] = useState<PendingRecord[]>([
    {
      id: '1',
      type: 'slaughter',
      farmer: 'Juan Dela Cruz',
      barangay: 'San Roque',
      details: 'Cattle #B-042 - 350kg beef cattle, dressed weight 210kg',
      date: 'Apr 22, 2026',
      status: 'pending',
    },
    {
      id: '2',
      type: 'mortality',
      farmer: 'Maria Santos',
      barangay: 'Banaba Ibaba',
      details: 'Cattle #D-128 - Dairy cow, age 8 years, cause: suspected FMD',
      date: 'Apr 21, 2026',
      status: 'pending',
    },
    {
      id: '3',
      type: 'birth',
      farmer: 'Pedro Garcia',
      barangay: 'Quilo-quilo',
      details: 'New calf - Female, mother #D-089, healthy condition',
      date: 'Apr 20, 2026',
      status: 'pending',
    },
    {
      id: '4',
      type: 'sale',
      farmer: 'Ana Reyes',
      barangay: 'Castillo',
      details: 'Live cattle sale - 2 heads, 320kg and 340kg, ₱85,000 total',
      date: 'Apr 19, 2026',
      status: 'pending',
    },
    {
      id: '5',
      type: 'slaughter',
      farmer: 'Carlos Mendoza',
      barangay: 'Maugat',
      details: 'Cattle #B-056 - 380kg beef cattle, dressed weight 228kg',
      date: 'Apr 18, 2026',
      status: 'pending',
    },
  ]);

  const filteredRecords = filter === 'all'
    ? records.filter(r => r.status === 'pending')
    : records.filter(r => r.type === filter && r.status === 'pending');

  const approveRecord = (recordId: string) => {
    setRecords(records.map(record =>
      record.id === recordId ? { ...record, status: 'approved' as const } : record
    ));
  };

  const flagRecord = (recordId: string) => {
    setRecords(records.map(record =>
      record.id === recordId ? { ...record, status: 'flagged' as const } : record
    ));
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'slaughter': return 'bg-purple-100 text-purple-800';
      case 'mortality': return 'bg-red-100 text-red-800';
      case 'birth': return 'bg-green-100 text-green-800';
      case 'sale': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <PageHeader
          title="Data Validation Center"
          subtitle="Review and approve farmer-submitted records — Municipal Agriculture Office"
          variant="admin"
        />

        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <p className="text-2xl font-bold">{records.filter(r => r.status === 'pending').length}</p>
              </div>
              <p className="text-sm text-gray-600">Pending Review</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-2xl">{records.filter(r => r.status === 'approved').length}</p>
              </div>
              <p className="text-sm text-gray-600">Approved Today</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <p className="text-2xl">{records.filter(r => r.status === 'flagged').length}</p>
              </div>
              <p className="text-sm text-gray-600">Flagged</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <p className="text-2xl">{records.length}</p>
              </div>
              <p className="text-sm text-gray-600">Total Records</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-wrap gap-2">
              {(['all', 'slaughter', 'mortality', 'birth', 'sale'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-4 py-2 rounded-lg capitalize transition-colors ${filter === type
                    ? 'bg-[#2D5A27] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Records List */}
          <div className="space-y-4">
            {filteredRecords.length === 0 ? (
              <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200 text-center">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="mb-2">All Caught Up!</h3>
                <p className="text-gray-600">No pending records to review at the moment.</p>
              </div>
            ) : (
              filteredRecords.map((record) => (
                <div key={record.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs capitalize ${getTypeColor(record.type)}`}>
                          {record.type}
                        </span>
                        <span className="text-sm text-gray-500">{record.date}</span>
                      </div>
                      <div className="mb-2">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">{record.farmer}</span> • {record.barangay}
                        </p>
                      </div>
                      <p className="text-gray-900">{record.details}</p>
                    </div>
                    <div className="flex md:flex-col gap-2">
                      <button
                        onClick={() => approveRecord(record.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => flagRecord(record.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Flag</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
    </>
  );
}
