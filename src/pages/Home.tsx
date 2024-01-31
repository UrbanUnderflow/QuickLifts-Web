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
    <div className="flex flex-col h-screen bg-[#141A1E] items-center justify-center relative">
      <div className="absolute top-0 w-full flex justify-center pt-5">
        <img src="logo.png" alt="Logo" className="h-12" />
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-baseline">
        <div className="text-white text-6xl sm:text-7xl font-bold leading-none">
          Beat Your
        </div>
        <div className="text-[#E0FE10] text-6xl sm:text-7xl font-bold leading-none ml-3">
          Best.
        </div>
      </div>

      <div className="text-[#E0FE10] text-3xl font-bold mt-5">
        {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </div>

      <div className="absolute bottom-5 w-full flex justify-center">
        <button
          onClick={showModal}
          className="text-[#E0FE10] bg-transparent border border-[#E0FE10] rounded py-2 px-4 font-bold text-lg"
        >
          Sign Up for Mailing List
        </button>
      </div>

      {
  isModalVisible && (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 px-8">
      <div className="bg-white p-2 rounded-lg w-full sm:w-auto sm:max-w-lg">
        <iframe
          title="Subscription Form"
          className="w-full h-full"
          src="https://edf11d78.sibforms.com/serve/MUIFALiEary2ZXCVrBvCVaN0IfIQerywK9ZIvBKZnz62QZP2zzrxODvbmXFcCs8uRTCgRn9YDWJfxQQGQipCXNYGXyfksg07HVIswd8YZoo4k_9nPashsKsHJE7JhMFnF6GNZNB32XGi8qJFKt88EaYYhcaNruIqt_MNjthGr1GUdshzbF1Mcp_zhwDNMGqSweQuM-GLr6XknnBx"
          frameBorder="0"
          allowFullScreen
          style={{ minHeight: '450px' }} // Ensures a minimum height for the content
        ></iframe>
        <button
          onClick={hideModal}
          className="mt-4 bg-[#E0FE10] text-black rounded py-2 px-4 font-bold text-lg"
        >
          Close
        </button>
      </div>
    </div>
  )
}
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

