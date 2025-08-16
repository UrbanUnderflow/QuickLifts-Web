import React, { useState, useEffect } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaShieldAlt, FaCopy, FaCheck } from 'react-icons/fa';
import PageHead from '../components/PageHead';

const SecurePage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [copied, setCopied] = useState(false);

  // The actual password - loaded from environment variable
  const SECURE_PASSWORD = process.env.NEXT_PUBLIC_SECURE_PASSWORD;
  const SSN = process.env.NEXT_PUBLIC_SECURE;
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300; // 5 minutes in seconds

  useEffect(() => {
    // Check if user is locked out
    const lockoutEnd = localStorage.getItem('secure_lockout_end');
    if (lockoutEnd) {
      const now = Date.now();
      const lockEnd = parseInt(lockoutEnd);
      if (now < lockEnd) {
        setIsLocked(true);
        setLockoutTime(Math.ceil((lockEnd - now) / 1000));
      } else {
        localStorage.removeItem('secure_lockout_end');
        localStorage.removeItem('secure_attempts');
      }
    }

    // Load attempt count
    const storedAttempts = localStorage.getItem('secure_attempts');
    if (storedAttempts) {
      setAttempts(parseInt(storedAttempts));
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLocked && lockoutTime > 0) {
      timer = setInterval(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            setAttempts(0);
            localStorage.removeItem('secure_lockout_end');
            localStorage.removeItem('secure_attempts');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockoutTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setError(`Too many failed attempts. Try again in ${Math.floor(lockoutTime / 60)}:${(lockoutTime % 60).toString().padStart(2, '0')}`);
      return;
    }

    if (password === SECURE_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      setAttempts(0);
      localStorage.removeItem('secure_attempts');
      localStorage.removeItem('secure_lockout_end');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('secure_attempts', newAttempts.toString());
      
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutEnd = Date.now() + (LOCKOUT_DURATION * 1000);
        localStorage.setItem('secure_lockout_end', lockoutEnd.toString());
        setIsLocked(true);
        setLockoutTime(LOCKOUT_DURATION);
        setError(`Too many failed attempts. Locked for ${LOCKOUT_DURATION / 60} minutes.`);
      } else {
        setError(`Incorrect password. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
      }
      setPassword('');
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(SSN || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isAuthenticated) {
    return (
      <>
        <PageHead 
          metaData={{
            pageTitle: "Secure Information - Pulse",
            metaDescription: "Secure access to sensitive information",
            lastUpdated: new Date().toISOString()
          }}
          pageOgUrl="https://fitwithpulse.ai/secure"
        />
        <div className="min-h-screen bg-black flex items-center justify-center px-4">
          <div className="max-w-md w-full">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              {/* Success Icon */}
              <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaShieldAlt className="h-8 w-8 text-green-400" />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-white mb-6">Secure Information</h1>
              
              {/* SSN Display */}
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 mb-6">
                <div className="text-sm text-zinc-400 mb-2">Social Security Number</div>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-mono text-white tracking-wider">
                    {SSN}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="ml-4 p-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <FaCheck className="h-4 w-4 text-green-400" />
                    ) : (
                      <FaCopy className="h-4 w-4 text-zinc-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <FaLock className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-amber-400 mb-1">Security Notice</div>
                    <div className="text-xs text-amber-200">
                      This information is password protected and should be kept confidential. 
                      Do not share this page or leave it open on shared devices.
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsAuthenticated(false);
                    setPassword('');
                  }}
                  className="w-full bg-zinc-800 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-700 transition-colors"
                >
                  Lock & Exit
                </button>
                
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full text-zinc-400 hover:text-white transition-colors"
                >
                  Return to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead 
        metaData={{
          pageTitle: "Secure Access - Pulse",
          metaDescription: "Password protected secure access",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/secure"
      />
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            {/* Lock Icon */}
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaLock className="h-8 w-8 text-red-400" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-white text-center mb-2">Secure Access Required</h1>
            <p className="text-zinc-400 text-center mb-8">
              Enter the password to access sensitive information
            </p>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-3">
                  <FaLock className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <div className="text-sm text-red-200">{error}</div>
                </div>
              </div>
            )}

            {/* Lockout Timer */}
            {isLocked && (
              <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4 mb-6">
                <div className="text-center">
                  <div className="text-lg font-mono text-amber-400 mb-2">
                    {formatTime(lockoutTime)}
                  </div>
                  <div className="text-sm text-amber-200">
                    Account temporarily locked due to failed attempts
                  </div>
                </div>
              </div>
            )}

            {/* Password Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter secure password"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] pr-12"
                  disabled={isLocked}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                  disabled={isLocked}
                >
                  {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLocked || !password.trim()}
                className="w-full bg-gradient-to-r from-[#E0FE10] to-lime-400 text-black px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLocked ? 'Account Locked' : 'Access Secure Information'}
              </button>
            </form>

            {/* Attempt Counter */}
            {!isLocked && attempts > 0 && (
              <div className="mt-4 text-center">
                <div className="text-sm text-zinc-400">
                  Failed attempts: {attempts}/{MAX_ATTEMPTS}
                </div>
              </div>
            )}

            {/* Back Link */}
            <div className="mt-6 text-center">
              <button
                onClick={() => window.location.href = '/'}
                className="text-zinc-400 hover:text-white transition-colors text-sm"
              >
                ← Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SecurePage;
