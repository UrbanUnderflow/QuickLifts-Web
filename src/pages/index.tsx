import React, { useEffect, useState } from 'react';
import type { GetStaticProps, NextPage } from 'next';
import PageHead from '../components/PageHead';
import ProductPortfolioHome from '../components/home/ProductPortfolioHome';
import HomeContent from '../components/home/HomeContent';
import { PulseCheckWaitlistForm } from '../components/PulseCheckWaitlistForm';
import MacraMarketingLanding from '../components/macra/MacraMarketingLanding';
import PulseCheckMarketingLanding from '../components/pulsecheck/PulseCheckMarketingLanding';
import { adminMethods } from '../api/firebase/admin/methods';
import { PageMetaData as FirestorePageMetaData } from '../api/firebase/admin/types';
import { useUser } from '../hooks/useUser';

interface SerializablePageMetaData extends Omit<FirestorePageMetaData, 'lastUpdated'> {
  lastUpdated: string;
}

interface HomePageProps {
  metaData: SerializablePageMetaData | null;
}

const STORAGE_KEY = 'pulse_has_seen_marketing';
const MACRA_HOSTS = new Set(['eatwithmacra.ai', 'www.eatwithmacra.ai']);
const PULSECHECK_HOSTS = new Set(['pulsecheckmind.ai', 'www.pulsecheckmind.ai']);
const MACRA_OG_IMAGE = '/macra-og.png';
const MACRA_APP_STORE_ID = '6463771067';
const PULSECHECK_OG_IMAGE = '/pulsecheck-og.png';

const HomePage: NextPage<HomePageProps> = ({ metaData }) => {
  const currentUser = useUser();
  const [showMarketing, setShowMarketing] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isMacraHost, setIsMacraHost] = useState(() => (
    typeof window !== 'undefined' && MACRA_HOSTS.has(window.location.hostname.toLowerCase())
  ));
  const [isPulseCheckHost, setIsPulseCheckHost] = useState(() => (
    typeof window !== 'undefined' && PULSECHECK_HOSTS.has(window.location.hostname.toLowerCase())
  ));
  const [isPulseCheckWaitlistOpen, setIsPulseCheckWaitlistOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase();
      setIsMacraHost(MACRA_HOSTS.has(hostname));
      setIsPulseCheckHost(PULSECHECK_HOSTS.has(hostname));
    }
  }, []);

  useEffect(() => {
    if (isMacraHost || isPulseCheckHost) {
      setIsLoading(false);
      return;
    }

    const hasSeenMarketing = localStorage.getItem(STORAGE_KEY);

    if (!currentUser) {
      localStorage.removeItem(STORAGE_KEY);
      setShowMarketing(true);
      setIsSignInModalOpen(false);
    } else if (hasSeenMarketing === 'true') {
      setShowMarketing(false);
    } else {
      setShowMarketing(true);
    }

    setIsLoading(false);
  }, [currentUser, isMacraHost, isPulseCheckHost]);

  const handleUseWebApp = () => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setShowMarketing(false);
      return;
    }

    setIsSignInModalOpen(true);
  };

  const handleBackToMarketing = () => {
    localStorage.removeItem(STORAGE_KEY);
    setShowMarketing(true);
  };

  if (isMacraHost) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'macra',
            pageTitle: 'Macra — Scan any food. Get your macros instantly.',
            metaDescription:
              'Macra turns any meal into a complete macro breakdown in seconds. Nora builds your daily meal plan around your exact targets. From Pulse Intelligence Labs.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://eatwithmacra.ai"
          pageOgImage={MACRA_OG_IMAGE}
          appleItunesAppId={MACRA_APP_STORE_ID}
          appleItunesAppArgument=""
        />
        <MacraMarketingLanding />
      </>
    );
  }

  if (isPulseCheckHost) {
    return (
      <>
        <PageHead
          metaData={{
            pageId: 'pulse-check',
            pageTitle: 'PulseCheck — The Mental Performance OS for Elite Programs',
            metaDescription:
              'PulseCheck gives coaches real-time readiness signals, intervention tools, and clinical safety nets before it shows on the scoreboard.',
            lastUpdated: new Date().toISOString(),
          }}
          pageOgUrl="https://pulsecheckmind.ai"
          pageOgImage={PULSECHECK_OG_IMAGE}
        />
        <PulseCheckMarketingLanding
          onJoinWaitlist={() => setIsPulseCheckWaitlistOpen(true)}
          onOpenWebApp={handleUseWebApp}
          webAppLabel={currentUser ? 'Open App' : 'Log In'}
        />
        <PulseCheckWaitlistForm
          isOpen={isPulseCheckWaitlistOpen}
          onClose={() => setIsPulseCheckWaitlistOpen(false)}
          userType="athlete"
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!currentUser || showMarketing) {
    return (
      <ProductPortfolioHome
        metaData={metaData}
        onUseWebApp={handleUseWebApp}
        isSignInModalOpen={isSignInModalOpen}
        setIsSignInModalOpen={setIsSignInModalOpen}
        isAuthenticated={Boolean(currentUser)}
      />
    );
  }

  return (
    <div className="relative h-screen">
      <HomeContent onAbout={handleBackToMarketing} />
    </div>
  );
};

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  try {
    const metaData = await adminMethods.getPageMetaData('index');

    if (metaData) {
      const serializedMetaData: SerializablePageMetaData = {
        ...metaData,
        lastUpdated: metaData.lastUpdated.toString(),
      };

      return {
        props: {
          metaData: serializedMetaData,
        },
        revalidate: 3600,
      };
    }

    return {
      props: {
        metaData: null,
      },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('Error fetching meta data:', error);

    return {
      props: {
        metaData: null,
      },
      revalidate: 3600,
    };
  }
};

export default HomePage;
