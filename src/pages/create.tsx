import React from 'react';
import Head from 'next/head';
import Create from '../components/App/RootScreens/Create';
import SideNav from '../components/Navigation/SideNav';
import { SelectedRootTabs } from '../types/DashboardTypes';

const CreatePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>Creator Studio | Pulse</title>
        <meta name="description" content="Build your fitness brand with powerful creator tools" />
      </Head>
      
      {/* Side Navigation */}
      <SideNav selectedTab={SelectedRootTabs.Create} />
      
      {/* Main Content - Add left padding for side nav */}
      <div className="md:ml-20 lg:ml-64 pb-16 md:pb-0">
        <Create />
      </div>
    </div>
  );
};

export default CreatePage; 