import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * /onboarding/set-password?token=<token>
 *
 * Public page where a new user sets their password after being onboarded by an admin.
 * The token is validated server-side by the complete-onboarding-password Netlify function.
 */
const SetPasswordPage: React.FC = () => {
    const router = useRouter();
    const { token } = router.query;

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [email, setEmail] = useState<string | null>(null);

    // Password strength
    const [strength, setStrength] = useState(0);

    useEffect(() => {
        let score = 0;
        if (password.length >= 6) score++;
        if (password.length >= 10) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;
        setStrength(score);
    }, [password]);

    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][strength];
    const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#E0FE10'][strength];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!token) {
            setError('Missing onboarding token. Please use the link from your email.');
            return;
        }

        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/.netlify/functions/complete-onboarding-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Something went wrong. Please try again.');
                setIsLoading(false);
                return;
            }

            setEmail(data.email || null);
            setSuccess(true);
        } catch (err: any) {
            setError('Network error. Please check your connection and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Success state ────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center px-4">
                <Head>
                    <title>Password Set | Pulse</title>
                    <meta name="robots" content="noindex,nofollow" />
                </Head>
                <div className="text-center max-w-md mx-auto">
                    {/* Animated success */}
                    <div
                        style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: 'rgba(224, 254, 16, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px',
                            animation: 'successPulse 1.5s ease-in-out infinite',
                        }}
                    >
                        <CheckCircle color="#E0FE10" size={40} />
                    </div>

                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 900,
                            color: '#fff',
                            marginBottom: 8,
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                        }}
                    >
                        You're All Set!
                    </h1>

                    <p
                        style={{
                            fontSize: 16,
                            color: '#a1a1aa',
                            marginBottom: 24,
                            lineHeight: 1.6,
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                        }}
                    >
                        Your password has been set successfully.
                        {email && (
                            <>
                                <br />
                                Sign in with <span style={{ color: '#E0FE10', fontWeight: 600 }}>{email}</span>
                            </>
                        )}
                    </p>

                    <div
                        style={{
                            background: 'rgba(24, 24, 27, 0.8)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 16,
                            padding: '20px 24px',
                            marginBottom: 24,
                        }}
                    >
                        <p
                            style={{
                                fontSize: 14,
                                color: '#e4e4e7',
                                lineHeight: 1.7,
                                margin: 0,
                                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                            }}
                        >
                            <strong style={{ color: '#fff' }}>Next steps:</strong>
                            <br />
                            1. Open the <span style={{ color: '#E0FE10' }}>Pulse app</span> on your phone
                            <br />
                            2. Tap <strong>Sign In</strong> and enter your email & password
                            <br />
                            3. You can also link Apple or Google sign-in later from Settings
                        </p>
                    </div>

                    <a
                        href="/"
                        style={{
                            display: 'inline-block',
                            background: '#E0FE10',
                            color: '#0a0a0b',
                            fontWeight: 900,
                            fontSize: 14,
                            textDecoration: 'none',
                            padding: '14px 32px',
                            borderRadius: 12,
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                            transition: 'background 0.2s',
                        }}
                    >
                        GO TO PULSE
                    </a>
                </div>

                <style jsx global>{`
          @keyframes successPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.9; }
          }
        `}</style>
            </div>
        );
    }

    // ── Main form ────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-black text-white">
            <Head>
                <title>Set Your Password | Pulse</title>
                <meta name="description" content="Set your Pulse account password to get started." />
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            {/* Background gradient */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'radial-gradient(ellipse at 50% 0%, rgba(224,254,16,0.06) 0%, transparent 60%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                }}
            />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 440, margin: '0 auto', padding: '48px 24px' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                        <img
                            src="/pulseIcon.png"
                            alt="Pulse"
                            style={{ width: 56, height: 56, objectFit: 'contain' }}
                        />
                    </div>
                    <h1
                        style={{
                            fontSize: 28,
                            fontWeight: 900,
                            color: '#fff',
                            marginBottom: 8,
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                        }}
                    >
                        Set Your Password
                    </h1>
                    <p
                        style={{
                            fontSize: 15,
                            color: '#a1a1aa',
                            lineHeight: 1.6,
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                        }}
                    >
                        Choose a password to complete your account setup.
                    </p>
                </div>

                {/* Security badge */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'rgba(24, 24, 27, 0.6)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12,
                        padding: '10px 14px',
                        marginBottom: 24,
                    }}
                >
                    <ShieldCheck size={16} color="#E0FE10" />
                    <span
                        style={{
                            fontSize: 12,
                            color: '#71717a',
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                        }}
                    >
                        Secure connection • Your password is encrypted end-to-end
                    </span>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Password */}
                    <div style={{ marginBottom: 16 }}>
                        <label
                            htmlFor="password"
                            style={{
                                display: 'block',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#d4d4d8',
                                marginBottom: 8,
                                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                            }}
                        >
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setError(null);
                                }}
                                placeholder="Choose a strong password"
                                autoComplete="new-password"
                                style={{
                                    width: '100%',
                                    background: 'rgba(24, 24, 27, 0.8)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12,
                                    padding: '14px 48px 14px 16px',
                                    fontSize: 15,
                                    color: '#fff',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                                    boxSizing: 'border-box',
                                }}
                                onFocus={(e) => (e.target.style.borderColor = 'rgba(224,254,16,0.5)')}
                                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: 14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    color: '#71717a',
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {/* Strength meter */}
                        {password.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 4,
                                        marginBottom: 4,
                                    }}
                                >
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div
                                            key={i}
                                            style={{
                                                flex: 1,
                                                height: 3,
                                                borderRadius: 2,
                                                background: i <= strength ? strengthColor : 'rgba(255,255,255,0.08)',
                                                transition: 'background 0.3s',
                                            }}
                                        />
                                    ))}
                                </div>
                                <span
                                    style={{
                                        fontSize: 11,
                                        color: strengthColor,
                                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                                    }}
                                >
                                    {strengthLabel}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div style={{ marginBottom: 24 }}>
                        <label
                            htmlFor="confirmPassword"
                            style={{
                                display: 'block',
                                fontSize: 13,
                                fontWeight: 600,
                                color: '#d4d4d8',
                                marginBottom: 8,
                                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                            }}
                        >
                            Confirm Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setError(null);
                                }}
                                placeholder="Confirm your password"
                                autoComplete="new-password"
                                style={{
                                    width: '100%',
                                    background: 'rgba(24, 24, 27, 0.8)',
                                    border: `1px solid ${confirmPassword && confirmPassword !== password
                                            ? 'rgba(239, 68, 68, 0.5)'
                                            : confirmPassword && confirmPassword === password
                                                ? 'rgba(34, 197, 94, 0.5)'
                                                : 'rgba(255,255,255,0.1)'
                                        }`,
                                    borderRadius: 12,
                                    padding: '14px 48px 14px 16px',
                                    fontSize: 15,
                                    color: '#fff',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                                    boxSizing: 'border-box',
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                    position: 'absolute',
                                    right: 14,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    color: '#71717a',
                                }}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== password && (
                            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>Passwords do not match</p>
                        )}
                        {confirmPassword && confirmPassword === password && password.length >= 6 && (
                            <p style={{ fontSize: 12, color: '#22c55e', marginTop: 6 }}>✓ Passwords match</p>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div
                            style={{
                                background: 'rgba(127, 29, 29, 0.3)',
                                border: '1px solid rgba(185, 28, 28, 0.5)',
                                borderRadius: 12,
                                padding: '12px 16px',
                                marginBottom: 16,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                            }}
                        >
                            <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
                            <span
                                style={{
                                    fontSize: 13,
                                    color: '#fca5a5',
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                                }}
                            >
                                {error}
                            </span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading || !password || !confirmPassword || password !== confirmPassword}
                        style={{
                            width: '100%',
                            background: isLoading || !password || !confirmPassword || password !== confirmPassword
                                ? 'rgba(224, 254, 16, 0.3)'
                                : '#E0FE10',
                            color: '#0a0a0b',
                            fontWeight: 900,
                            fontSize: 15,
                            padding: '15px',
                            borderRadius: 12,
                            border: 'none',
                            cursor: isLoading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            transition: 'all 0.2s',
                            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                        }}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Setting Password...
                            </>
                        ) : (
                            'SET PASSWORD & COMPLETE SETUP'
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p
                    style={{
                        textAlign: 'center',
                        fontSize: 12,
                        color: '#52525b',
                        marginTop: 32,
                        lineHeight: 1.6,
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
                    }}
                >
                    © {new Date().getFullYear()} Pulse Intelligence Labs, Inc.
                    <br />
                    Need help? Email{' '}
                    <a href="mailto:tre@fitwithpulse.ai" style={{ color: '#71717a', textDecoration: 'underline' }}>
                        tre@fitwithpulse.ai
                    </a>
                </p>
            </div>
        </div>
    );
};

export default SetPasswordPage;
