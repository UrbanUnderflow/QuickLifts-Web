import React from 'react';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import Head from 'next/head';

interface AdminCardProps {
  title: string;
  description: string;
  icon: string;
  link: string;
}

const AdminCard: React.FC<AdminCardProps> = ({ title, description, icon, link }) => {
  const router = useRouter();
  
  return (
    <div 
      className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden group cursor-pointer"
      onClick={() => router.push(link)}
    >
      {/* Top gradient border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
      
      {/* Left gradient border */}
      <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
      
      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-[#d7ff00]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#262a30] text-[#d7ff00] mr-3 group-hover:scale-110 transition-transform duration-300">
          <i className={icon}></i>
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-gray-400 group-hover:text-gray-300 transition-colors">{description}</p>
      
      {/* Bottom gradient animation on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#40c9ff] to-[#d7ff00] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
    </div>
  );
};

const AdminHome: React.FC = () => {
  const adminFunctions = [
    {
      title: 'App Version Control',
      description: 'Add or manage app versions and force updates',
      icon: 'fas fa-code-branch',
      link: '/admin/addVersion'
    },
    {
      title: 'Challenge Status',
      description: 'View and manage user challenge statuses',
      icon: 'fas fa-trophy',
      link: '/admin/challengestatus'
    },
    {
      title: 'Add Points',
      description: 'Reward users with points for social sharing',
      icon: 'fas fa-coins',
      link: '/admin/addpoints'
    },
    {
      title: 'Inactivity Check',
      description: 'Monitor and trigger workout inactivity notifications',
      icon: 'fas fa-clock',
      link: '/admin/inactivityCheck'
    },
    {
      title: 'Send Notifications',
      description: 'Send push notifications to users',
      icon: 'fas fa-bell',
      link: '/admin/SendNotification'
    },
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: 'fas fa-users',
      link: '/admin/users'
    },
    {
      title: 'Beta Users',
      description: 'Manage beta access and Founding Coaches Program',
      icon: 'fas fa-star',
      link: '/admin/betausers'
    },
    {
      title: 'Metrics Dashboard',
      description: 'View key app metrics like moves, workouts, and rounds.',
      icon: 'fas fa-chart-line',
      link: '/admin/metrics'
    },
    {
      title: 'Press Releases',
      description: 'Manage and generate automated press releases',
      icon: 'fas fa-newspaper',
      link: '/admin/pressReleases'
    }
  ];

  return (
    <AdminRouteGuard>
      <Head>
        <title>Pulse Admin Dashboard</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
              </svg>
            </span>
            Admin Dashboard
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminFunctions.map((func, index) => (
              <AdminCard
                key={index}
                title={func.title}
                description={func.description}
                icon={func.icon}
                link={func.link}
              />
            ))}
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default AdminHome; 