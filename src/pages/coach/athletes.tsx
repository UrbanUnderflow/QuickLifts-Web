import React, { useState, useEffect } from 'react';
import { useUser } from '../../hooks/useUser';
import PageHead from '../../components/PageHead';
import CoachLayout from '../../components/CoachLayout';
import { 
  FaSearch, 
  FaFilter, 
  FaPlus, 
  FaEye, 
  FaEdit,
  FaTrash,
  FaChartLine,
  FaCalendarAlt,
  FaBell,
  FaDownload
} from 'react-icons/fa';

interface Athlete {
  id: string;
  name: string;
  email: string;
  joinedDate: string;
  lastActive: string;
  status: 'active' | 'inactive' | 'pending';
  workoutsCompleted: number;
  currentStreak: number;
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
}

const CoachAthletes: React.FC = () => {
  const currentUser = useUser();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [filteredAthletes, setFilteredAthletes] = useState<Athlete[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [loading, setLoading] = useState(true);

  // Mock data for initial implementation
  useEffect(() => {
    const mockAthletes: Athlete[] = [
      {
        id: '1',
        name: 'Sarah Johnson',
        email: 'sarah.j@email.com',
        joinedDate: '2024-01-15',
        lastActive: '2 hours ago',
        status: 'active',
        workoutsCompleted: 45,
        currentStreak: 7,
        subscriptionStatus: 'active'
      },
      {
        id: '2',
        name: 'Mike Chen',
        email: 'mike.chen@email.com',
        joinedDate: '2024-01-10',
        lastActive: '1 day ago',
        status: 'active',
        workoutsCompleted: 32,
        currentStreak: 3,
        subscriptionStatus: 'active'
      },
      {
        id: '3',
        name: 'Emma Davis',
        email: 'emma.davis@email.com',
        joinedDate: '2024-01-08',
        lastActive: '3 days ago',
        status: 'inactive',
        workoutsCompleted: 28,
        currentStreak: 0,
        subscriptionStatus: 'past_due'
      },
      {
        id: '4',
        name: 'Alex Rodriguez',
        email: 'alex.r@email.com',
        joinedDate: '2024-01-20',
        lastActive: '5 hours ago',
        status: 'active',
        workoutsCompleted: 18,
        currentStreak: 4,
        subscriptionStatus: 'active'
      },
      {
        id: '5',
        name: 'Jessica Kim',
        email: 'jessica.kim@email.com',
        joinedDate: '2024-01-25',
        lastActive: 'Never',
        status: 'pending',
        workoutsCompleted: 0,
        currentStreak: 0,
        subscriptionStatus: 'active'
      }
    ];

    setAthletes(mockAthletes);
    setFilteredAthletes(mockAthletes);
    setLoading(false);
  }, []);

  // Filter athletes based on search and status
  useEffect(() => {
    let filtered = athletes;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(athlete => 
        athlete.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        athlete.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(athlete => athlete.status === statusFilter);
    }

    setFilteredAthletes(filtered);
  }, [athletes, searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400';
      case 'inactive': return 'bg-red-500/10 text-red-400';
      case 'pending': return 'bg-yellow-500/10 text-yellow-400';
      default: return 'bg-zinc-700 text-zinc-400';
    }
  };

  const getSubscriptionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400';
      case 'past_due': return 'bg-orange-500/10 text-orange-400';
      case 'canceled': return 'bg-red-500/10 text-red-400';
      default: return 'bg-zinc-700 text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading athletes...</div>
      </div>
    );
  }

  return (
    <>
      <PageHead 
        metaData={{
          pageId: "coach-athletes",
          pageTitle: "Manage Athletes - Coach Dashboard",
          metaDescription: "View and manage your athletes, track their progress, and grow your coaching business.",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/coach/athletes"
      />
      
      <CoachLayout>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white">Athletes</h1>
                  <p className="text-zinc-400 mt-2">
                    Manage your {athletes.length} athletes and track their progress
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors">
                    <FaDownload className="h-4 w-4" />
                    Export
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#d0ee00] transition-colors">
                    <FaPlus className="h-4 w-4" />
                    Add Athlete
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Total Athletes</p>
                    <p className="text-2xl font-bold text-white">{athletes.length}</p>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <FaChartLine className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Active</p>
                    <p className="text-2xl font-bold text-white">
                      {athletes.filter(a => a.status === 'active').length}
                    </p>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <FaChartLine className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Pending</p>
                    <p className="text-2xl font-bold text-white">
                      {athletes.filter(a => a.status === 'pending').length}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-lg">
                    <FaCalendarAlt className="h-6 w-6 text-yellow-400" />
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm">Avg Workouts</p>
                    <p className="text-2xl font-bold text-white">
                      {Math.round(athletes.reduce((sum, a) => sum + a.workoutsCompleted, 0) / athletes.length)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <FaChartLine className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Filters and Search */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-8">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search athletes by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] transition-colors"
                  />
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-2">
                  <FaFilter className="text-zinc-400 h-4 w-4" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-[#E0FE10] transition-colors"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Athletes Table */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-800">
                    <tr>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Athlete</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Status</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Workouts</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Streak</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Last Active</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Subscription</th>
                      <th className="text-left py-4 px-6 text-zinc-300 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAthletes.map((athlete, index) => (
                      <tr key={athlete.id} className={index % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-800/50'}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#E0FE10] to-green-400 rounded-full flex items-center justify-center">
                              <span className="text-black font-semibold text-sm">
                                {athlete.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <p className="text-white font-medium">{athlete.name}</p>
                              <p className="text-zinc-400 text-sm">{athlete.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(athlete.status)}`}>
                            {athlete.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-white font-medium">{athlete.workoutsCompleted}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-white font-medium">{athlete.currentStreak} days</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-zinc-400">{athlete.lastActive}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSubscriptionStatusColor(athlete.subscriptionStatus)}`}>
                            {athlete.subscriptionStatus}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors" title="View Details">
                              <FaEye className="h-4 w-4 text-zinc-400 hover:text-white" />
                            </button>
                            <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors" title="Send Message">
                              <FaBell className="h-4 w-4 text-zinc-400 hover:text-white" />
                            </button>
                            <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors" title="Schedule Session">
                              <FaCalendarAlt className="h-4 w-4 text-zinc-400 hover:text-white" />
                            </button>
                            <button className="p-2 hover:bg-zinc-700 rounded-lg transition-colors" title="Edit">
                              <FaEdit className="h-4 w-4 text-zinc-400 hover:text-white" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredAthletes.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-zinc-400 text-lg">No athletes found</p>
                  <p className="text-zinc-500 text-sm mt-2">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your search or filters' 
                      : 'Add your first athlete to get started'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CoachLayout>
    </>
  );
};

export default CoachAthletes;
