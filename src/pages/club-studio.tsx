import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHead from '../components/PageHead';
import { useRouter } from 'next/router';
import { FiUsers, FiActivity, FiCheckCircle, FiShare2, FiEdit3, FiSliders, FiArrowLeft, FiSettings, FiCamera, FiX, FiCheck, FiStar, FiUserMinus, FiMoreVertical } from 'react-icons/fi';
import { useUser } from '../hooks/useUser';
import { clubService } from '../api/firebase/club/service';
import { Club, ClubActivationConfig, ClubMember, ClubMemberProfile, ClubPairing, ClubPairingSuggestion, ClubSafetyReport } from '../api/firebase/club/types';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { workoutService } from '../api/firebase/workout/service';
import { SweatlistCollection } from '../api/firebase/workout/types';
import { userService, User } from '../api/firebase/user';
import { useDispatch } from 'react-redux';
import { setUser } from '../redux/userSlice';

import LandingPageBuilder from '../components/club/LandingPageBuilder';
import { SYSTEM_ACTIVATION_QUESTIONS } from '../api/firebase/club/activation';
import { buildClubOneLink } from '../utils/clubLinks';
import { trackClubShareLinkCopied } from '../lib/clubShareAnalytics';
import { platformDetection } from '../utils/platformDetection';

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
    const [activationDraft, setActivationDraft] = useState<ClubActivationConfig>(() => new ClubActivationConfig(club.activation?.toDictionary?.() ?? club.activation ?? {}));
    const [savingActivation, setSavingActivation] = useState(false);
    const [activationFeedback, setActivationFeedback] = useState<string | null>(null);
    const [showPairingsModal, setShowPairingsModal] = useState(false);
    const [loadingPairings, setLoadingPairings] = useState(false);
    const [clubMemberProfiles, setClubMemberProfiles] = useState<ClubMemberProfile[]>([]);
    const [clubPairings, setClubPairings] = useState<ClubPairing[]>([]);
    const [pairingSuggestions, setPairingSuggestions] = useState<ClubPairingSuggestion[]>([]);
    const [clubSafetyReports, setClubSafetyReports] = useState<ClubSafetyReport[]>([]);
    const [manualPairLeft, setManualPairLeft] = useState('');
    const [manualPairRight, setManualPairRight] = useState('');
    const [pairingFeedback, setPairingFeedback] = useState<string | null>(null);

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

    useEffect(() => {
        setActivationDraft(new ClubActivationConfig(club.activation?.toDictionary?.() ?? club.activation ?? {}));
    }, [club]);

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

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(
                buildClubOneLink({
                    clubId: club.id,
                    sharedBy: currentUser?.id ?? undefined,
                    title: `${club.name} | Pulse Club`,
                    description: club.description || `Join ${club.name} on Pulse.`,
                    imageUrl: club.coverImageURL || club.logoURL || null,
                })
            );
            trackClubShareLinkCopied({
                clubId: club.id,
                sharedBy: currentUser?.id ?? null,
                source: 'club_studio',
                platform: platformDetection.getPlatform(),
            });
            alert("Invite link copied!");
        } catch (error) {
            console.error("Failed to copy invite link:", error);
            alert("Failed to copy invite link. Please try again.");
        }
    };

    const handleOpenMembers = async () => {
        if (!club) return;
        setShowMembersModal(true);
        setLoadingMembers(true);
        try {
            const members = await clubService.getClubMembers(club.id);
            setClubMembers(members);

            // Self-heal member count if it drifts
            if (members.length !== club.memberCount) {
                const newCount = members.length;
                club.memberCount = newCount;
                setClub({ ...club } as Club);
                clubService.syncMemberCount(club.id, newCount).catch(console.error);
            }
        } catch (error) {
            console.error("Failed to load members:", error);
        } finally {
            setLoadingMembers(false);
        }
    };

    const loadPairingData = async () => {
        if (!club) return;

        setLoadingPairings(true);
        setPairingFeedback(null);

        try {
            const [members, profiles, pairings, suggestions, safetyReports] = await Promise.all([
                clubService.getClubMembers(club.id),
                clubService.getClubMemberProfiles(club.id),
                clubService.getClubPairings(club.id),
                clubService.suggestClubPairings(club.id),
                clubService.getClubSafetyReports(club.id),
            ]);

            setClubMembers(members);
            setClubMemberProfiles(profiles);
            setClubPairings(pairings);
            setPairingSuggestions(suggestions);
            setClubSafetyReports(safetyReports);
        } catch (error) {
            console.error("Failed to load pairing data:", error);
            setPairingFeedback('Error: failed to load pairing data.');
        } finally {
            setLoadingPairings(false);
        }
    };

    const handleOpenPairings = async () => {
        setShowPairingsModal(true);
        await loadPairingData();
    };

    const handleConfirmPairing = async (
        memberUserIds: string[],
        source: 'manual' | 'assisted',
        score?: number,
        reasons?: string[]
    ) => {
        if (!club || !currentUser?.id) return;

        try {
            setPairingFeedback(null);
            await clubService.upsertClubPairing({
                clubId: club.id,
                memberUserIds,
                createdByUserId: currentUser.id,
                source,
                score,
                reasons,
            });
            setManualPairLeft('');
            setManualPairRight('');
            setPairingFeedback('Pairing saved.');
            await loadPairingData();
        } catch (error) {
            console.error("Failed to save pairing:", error);
            setPairingFeedback(`Error: ${error instanceof Error ? error.message : 'Failed to save pairing.'}`);
        }
    };

    const handleRemovePairing = async (pairingId: string) => {
        if (!club) return;

        try {
            setPairingFeedback(null);
            await clubService.removeClubPairing(club.id, pairingId);
            setPairingFeedback('Pairing removed.');
            await loadPairingData();
        } catch (error) {
            console.error("Failed to remove pairing:", error);
            setPairingFeedback('Error: failed to remove pairing.');
        }
    };

    const handleClearRematchRequest = async (userId: string) => {
        if (!club) return;

        try {
            setPairingFeedback(null);
            await clubService.clearClubMemberRematch(club.id, userId);
            setPairingFeedback('Rematch request cleared.');
            await loadPairingData();
        } catch (error) {
            console.error("Failed to clear rematch request:", error);
            setPairingFeedback('Error: failed to clear rematch request.');
        }
    };

    const handleResolveSafetyReport = async (reportId: string) => {
        if (!club) return;

        try {
            setPairingFeedback(null);
            await clubService.resolveClubSafetyReport(club.id, reportId);
            setPairingFeedback('Safety report resolved.');
            await loadPairingData();
        } catch (error) {
            console.error("Failed to resolve safety report:", error);
            setPairingFeedback('Error: failed to resolve safety report.');
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

    const updateActivationDraft = (updates: Partial<ClubActivationConfig>) => {
        setActivationDraft(prev => new ClubActivationConfig({
            ...prev.toDictionary(),
            ...updates,
        }));
        setActivationFeedback(null);
    };

    const toggleRequiredQuestion = (questionId: string) => {
        const nextQuestionIds = activationDraft.requiredQuestionIds.includes(questionId)
            ? activationDraft.requiredQuestionIds.filter(id => id !== questionId)
            : [...activationDraft.requiredQuestionIds, questionId];

        updateActivationDraft({ requiredQuestionIds: nextQuestionIds });
    };

    const handleSaveActivation = async () => {
        try {
            setSavingActivation(true);
            setActivationFeedback(null);

            const updatedClub = new Club({
                ...club.toDictionary(),
                activation: activationDraft.toDictionary(),
                updatedAt: new Date(),
            });

            await clubService.updateClub(updatedClub);
            setClub(updatedClub);
            setActivationFeedback('Activation settings saved.');
        } catch (error) {
            console.error("Failed to save activation settings:", error);
            setActivationFeedback('Failed to save activation settings.');
        } finally {
            setSavingActivation(false);
        }
    };

    const memberByUserId = clubMembers.reduce<Record<string, ClubMember>>((accumulator, member) => {
        accumulator[member.userId] = member;
        return accumulator;
    }, {});
    const profileByUserId = clubMemberProfiles.reduce<Record<string, ClubMemberProfile>>((accumulator, profile) => {
        accumulator[profile.userId] = profile;
        return accumulator;
    }, {});
    const hasPairingConflict = (leftUserId: string, rightUserId: string): boolean => {
        const leftProfile = profileByUserId[leftUserId];
        const rightProfile = profileByUserId[rightUserId];

        if (!leftProfile || !rightProfile) {
            return false;
        }

        return (
            leftProfile.doNotPairUserIds.includes(rightUserId) ||
            rightProfile.doNotPairUserIds.includes(leftUserId)
        );
    };

    const activePairedUserIds = new Set(clubPairings.flatMap(pairing => pairing.memberUserIds));
    const eligiblePairingMembers = clubMembers.filter(member =>
        member.userId !== club.creatorId &&
        Boolean(member.onboardedAt) &&
        (!club.activation.introRequired || Boolean(member.introducedAt))
    );
    const pairingReadyMembers = eligiblePairingMembers.filter(member => profileByUserId[member.userId]?.pairingOptIn !== false);
    const unmatchedPairingMembers = pairingReadyMembers.filter(member => !activePairedUserIds.has(member.userId));
    const manualPairLeftProfile = manualPairLeft ? profileByUserId[manualPairLeft] : null;
    const manualPairRightOptions = pairingReadyMembers.filter(member =>
        member.userId !== manualPairLeft &&
        (!manualPairLeft || !hasPairingConflict(manualPairLeft, member.userId))
    );
    const rematchRequestProfiles = clubMemberProfiles
        .filter(profile => Boolean(profile.rematchRequestedAt))
        .sort((left, right) => (right.rematchRequestedAt?.getTime() || 0) - (left.rematchRequestedAt?.getTime() || 0));
    const openSafetyReports = clubSafetyReports.filter(report => report.status === 'open');
    const optedOutPairingMembers = eligiblePairingMembers.filter(member => profileByUserId[member.userId]?.pairingOptIn === false);
    const blockedPreferenceMembers = clubMemberProfiles.filter(profile => profile.doNotPairUserIds.length > 0);
    const selectedManualPairBlocked = Boolean(
        manualPairLeft &&
        manualPairRight &&
        hasPairingConflict(manualPairLeft, manualPairRight)
    );

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
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-8">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
                                <FiSliders size={12} />
                                Club Activation
                            </div>
                            <h3 className="mt-4 text-2xl font-bold">Onboarding, intro, and pairing</h3>
                            <p className="mt-2 max-w-3xl text-sm text-gray-400">
                                Configure how new members activate after they join your club. These settings are generic and can be reused across any creator-led community on Pulse.
                            </p>
                        </div>
                        <button
                            onClick={handleSaveActivation}
                            disabled={savingActivation}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#E0FE10] px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {savingActivation ? 'Saving...' : 'Save Activation'}
                            <FiCheck size={16} />
                        </button>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/5 bg-[#0E0E10] p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-semibold text-lg mb-1">Enable club activation</h4>
                                    <p className="text-sm text-gray-500">Turn on structured onboarding for new members after they join.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateActivationDraft({ enabled: !activationDraft.enabled })}
                                    className={`relative h-7 w-14 rounded-full transition ${activationDraft.enabled ? 'bg-[#E0FE10]' : 'bg-gray-700'}`}
                                >
                                    <span
                                        className={`absolute top-1 h-5 w-5 rounded-full bg-black transition ${activationDraft.enabled ? 'left-8' : 'left-1'}`}
                                    />
                                </button>
                            </div>

                            <div className={`mt-6 space-y-4 ${activationDraft.enabled ? '' : 'opacity-50'}`}>
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Required onboarding questions</label>
                                    <p className="mt-2 text-sm text-gray-500">
                                        Select the shared questions every new member must answer before they are considered onboarded.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {SYSTEM_ACTIVATION_QUESTIONS.map(question => {
                                        const isSelected = activationDraft.requiredQuestionIds.includes(question.id);
                                        return (
                                            <button
                                                key={question.id}
                                                type="button"
                                                disabled={!activationDraft.enabled}
                                                onClick={() => toggleRequiredQuestion(question.id)}
                                                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                                    isSelected
                                                        ? 'border-[#E0FE10]/50 bg-[#E0FE10]/10'
                                                        : 'border-white/5 bg-[#151518] hover:border-white/10'
                                                } ${activationDraft.enabled ? '' : 'cursor-not-allowed'}`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <div className="font-semibold text-white">{question.title}</div>
                                                        <div className="mt-1 text-sm text-gray-500">{question.description}</div>
                                                    </div>
                                                    <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${
                                                        isSelected ? 'border-[#E0FE10] bg-[#E0FE10] text-black' : 'border-white/15 text-transparent'
                                                    }`}>
                                                        <FiCheck size={14} />
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-2xl border border-white/5 bg-[#0E0E10] p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-semibold text-lg mb-1">Require introduction post</h4>
                                        <p className="text-sm text-gray-500">Prompt members to introduce themselves after onboarding is complete.</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!activationDraft.enabled}
                                        onClick={() => updateActivationDraft({ introRequired: !activationDraft.introRequired })}
                                        className={`relative h-7 w-14 rounded-full transition ${activationDraft.introRequired ? 'bg-cyan-400' : 'bg-gray-700'} ${activationDraft.enabled ? '' : 'cursor-not-allowed'}`}
                                    >
                                        <span
                                            className={`absolute top-1 h-5 w-5 rounded-full bg-black transition ${activationDraft.introRequired ? 'left-8' : 'left-1'}`}
                                        />
                                    </button>
                                </div>

                                <div className={`mt-6 ${activationDraft.enabled ? '' : 'opacity-50'}`}>
                                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Introduction template</label>
                                    <textarea
                                        value={activationDraft.introTemplate || ''}
                                        disabled={!activationDraft.enabled}
                                        onChange={(event) => updateActivationDraft({ introTemplate: event.target.value })}
                                        placeholder="Tell us your name, your background, what you're training for, and the kind of accountability you want from this club."
                                        className="mt-3 min-h-[140px] w-full rounded-2xl border border-white/5 bg-[#151518] px-4 py-4 text-sm text-white outline-none transition focus:border-cyan-400/40 disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/5 bg-[#0E0E10] p-6">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <h4 className="font-semibold text-lg mb-1">Enable accountability pairing</h4>
                                        <p className="text-sm text-gray-500">Let Pulse help you turn the club into real relationships, not just a roster.</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!activationDraft.enabled}
                                        onClick={() => updateActivationDraft({ matchingEnabled: !activationDraft.matchingEnabled })}
                                        className={`relative h-7 w-14 rounded-full transition ${activationDraft.matchingEnabled ? 'bg-teal-400' : 'bg-gray-700'} ${activationDraft.enabled ? '' : 'cursor-not-allowed'}`}
                                    >
                                        <span
                                            className={`absolute top-1 h-5 w-5 rounded-full bg-black transition ${activationDraft.matchingEnabled ? 'left-8' : 'left-1'}`}
                                        />
                                    </button>
                                </div>

                                <div className={`mt-6 ${activationDraft.enabled && activationDraft.matchingEnabled ? '' : 'opacity-50'}`}>
                                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Pairing mode</label>
                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'manual', title: 'Manual', description: 'You decide every pairing yourself.' },
                                            { id: 'assisted', title: 'Assisted', description: 'Pulse suggests pairs from onboarding answers.' },
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                type="button"
                                                disabled={!activationDraft.enabled || !activationDraft.matchingEnabled}
                                                onClick={() => updateActivationDraft({ matchingMode: mode.id as 'manual' | 'assisted' })}
                                                className={`rounded-2xl border px-4 py-4 text-left transition ${
                                                    activationDraft.matchingMode === mode.id
                                                        ? 'border-teal-400/50 bg-teal-400/10'
                                                        : 'border-white/5 bg-[#151518] hover:border-white/10'
                                                }`}
                                            >
                                                <div className="font-semibold text-white">{mode.title}</div>
                                                <div className="mt-1 text-sm text-gray-500">{mode.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/5 bg-[#151518] px-4 py-4">
                                        <div>
                                            <div className="font-semibold text-white">Pairing studio</div>
                                            <div className="mt-1 text-sm text-gray-500">Review suggestions, confirm pairs, and rematch members.</div>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!activationDraft.enabled || !activationDraft.matchingEnabled}
                                            onClick={() => void handleOpenPairings()}
                                            className="rounded-xl bg-teal-400 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-black transition disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Open
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {activationFeedback ? (
                        <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
                            activationFeedback.includes('Failed')
                                ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        }`}>
                            {activationFeedback}
                        </div>
                    ) : null}
                </div>

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
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                                                            Joined {member.joinedAt?.toLocaleDateString?.() || 'recently'}
                                                        </span>
                                                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                                                            member.onboardedAt
                                                                ? 'bg-emerald-500/10 text-emerald-300'
                                                                : 'bg-amber-500/10 text-amber-300'
                                                        }`}>
                                                            {member.onboardedAt ? 'Onboarded' : 'Onboarding Pending'}
                                                        </span>
                                                        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                                                            member.introducedAt
                                                                ? 'bg-cyan-500/10 text-cyan-300'
                                                                : 'bg-zinc-500/10 text-zinc-300'
                                                        }`}>
                                                            {member.introducedAt ? 'Introduced' : 'Intro Pending'}
                                                        </span>
                                                    </div>
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

                {/* Pairings Modal */}
                <AnimatePresence>
                    {showPairingsModal && (
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
                                transition={{ type: 'spring', bounce: 0.35, duration: 0.45 }}
                                className="bg-[#0E0E10] border border-white/10 rounded-3xl p-6 md:p-8 max-w-5xl w-full max-h-[85vh] flex flex-col shadow-2xl"
                            >
                                <div className="flex items-center justify-between gap-4 mb-6">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Pairing Studio</h3>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Confirm suggested pairs, manually match members, and keep one active partner per member.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setShowPairingsModal(false)}
                                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                                    >
                                        <FiX size={20} />
                                    </button>
                                </div>

                                <div className="grid gap-6 md:grid-cols-4 mb-6">
                                    <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Active pairings</div>
                                        <div className="mt-3 text-3xl font-black text-white">{clubPairings.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Unmatched members</div>
                                        <div className="mt-3 text-3xl font-black text-white">{unmatchedPairingMembers.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Suggestions ready</div>
                                        <div className="mt-3 text-3xl font-black text-white">{pairingSuggestions.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Safety reviews</div>
                                        <div className="mt-3 text-3xl font-black text-white">{rematchRequestProfiles.length + openSafetyReports.length}</div>
                                    </div>
                                </div>

                                {pairingFeedback ? (
                                    <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
                                        pairingFeedback.includes('Error:')
                                            ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                    }`}>
                                        {pairingFeedback}
                                    </div>
                                ) : null}

                                {loadingPairings ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full border-t-2 border-teal-400 animate-spin"></div>
                                    </div>
                                ) : (
                                    <div className="grid flex-1 gap-6 overflow-y-auto pr-2 lg:grid-cols-[1.1fr_0.9fr]">
                                        <div className="space-y-6">
                                            <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h4 className="text-lg font-bold text-white">Assisted suggestions</h4>
                                                        <p className="mt-1 text-sm text-gray-500">Generated from onboarding responses and current availability to pair.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => void loadPairingData()}
                                                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10"
                                                    >
                                                        Refresh
                                                    </button>
                                                </div>

                                                <div className="mt-4 space-y-3">
                                                    {pairingSuggestions.length === 0 ? (
                                                        <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-6 text-sm text-gray-500">
                                                            No assisted suggestions yet. Members need to complete onboarding, and intros if required, before they become eligible.
                                                        </div>
                                                    ) : pairingSuggestions.map((suggestion) => {
                                                        const leftMember = memberByUserId[suggestion.memberUserIds[0]];
                                                        const rightMember = memberByUserId[suggestion.memberUserIds[1]];

                                                        if (!leftMember || !rightMember) {
                                                            return null;
                                                        }

                                                        return (
                                                            <div key={suggestion.id} className="rounded-2xl border border-white/5 bg-[#0E0E10] p-4">
                                                                <div className="flex items-start justify-between gap-4">
                                                                    <div>
                                                                        <div className="font-semibold text-white">
                                                                            {leftMember.userInfo.displayName || leftMember.userInfo.username} + {rightMember.userInfo.displayName || rightMember.userInfo.username}
                                                                        </div>
                                                                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">
                                                                            Score {suggestion.score}
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => void handleConfirmPairing(suggestion.memberUserIds, 'assisted', suggestion.score, suggestion.reasons)}
                                                                        className="rounded-xl bg-teal-400 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-black transition hover:brightness-105"
                                                                    >
                                                                        Confirm
                                                                    </button>
                                                                </div>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {suggestion.reasons.map(reason => (
                                                                        <span key={reason} className="rounded-full border border-teal-400/20 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-200">
                                                                            {reason}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                                <h4 className="text-lg font-bold text-white">Active pairs</h4>
                                                <div className="mt-4 space-y-3">
                                                    {clubPairings.length === 0 ? (
                                                        <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-6 text-sm text-gray-500">
                                                            No active pairs yet.
                                                        </div>
                                                    ) : clubPairings.map(pairing => {
                                                        const leftMember = memberByUserId[pairing.memberUserIds[0]];
                                                        const rightMember = memberByUserId[pairing.memberUserIds[1]];

                                                        if (!leftMember || !rightMember) {
                                                            return null;
                                                        }

                                                        return (
                                                            <div key={pairing.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-[#0E0E10] p-4">
                                                                <div>
                                                                    <div className="font-semibold text-white">
                                                                        {leftMember.userInfo.displayName || leftMember.userInfo.username} + {rightMember.userInfo.displayName || rightMember.userInfo.username}
                                                                    </div>
                                                                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">
                                                                        {pairing.source === 'assisted' ? 'Assisted pair' : 'Manual pair'}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => void handleRemovePairing(pairing.id)}
                                                                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/15"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h4 className="text-lg font-bold text-white">Safety queue</h4>
                                                        <p className="mt-1 text-sm text-gray-500">
                                                            Rematch requests need host review. Opt-outs and block preferences are enforced automatically.
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => void loadPairingData()}
                                                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/10"
                                                    >
                                                        Refresh
                                                    </button>
                                                </div>

                                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                    <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-4">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Rematch requests</div>
                                                        <div className="mt-2 text-2xl font-black text-white">{rematchRequestProfiles.length}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-4">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Open reports</div>
                                                        <div className="mt-2 text-2xl font-black text-white">{openSafetyReports.length}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-4">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Opted out</div>
                                                        <div className="mt-2 text-2xl font-black text-white">{optedOutPairingMembers.length}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-4">
                                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Blocklists on file</div>
                                                        <div className="mt-2 text-2xl font-black text-white">{blockedPreferenceMembers.length}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 space-y-3">
                                                    {openSafetyReports.length > 0 ? openSafetyReports.map(report => {
                                                        const reporter = memberByUserId[report.reporterUserId];
                                                        const reportedMember = report.reportedUserId ? memberByUserId[report.reportedUserId] : null;

                                                        return (
                                                            <div key={report.id} className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                                                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                                    <div>
                                                                        <div className="font-semibold text-white">
                                                                            {reporter?.userInfo.displayName || reporter?.userInfo.username || 'Member'} reported an issue
                                                                        </div>
                                                                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-red-100/70">
                                                                            {report.category.replaceAll('_', ' ')} • {report.createdAt.toLocaleString()}
                                                                        </div>
                                                                        {reportedMember ? (
                                                                            <div className="mt-2 text-xs uppercase tracking-[0.16em] text-red-100/70">
                                                                                Related member: {reportedMember.userInfo.displayName || reportedMember.userInfo.username}
                                                                            </div>
                                                                        ) : null}
                                                                        <p className="mt-3 max-w-2xl text-sm leading-6 text-red-100/85">
                                                                            {report.details}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => void handleResolveSafetyReport(report.id)}
                                                                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/15"
                                                                    >
                                                                        Resolve
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    }) : null}

                                                    {rematchRequestProfiles.length === 0 ? (
                                                        <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-6 text-sm text-gray-500">
                                                            {openSafetyReports.length === 0 ? 'No active safety requests right now.' : 'No active rematch requests right now.'}
                                                        </div>
                                                    ) : rematchRequestProfiles.map(profile => {
                                                        const member = memberByUserId[profile.userId];

                                                        if (!member) {
                                                            return null;
                                                        }

                                                        return (
                                                            <div key={profile.id} className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                                                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                                    <div>
                                                                        <div className="font-semibold text-white">
                                                                            {member.userInfo.displayName || member.userInfo.username}
                                                                        </div>
                                                                        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
                                                                            Requested {profile.rematchRequestedAt?.toLocaleString() || 'recently'}
                                                                        </div>
                                                                        <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/85">
                                                                            {profile.rematchReason || 'No reason provided.'}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => void handleClearRematchRequest(profile.userId)}
                                                                        className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-white/15"
                                                                    >
                                                                        Clear
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                                <h4 className="text-lg font-bold text-white">Manual pairing</h4>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    Override any suggestion or pair members directly yourself. Opt-outs and do-not-pair restrictions still apply.
                                                </p>

                                                <div className="mt-4 space-y-3">
                                                    <select
                                                        value={manualPairLeft}
                                                        onChange={(event) => setManualPairLeft(event.target.value)}
                                                        className="w-full rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-3 text-sm text-white outline-none"
                                                    >
                                                        <option value="">Select first member</option>
                                                        {pairingReadyMembers.map(member => (
                                                            <option key={member.userId} value={member.userId}>
                                                                {member.userInfo.displayName || member.userInfo.username}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={manualPairRight}
                                                        onChange={(event) => setManualPairRight(event.target.value)}
                                                        className="w-full rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-3 text-sm text-white outline-none"
                                                    >
                                                        <option value="">Select second member</option>
                                                        {manualPairRightOptions
                                                            .map(member => (
                                                                <option key={member.userId} value={member.userId}>
                                                                    {member.userInfo.displayName || member.userInfo.username}
                                                                </option>
                                                            ))}
                                                    </select>
                                                    {manualPairLeft && manualPairRightOptions.length === 0 ? (
                                                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                                            No safe match options are available for this member right now.
                                                        </div>
                                                    ) : null}
                                                    {selectedManualPairBlocked ? (
                                                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                                                            This pair is blocked by a do-not-pair preference.
                                                        </div>
                                                    ) : null}
                                                    {manualPairLeftProfile?.rematchRequestedAt ? (
                                                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                                                            The first selected member has an open rematch request. Pairing them will clear that request.
                                                        </div>
                                                    ) : null}
                                                    <button
                                                        onClick={() => void handleConfirmPairing([manualPairLeft, manualPairRight], 'manual')}
                                                        disabled={!manualPairLeft || !manualPairRight || manualPairLeft === manualPairRight || selectedManualPairBlocked}
                                                        className="w-full rounded-2xl bg-[#E0FE10] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        Save pair
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-white/5 bg-[#151518] p-5">
                                                <h4 className="text-lg font-bold text-white">Eligible members</h4>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    Members must be onboarded and, if required, introduced before they can be paired.
                                                </p>
                                                <div className="mt-4 space-y-3">
                                                    {eligiblePairingMembers.length === 0 ? (
                                                        <div className="rounded-2xl border border-white/5 bg-[#0E0E10] px-4 py-6 text-sm text-gray-500">
                                                            No one is pairing-ready yet.
                                                        </div>
                                                    ) : eligiblePairingMembers.map(member => {
                                                        const profile = profileByUserId[member.userId];
                                                        const isPaired = activePairedUserIds.has(member.userId);
                                                        return (
                                                            <div key={member.id} className="rounded-2xl border border-white/5 bg-[#0E0E10] p-4">
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div>
                                                                        <div className="font-semibold text-white">{member.userInfo.displayName || member.userInfo.username}</div>
                                                                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">
                                                                            {profile?.completedQuestionIds.length || 0} answers on file
                                                                        </div>
                                                                    </div>
                                                                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                                                        isPaired ? 'bg-teal-400/10 text-teal-200' : 'bg-amber-500/10 text-amber-200'
                                                                    }`}>
                                                                        {isPaired ? 'Paired' : 'Unmatched'}
                                                                    </span>
                                                                </div>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {profile?.pairingOptIn === false ? (
                                                                        <span className="rounded-full bg-zinc-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                                                                            Opted out
                                                                        </span>
                                                                    ) : null}
                                                                    {profile?.rematchRequestedAt ? (
                                                                        <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                                                                            Rematch requested
                                                                        </span>
                                                                    ) : null}
                                                                    {profile?.doNotPairUserIds.length ? (
                                                                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-red-200">
                                                                            {profile.doNotPairUserIds.length} blocked
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
