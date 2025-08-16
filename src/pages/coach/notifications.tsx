import React, { useState, useEffect } from 'react';
import PageHead from '../../components/PageHead';
import CoachLayout from '../../components/CoachLayout';
import { 
  FaBell, 
  FaCheck, 
  FaTrash,
  FaFilter,
  FaCheckCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaDollarSign
} from 'react-icons/fa';

interface Notification {
  id: string;
  type: 'athlete' | 'revenue' | 'system' | 'alert';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionRequired?: boolean;
}

const CoachNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'athlete' | 'revenue' | 'system'>('all');
  const [loading, setLoading] = useState(true);

  // Mock data for initial implementation
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: '1',
        type: 'athlete',
        title: 'New Athlete Joined',
        message: 'Jessica Kim has joined your coaching program and completed her first workout.',
        timestamp: '2 hours ago',
        read: false,
        actionRequired: false
      },
      {
        id: '2',
        type: 'revenue',
        title: 'Monthly Payout Processed',
        message: 'Your January payout of $156.80 has been processed and will arrive in 2-3 business days.',
        timestamp: '1 day ago',
        read: false,
        actionRequired: false
      },
      {
        id: '3',
        type: 'athlete',
        title: 'Athlete Needs Attention',
        message: 'Emma Davis hasn\'t logged a workout in 5 days. Consider reaching out to check in.',
        timestamp: '2 days ago',
        read: true,
        actionRequired: true
      },
      {
        id: '4',
        type: 'system',
        title: 'Profile Update Required',
        message: 'Please update your payout information to ensure timely payments.',
        timestamp: '3 days ago',
        read: false,
        actionRequired: true
      },
      {
        id: '5',
        type: 'athlete',
        title: 'Milestone Achievement',
        message: 'Sarah Johnson completed her 50th workout! Send her a congratulations message.',
        timestamp: '1 week ago',
        read: true,
        actionRequired: false
      },
      {
        id: '6',
        type: 'revenue',
        title: 'New Revenue Stream',
        message: 'You earned $12.99 from a new athlete subscription this month.',
        timestamp: '1 week ago',
        read: true,
        actionRequired: false
      }
    ];

    setNotifications(mockNotifications);
    setLoading(false);
  }, []);

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const getNotificationIcon = (type: string, actionRequired?: boolean) => {
    if (actionRequired) {
      return <FaExclamationTriangle className="h-5 w-5 text-orange-400" />;
    }
    
    switch (type) {
      case 'athlete': return <FaCheckCircle className="h-5 w-5 text-blue-400" />;
      case 'revenue': return <FaDollarSign className="h-5 w-5 text-[#E0FE10]" />;
      case 'system': return <FaInfoCircle className="h-5 w-5 text-purple-400" />;
      default: return <FaBell className="h-5 w-5 text-zinc-400" />;
    }
  };

  const getNotificationBorder = (type: string, actionRequired?: boolean) => {
    if (actionRequired) return 'border-l-orange-400';
    
    switch (type) {
      case 'athlete': return 'border-l-blue-400';
      case 'revenue': return 'border-l-[#E0FE10]';
      case 'system': return 'border-l-purple-400';
      default: return 'border-l-zinc-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading notifications...</div>
      </div>
    );
  }

  return (
    <>
      <PageHead 
        title="Notifications - Coach Dashboard"
        description="Stay updated with athlete progress, revenue updates, and important system notifications."
        url="https://fitwithpulse.ai/coach/notifications"
      />
      
      <CoachLayout>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white">Notifications</h1>
                  <p className="text-zinc-400 mt-2">
                    {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      <FaCheck className="h-4 w-4" />
                      Mark All Read
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <FaFilter className="text-zinc-400 h-4 w-4" />
                <span className="text-white font-medium">Filter notifications</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All', count: notifications.length },
                  { key: 'unread', label: 'Unread', count: unreadCount },
                  { key: 'athlete', label: 'Athletes', count: notifications.filter(n => n.type === 'athlete').length },
                  { key: 'revenue', label: 'Revenue', count: notifications.filter(n => n.type === 'revenue').length },
                  { key: 'system', label: 'System', count: notifications.filter(n => n.type === 'system').length }
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === key
                        ? 'bg-[#E0FE10] text-black'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                    }`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications List */}
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-zinc-900 rounded-xl border border-zinc-800 border-l-4 ${getNotificationBorder(notification.type, notification.actionRequired)} ${
                    !notification.read ? 'bg-zinc-800/50' : ''
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-2 bg-zinc-800 rounded-lg">
                          {getNotificationIcon(notification.type, notification.actionRequired)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`font-semibold ${notification.read ? 'text-zinc-300' : 'text-white'}`}>
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-[#E0FE10] rounded-full"></div>
                            )}
                            {notification.actionRequired && (
                              <span className="px-2 py-1 bg-orange-500/10 text-orange-400 text-xs rounded-full">
                                Action Required
                              </span>
                            )}
                          </div>
                          
                          <p className={`text-sm mb-2 ${notification.read ? 'text-zinc-400' : 'text-zinc-300'}`}>
                            {notification.message}
                          </p>
                          
                          <p className="text-zinc-500 text-xs">
                            {notification.timestamp}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Mark as read"
                          >
                            <FaCheck className="h-4 w-4 text-zinc-400 hover:text-white" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                          title="Delete notification"
                        >
                          <FaTrash className="h-4 w-4 text-zinc-400 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredNotifications.length === 0 && (
                <div className="text-center py-12">
                  <div className="p-4 bg-zinc-800 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <FaBell className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-zinc-400 text-lg">No notifications found</p>
                  <p className="text-zinc-500 text-sm mt-2">
                    {filter === 'all' 
                      ? 'You\'re all caught up!' 
                      : `No ${filter} notifications at the moment`
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

export default CoachNotifications;
