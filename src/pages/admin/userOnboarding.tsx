import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useUser } from '../../hooks/useUser';
import { useRouter } from 'next/router';
import {
    UserPlus,
    Loader2,
    CheckCircle,
    AlertTriangle,
    Copy,
    Send,
    ArrowLeft,
    Users,
    Clock,
    Link2,
    Mail,
    RefreshCw,
} from 'lucide-react';
import { db } from '../../api/firebase/config';
import { collection, query, where, orderBy, getDocs, limit, Timestamp } from 'firebase/firestore';

// ── Admin guard check ────────────────────────────────────────────────
const ADMIN_EMAILS = [
    'tre@fitwithpulse.ai',
    'tremainegrant@gmail.com',
    // Add other admin emails here
];

interface OnboardedUser {
    userId: string;
    email: string;
    username: string;
    token: string;
    used: boolean;
    createdAt: any;
    expiresAt: any;
    adminNotes: string;
}

const UserOnboarding: React.FC = () => {
    const currentUser = useUser();
    const router = useRouter();

    // ── Form state ──────────────────────────────────────────────────────
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        displayName: '',
        role: 'athlete' as 'athlete' | 'coach',
        age: '',
        gender: '' as '' | 'man' | 'woman' | "I'd rather self describe",
        notes: '',
    });

    const [isCreating, setIsCreating] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{
        userId: string;
        username: string;
        onboardingLink: string;
        expiresAt: string;
    } | null>(null);
    const [emailSent, setEmailSent] = useState(false);
    const [copied, setCopied] = useState(false);

    // ── Recent onboardings ──────────────────────────────────────────────
    const [recentOnboardings, setRecentOnboardings] = useState<OnboardedUser[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);

    const isAdmin = currentUser && ADMIN_EMAILS.includes(currentUser.email?.toLowerCase());

    // ── Load recent onboardings ─────────────────────────────────────────
    const loadRecentOnboardings = async () => {
        setLoadingRecent(true);
        try {
            const tokensRef = collection(db, 'onboarding-tokens');
            const q = query(tokensRef, orderBy('createdAt', 'desc'), limit(20));
            const snap = await getDocs(q);
            const items: OnboardedUser[] = snap.docs.map((d) => ({
                ...d.data(),
                token: d.id,
            })) as OnboardedUser[];
            setRecentOnboardings(items);
        } catch (e) {
            console.warn('[UserOnboarding] Failed to load recent onboardings:', e);
        } finally {
            setLoadingRecent(false);
        }
    };

    useEffect(() => {
        if (isAdmin) loadRecentOnboardings();
    }, [isAdmin]);

    // ── Handlers ────────────────────────────────────────────────────────
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setError(null);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.email || !formData.username) {
            setError('Email and username are required.');
            return;
        }

        setIsCreating(true);

        try {
            const response = await fetch('/.netlify/functions/create-onboarding-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email.trim(),
                    username: formData.username.trim(),
                    displayName: formData.displayName.trim() || undefined,
                    role: formData.role,
                    age: formData.age ? parseInt(formData.age) : undefined,
                    gender: formData.gender || undefined,
                    notes: formData.notes.trim() || undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Failed to create onboarding link.');
                return;
            }

            setSuccess({
                userId: data.userId,
                username: data.username,
                onboardingLink: data.onboardingLink,
                expiresAt: data.expiresAt,
            });

            // Refresh the list
            loadRecentOnboardings();
        } catch (err: any) {
            setError('Network error. Please try again.');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSendEmail = async () => {
        if (!success) return;
        setIsSendingEmail(true);

        try {
            const response = await fetch('/.netlify/functions/send-onboarding-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: formData.email.trim(),
                    firstName: formData.displayName.trim() || formData.username.trim(),
                    username: success.username,
                    onboardingLink: success.onboardingLink,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.error || 'Failed to send email.');
                return;
            }

            setEmailSent(true);
        } catch (err: any) {
            setError('Failed to send email. Try copying the link instead.');
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleCopyLink = () => {
        if (!success) return;
        navigator.clipboard.writeText(success.onboardingLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setFormData({ email: '', username: '', displayName: '', role: 'athlete', age: '', gender: '', notes: '' });
        setSuccess(null);
        setEmailSent(false);
        setError(null);
        setCopied(false);
    };

    // ── Auth guard ──────────────────────────────────────────────────────
    if (!currentUser) {
        return (
            <div style={styles.pageContainer}>
                <Head><title>User Onboarding | Pulse Admin</title></Head>
                <div style={styles.centerBox}>
                    <Loader2 size={24} color="#E0FE10" className="animate-spin" />
                    <p style={{ color: '#a1a1aa', marginTop: 12 }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div style={styles.pageContainer}>
                <Head><title>Unauthorized | Pulse Admin</title></Head>
                <div style={styles.centerBox}>
                    <AlertTriangle size={32} color="#f87171" />
                    <h2 style={{ color: '#fff', marginTop: 12 }}>Access Denied</h2>
                    <p style={{ color: '#a1a1aa', fontSize: 14 }}>You don't have permission to access this page.</p>
                </div>
            </div>
        );
    }

    // ── Main render ─────────────────────────────────────────────────────
    return (
        <div style={styles.pageContainer}>
            <Head>
                <title>User Onboarding | Pulse Admin</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            {/* Background gradient */}
            <div style={styles.bgGradient} />

            <div style={styles.contentWrapper}>
                {/* Header */}
                <div style={styles.header}>
                    <button onClick={() => router.push('/admin')} style={styles.backButton}>
                        <ArrowLeft size={18} />
                        <span>Admin</span>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={styles.iconBadge}>
                            <UserPlus size={20} color="#E0FE10" />
                        </div>
                        <div>
                            <h1 style={styles.title}>User Onboarding</h1>
                            <p style={styles.subtitle}>Create accounts and send password setup links</p>
                        </div>
                    </div>
                </div>

                <div className="onboarding-grid">
                    {/* ── Left: Create / Success ──────────────────────────── */}
                    <div style={styles.card}>
                        {success ? (
                            // ── Success view ──────────────────────────────────
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                    <div style={styles.successIcon}>
                                        <CheckCircle size={32} color="#E0FE10" />
                                    </div>
                                    <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                                        Account Created!
                                    </h2>
                                    <p style={{ color: '#a1a1aa', fontSize: 14 }}>
                                        <strong style={{ color: '#E0FE10' }}>@{success.username}</strong> is ready for onboarding
                                    </p>
                                </div>

                                {/* Link box */}
                                <div style={styles.linkBox}>
                                    <label style={styles.smallLabel}>Onboarding Link</label>
                                    <div style={styles.linkRow}>
                                        <input
                                            readOnly
                                            value={success.onboardingLink}
                                            style={styles.linkInput}
                                        />
                                        <button onClick={handleCopyLink} style={styles.copyBtn}>
                                            {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                    <p style={{ fontSize: 11, color: '#52525b', marginTop: 6 }}>
                                        Expires: {new Date(success.expiresAt).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Send email button */}
                                {!emailSent ? (
                                    <button
                                        onClick={handleSendEmail}
                                        disabled={isSendingEmail}
                                        style={{
                                            ...styles.primaryButton,
                                            marginTop: 16,
                                            opacity: isSendingEmail ? 0.6 : 1,
                                        }}
                                    >
                                        {isSendingEmail ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={16} />
                                                Send Onboarding Email
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div style={styles.emailSentBadge}>
                                        <Mail size={16} color="#22c55e" />
                                        <span>Email sent to {formData.email}</span>
                                    </div>
                                )}

                                {/* Error */}
                                {error && (
                                    <div style={styles.errorBox}>
                                        <AlertTriangle size={16} color="#f87171" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button onClick={handleReset} style={styles.secondaryButton}>
                                    <UserPlus size={16} />
                                    Onboard Another User
                                </button>
                            </div>
                        ) : (
                            // ── Create form ─────────────────────────────────────
                            <form onSubmit={handleCreateUser}>
                                <h2 style={styles.cardTitle}>New User Details</h2>

                                {/* Email */}
                                <div style={styles.field}>
                                    <label style={styles.label}>Email *</label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="user@example.com"
                                        required
                                        style={styles.input}
                                    />
                                </div>

                                {/* Username */}
                                <div style={styles.field}>
                                    <label style={styles.label}>Username *</label>
                                    <input
                                        name="username"
                                        type="text"
                                        value={formData.username}
                                        onChange={handleChange}
                                        placeholder="john_doe"
                                        required
                                        style={styles.input}
                                    />
                                    <p style={styles.hint}>3-20 chars: lowercase letters, numbers, underscore</p>
                                </div>

                                {/* Display Name */}
                                <div style={styles.field}>
                                    <label style={styles.label}>Display Name</label>
                                    <input
                                        name="displayName"
                                        type="text"
                                        value={formData.displayName}
                                        onChange={handleChange}
                                        placeholder="John Doe"
                                        style={styles.input}
                                    />
                                </div>

                                {/* Role + Age row */}
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ ...styles.field, flex: 1 }}>
                                        <label style={styles.label}>Role</label>
                                        <select name="role" value={formData.role} onChange={handleChange} style={styles.input}>
                                            <option value="athlete">Athlete</option>
                                            <option value="coach">Coach</option>
                                        </select>
                                    </div>
                                    <div style={{ ...styles.field, flex: 1 }}>
                                        <label style={styles.label}>Age</label>
                                        <input
                                            name="age"
                                            type="number"
                                            value={formData.age}
                                            onChange={handleChange}
                                            placeholder="25"
                                            min="13"
                                            max="120"
                                            style={styles.input}
                                        />
                                    </div>
                                </div>

                                {/* Gender */}
                                <div style={styles.field}>
                                    <label style={styles.label}>Gender</label>
                                    <select name="gender" value={formData.gender} onChange={handleChange} style={styles.input}>
                                        <option value="">Not specified</option>
                                        <option value="man">Man</option>
                                        <option value="woman">Woman</option>
                                        <option value="I'd rather self describe">Self describe</option>
                                    </select>
                                </div>

                                {/* Notes */}
                                <div style={styles.field}>
                                    <label style={styles.label}>Onboarding Notes</label>
                                    <textarea
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleChange}
                                        placeholder="Steps completed, goals, preferences, etc."
                                        rows={3}
                                        style={{ ...styles.input, resize: 'vertical' as any, minHeight: 72 }}
                                    />
                                </div>

                                {/* Error */}
                                {error && (
                                    <div style={styles.errorBox}>
                                        <AlertTriangle size={16} color="#f87171" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    style={{
                                        ...styles.primaryButton,
                                        opacity: isCreating ? 0.6 : 1,
                                    }}
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Creating Account...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={16} />
                                            Create Account & Generate Link
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* ── Right: Recent onboardings ────────────────────────── */}
                    <div style={styles.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2 style={styles.cardTitle}>Recent Onboardings</h2>
                            <button onClick={loadRecentOnboardings} style={styles.refreshBtn}>
                                <RefreshCw size={14} />
                            </button>
                        </div>

                        {loadingRecent ? (
                            <div style={{ textAlign: 'center', padding: 24 }}>
                                <Loader2 size={20} color="#a1a1aa" className="animate-spin" />
                            </div>
                        ) : recentOnboardings.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 24 }}>
                                <Users size={24} color="#52525b" />
                                <p style={{ color: '#71717a', fontSize: 13, marginTop: 8 }}>No onboardings yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                                {recentOnboardings.map((item) => {
                                    const isExpired = item.expiresAt?.toDate
                                        ? new Date() > item.expiresAt.toDate()
                                        : item.expiresAt
                                            ? new Date() > new Date(item.expiresAt)
                                            : false;

                                    return (
                                        <div key={item.token} style={styles.onboardItem}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ color: '#E0FE10', fontWeight: 700, fontSize: 13 }}>
                                                            @{item.username}
                                                        </span>
                                                        {item.used ? (
                                                            <span style={styles.statusBadge('#22c55e')}>
                                                                <CheckCircle size={10} /> Complete
                                                            </span>
                                                        ) : isExpired ? (
                                                            <span style={styles.statusBadge('#f87171')}>
                                                                <Clock size={10} /> Expired
                                                            </span>
                                                        ) : (
                                                            <span style={styles.statusBadge('#eab308')}>
                                                                <Link2 size={10} /> Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{item.email}</p>
                                                </div>
                                                <span style={{ color: '#52525b', fontSize: 10 }}>
                                                    {item.createdAt?.toDate
                                                        ? item.createdAt.toDate().toLocaleDateString()
                                                        : ''}
                                                </span>
                                            </div>
                                            {item.adminNotes && (
                                                <p style={{ color: '#52525b', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                                                    {item.adminNotes}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx global>{`
              .onboarding-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
              }
              @media (max-width: 768px) {
                .onboarding-grid {
                  grid-template-columns: 1fr;
                }
              }
            `}</style>
        </div>
    );
};

// ── Styles ──────────────────────────────────────────────────────────────
const styles: Record<string, any> = {
    pageContainer: {
        minHeight: '100vh',
        background: '#0a0a0b',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Arial, sans-serif",
        position: 'relative' as const,
    },
    bgGradient: {
        position: 'fixed' as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 30% 0%, rgba(224,254,16,0.04) 0%, transparent 50%)',
        pointerEvents: 'none' as const,
        zIndex: 0,
    },
    contentWrapper: {
        position: 'relative' as const,
        zIndex: 1,
        maxWidth: 1100,
        margin: '0 auto',
        padding: '24px 20px 60px',
    },
    header: {
        marginBottom: 32,
    },
    backButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        color: '#71717a',
        fontSize: 13,
        cursor: 'pointer',
        marginBottom: 16,
        padding: 0,
        fontFamily: 'inherit',
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: 'rgba(224,254,16,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 900,
        margin: 0,
    },
    subtitle: {
        color: '#71717a',
        fontSize: 13,
        margin: '2px 0 0',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        '@media (max-width: 768px)': {
            gridTemplateColumns: '1fr',
        },
    },
    card: {
        background: 'rgba(24, 24, 27, 0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 24,
        backdropFilter: 'blur(12px)',
    },
    cardTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 700,
        margin: '0 0 16px',
    },
    field: {
        marginBottom: 14,
    },
    label: {
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: '#a1a1aa',
        marginBottom: 6,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.5,
    },
    hint: {
        fontSize: 11,
        color: '#52525b',
        marginTop: 4,
    },
    input: {
        width: '100%',
        background: 'rgba(9, 9, 11, 0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        padding: '11px 14px',
        fontSize: 14,
        color: '#fff',
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.2s',
    },
    primaryButton: {
        width: '100%',
        background: '#E0FE10',
        color: '#0a0a0b',
        fontWeight: 800,
        fontSize: 14,
        padding: '13px 20px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        marginTop: 8,
    },
    secondaryButton: {
        width: '100%',
        background: 'transparent',
        color: '#a1a1aa',
        fontWeight: 600,
        fontSize: 13,
        padding: '12px 20px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        transition: 'all 0.2s',
        fontFamily: 'inherit',
        marginTop: 12,
    },
    errorBox: {
        background: 'rgba(127, 29, 29, 0.2)',
        border: '1px solid rgba(185, 28, 28, 0.4)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: '#fca5a5',
    },
    successIcon: {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'rgba(224, 254, 16, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 12px',
    },
    linkBox: {
        background: 'rgba(9, 9, 11, 0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 14,
    },
    smallLabel: {
        fontSize: 10,
        fontWeight: 700,
        color: '#71717a',
        textTransform: 'uppercase' as const,
        letterSpacing: 0.8,
        marginBottom: 6,
        display: 'block',
    },
    linkRow: {
        display: 'flex',
        gap: 6,
    },
    linkInput: {
        flex: 1,
        background: 'rgba(24, 24, 27, 0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        color: '#a1a1aa',
        outline: 'none',
        fontFamily: 'monospace',
        boxSizing: 'border-box' as const,
    },
    copyBtn: {
        background: 'rgba(224, 254, 16, 0.15)',
        border: '1px solid rgba(224,254,16,0.25)',
        borderRadius: 8,
        padding: '8px 12px',
        cursor: 'pointer',
        color: '#E0FE10',
        display: 'flex',
        alignItems: 'center',
    },
    emailSentBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.2)',
        borderRadius: 10,
        padding: '12px 16px',
        marginTop: 16,
        color: '#86efac',
        fontSize: 13,
        fontWeight: 600,
    },
    refreshBtn: {
        background: 'none',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '6px 8px',
        cursor: 'pointer',
        color: '#71717a',
        display: 'flex',
        alignItems: 'center',
    },
    onboardItem: {
        background: 'rgba(9, 9, 11, 0.4)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 10,
        padding: '10px 14px',
    },
    statusBadge: (color: string) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        color,
        background: `${color}15`,
        borderRadius: 6,
        padding: '2px 8px',
    }),
    centerBox: {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center' as const,
    },
};

export default UserOnboarding;
