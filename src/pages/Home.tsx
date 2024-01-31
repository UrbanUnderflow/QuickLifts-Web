import React, { useState, useEffect } from 'react';

type CountdownTimerProps = {
  targetDate: string;
  onCountdownEnd: () => void;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate, onCountdownEnd }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };

    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    if (timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0) {
      onCountdownEnd();
      clearTimeout(timer);
    }

    return () => clearTimeout(timer);
  });

  return (
    <div className="countdown-timer" style={{
      backgroundColor: '#141A1E',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'Poppins, sans-serif'
    }}>
      <div style={{
        position: 'absolute', // Positioning it absolutely to sit on top of the page
        top: 0, // At the top of the page
        width: '100%', // Take the full width to center content
        display: 'flex',
        justifyContent: 'center', // Center the logo horizontally
        padding: '20px' // Add some space from the top of the page
      }}>
        <img src="logo.png" alt="Logo" style={{ height: '50px' }} /> {/* Adjust the height as needed */}
      </div>
      <div style={{
    display: 'flex', // This will align the text side by side
    alignItems: 'baseline' // Align the text baselines for consistent typography
  }}>
    <div style={{
        color: '#FFF',
        fontSize: '70px',
        fontWeight: 600,
        lineHeight: '140%', // This will be approximately 98px if the font-size is 70px
      }}>
        Beat Your
      </div>
      <span style={{width: '12px'}}></span>
      <div style={{
        color: '#E0FE10',
        fontSize: '70px',
        fontWeight: 600,
        lineHeight: '140%',
        marginTop: '1rem', // Add space between the text and the timer if needed
      }}>Best.</div>
  </div>
  <div style={{
        color: '#E0FE10',
        fontSize: '30px',
        fontWeight: 600,
        lineHeight: '140%',
        marginTop: '1rem', // Add space between the text and the timer if needed
      }}>   
      {Object.keys(timeLeft).length !== 0 ? (
          <>
            <span>{timeLeft.days}d </span>
            <span>{timeLeft.hours}h </span>
            <span>{timeLeft.minutes}m </span>
            <span>{timeLeft.seconds}s </span>
          </>
        ) : (
          <span>Time's up!</span>
        )}
        </div>

        {/* Sign up button */}
      <div style={{
        position: 'absolute', // Positioning it absolutely
        bottom: '20px', // At the bottom of the page
        width: '100%', // Take the full width to center content
        display: 'flex',
        justifyContent: 'center', // Center the button horizontally
      }}>
        <button onClick={showModal} style={{
          color: '#E0FE10', // Text color for the button
          fontSize: '16px',
          fontWeight: 'bold',
          padding: '10px 20px',
          borderRadius: '5px',
          border: 'none',
          cursor: 'pointer'
        }}>
          Sign Up for Mailing List
        </button>
      </div>


      {/* Subscription Modal */}
      {isModalVisible && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2,
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '5px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Iframe subscription form */}
            <iframe 
            title="subscription-form"
            width="400" 
            height="500" 
            src="https://edf11d78.sibforms.com/serve/MUIFALiEary2ZXCVrBvCVaN0IfIQerywK9ZIvBKZnz62QZP2zzrxODvbmXFcCs8uRTCgRn9YDWJfxQQGQipCXNYGXyfksg07HVIswd8YZoo4k_9nPashsKsHJE7JhMFnF6GNZNB32XGi8qJFKt88EaYYhcaNruIqt_MNjthGr1GUdshzbF1Mcp_zhwDNMGqSweQuM-GLr6XknnBx" 
            frameBorder="0" 
            allowFullScreen 
            style={{ display: 'block', margin: 'auto', maxWidth: '100%' }}>
            </iframe>

            {/* Close button */}
            <button onClick={hideModal} style={{
              marginTop: '10px',
              // Style your button as needed
            }}>
              Close
            </button>
          </div>
        </div>
      )}
      </div>      
  );

};

const Home = () => {
  const [showHomePage, setShowHomePage] = useState(false);

  return (
    <div className="home">
      {showHomePage ? (
        <div className="h-screen overflow-hidden relative flex flex-col"
              style={{backgroundColor: '#141A1E'}}>
          <div className="pt-10 px-6 sm:px-24 flex justify-between">
            <div className="flex items-center text-white font-bold">
              <img src="/pulse-logo.png" alt="Pulse Logo" className="h-12" />
            </div>
            <div className="text-white font-bold">
              <a href="mailto:pulsefitnessapp@gmail.com" className="text-white">Contact Us</a>
            </div>
          </div>
      
          <div className="flex flex-col sm:flex-row p-6 sm:p-20">
            <div className="sm:pl-48 pt-10 font-bold text-white text-4xl sm:text-5xl">
              Beat Your Best,<br />Share Your Victory<br />
              <div className="mt-10">
                <button className="px-8 py-2 h-12 text-sm bg-[#E0FE10] text-black font-bold rounded">
                  Download Now
                </button>
              </div>
            </div>
            <div className="mt-10 sm:mt-0">
              <img src="/pulse-phone-mobile.png" alt="Phone Mobile" className="w-full md:hidden h-auto" />
              <img src="/pulse-phone.png" alt="Phone" className="hidden md:block w-full md:w-[700px] h-auto" />
            </div>
          </div>
      
          <footer className="absolute bottom-0 z-20 w-full h-20 bg-black flex items-center justify-center">
            <div className="text-white text-center space-y-2">
              <p>© {new Date().getFullYear()} Pulse Fitness. All rights reserved.</p>
              <div className="flex justify-center space-x-4">
                <a href="/terms" className="text-blue-400 hover:text-blue-600">Terms of Use</a>
                <a href="/privacy" className="text-blue-400 hover:text-blue-600">Privacy Policy</a>
              </div>
            </div>
          </footer>
        </div>
      ) : (
        <div className="countdown-page">
        <CountdownTimer
          targetDate="2024-02-12T00:00:00"
          onCountdownEnd={() => setShowHomePage(true)}
        />
      </div>
      )}

    </div>
);

}

export default Home;

