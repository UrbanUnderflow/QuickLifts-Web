import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiActivity, FiUsers, FiMessageCircle, FiAward, FiSliders, FiEdit3, FiCheckCircle, FiImage, FiX, FiCalendar } from 'react-icons/fi';
import { Club } from '../../api/firebase/club/types';
import { SweatlistCollection } from '../../api/firebase/workout/types';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

type Step = 'prompt' | 'generating' | 'preview';

function getFeatureDescription(featureName: string): string {
    const lower = featureName.toLowerCase();
    if (lower.includes('chat')) return 'Connect with fellow members in real-time.';
    if (lower.includes('challenges')) return 'Join challenges and push your limits together.';
    if (lower.includes('leaderboard')) return 'Compete and climb the ranks.';
    if (lower.includes('community')) return 'A supportive space to grow and stay accountable.';
    return 'Included with your membership.';
}

interface CreatorFallback {
    displayName?: string;
    username?: string;
    profileImage?: { profileImageURL?: string };
}

interface LandingPageBuilderProps {
    club?: Club;
    /** When club.creatorInfo is missing, use this (e.g. currentUser) so the host's image/name show in preview */
    creatorFallback?: CreatorFallback | null;
    /** Total workouts completed by all club members (for preview stats) */
    totalWorkoutsCompleted?: number | null;
    /** All featured rounds to show in the "See What's Inside" section, sorted by activity */
    allRounds?: SweatlistCollection[];
    onGenerated: (config: any) => void;
    onCancel?: () => void;
}

export default function LandingPageBuilder({ club, creatorFallback, totalWorkoutsCompleted, allRounds = [], onGenerated, onCancel }: LandingPageBuilderProps) {
    const [step, setStep] = useState<Step>('prompt');
    const [prompt, setPrompt] = useState('');
    const [loadingText, setLoadingText] = useState('Analyzing audience...');

    // Assets
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);

    // Generated fake data config
    const [config, setConfig] = useState<any>(club?.landingPageConfig || (club ? {
        heroTitle: club.name,
        heroSubtitle: club.description,
        heroImage: club.coverImageURL || "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop",
        aboutText: club.description,
        features: ["Chat", "Challenges", "Leaderboard", "Community"],
        assets: []
    } : null));

    // Initial step effect
    React.useEffect(() => {
        if (club && step === 'prompt') {
            setStep('preview');
        }
    }, [club]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploadingImages(true);
        try {
            const storage = getStorage();
            const newUrls: string[] = [];

            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                const fileName = `${Date.now()}_asset_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
                // Use a generic folder if no club id
                const path = club ? `club-assets/${club.id}/${fileName}` : `club-assets/draft/${fileName}`;
                const imageRef = storageRef(storage, path);

                await uploadBytes(imageRef, file);
                const downloadURL = await getDownloadURL(imageRef);
                newUrls.push(downloadURL);
            }

            setUploadedImages(prev => [...prev, ...newUrls]);
        } catch (error) {
            console.error("Failed to upload images:", error);
            alert("Failed to upload some images.");
        } finally {
            setUploadingImages(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (url: string) => {
        setUploadedImages(prev => prev.filter(u => u !== url));
    };

    const generateClub = () => {
        if (!prompt && uploadedImages.length === 0) return;
        setStep('generating');

        setTimeout(() => setLoadingText('Structuring landing page...'), 1500);
        setTimeout(() => setLoadingText('Writing copy...'), 3000);
        setTimeout(() => setLoadingText('Incorporating your assets...'), 4500);
        setTimeout(() => setLoadingText('Generating stunning visuals...'), 6000);

        setTimeout(() => {
            const words = prompt.split(' ');
            const themeTitle = words.length > 2 ? words.slice(0, 3).join(' ') : (club?.name || "Premium");

            const defaultImages = [
                "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop"
            ];

            const useImages = uploadedImages.length > 0 ? uploadedImages : defaultImages;

            setConfig({
                heroTitle: `${themeTitle} Club`,
                heroSubtitle: prompt.length > 10 ? prompt : "A space purposely built for those ready to push limits.",
                heroImage: useImages[0],
                aboutText: `Welcome to ${themeTitle} Club. We brought this community together because: ${prompt}`,
                features: ["Chat", "Challenges", "Leaderboard", "Community"],
                assets: useImages,
                additionalAspect: prompt ? "Based on your prompt, we've optimized this page to focus heavily on community engagement and high-intensity visualization." : null,
                colors: { primary: "#E0FE10", background: "#0E0E10" } // generated color theme mock
            });
            setStep('preview');
        }, 7500);
    };

    return (
        <div className="bg-[#0E0E10] min-h-screen text-white font-sans overflow-y-auto">
            {onCancel && (
                <button
                    onClick={onCancel}
                    className="absolute top-6 left-6 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                    <FiX size={24} />
                </button>
            )}

            <AnimatePresence mode="wait">
                {step === 'prompt' && (
                    <motion.div
                        key="prompt"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="max-w-4xl mx-auto pt-24 px-6 pb-32"
                    >
                        <div className="text-center mb-12">
                            <motion.div
                                initial={{ scale: 0.9 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className="inline-block p-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 mb-6"
                            >
                                <div className="px-4 py-2 rounded-full border border-emerald-500/30 bg-black/40 backdrop-blur-md text-sm text-emerald-300 font-medium">
                                    Pulse Club Studio AI ✨
                                </div>
                            </motion.div>
                            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
                                Design your perfect <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                                    landing page.
                                </span>
                            </h1>
                            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                                Describe the vibe, the audience, and your goals. Upload your own assets, and our AI will generate a stunning landing page to convert visitors into members.
                            </p>
                        </div>

                        {/* Editor Controls */}
                        <div className="bg-[#151518] border border-gray-800 rounded-3xl p-6 md:p-8 max-w-3xl mx-auto shadow-2xl">

                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-gray-300 mb-2">1. Your AI Prompt</label>
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="e.g. A high-intensity interval training club for busy founders in NYC, focusing on mental toughness and early morning workouts..."
                                        className="relative w-full bg-[#0E0E10] border border-white/10 text-white placeholder-gray-600 px-5 py-4 rounded-2xl focus:outline-none focus:border-emerald-500/50 resize-none h-32"
                                    />
                                </div>
                            </div>

                            <div className="mb-8">
                                <label className="block text-sm font-semibold text-gray-300 mb-2">2. Visual Assets</label>
                                <p className="text-xs text-gray-500 mb-4">Upload images to be used by the AI in constructing your landing page. </p>

                                <div className="flex flex-wrap gap-4 mb-4">
                                    {uploadedImages.map((url, i) => (
                                        <div key={i} className="relative w-24 h-24 rounded-bl-lg rounded-tr-lg rounded-tl-lg overflow-hidden group border border-white/10">
                                            <img src={url} alt={`Asset ${i}`} className="w-full h-full object-cover" />
                                            <button onClick={() => removeImage(url)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                                <FiX size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImages}
                                        className="w-24 h-24 rounded-bl-lg rounded-tr-lg rounded-tl-lg border-2 border-dashed border-gray-700 hover:border-emerald-500/50 flex flex-col items-center justify-center text-gray-500 hover:text-emerald-400 transition-colors disabled:opacity-50"
                                    >
                                        {uploadingImages ? <span className="text-xs">Uploading</span> : (
                                            <>
                                                <FiImage size={24} className="mb-1" />
                                                <span className="text-xs font-semibold">Upload</span>
                                            </>
                                        )}
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={generateClub}
                                disabled={(!prompt && uploadedImages.length === 0)}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black py-4 rounded-xl disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all font-bold flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                            >
                                Generate Page <FiArrowRight size={20} className="ml-2" />
                            </button>
                        </div>

                    </motion.div>
                )}

                {step === 'generating' && (
                    <motion.div
                        key="generating"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center min-h-[80vh] text-center"
                    >
                        <div className="relative mb-12">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                className="w-32 h-32 rounded-full border-t-2 border-r-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.4)]"
                            />
                            <motion.div
                                animate={{ rotate: -360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                className="w-24 h-24 rounded-full border-b-2 border-l-2 border-teal-400 absolute top-4 left-4"
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-emerald-400">
                                <FiSliders size={32} />
                            </div>
                        </div>
                        <motion.h2
                            key={loadingText}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-2xl font-semibold text-white tracking-wide"
                        >
                            {loadingText}
                        </motion.h2>
                    </motion.div>
                )}

                {step === 'preview' && config && (
                    <motion.div
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative min-h-screen bg-black"
                    >
                        {/* Editor Top Bar */}
                        <div className="fixed top-0 left-0 right-0 h-16 bg-[#0E0E10]/90 backdrop-blur-lg border-b border-white/10 z-50 flex items-center justify-between px-6">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-sm font-semibold text-white">Preview Mode</span>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setStep('prompt')} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
                                    <FiEdit3 size={16} /> Edit Settings
                                </button>
                                <button onClick={() => onGenerated(config)} className="px-5 py-2 text-sm bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                                    <FiCheckCircle size={16} /> Save & Publish
                                </button>
                            </div>
                        </div>

                        {/* PREVIEW OF THE ACTUAL PAGE - matches club/[id] design */}
                        <div className="pt-16 pb-24 max-w-5xl mx-auto">
                            {/* Section 1: Hero */}
                            <div className="relative min-h-[85vh] w-full flex flex-col justify-end overflow-hidden rounded-b-3xl">
                                <div className="absolute inset-0 z-0">
                                    <img src={config.heroImage || club?.coverImageURL || "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop"} alt="Club Background" className="w-full h-full object-cover scale-105" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/70 to-transparent" />
                                </div>
                                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                                    <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#E0FE10]/10 blur-[120px]" />
                                </div>
                                <div className="relative z-10 px-6 pb-20 pt-20 w-full max-w-4xl mx-auto">
                                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-6">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#E0FE10] animate-pulse" />
                                        <span className="text-white/90 text-sm font-semibold tracking-wide uppercase">Active Now</span>
                                    </div>
                                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter">
                                        {config.heroTitle || club?.name || "Premium Club"}
                                    </h1>
                                    <p className="text-lg md:text-2xl text-gray-300 font-light mb-10 max-w-2xl">
                                        {config.heroSubtitle || config.aboutText || club?.description || "A space purposely built for those ready to push limits."}
                                    </p>
                                    <button className="bg-[#E0FE10] text-black font-bold px-8 py-4 rounded-xl opacity-70 cursor-not-allowed">
                                        Join Club (Preview)
                                    </button>
                                </div>
                            </div>

                            {/* Section 2: Marquee */}
                            <div className="py-6 overflow-hidden border-y border-white/10">
                                <div className="flex animate-marquee whitespace-nowrap w-max">
                                    {["Active members", "Daily workouts", "Live chat", "Challenges", "Leaderboards", "Community support"].flatMap((item, i) => [item, item]).map((item, i) => (
                                        <span key={i} className="mx-8 text-gray-400 font-semibold flex items-center gap-2">
                                            <span className="text-[#E0FE10]">◆</span> {item}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: Creator spotlight (club.creatorInfo or creatorFallback for host image/name) */}
                            {(() => {
                                const creator = (club?.creatorInfo?.displayName || club?.creatorInfo?.username || club?.creatorInfo?.profileImage?.profileImageURL)
                                    ? club.creatorInfo
                                    : creatorFallback;
                                const hasCreator = creator && (creator.displayName || creator.username || (creator as { profileImage?: { profileImageURL?: string } })?.profileImage?.profileImageURL);
                                return (
                                    <div className="py-16 px-6">
                                        <p className="text-sm font-semibold text-[#E0FE10] uppercase tracking-wider mb-4">Designed and led by</p>
                                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                                            <div className="relative shrink-0">
                                                {hasCreator ? (
                                                    <>
                                                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full ring-4 ring-[#E0FE10]/30 ring-offset-4 ring-offset-[#0E0E10] overflow-hidden">
                                                            <img
                                                                src={(creator as { profileImage?: { profileImageURL?: string } })?.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.displayName || creator.username || 'Coach')}`}
                                                                alt={creator.displayName || creator.username || 'Creator'}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div className="absolute -inset-1 rounded-full bg-[#E0FE10]/20 blur-xl -z-10" />
                                                    </>
                                                ) : (
                                                    <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-[#E0FE10]/30 flex items-center justify-center text-2xl font-black text-white/60">
                                                        ?
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-center md:text-left">
                                                <h2 className="text-2xl md:text-3xl font-bold text-white">
                                                    {hasCreator ? (creator.displayName || creator.username) : 'Your profile'}
                                                </h2>
                                                <p className="text-gray-400 font-semibold mb-2">Head Coach</p>
                                                {(config.aboutText || club?.description) && (
                                                    <blockquote className="text-gray-300 font-light leading-relaxed italic max-w-xl">
                                                        &quot;{config.aboutText || club?.description}&quot;
                                                    </blockquote>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Section 4: Features */}
                            <div className="py-16 px-6">
                                <div className="text-center mb-12">
                                    <h2 className="text-4xl font-black mb-4">Everything You Need To Level Up</h2>
                                    <p className="text-gray-400 max-w-2xl mx-auto">Join a community of like-minded individuals.</p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {(config.features && config.features.length > 0 ? config.features : ["Chat", "Challenges", "Leaderboard", "Community"]).map((ft: string, idx: number) => {
                                        let Icon = FiCheckCircle;
                                        let colorClass = "text-emerald-400 bg-emerald-500/10";
                                        if (ft.toLowerCase().includes('chat')) { Icon = FiMessageCircle; colorClass = "text-teal-400 bg-teal-500/10"; }
                                        if (ft.toLowerCase().includes('leaderboard')) { Icon = FiAward; colorClass = "text-purple-400 bg-purple-500/10"; }
                                        if (ft.toLowerCase().includes('challenges')) { Icon = FiActivity; colorClass = "text-orange-400 bg-orange-500/10"; }
                                        if (ft.toLowerCase().includes('community')) { Icon = FiUsers; colorClass = "text-blue-400 bg-blue-500/10"; }
                                        return (
                                            <div key={idx} className="bg-[#151518] p-6 rounded-3xl border border-white/5 text-center">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${colorClass}`}>
                                                    <Icon size={24} />
                                                </div>
                                                <h3 className="font-bold mb-1">{ft}</h3>
                                                <p className="text-xs text-gray-400">{getFeatureDescription(ft)}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 5: All Featured Rounds */}
                            <div className="py-16 px-6">
                                <div className="text-center mb-10">
                                    <p className="text-[#E0FE10] text-sm font-bold uppercase tracking-widest mb-2">Featured Rounds</p>
                                    <h2 className="text-3xl font-black mb-2">See What&apos;s Waiting Inside</h2>
                                    <p className="text-gray-400 text-sm">Join the club to get access to these rounds.</p>
                                </div>
                                {allRounds.length > 0 ? (
                                    <div className="max-w-2xl mx-auto flex flex-col gap-5">
                                        {allRounds.map((round) => {
                                            const challenge = round.challenge;
                                            const roundTitle = round.title || challenge?.title || 'Round';
                                            const roundSubtitle = round.subtitle || challenge?.subtitle || '';
                                            const workoutCount = round.sweatlistIds?.length ?? 0;
                                            const participantCount = (round as any)._participantCount ?? 0;
                                            const endDate = challenge?.endDate ? new Date(challenge.endDate) : null;
                                            const now = new Date();
                                            const isActive = endDate ? now <= endDate : true;
                                            return (
                                                <div key={round.id} className="rounded-2xl border border-white/10 bg-[#151518] p-5 md:p-6">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="min-w-0">
                                                            <h3 className="text-lg font-bold text-white truncate">{roundTitle}</h3>
                                                            {roundSubtitle && <p className="text-gray-400 text-sm mt-0.5 line-clamp-1">{roundSubtitle}</p>}
                                                        </div>
                                                        <span className={`shrink-0 ml-3 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${isActive ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}>
                                                            {isActive ? 'Live' : 'Ended'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E0FE10]/10 text-[#E0FE10] font-semibold text-sm">
                                                            <FiActivity className="w-3.5 h-3.5" />
                                                            {workoutCount} workout{workoutCount !== 1 ? 's' : ''}
                                                        </span>
                                                        {participantCount > 0 && (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 font-semibold text-sm">
                                                                <FiUsers className="w-3.5 h-3.5" />
                                                                {participantCount} participant{participantCount !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="max-w-md mx-auto border border-dashed border-white/20 rounded-3xl p-8 text-center">
                                        <FiActivity className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-500 text-sm">No rounds linked yet.</p>
                                        <p className="text-gray-600 text-xs mt-1">Create a round and link it to your club to preview it here.</p>
                                    </div>
                                )}
                            </div>

                            {/* Section 6: Stats — member count when available */}
                            <div className="py-16 px-6">
                                <div className="bg-[#151518] border border-white/10 rounded-3xl p-8 text-center">
                                    <h2 className="text-xl font-bold text-white mb-6">Join others already training</h2>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div><p className="text-3xl font-black text-[#E0FE10]">{club?.memberCount != null ? club.memberCount.toLocaleString() : '—'}</p><p className="text-gray-400 text-sm">Members</p></div>
                                        <div><p className="text-3xl font-black text-[#E0FE10]">{totalWorkoutsCompleted != null ? totalWorkoutsCompleted.toLocaleString() : '—'}</p><p className="text-gray-400 text-sm">Workouts Completed</p></div>
                                        <div><p className="text-3xl font-black text-[#E0FE10]">24/7</p><p className="text-gray-400 text-sm">Community</p></div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 7: Final CTA */}
                            <div className="py-16 px-6">
                                <div className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/10 p-10 text-center">
                                    <h2 className="text-3xl font-black text-white mb-4">Ready to Join {config.heroTitle || club?.name || "Your Club"}?</h2>
                                    <p className="text-gray-300 mb-8 max-w-xl mx-auto">{config.aboutText || club?.description || "Get started today."}</p>
                                    <button className="bg-[#E0FE10] text-black font-bold px-8 py-4 rounded-xl opacity-70 cursor-not-allowed">
                                        Join Club (Preview)
                                    </button>
                                    <p className="text-gray-500 text-sm mt-6">Powered by Pulse</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
