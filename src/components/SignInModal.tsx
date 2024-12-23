import React, { useState } from "react";

interface SignInModalProps {
  isVisible: boolean;
  onSignIn: (email: string, password: string) => void;
}

const SignInModal: React.FC<SignInModalProps> = ({ isVisible, onSignIn }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isVisible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSignIn(email, password);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-80 z-50 sm:p-6">
      <div className="bg-zinc-900 w-full h-full sm:h-auto sm:w-[480px] sm:rounded-xl p-6 sm:p-8 
        border-none sm:border sm:border-zinc-700 shadow-xl overflow-y-auto">
        {/* Branding Section */}
        <div className="text-center mb-8 pt-4 sm:pt-0">
          <img 
            src="/pulse-logo.svg" 
            alt="Pulse Logo" 
            className="h-12 mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-white font-['Thunder'] mb-2">Welcome Back!</h2>
          <p className="text-zinc-400 font-['HK Grotesk'] text-sm">
            Beat Your Best, Share Your Victory
          </p>
        </div>
        
        {/* Social Sign-in Buttons */}
        <div className="flex flex-col gap-4 mb-8">
          <button
            type="button"
            className="w-full bg-black text-white font-semibold py-3 px-4 rounded-lg 
              hover:bg-zinc-800 transition-colors font-['HK Grotesk'] border border-zinc-700 
              flex items-center justify-center gap-3"
          >
            <img src="/apple-logo.svg" alt="Apple" className="w-5 h-5" />
            Sign in with Apple
          </button>
          
          <button
            type="button"
            className="w-full bg-white text-black font-semibold py-3 px-4 rounded-lg 
              hover:bg-gray-100 transition-colors font-['HK Grotesk']
              flex items-center justify-center gap-3"
          >
            <img src="/google-logo.svg" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 text-zinc-400 bg-zinc-900">or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
                placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
                focus:ring-[#E0FE10] transition-colors"
              placeholder="Enter your email"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2 font-['HK Grotesk']">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white 
                placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 
                focus:ring-[#E0FE10] transition-colors"
              placeholder="Enter your password"
              required
            />
          </div>

          <div className="flex flex-col gap-4 mt-8">
            <button
              type="submit"
              className="w-full bg-[#E0FE10] text-black font-semibold py-3 px-4 rounded-lg 
                hover:bg-[#c8e60e] transition-colors font-['HK Grotesk']"
            >
              Sign In
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <a href="#" className="text-zinc-400 hover:text-[#E0FE10] text-sm transition-colors mb-2 block">
            Forgot your password?
          </a>
          <p className="text-zinc-500 text-sm font-['HK Grotesk']">
            New to Pulse? <a href="#" className="text-[#E0FE10] hover:text-[#c8e60e]">Download the app</a>
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-zinc-700">
          <p className="text-zinc-400 text-xs text-center font-['HK Grotesk'] px-4">
            Join the Fitness Collective: Create, Share, and Progress Together
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInModal;