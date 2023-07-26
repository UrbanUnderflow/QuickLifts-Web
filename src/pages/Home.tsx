import React from 'react';
const Home = () => (
  <div className="h-screen overflow-hidden relative flex flex-col" style={{backgroundColor: '#192126'}}>
    <div className="relative z-20 h-screen flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white bg-opacity-50 p-10 rounded shadow-lg w-1/3 space-y-6 text-left ml-20" style={{color: '#E0FE10'}}>
        <h1 className="text-4xl font-bold">QuickLifts - Your Personal Gym Guide</h1>
        <p className="text-lg">
          Welcome to QuickLifts, the ultimate guide for your gym workouts. Powered by AI, our app provides personalized workout plans to help you reach your fitness goals in 40 minutes. Start your fitness journey with us and make every minute count.
          <br />
          Available now on the App Store and Play Store!
        </p>
        <a href="mailto:quickliftsapp@gmail.com">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold my-8 py-2 px-4 rounded">Contact us</button>
        </a>
      </div>
    </div>
    <footer className="absolute bottom-0 z-20 w-full h-20 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="text-white text-center space-y-2">
        <p>© {new Date().getFullYear()} QuickLifts. All rights reserved.</p>
        <div className="flex justify-center space-x-4">
          <a href="/terms" className="text-blue-400 hover:text-blue-600">Terms of Use</a>
          <a href="/privacyPolicy" className="text-blue-400 hover:text-blue-600">Privacy Policy</a>
        </div>
      </div>
    </footer>
  </div>
);


export default Home;
