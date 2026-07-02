import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/sidebar';
import { Plus, Search, Edit, Trash2, Calendar, Weight } from 'lucide-react';

interface Livestock {
  id: string;
  tagNumber: string;
  type: 'dairy' | 'beef';
  breed: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  weight: number;
  status: 'healthy' | 'sick' | 'pregnant';
  lastVaccination: string;
}

export default function LivestockInventoryPage() {
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [livestock, setLivestock] = useState<Livestock[]>([
    {
      id: '1',
      tagNumber: 'D-089',
      type: 'dairy',
      breed: 'Holstein Friesian',
      gender: 'female',
      dateOfBirth: '2020-05-12',
      weight: 580,
      status: 'healthy',
      lastVaccination: '2026-01-15',
    },
    {
      id: '2',
      tagNumber: 'B-042',
      type: 'beef',
      breed: 'Brahman',
      gender: 'male',
      dateOfBirth: '2021-03-20',
      weight: 450,
      status: 'healthy',
      lastVaccination: '2026-02-10',
    },
    {
      id: '3',
      tagNumber: 'D-128',
      type: 'dairy',
      breed: 'Jersey',
      gender: 'female',
      dateOfBirth: '2019-08-15',
      weight: 520,
      status: 'pregnant',
      lastVaccination: '2025-12-20',
    },
  ]);

  const filteredLivestock = livestock.filter(item =>
    item.tagNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.breed.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteLivestock = (id: string) => {
    if (confirm('Are you sure you want to remove this livestock?')) {
      setLivestock(livestock.filter(item => item.id !== id));
    }
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    const years = today.getFullYear() - birth.getFullYear();
    const months = today.getMonth() - birth.getMonth();
    return `${years}y ${months >= 0 ? months : 12 + months}m`;
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="hidden md:block">
        <Sidebar role="farmer" onLogout={() => navigate('/')} />
      </div>

      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {/* Header */}
        <div className="bg-[#2D5A27] text-white p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl mb-1 text-white">Livestock Inventory</h1>
            <p className="text-white/90">Manage your cattle records</p>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-4xl mx-auto">
          {/* Search and Add */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by tag or breed..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#2D5A27] text-white rounded-lg hover:bg-[#3d7234] transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Cattle</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1">{livestock.length}</p>
              <p className="text-sm text-gray-600">Total Cattle</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1">{livestock.filter(l => l.type === 'dairy').length}</p>
              <p className="text-sm text-gray-600">Dairy</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1">{livestock.filter(l => l.type === 'beef').length}</p>
              <p className="text-sm text-gray-600">Beef</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1">{livestock.filter(l => l.status === 'pregnant').length}</p>
              <p className="text-sm text-gray-600">Pregnant</p>
            </div>
          </div>

          {/* Livestock Cards */}
          <div className="space-y-4">
            {filteredLivestock.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 md:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3>{item.tagNumber}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs ${item.type === 'dairy' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                            }`}
                        >
                          {item.type}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs ${item.status === 'healthy'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'pregnant'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{item.breed} • {item.gender === 'female' ? '♀' : '♂'} {item.gender}</p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Age</p>
                            <p className="text-gray-900">{calculateAge(item.dateOfBirth)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Weight className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Weight</p>
                            <p className="text-gray-900">{item.weight} kg</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Last Vaccination: <span className="text-gray-900">{new Date(item.lastVaccination).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteLivestock(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          <button onClick={() => navigate('/farmer')} className="flex flex-col items-center gap-1 text-gray-600">
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-[#2D5A27]">
            <span className="text-xs">Inventory</span>
          </button>
          <button onClick={() => navigate('/production-logger')} className="flex flex-col items-center gap-1 text-gray-600">
            <span className="text-xs">Logger</span>
          </button>
          <button onClick={() => navigate('/alerts')} className="flex flex-col items-center gap-1 text-gray-600">
            <span className="text-xs">Alerts</span>
          </button>
        </div>
      </nav>

      {/* Add Livestock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4">Add New Cattle</h3>
            <form className="space-y-4">
              <div>
                <label className="block mb-2">Tag Number</label>
                <input
                  type="text"
                  placeholder="e.g., D-090"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block mb-2">Type</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none">
                  <option value="dairy">Dairy</option>
                  <option value="beef">Beef</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Breed</label>
                <input
                  type="text"
                  placeholder="e.g., Holstein Friesian"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block mb-2">Gender</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none">
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Date of Birth</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block mb-2">Weight (kg)</label>
                <input
                  type="number"
                  placeholder="e.g., 580"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={(e) => { e.preventDefault(); setShowAddModal(false); }}
                  className="flex-1 px-4 py-2 bg-[#2D5A27] text-white rounded-lg hover:bg-[#3d7234] transition-colors"
                >
                  Add Cattle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
