import { useEffect } from 'react';
import Head from 'next/head';

const MorningMobilityRedirect = () => {
  // The OneLink URL provided by the user
  const oneLinkUrl = 'https://fitwithpulse.onelink.me/yffD?pid=user_share&c=round_share&af_referrer_customer_id=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&deep_link_value=round&roundId=Kel8IL0kWpbie4PXRVgZ&id=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&sharedBy=Bq6zlqIlSdPUGki6gsv6X9TdVtG3&af_r=https://fitwithpulse.ai/round-invitation/Kel8IL0kWpbie4PXRVgZ?id%3DBq6zlqIlSdPUGki6gsv6X9TdVtG3%26sharedBy%3DBq6zlqIlSdPUGki6gsv6X9TdVtG3&af_og_title=Morning%20Mobility%20Challenge&af_og_description=Join%20me%20in%20this%20fitness%20challenge%20on%20Pulse!%20%E2%9A%A0%EF%B8%8F%E2%80%8D%E2%99%82%EF%B8%8F%20May%202,%202025%20-%20Jul%2031,%202025&af_og_image=https://fitwithpulse.ai/round-preview.png';

  useEffect(() => {
    // Perform the redirect client-side
    if (typeof window !== 'undefined') {
      window.location.replace(oneLinkUrl);
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Display a fallback message while the redirect is happening
  return (
    <>
      <Head>
        <title>Redirecting to Pulse...</title>
        {/* Optional: Add meta tags if needed, though users won't see this page for long */}
      </Head>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        textAlign: 'center',
        padding: '20px',
        backgroundColor: '#f0f0f0'
      }}>
        <div>
          <p style={{ fontSize: '1.2em', marginBottom: '15px' }}>Redirecting you to the Morning Mobility Challenge...</p>
          <p style={{ color: '#555' }}>
            If the Pulse app doesn't open automatically, please make sure it's installed on your device.
          </p>
          {/* Optional: Add a direct link to the app stores */}
          {/*
          <p style={{ marginTop: '20px' }}>
            <a href="YOUR_APP_STORE_LINK">Download on the App Store</a> | 
            <a href="YOUR_PLAY_STORE_LINK">Get it on Google Play</a>
          </p>
          */}
          {/* Fallback link in case redirect fails completely */}
          <p style={{ marginTop: '30px', fontSize: '0.9em' }}>
            If you are not redirected, <a href={oneLinkUrl} style={{ color: '#007bff' }}>click here</a>.
          </p>
        </div>
      </div>
    </>
  );
};

export default MorningMobilityRedirect; 