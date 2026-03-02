import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import PageHead from '../components/PageHead';
import { useRouter } from 'next/router';
import { FiArrowRight, FiUsers, FiTarget, FiActivity, FiCheckCircle, FiShare2, FiEdit3, FiSliders, FiArrowLeft, FiSettings, FiCamera, FiX, FiCheck, FiStar, FiUserMinus, FiMoreVertical } from 'react-icons/fi';
import { useUser } from '../hooks/useUser';
import { clubService } from '../api/firebase/club/service';
import { Club, ClubMember } from '../api/firebase/club/types';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { workoutService } from '../api/firebase/workout/service';
import { SweatlistCollection } from '../api/firebase/workout/types';
import { userService, User, ShortUser } from '../api/firebase/user';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';

import LandingPageBuilder from '../components/club/LandingPageBuilder';

const ManageClubDashboard = ({ club, setClub }: { club: Club, setClub: (c: Club) => void }) => {
    const router = useRouter();
    const currentUser = useUser();
    const dispatch = useDispatch();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Landing Page Modal State
    const [showLandingPageModal, setShowLandingPageModal] = useState(false);
    const [totalWorkoutsCompleted, setTotalWorkoutsCompleted] = useState<number | null>(null);
    const [allRounds, setAllRounds] = useState<SweatlistCollection[]>([]);

    // Featured Rounds Modal State
    const [showRoundsModal, setShowRoundsModal] = useState(false);
    const [userCollections, setUserCollections] = useState<SweatlistCollection[]>([]);
    const [draftFeatured, setDraftFeatured] = useState<string[]>([]);

    // Members Modal State
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [clubMembers, setClubMembers] = useState<ClubMember[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [loadingRounds, setLoadingRounds] = useState(false);
    const [activeMemberMenu, setActiveMemberMenu] = useState<string | null>(null);

    const handleRemoveMember = async (userId: string) => {
        if (!club) return;
        if (window.confirm("Are you sure you want to remove this member?")) {
            try {
                await clubService.leaveClub(club.id, userId);
                setClubMembers(prev => prev.filter(m => m.userId !== userId));
                setClub({ ...club, memberCount: Math.max(0, club.memberCount - 1) } as Club);
            } catch (error) {
                console.error("Failed to remove member:", error);
                alert("Failed to remove member. Please try again.");
            }
        }
    };

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

    // Fetch total workouts + active linked round when landing page builder opens
    useEffect(() => {
        if (showLandingPageModal && club?.id) {
            setTotalWorkoutsCompleted(null);
            clubService.getTotalWorkoutsCompletedByMembers(club.id)
                .then(setTotalWorkoutsCompleted)
                .catch(() => setTotalWorkoutsCompleted(null));

            const linkedIds = club.linkedRoundIds || [];
            const featuredIds = currentUser?.featuredRoundIds || [];
            const allRoundIds = [...new Set([...linkedIds, ...featuredIds])];
            if (allRoundIds.length > 0) {
                setAllRounds([]);
                Promise.all(allRoundIds.map(id => workoutService.getCollectionById(id).catch(() => null)))
                    .then(async collections => {
                        const valid = collections.filter((c): c is SweatlistCollection => c !== null);
                        // Fetch real participant counts from user-challenge collection
                        // (challenge.participants is never populated — real data is in user-challenge docs)
                        const participantCounts = await Promise.all(
                            valid.map(col =>
                                workoutService.fetchUserChallengesByChallengeId(col.id)
                                    .then(uc => uc.length)
                                    .catch(() => 0)
                            )
                        );
                        // Attach real counts and sort by most activity
                        const enriched = valid.map((col, i) => {
                            (col as any)._participantCount = participantCounts[i];
                            return col;
                        });
                        enriched.sort((a, b) => {
                            const aScore = ((a as any)._participantCount || 0) + (a.sweatlistIds?.length ?? 0);
                            const bScore = ((b as any)._participantCount || 0) + (b.sweatlistIds?.length ?? 0);
                            return bScore - aScore;
                        });
                        setAllRounds(enriched);
                    })
                    .catch(() => setAllRounds([]));
            } else {
                setAllRounds([]);
            }
        }
    }, [showLandingPageModal, club?.id]);

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

    const handleOpenMembers = async () => {
        if (!club) return;
        setShowMembersModal(true);
        setLoadingMembers(true);
        try {
            const members = await clubService.getClubMembers(club.id);
            setClubMembers(members);
        } catch (error) {
            console.error("Failed to load members:", error);
        } finally {
            setLoadingMembers(false);
        }
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
                        onClick={() => router.push('/manage-clubs')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <FiArrowLeft /> Back to My Clubs
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
                    <button
                        onClick={() => setShowLandingPageModal(true)}
                        className="bg-[#151518] border border-white/5 hover:border-emerald-500/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden"
                    >
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

                    <button
                        onClick={handleOpenMembers}
                        className="bg-[#151518] border border-white/5 hover:border-teal-500/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-bl-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center mb-4 md:mb-6 relative z-10">
                            <FiUsers size={24} />
                        </div>
                        <h3 className="text-lg md:text-xl font-bold mb-2 relative z-10">Members</h3>
                        <p className="text-gray-400 text-xs md:text-sm relative z-10">View and manage your club members, their roles, and track their participation.</p>
                    </button>

                    <button
                        onClick={() => router.push('/club-analytics')}
                        className="bg-[#151518] border border-white/5 hover:border-purple-500/50 p-6 md:p-8 rounded-3xl transition-all group text-left relative overflow-hidden"
                    >
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

                {/* Landing Page Modal */}
                <AnimatePresence>
                    {showLandingPageModal && (
                        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/90 backdrop-blur-md">
                            <LandingPageBuilder
                                club={club}
                                creatorFallback={currentUser ? { displayName: currentUser.displayName, username: currentUser.username, profileImage: currentUser.profileImage } : null}
                                totalWorkoutsCompleted={totalWorkoutsCompleted}
                                allRounds={allRounds}
                                onCancel={() => setShowLandingPageModal(false)}
                                onGenerated={async (config) => {
                                    const updatedClub = new Club({ ...club.toDictionary(), landingPageConfig: config, name: config.heroTitle || club.name, description: config.aboutText || club.description, coverImageURL: config.heroImage || club.coverImageURL, updatedAt: new Date() });
                                    try {
                                        await clubService.updateClub(updatedClub);
                                        setClub(updatedClub);
                                        setShowLandingPageModal(false);
                                    } catch (err) {
                                        console.error(err);
                                        alert("Failed to save landing page.");
                                    }
                                }}
                            />
                        </div>
                    )}
                </AnimatePresence>

                {/* Members Modal */}
                <AnimatePresence>
                    {showMembersModal && (
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
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold flex items-center gap-3">
                                        <FiUsers className="text-teal-400" />
                                        Club Members
                                    </h3>
                                    <button
                                        onClick={() => setShowMembersModal(false)}
                                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                    >
                                        <FiX size={20} />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                    {loadingMembers ? (
                                        <div className="flex justify-center py-12">
                                            <div className="w-8 h-8 rounded-full border-t-2 border-teal-400 animate-spin"></div>
                                        </div>
                                    ) : clubMembers.length === 0 ? (
                                        <div className="text-center py-12 px-6 bg-[#151518] rounded-2xl border border-white/5">
                                            <FiUsers className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                            <p className="text-gray-400 mb-2">No members yet.</p>
                                            <p className="text-sm text-gray-500">Share your invite link to grow your club!</p>
                                        </div>
                                    ) : clubMembers.map(member => (
                                        <div key={member.id} className="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-[#151518]">
                                            <div className="flex items-center gap-4">
                                                <img
                                                    src={member.userInfo?.profileImage?.profileImageURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.userInfo?.displayName || 'User')}&background=random`}
                                                    alt={member.userInfo?.displayName}
                                                    className="w-12 h-12 rounded-full object-cover bg-zinc-800"
                                                />
                                                <div>
                                                    <p className="font-bold text-white">{member.userInfo?.displayName}</p>
                                                    <p className="text-sm text-gray-500">@{member.userInfo?.username}</p>
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center justify-end gap-3 relative">
                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400">
                                                    Joined
                                                </span>
                                                {member.userId !== club.creatorId && (
                                                    <div className="relative">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveMemberMenu(activeMemberMenu === member.id ? null : member.id);
                                                            }}
                                                            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                                        >
                                                            <FiMoreVertical size={18} />
                                                        </button>

                                                        {activeMemberMenu === member.id && (
                                                            <>
                                                                <div
                                                                    className="fixed inset-0 z-40"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveMemberMenu(null);
                                                                    }}
                                                                />
                                                                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1E1E21] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[60]">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveMember(member.userId);
                                                                            setActiveMemberMenu(null);
                                                                        }}
                                                                        className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-3 transition-colors font-medium"
                                                                    >
                                                                        <FiUserMinus size={16} />
                                                                        Remove Member
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
    const { clubId } = router.query;

    useEffect(() => {
        if (!currentUser?.id || !router.isReady) {
            setLoadingClub(false);
            return;
        }

        const loadClub = async () => {
            try {
                let fetchedClub: Club | null = null;

                if (clubId && typeof clubId === 'string') {
                    // Load specific club by ID
                    fetchedClub = await clubService.getClubById(clubId);
                }

                if (!fetchedClub) {
                    // Fallback: get or create the default club
                    fetchedClub = await clubService.getOrCreateClub(currentUser);
                }

                setClub(fetchedClub);
            } catch (err) {
                console.error("Failed to load club:", err);
            } finally {
                setLoadingClub(false);
            }
        };

        loadClub();
    }, [currentUser?.id, clubId, router.isReady]);

    return (
        <div className="min-h-screen bg-[#0E0E10] min-h-screen text-white font-sans overflow-hidden">
            <PageHead
                pageOgUrl="https://fitwithpulse.ai/club-studio"
                metaData={{
                    pageId: 'club-studio',
                    pageTitle: 'Club Studio | Pulse',
                    metaDescription: 'Manage your club on Pulse.',
                    ogTitle: 'Club Studio | Pulse',
                    ogDescription: 'Manage your club on Pulse.',
                    lastUpdated: new Date().toISOString()
                }}
            />

            {loadingClub && (
                <div className="flex flex-col items-center justify-center min-h-screen text-center">
                    <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                    <p className="text-white">Loading your club...</p>
                </div>
            )}

            {!loadingClub && club && (
                <ManageClubDashboard club={club} setClub={setClub} />
            )}
        </div>
    );
}
