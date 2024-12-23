import React, { useState } from 'react';
import BottomNav from '../components/App/BottomNav';
import Discover from '../../src/components/App/RootScreens/Discover';
import Search from '../../src/components/App/RootScreens/Search';
import Create from '../../src/components/App/RootScreens/Create';
import Message from '../../src/components/App/RootScreens/Message';
import Profile from '../../src/components/App/RootScreens/Profile';
import { SelectedRootTabs } from '../types/DashboardTypes';

const Dashboard = () => {
  const [selectedTab, setSelectedTab] = useState<SelectedRootTabs>(SelectedRootTabs.Discover);

  // Function to render the selected tab's content
  const renderContent = () => {
    switch (selectedTab) {
      case SelectedRootTabs.Discover:
        return <Discover />;
      case SelectedRootTabs.Search:
        return <Search />;
      case SelectedRootTabs.Create:
        return <Create />;
      case SelectedRootTabs.Message:
        return <Message />;
      case SelectedRootTabs.Profile:
        return <Profile />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Top Navigation */}
      <nav className="px-4 py-4 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-10">
        <img src="/pulse-logo-white.svg" alt="Pulse" className="h-8" />
      </nav>

      {/* Main Content */}
      <div className="max-w-xl mx-auto px-4 py-6">
        {renderContent()}
      </div>

      {/* Bottom Navigation */}
      <BottomNav selectedTab={selectedTab} onTabChange={setSelectedTab} />
    </div>
  );
};

export default Dashboard;