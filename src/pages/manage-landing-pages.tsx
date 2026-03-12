import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import PageHead from '../components/PageHead';
import { FiArrowLeft, FiPlus, FiEye, FiLayout, FiExternalLink, FiCopy, FiTrash2 } from 'react-icons/fi';
import { useUser } from '../hooks/useUser';
import { creatorPagesService, CreatorLandingPage } from '../api/firebase/creatorPages/service';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function ManageLandingPagesPage() {
    const router = useRouter();
    const currentUser = useUser();
    const [pages, setPages] = useState<CreatorLandingPage[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showPageModal, setShowPageModal] = useState(false);
    const [lpSlug, setLpSlug] = useState('');
    const [lpTitle, setLpTitle] = useState('');
    const [lpHeadline, setLpHeadline] = useState('');
    const [lpBody, setLpBody] = useState('');
    const [lpBgType, setLpBgType] = useState<'color' | 'image'>('color');
    const [lpBgColor, setLpBgColor] = useState('#0b0b0c');
    const [lpBgImage, setLpBgImage] = useState('');
    const [lpBgImageFile, setLpBgImageFile] = useState<File | null>(null);
    const [lpBgImagePreview, setLpBgImagePreview] = useState<string | null>(null);
    const [lpImageUploading, setLpImageUploading] = useState(false);
    const [lpCtaType, setLpCtaType] = useState<'link' | 'waitlist'>('waitlist');
    const [lpCtaLabel, setLpCtaLabel] = useState('Join Waitlist');
    const [lpCtaHref, setLpCtaHref] = useState('');
    const [lpCtaButtonColor, setLpCtaButtonColor] = useState('#E0FE10');
    const [lpCtaTextColor, setLpCtaTextColor] = useState('#000000');
    const [lpSaving, setLpSaving] = useState(false);

    useEffect(() => {
        if (!currentUser?.id) {
            setLoading(false);
            return;
        }

        loadPages();
    }, [currentUser?.id]);

    const loadPages = async () => {
        if (!currentUser?.id) return;
        setLoading(true);
        try {
            const fetchedPages = await creatorPagesService.getAllPages(currentUser.id);
            // Sort by newest first
            fetchedPages.sort((a, b) => {
                const timeA = a.createdAt?.toMillis?.() || 0;
                const timeB = b.createdAt?.toMillis?.() || 0;
                return timeB - timeA;
            });
            setPages(fetchedPages);
        } catch (err) {
            console.error('[Manage Pages] Failed to load pages:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = (e: React.MouseEvent, page: CreatorLandingPage) => {
        e.stopPropagation();
        const username = currentUser?.username || page.username || currentUser?.id;
        const url = `${window.location.origin}/${username}/${page.slug}`;
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
    };

    const handleVisitPage = (e: React.MouseEvent, page: CreatorLandingPage) => {
        e.stopPropagation();
        const username = currentUser?.username || page.username || currentUser?.id;
        window.open(`/${username}/${page.slug}`, '_blank');
    };

    const handleLpImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLpBgImageFile(file);
            setLpBgImagePreview(URL.createObjectURL(file));
            setLpBgType('image'); // auto switch to image
        }
    };

    const openCreateModal = () => {
        setLpSlug('');
        setLpTitle('');
        setLpHeadline('');
        setLpBody('');
        setLpBgType('color');
        setLpBgColor('#0b0b0c');
        setLpBgImage('');
        setLpBgImageFile(null);
        setLpBgImagePreview(null);
        setLpCtaType('waitlist');
        setLpCtaLabel('Join Waitlist');
        setLpCtaHref('');
        setLpCtaButtonColor('#E0FE10');
        setLpCtaTextColor('#000000');
        setShowPageModal(true);
    };

    const handleSaveLandingPage = async () => {
        if (!currentUser?.id) {
            alert('You must be logged in to create a landing page.');
            return;
        }
        if (!lpSlug.trim()) {
            alert('Please enter a page slug (URL).');
            return;
        }
        if (!lpTitle.trim()) {
            alert('Please enter a page title.');
            return;
        }

        setLpSaving(true);
        try {
            let backgroundImageUrl = lpBgImage;

            // Upload image if file is selected
            if (lpBgType === 'image' && lpBgImageFile) {
                setLpImageUploading(true);
                const storage = getStorage();
                const fileName = `${Date.now()}_${lpBgImageFile.name}`;
                const imageRef = storageRef(storage, `landing-page/${currentUser.id}/${fileName}`);

                await uploadBytes(imageRef, lpBgImageFile);
                backgroundImageUrl = await getDownloadURL(imageRef);
                setLpImageUploading(false);
            }

            const pageInput = {
                slug: lpSlug.trim().toLowerCase().replace(/\s+/g, '-'),
                title: lpTitle.trim(),
                headline: lpHeadline.trim(),
                body: lpBody.trim(),
                backgroundType: lpBgType,
                backgroundColor: lpBgType === 'color' ? lpBgColor : '',
                backgroundImageUrl: lpBgType === 'image' ? backgroundImageUrl : '',
                ctaType: lpCtaType,
                ctaLabel: lpCtaLabel.trim(),
                ctaHref: lpCtaType === 'link' ? lpCtaHref.trim() : '',
                ctaButtonColor: lpCtaButtonColor,
                ctaTextColor: lpCtaTextColor,
            };

            await creatorPagesService.savePage(currentUser.id, currentUser.username || '', pageInput);
            alert(`Landing page saved!`);
            setShowPageModal(false);
            await loadPages(); // reload list
        } catch (err) {
            console.error('[Save Landing Page]', err);
            alert('Failed to save landing page. Please try again.');
        } finally {
            setLpSaving(false);
            setLpImageUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0E0E10] text-white font-sans">
            <PageHead
                pageOgUrl="https://fitwithpulse.ai/manage-landing-pages"
                metaData={{
                    pageId: 'manage-landing-pages',
                    pageTitle: 'Manage Landing Pages | Pulse',
                    metaDescription: 'View and manage all your landing pages on Pulse.',
                    ogTitle: 'Manage Landing Pages | Pulse',
                    ogDescription: 'View and manage all your landing pages on Pulse.',
                    lastUpdated: new Date().toISOString()
                }}
            />

            <div className="max-w-5xl mx-auto px-6 py-12 md:py-20">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <button
                        onClick={() => router.push('/?tab=create')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                        Back to Creator Studio
                    </button>

                    <button
                        onClick={openCreateModal}
                        className="px-5 py-2.5 bg-[#E0FE10] hover:bg-[#c8e60e] text-black rounded-xl font-bold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <FiPlus className="w-5 h-5" />
                        New Page
                    </button>
                </div>

                {/* Page Title */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                            <FiLayout className="w-5 h-5 text-cyan-400" />
                        </div>
                        <span className="text-cyan-400 font-semibold tracking-wide uppercase text-sm">Landing Pages</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Your Pages</h1>
                    <p className="text-lg text-zinc-400">
                        Select a landing page to view waitlist check-ins, or create a new promo page.
                    </p>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6" />
                        <p className="text-zinc-400">Loading your pages...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && pages.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-3xl p-12 text-center"
                    >
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                            <FiLayout className="w-10 h-10 text-cyan-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">No pages yet</h3>
                        <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                            Create your first landing page to capture waitlist signups and promo leads.
                        </p>
                        <button
                            onClick={openCreateModal}
                            className="px-8 py-4 bg-[#E0FE10] hover:bg-[#c8e60e] text-black rounded-xl font-bold transition-all inline-flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <FiPlus className="w-5 h-5" />
                            Create Your First Page
                        </button>
                    </motion.div>
                )}

                {/* Page Cards Grid */}
                {!loading && pages.length > 0 && (
                    <div className="grid gap-6">
                        {pages.map((page, index) => (
                            <motion.div
                                key={page.slug}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08 }}
                                className="group relative bg-[#151518] border border-white/5 hover:border-cyan-500/30 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/5 text-left w-full"
                            >
                                {/* Background Image/Color Indicator */}
                                <div className="absolute inset-0 z-0">
                                    {page.backgroundType === 'image' && page.backgroundImageUrl ? (
                                        <img
                                            src={page.backgroundImageUrl}
                                            alt=""
                                            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-700"
                                        />
                                    ) : (
                                        <div
                                            className="w-full h-full opacity-20"
                                            style={{ backgroundColor: page.backgroundColor || '#0b0b0c' }}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#151518] via-[#151518]/95 to-[#151518]/80" />
                                </div>

                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between p-6 md:p-8 gap-4">
                                    {/* Page Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl md:text-2xl font-bold text-white truncate">
                                                {page.title || page.slug}
                                            </h3>
                                            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-zinc-300 tracking-wide">
                                                /{page.slug}
                                            </span>
                                        </div>
                                        <p className="text-zinc-400 text-sm md:text-base line-clamp-1 mb-4">
                                            {page.headline || 'No headline set.'}
                                        </p>

                                        {/* Stats */}
                                        <div className="flex flex-wrap items-center gap-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                    <FiEye className="w-3.5 h-3.5 text-emerald-400" />
                                                </div>
                                                <span className="text-zinc-300 text-sm font-medium">
                                                    {page.viewCount || 0} views
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${page.ctaType === 'waitlist' ? 'bg-amber-500/10' : 'bg-purple-500/10'}`}>
                                                    <FiLayout className={`w-3.5 h-3.5 ${page.ctaType === 'waitlist' ? 'text-amber-400' : 'text-purple-400'}`} />
                                                </div>
                                                <span className="text-zinc-300 text-sm font-medium capitalize">
                                                    {page.ctaType || 'Waitlist'} CTA
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => handleCopyLink(e, page)}
                                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors flex items-center gap-2 text-sm border border-white/10"
                                        >
                                            <FiCopy className="w-4 h-4" />
                                            Copy Link
                                        </button>
                                        <button
                                            onClick={(e) => handleVisitPage(e, page)}
                                            className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-medium transition-colors flex items-center gap-2 text-sm border border-cyan-500/30"
                                        >
                                            <FiExternalLink className="w-4 h-4" />
                                            Preview
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Landing Page Builder Modal */}
            {showPageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="bg-zinc-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-zinc-800">
                        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
                            <h2 className="text-2xl font-bold text-white">Create Landing Page</h2>
                            <button onClick={() => setShowPageModal(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
                                <span className="text-2xl leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Slug */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Page URL Slug</label>
                                <div className="text-xs text-zinc-500 mb-2">Your page will be at: /{currentUser?.username || 'user'}/{lpSlug || 'your-page'}</div>
                                <input
                                    type="text"
                                    value={lpSlug}
                                    onChange={(e) => setLpSlug(e.target.value)}
                                    placeholder="my-landing-page"
                                    className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] rounded-xl p-3 text-white placeholder-zinc-500 transition-all outline-none"
                                />
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Page Title</label>
                                <input
                                    type="text"
                                    value={lpTitle}
                                    onChange={(e) => setLpTitle(e.target.value)}
                                    placeholder="Welcome to My Page"
                                    className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] rounded-xl p-3 text-white placeholder-zinc-500 transition-all outline-none"
                                />
                            </div>

                            {/* Headline */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Headline (optional)</label>
                                <input
                                    type="text"
                                    value={lpHeadline}
                                    onChange={(e) => setLpHeadline(e.target.value)}
                                    placeholder="Join the movement"
                                    className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] rounded-xl p-3 text-white placeholder-zinc-500 transition-all outline-none"
                                />
                            </div>

                            {/* Body */}
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">Body Text (optional)</label>
                                <textarea
                                    value={lpBody}
                                    onChange={(e) => setLpBody(e.target.value)}
                                    placeholder="Describe what you're offering..."
                                    rows={4}
                                    className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] rounded-xl p-3 text-white placeholder-zinc-500 transition-all outline-none"
                                />
                            </div>

                            {/* Background Type */}
                            <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50">
                                <label className="block text-sm font-semibold text-zinc-300 mb-3">Background Styling</label>
                                <div className="flex gap-2 mb-4 p-1 bg-zinc-900 rounded-lg max-w-fit">
                                    <button
                                        onClick={() => setLpBgType('color')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${lpBgType === 'color' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        Solid Color
                                    </button>
                                    <button
                                        onClick={() => setLpBgType('image')}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${lpBgType === 'image' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                    >
                                        Hero Image
                                    </button>
                                </div>
                                {lpBgType === 'color' && (
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                                            <input
                                                type="color"
                                                value={lpBgColor}
                                                onChange={(e) => setLpBgColor(e.target.value)}
                                                className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                            />
                                        </div>
                                        <span className="text-zinc-400 font-mono text-sm uppercase">{lpBgColor}</span>
                                    </div>
                                )}
                                {lpBgType === 'image' && (
                                    <div className="space-y-3">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLpImageSelect}
                                            className="w-full text-sm text-zinc-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 file:cursor-pointer transition-all"
                                        />
                                        {lpBgImagePreview && (
                                            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-zinc-700 group">
                                                <img src={lpBgImagePreview} alt="Background preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button
                                                        onClick={() => {
                                                            setLpBgImageFile(null);
                                                            setLpBgImagePreview(null);
                                                        }}
                                                        className="bg-red-500/90 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center gap-2 backdrop-blur-sm"
                                                    >
                                                        <FiTrash2 /> Remove
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {lpImageUploading && (
                                            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
                                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                Uploading image...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* CTA Setup */}
                            <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50 mt-6 !mb-2">
                                <label className="block text-sm font-semibold text-zinc-300 mb-3">Call to Action (CTA)</label>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Action Type</label>
                                        <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg max-w-fit">
                                            <button
                                                onClick={() => setLpCtaType('waitlist')}
                                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${lpCtaType === 'waitlist' ? 'bg-[#E0FE10] text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            >
                                                Collect Emails (Waitlist)
                                            </button>
                                            <button
                                                onClick={() => setLpCtaType('link')}
                                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${lpCtaType === 'link' ? 'bg-[#E0FE10] text-black shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                            >
                                                Custom Link
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Button Text</label>
                                        <input
                                            type="text"
                                            value={lpCtaLabel}
                                            onChange={(e) => setLpCtaLabel(e.target.value)}
                                            placeholder="Join Waitlist"
                                            className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] rounded-xl p-2.5 text-white placeholder-zinc-500 transition-all outline-none"
                                        />
                                    </div>

                                    {/* CTA Href (if link) */}
                                    {lpCtaType === 'link' && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 mt-2">Destination URL</label>
                                            <input
                                                type="url"
                                                value={lpCtaHref}
                                                onChange={(e) => setLpCtaHref(e.target.value)}
                                                placeholder="https://example.com/checkout"
                                                className="w-full bg-zinc-950/50 border border-zinc-700/50 focus:border-[#E0FE10] focus:ring-1 focus:ring-[#E0FE10] rounded-xl p-2.5 text-white placeholder-zinc-500 transition-all outline-none"
                                            />
                                        </motion.div>
                                    )}

                                    {/* Button Colors */}
                                    <div className="grid grid-cols-2 gap-4 mt-2 border-t border-zinc-800/50 pt-4">
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Button Color</label>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                                                    <input
                                                        type="color"
                                                        value={lpCtaButtonColor}
                                                        onChange={(e) => setLpCtaButtonColor(e.target.value)}
                                                        className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                    />
                                                </div>
                                                <span className="text-zinc-400 font-mono text-xs uppercase">{lpCtaButtonColor}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Text Color</label>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-700 shrink-0">
                                                    <input
                                                        type="color"
                                                        value={lpCtaTextColor}
                                                        onChange={(e) => setLpCtaTextColor(e.target.value)}
                                                        className="w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                                                    />
                                                </div>
                                                <span className="text-zinc-400 font-mono text-xs uppercase">{lpCtaTextColor}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setShowPageModal(false)}
                                    className="flex-1 bg-zinc-800 text-white font-medium px-4 py-3.5 rounded-xl hover:bg-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveLandingPage}
                                    disabled={lpSaving}
                                    className="flex-[2] bg-[#E0FE10] text-black font-bold px-4 py-3.5 rounded-xl hover:bg-[#c8e60e] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#E0FE10]/10 flex justify-center items-center"
                                >
                                    {lpSaving ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                            Saving...
                                        </div>
                                    ) : 'Save & Publish Page'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
