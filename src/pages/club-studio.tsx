import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { FiArrowRight, FiUsers, FiTarget, FiActivity, FiCheckCircle, FiShare2, FiEdit3, FiSliders, FiArrowLeft, FiSettings, FiCamera, FiX, FiCheck, FiStar } from 'react-icons/fi';
import { useUser } from '../hooks/useUser';
import { clubService } from '../api/firebase/club/service';
import { Club } from '../api/firebase/club/types';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { workoutService } from '../api/firebase/workout/service';
import { SweatlistCollection } from '../api/firebase/workout/types';
import { userService, User } from '../api/firebase/user';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';

type Step = 'prompt' | 'generating' | 'preview';

function ClubGenerator({ onGenerated }: { onGenerated: () => void }) {
    const [step, setStep] = useState<Step>('prompt');
    const [prompt, setPrompt] = useState('');
    const [loadingText, setLoadingText] = useState('Analyzing audience...');

    // Generated fake data
    const [clubName, setClubName] = useState('My Awesome Club');
    const [bgImage, setBgImage] = useState("https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop");

    const generateClub = () => {
        if (!prompt) return;
        setStep('generating');

        // Simulate generation steps
        setTimeout(() => setLoadingText('Structuring landing page...'), 1500);
        setTimeout(() => setLoadingText('Writing copy...'), 3000);
        setTimeout(() => setLoadingText('Generating stunning visuals...'), 4500);

        setTimeout(() => {
            // Basic heuristic to pick a title from prompt
            setClubName(prompt.split(' ').slice(0, 3).join(' ') + " Club");
            // Pick a random bg image
            const images = [
                "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=2069&auto=format&fit=crop"
            ];
            setBgImage(images[Math.floor(Math.random() * images.length)]);
            setStep('preview');
        }, 6000);
    };

    return (
        <AnimatePresence mode="wait">
            {step === 'prompt' && (
                <motion.div
                    key="prompt"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="max-w-4xl mx-auto pt-32 px-6"
                >
                    <div className="text-center mb-16">
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
                            Instantly build your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                                community landing page.
                            </span>
                        </h1>
                        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                            No coding or design skills needed. Describe your perfect club, and our AI will generate a stunning landing page to convert visitors into members.
                        </p>
                    </div>

                    {/* Prompt Input */}
                    <div className="relative group max-w-2xl mx-auto mb-24 z-10">
                        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500"></div>
                        <div className="relative flex items-center bg-[#151518] border border-gray-800 rounded-2xl p-2 shadow-2xl">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="e.g. A high-intensity interval training club for busy founders in NYC, focusing on mental toughness and early morning workouts..."
                                className="w-full bg-transparent text-white placeholder-gray-600 px-4 py-4 focus:outline-none resize-none h-24"
                            />
                            <button
                                onClick={generateClub}
                                disabled={!prompt}
                                className="absolute bottom-4 right-4 bg-emerald-500 hover:bg-emerald-400 text-black p-3 rounded-xl disabled:opacity-40 disabled:hover:bg-emerald-500 transition-all font-bold flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                            >
                                <FiArrowRight size={20} />
                            </button>
                        </div>
                    </div>

                    {/* How it Works Section */}
                    <div className="pt-20 border-t border-white/5 relative z-0 pb-32">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-white mb-4">How Pulse Clubs Work</h2>
                            <p className="text-gray-400">Everything you need to host, manage, and monetize your community.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="bg-[#151518] border border-white/5 p-8 rounded-2xl hover:border-emerald-500/30 transition-colors">
                                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 text-emerald-400">
                                    <FiActivity size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">1. Build The Experience</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    Upload your programs, daily workouts, and exclusive content. Set your monthly subscription or one-time entry fee.
                                </p>
                            </div>
                            <div className="bg-[#151518] border border-white/5 p-8 rounded-2xl hover:border-emerald-500/30 transition-colors">
                                <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center mb-6 text-teal-400">
                                    <FiUsers size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">2. Launch & Grow</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    Generate your stunning landing page with AI. Share the link on your socials and watch your community grow.
                                </p>
                            </div>
                            <div className="bg-[#151518] border border-white/5 p-8 rounded-2xl hover:border-emerald-500/30 transition-colors">
                                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 text-purple-400">
                                    <FiTarget size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-3">3. Engage & Lead</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    Host live events, drop new workouts in the shared feed, and manage participant leaderboards inside the app.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {step === 'generating' && (
                <motion.div
                    key="generating"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center min-h-screen text-center"
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

            {step === 'preview' && (
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
                                <FiEdit3 size={16} /> Edit Prompt
                            </button>
                            <button onClick={onGenerated} className="px-5 py-2 text-sm bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                                <FiCheckCircle size={16} /> Continue
                            </button>
                        </div>
                    </div>

                    {/* Generated Landing Page Content */}
                    <div className="pt-16 pb-24">
                        <div className="relative h-[80vh] w-full flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 z-0">
                                <img src={bgImage} alt="Club Background" className="w-full h-full object-cover scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
                            </div>

                            <div className="relative z-10 text-center max-w-4xl px-6 pt-20">
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-sm font-medium border border-white/20 mb-8"
                                >
                                    Host: You
                                </motion.div>
                                <motion.h1
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-6xl md:text-8xl font-black text-white mb-6 uppercase tracking-tighter"
                                >
                                    {clubName}
                                </motion.h1>
                                <motion.p
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-xl md:text-2xl text-gray-300 font-light mb-12 max-w-2xl mx-auto"
                                >
                                    Generated exclusively from your prompt. A space purposely built for those ready to push limits.
                                </motion.p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

const ManageClubDashboard = ({ club, setClub }: { club: Club, setClub: (c: Club) => void }) => {
    const router = useRouter();
    const currentUser = useUser();
    const dispatch = useDispatch();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Featured Rounds Modal State
    const [showRoundsModal, setShowRoundsModal] = useState(false);
    const [userCollections, setUserCollections] = useState<SweatlistCollection[]>([]);
    const [draftFeatured, setDraftFeatured] = useState<string[]>([]);
    const [loadingRounds, setLoadingRounds] = useState(false);

    const [roundTab, setRoundTab] = useState<'active' | 'completed'>('active');
    const [relaunchPrompt, setRelaunchPrompt] = useState<SweatlistCollection | null>(null);

    const now = new Date();
    const activeCollections = userCollections.filter(c => {
        const endDate = c.challenge?.endDate ? new Date(c.challenge.endDate) : null;
        return !endDate || now <= endDate;
    });

    const completedCollections = userCollections.filter(c => {
        const endDate = c.challenge?.endDate ? new Date(c.challenge.endDate) : null;
        return endDate && now > endDate;
    });

    const displayCollections = roundTab === 'active' ? activeCollections : completedCollections;

    useEffect(() => {
        if (showRoundsModal && currentUser?.id) {
            setLoadingRounds(true);
            setDraftFeatured(currentUser.featuredRoundIds || []);
            workoutService.fetchCollections(currentUser.id).then(cols => {
                setUserCollections(cols.filter(c => c.challenge));
            }).finally(() => {
                setLoadingRounds(false);
            });
        }
    }, [showRoundsModal, currentUser?.id]);

    const handleSaveFeatured = async () => {
        if (!currentUser) return;
        try {
            const updatedUser = new User(currentUser.id, {
                ...currentUser.toDictionary(),
                featuredRoundIds: draftFeatured,
                updatedAt: new Date(),
            });
            await userService.updateUser(currentUser.id, updatedUser);
            dispatch(setUser(updatedUser.toDictionary()));
            setShowRoundsModal(false);
        } catch (error) {
            console.error("Failed to update featured rounds:", error);
            alert("Failed to save. Please try again.");
        }
    };

    const toggleFeatured = (id: string, isCompleted: boolean = false, collection?: SweatlistCollection) => {
        if (isCompleted && collection) {
            setRelaunchPrompt(collection);
            return;
        }
        setDraftFeatured(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleCopyLink = () => {
        // TODO: copy actual link
        navigator.clipboard.writeText(`https://fitwithpulse.ai/club/${club.id}`);
        alert("Invite link copied!");
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        try {
            setUploadingImage(true);
            const storage = getStorage();
            const fileName = `${Date.now()}_cover_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
            const imageRef = storageRef(storage, `club-covers/${club.id}/${fileName}`);

            await uploadBytes(imageRef, file);
            const downloadURL = await getDownloadURL(imageRef);

            // Update the club model
            club.coverImageURL = downloadURL;
            await clubService.updateClub(club);
            setClub({ ...club } as Club); // Trigger re-render with updated club instance
        } catch (error) {
            console.error("Failed to upload cover image:", error);
            alert("Failed to upload cover image. Please try again.");
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <div className="min-h-screen bg-[#0E0E10] text-white">
            <div className="max-w-6xl mx-auto px-6 py-12 md:py-24">
                <div className="flex items-center justify-between mb-12">
                    <button
                        onClick={() => router.push('/creator')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <FiArrowLeft /> Back to Creator Studio
                    </button>
                    <button
                        onClick={handleCopyLink}
                        className="px-5 py-2.5 bg-white hover:bg-gray-200 text-black rounded-xl font-bold transition-colors flex items-center gap-2"
                    >
                        <FiShare2 />
                        Invite Link
                    </button>
                </div>

                {/* Club Profile Card */}
                <div className="relative rounded-3xl overflow-hidden mb-12 border border-white/10 group">
                    <div className="absolute inset-0 z-0">
                        <img
                            src={club.coverImageURL || "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop"}
                            alt="Cover"
                            className="w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E10] via-[#0E0E10]/80 to-transparent" />
                    </div>

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="absolute top-6 right-6 z-30 opacity-0 group-hover:opacity-100 md:px-5 px-3 py-2.5 bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border border-white/20 rounded-full font-bold transition-all flex items-center gap-2 shadow-2xl disabled:opacity-50"
                    >
                        <FiCamera className="w-5 h-5" />
                        <span className="hidden md:inline">{uploadingImage ? 'Uploading...' : 'Update Cover'}</span>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                    />

                    <div className="relative z-10 p-8 md:p-12 flex flex-col md:flex-row gap-8 items-end pointer-events-none">
                        <div className="flex-1 pointer-events-auto">
                            <h2 className="text-5xl md:text-6xl font-black mb-4 tracking-tight drop-shadow-2xl">{club.name}</h2>
                            <p className="text-lg text-gray-300 max-w-2xl drop-shadow-md">
                                {club.description || "Your exclusive community space."}
                            </p>
                        </div>
                        <div className="flex gap-4 pointer-events-auto">
                            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl min-w-[120px] text-center">
                                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Members</p>
                                <p className="text-4xl font-black text-white">{club.memberCount}</p>
                            </div>
                            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-5 rounded-2xl min-w-[120px] text-center">
                                <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Active Rounds</p>
                                <p className="text-4xl font-black text-white">{currentUser?.featuredRoundIds?.length || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <button className="bg-[#151518] border border-white/5 hover:border-emerald-500/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 md:mb-6 relative z-10">
                            <FiEdit3 size={24} />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold mb-2 relative z-10">Landing Page</h3>
                        <p className="text-gray-400 text-xs md:text-sm relative z-10">Customize your club's public-facing landing page, cover image, and description.</p>
                    </button>

                    <button
                        onClick={() => setShowRoundsModal(true)}
                        className="bg-[#151518] border border-white/5 hover:border-[#E0FE10]/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#E0FE10]/10 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-[#E0FE10]/10 text-[#E0FE10] flex items-center justify-center mb-4 md:mb-6 relative z-10">
                            <FiStar size={24} />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold mb-2 relative z-10">Featured Rounds</h3>
                        <p className="text-gray-400 text-xs md:text-sm relative z-10">Manage which of your rounds appear directly on your club and public profile.</p>
                    </button>

                    <button className="bg-[#151518] border border-white/5 hover:border-teal-500/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 md:mb-6 relative z-10">
                            <FiUsers size={24} />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold mb-2 relative z-10">Members</h3>
                        <p className="text-gray-400 text-xs md:text-sm relative z-10">View and manage your club members, their roles, and track their participation.</p>
                    </button>

                    <button className="bg-[#151518] border border-white/5 hover:border-purple-500/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 md:mb-6 relative z-10">
                            <FiActivity size={24} />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold mb-2 relative z-10">Analytics</h3>
                        <p className="text-gray-400 text-xs md:text-sm relative z-10">Track engagement, retention, and revenue from your active community members.</p>
                    </button>
                </div>

                {/* Advanced Settings */}
                <div className="mt-12 bg-[#151518] border border-white/5 rounded-3xl p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <FiSettings className="text-gray-400" size={24} />
                        <h3 className="text-2xl font-bold">Preferences</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 border border-white/5 rounded-2xl bg-[#0E0E10] flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-lg mb-1">Make Club Private</h4>
                                <p className="text-sm text-gray-500">Require approval for new members joining.</p>
                            </div>
                            <div className="w-12 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                                <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full"></div>
                            </div>
                        </div>
                        <div className="p-6 border border-white/5 rounded-2xl bg-[#0E0E10] flex items-center justify-between">
                            <div>
                                <h4 className="font-semibold text-lg mb-1">Pause New Signups</h4>
                                <p className="text-sm text-gray-500">Temporarily hide your landing page.</p>
                            </div>
                            <div className="w-12 h-6 bg-gray-700 rounded-full relative cursor-pointer">
                                <div className="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Featured Rounds Modal */}
                <AnimatePresence>
                    {showRoundsModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 20 }}
                                transition={{ type: 'spring', bounce: 0.4, duration: 0.5 }}
                                className="bg-[#0E0E10] border border-white/10 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl"
                            >
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-2xl font-bold">Featured Rounds</h3>
                                    <button
                                        onClick={() => {
                                            setShowRoundsModal(false);
                                            setRelaunchPrompt(null);
                                        }}
                                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                    >
                                        <FiX size={20} />
                                    </button>
                                </div>

                                {relaunchPrompt ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                                        <FiActivity className="w-16 h-16 text-[#E0FE10] mb-6" />
                                        <h3 className="text-2xl font-bold mb-3">Round is Over</h3>
                                        <p className="text-gray-400 max-w-sm mb-8 leading-relaxed">
                                            "{relaunchPrompt.challenge?.title}" has already ended. Completed rounds cannot be featured as active. Would you like to re-launch it with new dates?
                                        </p>
                                        <div className="flex gap-4 w-full md:w-auto">
                                            <button
                                                onClick={() => setRelaunchPrompt(null)}
                                                className="flex-1 md:flex-none px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => router.push(`/createRound?duplicateId=${relaunchPrompt.id}`)}
                                                className="flex-1 md:flex-none px-6 py-3.5 rounded-xl bg-[#E0FE10] hover:bg-[#c8e60e] text-black font-bold transition"
                                            >
                                                Re-launch Round
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-gray-400 mb-6 font-light leading-relaxed max-w-lg">
                                            Select the rounds you want to feature. These will be highlighted on your public profile and your club's landing page!
                                        </p>

                                        {/* Tabs */}
                                        <div className="flex gap-6 border-b border-white/10 mb-4 pb-0">
                                            <button
                                                className={`font-semibold pb-3 border-b-2 transition-all flex items-center gap-2 ${roundTab === 'active' ? 'border-[#E0FE10] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                                onClick={() => setRoundTab('active')}
                                            >
                                                Active
                                                <span className={`text-xs py-0.5 px-2 rounded-full ${roundTab === 'active' ? 'bg-white/10 text-gray-200' : 'bg-white/5 text-gray-500'}`}>{activeCollections.length}</span>
                                            </button>
                                            <button
                                                className={`font-semibold pb-3 border-b-2 transition-all flex items-center gap-2 ${roundTab === 'completed' ? 'border-[#E0FE10] text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                                                onClick={() => setRoundTab('completed')}
                                            >
                                                Completed
                                                <span className={`text-xs py-0.5 px-2 rounded-full ${roundTab === 'completed' ? 'bg-white/10 text-gray-200' : 'bg-white/5 text-gray-500'}`}>{completedCollections.length}</span>
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6 custom-scrollbar">
                                            {loadingRounds ? (
                                                <div className="flex justify-center py-12">
                                                    <div className="w-8 h-8 rounded-full border-t-2 border-[#E0FE10] animate-spin"></div>
                                                </div>
                                            ) : displayCollections.length === 0 ? (
                                                <div className="text-center py-12 px-6 bg-[#151518] rounded-2xl border border-white/5">
                                                    <FiActivity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                                    <p className="text-gray-400 mb-2">No {roundTab} rounds found.</p>
                                                    {roundTab === 'active' && <p className="text-sm text-gray-500">Go to Creator Studio to build your first round!</p>}
                                                </div>
                                            ) : displayCollections.map(collection => {
                                                const isDrafted = draftFeatured.includes(collection.id);
                                                const isCompletedMode = roundTab === 'completed';

                                                return (
                                                    <div
                                                        key={collection.id}
                                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group select-none ${isDrafted
                                                                ? 'bg-[#E0FE10]/10 border-[#E0FE10]/30 hover:bg-[#E0FE10]/20'
                                                                : isCompletedMode
                                                                    ? 'bg-[#151518]/50 border-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                                                                    : 'bg-[#151518] border-white/5 hover:border-white/10'
                                                            }`}
                                                        onClick={() => toggleFeatured(collection.id, isCompletedMode, collection)}
                                                    >
                                                        <div className="flex-1 pr-4">
                                                            <h4 className={`font-bold mb-1 transition-colors ${isDrafted ? 'text-[#E0FE10]' : 'text-white'}`}>
                                                                {collection.challenge?.title || 'Untitled'}
                                                            </h4>
                                                            <p className="text-xs text-gray-500 line-clamp-1">
                                                                {collection.challenge?.subtitle || 'No description provided'}
                                                            </p>
                                                        </div>

                                                        {!isCompletedMode ? (
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isDrafted
                                                                    ? 'bg-[#E0FE10] text-black scale-110 shadow-[0_0_15px_rgba(224,254,16,0.5)]'
                                                                    : 'bg-black/50 border border-gray-600 group-hover:border-gray-500'
                                                                }`}>
                                                                {isDrafted && <FiCheck size={16} strokeWidth={3} />}
                                                            </div>
                                                        ) : (
                                                            <div className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-semibold text-gray-300 group-hover:bg-white/20 transition-colors">
                                                                View
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        <div className="flex justify-end pt-6 border-t border-white/10 mt-auto">
                                            <button
                                                onClick={handleSaveFeatured}
                                                className="px-8 py-3.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl flex items-center gap-2"
                                            >
                                                <FiCheckCircle className="w-5 h-5" /> Save Changes
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function ClubStudioPage() {
    const currentUser = useUser();
    const router = useRouter();
    const [club, setClub] = useState<Club | null>(null);
    const [loadingClub, setLoadingClub] = useState(true);

    useEffect(() => {
        if (!currentUser?.id) {
            setLoadingClub(false);
            return;
        }

        // Fetch user's club using clubService
        clubService.getClubByCreatorId(currentUser.id)
            .then((fetchedClub) => {
                setClub(fetchedClub);
            })
            .catch((err) => {
                console.error("Failed to load club:", err);
            })
            .finally(() => {
                setLoadingClub(false);
            });
    }, [currentUser?.id]);

    return (
        <div className="min-h-screen bg-[#0E0E10] min-h-screen text-white font-sans overflow-hidden">
            <Head>
                <title>Club Studio | Pulse</title>
            </Head>

            {loadingClub && (
                <div className="flex flex-col items-center justify-center min-h-screen text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="text-white">Loading your club...</p>
                </div>
            )}

            {!loadingClub && club && (
                <ManageClubDashboard club={club} setClub={setClub} />
            )}

            {!loadingClub && !club && (
                <ClubGenerator onGenerated={() => {
                    // Navigate to back to manage club or create one?
                    // As a dummy action for now, reload or mock club
                    setClub(new Club({
                        id: 'fake-id',
                        name: 'My New Club',
                        description: 'Generated from AI Prompt.',
                        coverImageURL: '',
                        memberCount: 1,
                        creatorId: currentUser?.id || '',
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        creatorInfo: {}
                    }));
                }} />
            )}
        </div>
    );
}
