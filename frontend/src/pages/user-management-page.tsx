import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sidebar } from '../components/sidebar';
import { Search, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  barangay: string;
  status: 'active' | 'pending' | 'inactive';
  farmsAssigned: number;
}

export function UserManagementPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [users, setUsers] = useState<User[]>([
    { id: '1', name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'Farmer', barangay: 'San Roque', status: 'active', farmsAssigned: 1 },
    { id: '2', name: 'Maria Santos', email: 'maria@example.com', role: 'Farmer', barangay: 'Banaba Ibaba', status: 'active', farmsAssigned: 2 },
    { id: '3', name: 'Pedro Garcia', email: 'pedro@example.com', role: 'Farmer', barangay: 'Quilo-quilo', status: 'pending', farmsAssigned: 0 },
    { id: '4', name: 'Ana Reyes', email: 'ana@example.com', role: 'Farmer', barangay: 'Castillo', status: 'active', farmsAssigned: 1 },
    { id: '5', name: 'Carlos Mendoza', email: 'carlos@example.com', role: 'Farmer', barangay: 'Maugat', status: 'pending', farmsAssigned: 0 },
  ]);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.barangay.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const approveUser = (userId: string) => {
    setUsers(users.map(user =>
      user.id === userId ? { ...user, status: 'active' as const } : user
    ));
  };

  const deleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(user => user.id !== userId));
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role="lgu" onLogout={() => navigate('/')} />
      
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl mb-1">User Management</h1>
            <p className="text-gray-600">Manage farmer accounts and farm assignments</p>
          </div>
        </div>

        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {/* Search and Add */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or barangay..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#2D5A27] text-white rounded-lg hover:bg-[#3d7234] transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add User</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1">{users.filter(u => u.status === 'active').length}</p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1 text-yellow-600">{users.filter(u => u.status === 'pending').length}</p>
              <p className="text-sm text-gray-600">Pending Approval</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-2xl mb-1">{users.length}</p>
              <p className="text-sm text-gray-600">Total Users</p>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Barangay</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Farms</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p>{user.name}</p>
                          <p className="text-sm text-gray-500">{user.role}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.barangay}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{user.farmsAssigned}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : user.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {user.status === 'pending' && (
                            <button
                              onClick={() => approveUser(user.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Approve User"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="mb-4">Add New User</h3>
            <form className="space-y-4">
              <div>
                <label className="block mb-2">Full Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block mb-2">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block mb-2">Barangay</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none">
                  <option>San Roque</option>
                  <option>Banaba Ibaba</option>
                  <option>Quilo-quilo</option>
                  <option>Castillo</option>
                  <option>Maugat</option>
                </select>
              </div>
              <div>
                <label className="block mb-2">Role</label>
                <select className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D5A27] focus:border-transparent outline-none">
                  <option>Farmer</option>
                  <option>LGU Personnel</option>
                  <option>DA Official</option>
                </select>
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
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
