import React, { useState, useEffect } from 'react';
import { FaLock, FaEye, FaEyeSlash, FaShieldAlt, FaCopy, FaCheck } from 'react-icons/fa';
import PageHead from '../components/PageHead';

// Types for access logging
interface AccessLog {
  timestamp: string;
  type: 'page_visit' | 'failed_attempt' | 'successful_access' | 'lockout';
  ip?: string;
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
  };
  userAgent: string;
  attempts?: number;
}

const SecurePage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [keySequence, setKeySequence] = useState('');

  // The actual password - loaded from environment variable
  const SECURE_PASSWORD = process.env.NEXT_PUBLIC_SECURE_PASSWORD;
  const SSN = process.env.NEXT_PUBLIC_SECURE;
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300; // 5 minutes in seconds

  // Access logging functions
  const getClientIP = async (): Promise<string | undefined> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error('Failed to get IP:', error);
      return undefined;
    }
  };

  const getLocationData = (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          console.error('Geolocation error:', error);
          resolve(null);
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  };

  const getCityFromCoords = async (lat: number, lon: number): Promise<{ city?: string; country?: string }> => {
    try {
      // Using a free geocoding service
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      const data = await response.json();
      return {
        city: data.city || data.locality,
        country: data.countryName
      };
    } catch (error) {
      console.error('Failed to get city data:', error);
      return {};
    }
  };

  const logAccess = async (type: AccessLog['type'], additionalData?: Partial<AccessLog>) => {
    try {
      const [ip, locationPosition] = await Promise.all([
        getClientIP(),
        getLocationData()
      ]);

      let location: AccessLog['location'] | undefined;
      if (locationPosition) {
        const coords = locationPosition.coords;
        const cityData = await getCityFromCoords(coords.latitude, coords.longitude);
        location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...cityData
        };
      }

      const logEntry: AccessLog = {
        timestamp: new Date().toISOString(),
        type,
        ip,
        location,
        userAgent: navigator.userAgent,
        ...additionalData
      };

      // Store in localStorage for immediate access
      const existingLogs = JSON.parse(localStorage.getItem('secure_access_logs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only the last 100 logs to prevent localStorage bloat
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      localStorage.setItem('secure_access_logs', JSON.stringify(existingLogs));

      // Send to server (Firestore + Email notification)
      try {
        const response = await fetch('/.netlify/functions/log-secure-access', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(logEntry)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Server logging successful:', result);
          
          // Log rate limiting information
          if (result.rateLimitInfo) {
            console.log('📧 Email notification status:', result.rateLimitInfo);
          }
          if (result.email?.rateLimited) {
            console.log('⏰ Email rate limited - cooldown period active for this IP address');
          }
        } else {
          console.error('❌ Server logging failed:', response.status, response.statusText);
        }
      } catch (serverError) {
        console.error('❌ Failed to send log to server:', serverError);
        // Continue execution - local logging still works
      }

      // Also log to console for debugging
      console.log('🔒 Secure Page Access Log:', logEntry);

    } catch (error) {
      console.error('Failed to log access:', error);
    }
  };

  useEffect(() => {
    // Log page visit
    logAccess('page_visit');

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

    // Keypress listener for admin logs (type "LOGS" to view)
    const handleKeyPress = (e: KeyboardEvent) => {
      const newSequence = (keySequence + e.key.toUpperCase()).slice(-4);
      setKeySequence(newSequence);
      
      if (newSequence === 'LOGS') {
        setShowLogs(true);
        setKeySequence('');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [keySequence]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      setError(`Too many failed attempts. Try again in ${Math.floor(lockoutTime / 60)}:${(lockoutTime % 60).toString().padStart(2, '0')}`);
      return;
    }

    if (password === SECURE_PASSWORD) {
      // Log successful access
      await logAccess('successful_access');
      
      setIsAuthenticated(true);
      setError('');
      setAttempts(0);
      localStorage.removeItem('secure_attempts');
      localStorage.removeItem('secure_lockout_end');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('secure_attempts', newAttempts.toString());
      
      // Log failed attempt
      await logAccess('failed_attempt', { attempts: newAttempts });
      
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockoutEnd = Date.now() + (LOCKOUT_DURATION * 1000);
        localStorage.setItem('secure_lockout_end', lockoutEnd.toString());
        setIsLocked(true);
        setLockoutTime(LOCKOUT_DURATION);
        setError(`Too many failed attempts. Locked for ${LOCKOUT_DURATION / 60} minutes.`);
        
        // Log lockout event
        await logAccess('lockout', { attempts: newAttempts });
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

  const getAccessLogs = (): AccessLog[] => {
    try {
      return JSON.parse(localStorage.getItem('secure_access_logs') || '[]');
    } catch {
      return [];
    }
  };

  const clearLogs = () => {
    localStorage.removeItem('secure_access_logs');
    setShowLogs(false);
  };

  // Admin logs modal
  if (showLogs) {
    const logs = getAccessLogs();
    return (
      <>
        <PageHead 
          metaData={{
            pageId: "secure-logs",
            pageTitle: "Access Logs - Pulse",
            metaDescription: "Secure page access logs",
            lastUpdated: new Date().toISOString()
          }}
          pageOgUrl="https://fitwithpulse.ai/secure"
        />
        <div className="min-h-screen bg-black p-4">
          <div className="max-w-6xl mx-auto">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center">
                  <FaShieldAlt className="mr-3 text-red-400" />
                  Secure Page Access Logs
                </h1>
                <div className="space-x-3">
                  <button
                    onClick={clearLogs}
                    className="bg-red-900/20 text-red-400 px-4 py-2 rounded-lg hover:bg-red-900/30 transition-colors"
                  >
                    Clear Logs
                  </button>
                  <button
                    onClick={() => setShowLogs(false)}
                    className="bg-zinc-800 text-white px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="text-sm text-zinc-400 mb-4">
                Total entries: {logs.length} | Press "LOGS" anywhere to view this panel
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center text-zinc-500 py-8">No access logs found</div>
                ) : (
                  logs.slice().reverse().map((log, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${
                      log.type === 'successful_access' ? 'bg-green-900/10 border-green-800/30' :
                      log.type === 'failed_attempt' ? 'bg-red-900/10 border-red-800/30' :
                      log.type === 'lockout' ? 'bg-amber-900/10 border-amber-800/30' :
                      'bg-zinc-800/50 border-zinc-700/50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              log.type === 'successful_access' ? 'bg-green-900/30 text-green-400' :
                              log.type === 'failed_attempt' ? 'bg-red-900/30 text-red-400' :
                              log.type === 'lockout' ? 'bg-amber-900/30 text-amber-400' :
                              'bg-zinc-700 text-zinc-300'
                            }`}>
                              {log.type.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-zinc-400 text-sm">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            {log.attempts && (
                              <span className="text-zinc-500 text-sm">
                                Attempt {log.attempts}/{MAX_ATTEMPTS}
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-zinc-400">IP Address:</div>
                              <div className="text-white font-mono">{log.ip || 'Unknown'}</div>
                            </div>
                            
                            {log.location && (
                              <div>
                                <div className="text-zinc-400">Location:</div>
                                <div className="text-white">
                                  {log.location.city && log.location.country 
                                    ? `${log.location.city}, ${log.location.country}`
                                    : `${log.location.latitude.toFixed(4)}, ${log.location.longitude.toFixed(4)}`
                                  }
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="text-xs text-zinc-500 break-all">
                            User Agent: {log.userAgent}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isAuthenticated) {
    return (
      <>
        <PageHead 
          metaData={{
            pageId: "secure-info",
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
          pageId: "secure-access",
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
