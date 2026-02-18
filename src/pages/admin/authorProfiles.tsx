import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { ArrowLeft, Plus, Save, Trash2, Loader2, User } from 'lucide-react';
import { db } from '../../api/firebase/config';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    Timestamp,
} from 'firebase/firestore';

interface AuthorProfile {
    id: string; // slug-based doc ID, e.g. "tremaine"
    name: string;
    title: string; // e.g. "Founder, Pulse · Software Engineer · Clinical Research"
    bio: string;
    avatarUrl?: string;
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
}

const AuthorProfilesAdmin: React.FC = () => {
    const router = useRouter();
    const [authors, setAuthors] = useState<AuthorProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedAuthor, setSelectedAuthor] = useState<AuthorProfile | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        title: '',
        bio: '',
        avatarUrl: '',
    });
    const [successMsg, setSuccessMsg] = useState('');

    // Load authors
    useEffect(() => {
        const fetchAuthors = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'authorProfiles'));
                const authorsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as AuthorProfile[];
                setAuthors(authorsData);
            } catch (error) {
                console.error('Error fetching authors:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAuthors();
    }, []);

    const generateSlug = (name: string) =>
        name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

    const handleSelectAuthor = (author: AuthorProfile) => {
        setSelectedAuthor(author);
        setIsCreating(false);
        setFormData({
            name: author.name,
            title: author.title,
            bio: author.bio,
            avatarUrl: author.avatarUrl || '',
        });
        setSuccessMsg('');
    };

    const handleNewAuthor = () => {
        setSelectedAuthor(null);
        setIsCreating(true);
        setFormData({ name: '', title: '', bio: '', avatarUrl: '' });
        setSuccessMsg('');
    };

    const handleSave = async () => {
        if (!formData.name.trim()) return;
        setSaving(true);
        setSuccessMsg('');

        try {
            const slug = isCreating
                ? generateSlug(formData.name)
                : selectedAuthor!.id;
            const now = Timestamp.now();

            const data: any = {
                name: formData.name.trim(),
                title: formData.title.trim(),
                bio: formData.bio.trim(),
                avatarUrl: formData.avatarUrl.trim(),
                updatedAt: now,
            };

            if (isCreating) {
                data.createdAt = now;
            }

            await setDoc(doc(db, 'authorProfiles', slug), data, { merge: true });

            // Refresh list
            const snapshot = await getDocs(collection(db, 'authorProfiles'));
            const authorsData = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as AuthorProfile[];
            setAuthors(authorsData);

            // Select the saved author
            const saved = authorsData.find((a) => a.id === slug);
            if (saved) {
                setSelectedAuthor(saved);
                setIsCreating(false);
            }

            setSuccessMsg('Author profile saved successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            console.error('Error saving author:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedAuthor) return;
        if (!confirm(`Delete author profile "${selectedAuthor.name}"?`)) return;

        try {
            await deleteDoc(doc(db, 'authorProfiles', selectedAuthor.id));
            setAuthors((prev) => prev.filter((a) => a.id !== selectedAuthor.id));
            setSelectedAuthor(null);
            setFormData({ name: '', title: '', bio: '', avatarUrl: '' });
        } catch (error) {
            console.error('Error deleting author:', error);
        }
    };

    return (
        <AdminRouteGuard>
            <Head>
                <title>Author Profiles – Pulse Admin</title>
            </Head>

            <div className="min-h-screen bg-[#111417] text-white">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/admin')}
                                className="p-2 rounded-lg hover:bg-[#1a1e24] transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold">Author Profiles</h1>
                                <p className="text-sm text-zinc-400">
                                    Manage author profiles for research articles
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleNewAuthor}
                            className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#c8e60e] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            New Author
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Author List */}
                        <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="font-semibold text-white">All Authors</h2>
                                <span className="text-xs text-zinc-500">
                                    {authors.length} total
                                </span>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                                </div>
                            ) : authors.length === 0 ? (
                                <p className="text-zinc-500 text-sm text-center py-8">
                                    No author profiles yet
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {authors.map((author) => (
                                        <button
                                            key={author.id}
                                            onClick={() => handleSelectAuthor(author)}
                                            className={`w-full text-left p-3 rounded-lg transition-colors ${selectedAuthor?.id === author.id
                                                    ? 'bg-[#E0FE10]/10 border border-[#E0FE10]/30'
                                                    : 'hover:bg-[#262a30] border border-transparent'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-sm font-bold text-[#E0FE10]">
                                                        {author.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-white text-sm truncate">
                                                        {author.name}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 truncate">
                                                        {author.title || 'No title set'}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Edit Form */}
                        <div className="lg:col-span-2 bg-[#1a1e24] rounded-xl border border-zinc-800 p-6">
                            {!selectedAuthor && !isCreating ? (
                                <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                                    <User className="w-12 h-12 mb-4 opacity-50" />
                                    <p className="font-semibold text-lg text-white mb-1">
                                        No author selected
                                    </p>
                                    <p className="text-sm">
                                        Select an author from the list or create a new one
                                    </p>
                                    <button
                                        onClick={handleNewAuthor}
                                        className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#c8e60e] transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        New Author
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-lg font-semibold">
                                            {isCreating ? 'Create Author Profile' : 'Edit Author Profile'}
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            {!isCreating && (
                                                <button
                                                    onClick={handleDelete}
                                                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            )}
                                            <button
                                                onClick={handleSave}
                                                disabled={saving || !formData.name.trim()}
                                                className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg font-medium hover:bg-[#c8e60e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {saving ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Save
                                            </button>
                                        </div>
                                    </div>

                                    {successMsg && (
                                        <div className="mb-4 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                                            {successMsg}
                                        </div>
                                    )}

                                    {/* Preview */}
                                    <div className="mb-6 p-4 bg-[#FAFAF7] rounded-xl">
                                        <p className="text-xs text-stone-400 mb-3 font-medium uppercase tracking-wider">
                                            Preview on article
                                        </p>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center">
                                                <span className="text-sm font-bold text-[#E0FE10]">
                                                    {formData.name
                                                        ? formData.name.charAt(0).toUpperCase()
                                                        : '?'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-stone-800">
                                                    {formData.name || 'Author Name'}
                                                </p>
                                                <p className="text-xs text-stone-400">
                                                    {formData.title || 'Author title goes here'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                                                Display Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, name: e.target.value })
                                                }
                                                placeholder="e.g. Tremaine"
                                                className="w-full px-4 py-2.5 bg-[#111417] border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/30 focus:border-[#E0FE10]/40"
                                            />
                                            {isCreating && formData.name && (
                                                <p className="mt-1 text-xs text-zinc-500">
                                                    Slug: <code className="text-zinc-400">{generateSlug(formData.name)}</code>
                                                </p>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                                                Title / Role
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, title: e.target.value })
                                                }
                                                placeholder="e.g. Founder, Pulse · Software Engineer · Clinical Research"
                                                className="w-full px-4 py-2.5 bg-[#111417] border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/30 focus:border-[#E0FE10]/40"
                                            />
                                            <p className="mt-1 text-xs text-zinc-500">
                                                Displayed below the author name on articles. Use · to separate roles.
                                            </p>
                                        </div>

                                        {/* Bio */}
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                                                Bio
                                            </label>
                                            <textarea
                                                value={formData.bio}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, bio: e.target.value })
                                                }
                                                placeholder="Short bio shown at the end of articles..."
                                                rows={4}
                                                className="w-full px-4 py-2.5 bg-[#111417] border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/30 focus:border-[#E0FE10]/40 resize-none"
                                            />
                                        </div>

                                        {/* Avatar URL */}
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                                                Avatar URL (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.avatarUrl}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, avatarUrl: e.target.value })
                                                }
                                                placeholder="https://..."
                                                className="w-full px-4 py-2.5 bg-[#111417] border border-zinc-700 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]/30 focus:border-[#E0FE10]/40"
                                            />
                                        </div>
                                    </div>

                                    {/* Usage info */}
                                    <div className="mt-8 p-4 bg-[#111417] rounded-lg border border-zinc-800">
                                        <p className="text-xs text-zinc-500 leading-relaxed">
                                            <strong className="text-zinc-400">How it works:</strong>{' '}
                                            When a research article is published, the author's name is
                                            matched to this profile by slug (e.g., author "Tremaine"
                                            matches slug "tremaine"). The title is shown below
                                            the name in the article header and footer.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AdminRouteGuard>
    );
};

export default AuthorProfilesAdmin;
