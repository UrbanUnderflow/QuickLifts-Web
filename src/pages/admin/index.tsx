import React from 'react';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import Head from 'next/head';
import { Users, Settings, BarChart2, Bell, FileText, CheckSquare, PlusSquare, Image as ImageIcon, Zap, TrendingUp, Dumbbell, Tag, Users2, Activity, Award, Clock, Gift, Edit3, Send, Server, ChevronDown, MessageCircle, Utensils, Code, Building2, Kanban, Layers, Bug } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { toggleDevMode } from '../../redux/devModeSlice';
import { initializeFirebase } from '../../api/firebase/config';

interface AdminCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
}

const AdminCard: React.FC<AdminCardProps> = ({ title, description, icon, link }) => {
  const router = useRouter();
  
  return (
    <div 
      className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden group cursor-pointer h-full flex flex-col"
      onClick={() => router.push(link)}
    >
      {/* Top gradient border */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
      
      {/* Left gradient border */}
      <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
      
      {/* Hover effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-[#d7ff00]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#262a30] text-[#d7ff00] mr-3 group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="text-gray-400 group-hover:text-gray-300 transition-colors flex-grow">{description}</p>
      
      {/* Bottom gradient animation on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#40c9ff] to-[#d7ff00] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
    </div>
  );
};

const adminCardsData = [
  {
    title: "Subscriptions",
    description: "View subscription records, latest expiration, and sync history.",
    icon: <TrendingUp className="w-5 h-5" />,
    link: "/admin/subscriptions"
  },
  {
    title: "Manage Beta Users",
    description: "View, search, and manage beta user accounts and their status.",
    icon: <Users2 className="w-5 h-5" />,
    link: "/admin/betausers"
  },
  {
    title: "Programming Access Management",
    description: "Manage access requests and permissions for Pulse Programming platform.",
    icon: <Code className="w-5 h-5" />,
    link: "/admin/programmingAccess"
  },
  {
    title: "Project Management",
    description: "Kanban board for tracking development tasks and project progress across todo, in-progress, and done states.",
    icon: <Kanban className="w-5 h-5" />,
    link: "/admin/projectManagement"
  },
  {
    title: "Application Metrics",
    description: "Monitor key application metrics, user engagement, and performance data.",
    icon: <BarChart2 className="w-5 h-5" />,
    link: "/admin/metrics"
  },
  {
    title: "Challenge Managment",
    description: "Oversee and manage ongoing rounds and their statuses.",
    icon: <Award className="w-5 h-5" />,
    link: "/admin/challengestatus"
  },
  {
    title: "User Challenge Management",
    description: "Identify and manage users challenges, checkeck activity, etc.",
    icon: <Clock className="w-5 h-5" />,
    link: "/admin/inactivityCheck"
  },
  {
    title: "Add Points to User",
    description: "Manually add points to a user for specific activities or rewards.",
    icon: <Gift className="w-5 h-5" />,
    link: "/admin/addpoints"
  },
  {
    title: "Referral Award",
    description: "Manually link referrals and award points for missed referral connections.",
    icon: <Users className="w-5 h-5" />,
    link: "/admin/referralAward"
  },
  {
    title: "Press Releases",
    description: "Create, edit, and manage press releases for public announcement.",
    icon: <FileText className="w-5 h-5" />,
    link: "/admin/pressReleases"
  },
  {
    title: "Round Exports",
    description: "View and download creator round plans exported from Build Your Round page.",
    icon: <FileText className="w-5 h-5" />,
    link: "/admin/roundExports"
  },
  {
    title: "Send Notification",
    description: "Send push notifications to users or specific user groups.",
    icon: <Bell className="w-5 h-5" />,
    link: "/admin/SendNotification"
  },
  {
    title: "User Management",
    description: "Comprehensive user management including editing profiles and roles.",
    icon: <Users className="w-5 h-5" />,
    link: "/admin/users"
  },
  {
    title: "Add App Version",
    description: "Manage application versions and update notes for releases.",
    icon: <PlusSquare className="w-5 h-5" />,
    link: "/admin/addVersion"
  },
  {
    title: "Move Management",
    description: "Manage exercises, videos, and the Move of the Day.",
    icon: <Dumbbell className="w-5 h-5" />,
    link: "/admin/MoveManagement"
  },
  {
    title: "Stacks Management",
    description: "Manage workout stacks, view exercises, and track user-created vs AI-generated stacks.",
    icon: <Layers className="w-5 h-5" />,
    link: "/admin/StacksManagement"
  },
  {
    title: "Manage Page Meta Data",
    description: "Control SEO and social sharing tags for application pages.",
    icon: <Tag className="w-5 h-5" />,
    link: "/admin/manageMeta"
  },
  {
    title: "Creator Prospects",
    description: "Track and manage inbound/outbound creator opportunities and onboarding.",
    icon: <Users2 className="w-5 h-5" />,
    link: "/admin/creatorProspects"
  },
  {
    title: "Daily Reflection",
    description: "Create and manage daily reflection prompts for users.",
    icon: <Edit3 className="w-5 h-5" />,
    link: "/admin/dailyReflection"
  },
  {
    title: "Test Check-in Notification",
    description: "Test the check-in callout notification functionality.",
    icon: <Send className="w-5 h-5" />,
    link: "/admin/testCheckinNotification"
  },
  {
    title: "Notification Logs",
    description: "View notification logs and payloads for debugging and monitoring.",
    icon: <Bell className="w-5 h-5" />,
    link: "/admin/NotificationLogs"
  },
  {
    title: "Error Logs",
    description: "View and manage application error logs from Firestore for debugging and monitoring.",
    icon: <Bug className="w-5 h-5" />,
    link: "/admin/ErrorLogs"
  },
  {
    title: "Chat Management",
    description: "View and debug chat data including group messages, direct messages, and chat metadata.",
    icon: <MessageCircle className="w-5 h-5" />,
    link: "/admin/chatManagement"
  },
  {
    title: "Workout Summaries",
    description: "View and search all workout summaries from the root collection with user filtering.",
    icon: <Activity className="w-5 h-5" />,
    link: "/admin/workoutSummaries"
  },
  {
    title: "Generate Meal Macros",
    description: "View and monitor meal macro generation requests from the generateMealMacros collection.",
    icon: <Utensils className="w-5 h-5" />,
    link: "/admin/generateMealMacros"
  },
  {
    title: "Meal Logs Management",
    description: "View and manage all meal logs from the root collection with manual sync functionality.",
    icon: <Utensils className="w-5 h-5" />,
    link: "/admin/mealLogs"
  },
  {
    title: "VC Database",
    description: "Manage venture capital prospects and investor relationships for fundraising.",
    icon: <Building2 className="w-5 h-5" />,
    link: "/admin/vcDatabase"
  },
  {
    title: "Assign Prize Money",
    description: "Add and manage prize money for challenges. Set prize amounts and distribution types.",
    icon: <Award className="w-5 h-5" />,
    link: "/admin/assign-prize-money"
  },
  {
    title: "Corporate Partners",
    description: "Manage corporate partner prospects, track partnerships, and monitor business development opportunities.",
    icon: <Building2 className="w-5 h-5" />,
    link: "/admin/corporatePartners"
  },
  {
    title: "Add User to Challenge",
    description: "Manually add any user to any challenge. Search users and challenges, then create user-challenge relationships.",
    icon: <Users className="w-5 h-5" />,
    link: "/admin/addUserToChallenge"
  },
  {
    title: "Debug User Challenge",
    description: "Debug why users aren't seeing active rounds. Analyze challenge filtering and data issues.",
    icon: <Bug className="w-5 h-5" />,
    link: "/admin/debugUserChallenge"
  }
];

const EnvironmentSwitcher: React.FC = () => {
  const dispatch = useDispatch();
  const isDevelopment = useSelector((state: RootState) => state.devMode.isDevelopment);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  const handleEnvironmentSwitch = (newMode: boolean) => {
    if (newMode === isDevelopment) {
      setIsDropdownOpen(false);
      return; // No change needed
    }

    console.log('[Admin Environment Switch] Switching environment:', {
      from: isDevelopment ? 'development' : 'production',
      to: newMode ? 'development' : 'production',
      isLocalhost,
      source: isLocalhost ? '.env.local' : (newMode ? 'firebaseConfigs' : 'Netlify'),
      timestamp: new Date().toISOString()
    });

    window.localStorage.setItem('devMode', String(newMode));
    dispatch(toggleDevMode());
    initializeFirebase(newMode);
    
    setIsDropdownOpen(false);
    
    // Add a slight delay before reloading to ensure Firebase initialization completes
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-[#1a1e24] text-white hover:bg-[#262a30] transition-colors"
        title={`Currently using ${isDevelopment ? 'development' : 'production'} configuration`}
      >
        <Server className="w-4 h-4" />
        <span className="text-sm font-medium">
          {isDevelopment ? 'Dev Environment' : 'Production Environment'}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full mt-1 right-0 w-64 bg-[#1a1e24] border border-zinc-700 rounded-lg shadow-xl z-20">
            <div className="p-2">
              <button
                onClick={() => handleEnvironmentSwitch(false)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  !isDevelopment 
                    ? 'bg-[#E0FE10] text-black font-medium' 
                    : 'text-zinc-300 hover:bg-[#262a30] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${!isDevelopment ? 'bg-black' : 'bg-zinc-600'}`} />
                  <div>
                    <div className="font-medium">Production</div>
                    <div className="text-xs opacity-75">Live Firebase project</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleEnvironmentSwitch(true)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  isDevelopment 
                    ? 'bg-[#E0FE10] text-black font-medium' 
                    : 'text-zinc-300 hover:bg-[#262a30] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isDevelopment ? 'bg-black' : 'bg-zinc-600'}`} />
                  <div>
                    <div className="font-medium">Development</div>
                    <div className="text-xs opacity-75">Dev Firebase project</div>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="border-t border-zinc-700 p-2">
              <div className="text-xs text-zinc-500 px-3 py-1">
                Config source: {isLocalhost ? '.env.local' : (isDevelopment ? 'firebaseConfigs' : 'Netlify')}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const AdminHome: React.FC = () => {
  return (
    <AdminRouteGuard>
      <Head>
        <title>Pulse Admin Dashboard</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold flex items-center">
              <span className="text-[#d7ff00] mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                  <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
                </svg>
              </span>
              Admin Dashboard
            </h1>
            
            <EnvironmentSwitcher />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminCardsData.map((func, index) => (
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