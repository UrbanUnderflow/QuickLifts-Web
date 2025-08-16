import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  FaTachometerAlt, 
  FaUsers, 
  FaDollarSign, 
  FaChartLine,
  FaBell,
  FaCog,
  FaCalendarAlt,
  FaComments
} from 'react-icons/fa';

const CoachNavigation: React.FC = () => {
  const router = useRouter();

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/coach/dashboard',
      icon: FaTachometerAlt,
      current: router.pathname === '/coach/dashboard'
    },
    {
      name: 'Athletes',
      href: '/coach/athletes',
      icon: FaUsers,
      current: router.pathname === '/coach/athletes'
    },
    {
      name: 'Revenue',
      href: '/coach/revenue',
      icon: FaDollarSign,
      current: router.pathname === '/coach/revenue'
    },
    {
      name: 'Analytics',
      href: '/coach/analytics',
      icon: FaChartLine,
      current: router.pathname === '/coach/analytics'
    },
    {
      name: 'Schedule',
      href: '/coach/schedule',
      icon: FaCalendarAlt,
      current: router.pathname === '/coach/schedule'
    },
    {
      name: 'Messages',
      href: '/coach/messages',
      icon: FaComments,
      current: router.pathname === '/coach/messages'
    },
    {
      name: 'Notifications',
      href: '/coach/notifications',
      icon: FaBell,
      current: router.pathname === '/coach/notifications'
    },
    {
      name: 'Settings',
      href: '/coach/settings',
      icon: FaCog,
      current: router.pathname === '/coach/settings'
    }
  ];

  return (
    <nav className="bg-zinc-900 border-r border-zinc-800 w-64 min-h-screen fixed left-0 top-16 z-40">
      <div className="p-6">
        <h2 className="text-white font-semibold text-lg mb-6">Coach Dashboard</h2>
        
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    item.current
                      ? 'bg-[#E0FE10] text-black font-medium'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default CoachNavigation;
