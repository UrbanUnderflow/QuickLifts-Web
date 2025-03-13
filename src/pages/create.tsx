import React from 'react';
import Head from 'next/head';
import Create from '../components/App/RootScreens/Create';
import Footer from '../components/Footer/Footer';

const CreatePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-900 text-white">
      <Head>
        <title>Create Exercise | QuickLifts</title>
        <meta name="description" content="Create and share your exercise videos with the QuickLifts community" />
      </Head>
      
      <main className="flex-grow">
        <Create />
      </main>
      
    </div>
  );
};

export default CreatePage; 