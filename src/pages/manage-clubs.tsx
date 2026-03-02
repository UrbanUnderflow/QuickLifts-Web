import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/router';
import PageHead from '../components/PageHead';
import { FiArrowLeft, FiUsers, FiPlus, FiChevronRight, FiActivity } from 'react-icons/fi';
import { useUser } from '../hooks/useUser';
import { clubService } from '../api/firebase/club/service';
import { Club } from '../api/firebase/club/types';

export default function ManageClubsPage() {
    const router = useRouter();
    const currentUser = useUser();
    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser?.id) {
            setLoading(false);
            return;
        }

        const loadClubs = async () => {
            try {
                const fetchedClubs = await clubService.getClubsByCreatorId(currentUser.id);
                // Sort by newest first
                fetchedClubs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                setClubs(fetchedClubs);
            } catch (err) {
                console.error('[Manage Clubs] Failed to load clubs:', err);
            } finally {
                setLoading(false);
            }
        };

        loadClubs();
    }, [currentUser?.id]);

    const handleClubClick = (club: Club) => {
        router.push(`/club-studio?clubId=${club.id}`);
    };

    return (
        <div className="min-h-screen bg-[#0E0E10] text-white font-sans">
            <PageHead
                pageOgUrl="https://fitwithpulse.ai/manage-clubs"
                metaData={{
                    pageId: 'manage-clubs',
                    pageTitle: 'Manage Clubs | Pulse',
                    metaDescription: 'View and manage all your clubs on Pulse.',
                    ogTitle: 'Manage Clubs | Pulse',
                    ogDescription: 'View and manage all your clubs on Pulse.',
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
                        onClick={() => router.push('/club-studio')}
                        className="px-5 py-2.5 bg-[#E0FE10] hover:bg-[#c8e60e] text-black rounded-xl font-bold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <FiPlus className="w-5 h-5" />
                        New Club
                    </button>
                </div>

                {/* Page Title */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-yellow-500/30 flex items-center justify-center">
                            <FiUsers className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-amber-400 font-semibold tracking-wide uppercase text-sm">Club Management</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">Your Clubs</h1>
                    <p className="text-lg text-zinc-400">
                        Select a club to manage its landing page, members, rounds, and settings.
                    </p>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-6" />
                        <p className="text-zinc-400">Loading your clubs...</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && clubs.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-3xl p-12 text-center"
                    >
                        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                            <FiUsers className="w-10 h-10 text-amber-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">No clubs yet</h3>
                        <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                            Create your first club to build a community, share rounds, and grow your fitness brand.
                        </p>
                        <button
                            onClick={() => router.push('/club-studio')}
                            className="px-8 py-4 bg-[#E0FE10] hover:bg-[#c8e60e] text-black rounded-xl font-bold transition-all inline-flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <FiPlus className="w-5 h-5" />
                            Create Your First Club
                        </button>
                    </motion.div>
                )}

                {/* Club Cards Grid */}
                {!loading && clubs.length > 0 && (
                    <div className="grid gap-6">
                        {clubs.map((club, index) => (
                            <motion.button
                                key={club.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.08 }}
                                onClick={() => handleClubClick(club)}
                                className="group relative bg-[#151518] border border-white/5 hover:border-amber-500/30 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5 text-left w-full"
                            >
                                {/* Club Cover Image Background */}
                                <div className="absolute inset-0 z-0">
                                    {club.coverImageURL ? (
                                        <img
                                            src={club.coverImageURL}
                                            alt=""
                                            className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-700"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-amber-500/5 to-yellow-500/5" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#151518] via-[#151518]/95 to-[#151518]/80" />
                                </div>

                                <div className="relative z-10 flex items-center gap-6 p-6 md:p-8">
                                    {/* Club Avatar */}
                                    <div className="flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border border-white/10 bg-zinc-900">
                                        {club.coverImageURL ? (
                                            <img
                                                src={club.coverImageURL}
                                                alt={club.name}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 flex items-center justify-center">
                                                <FiUsers className="w-8 h-8 md:w-10 md:h-10 text-amber-400" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Club Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl md:text-2xl font-bold text-white mb-1.5 group-hover:text-amber-300 transition-colors truncate">
                                            {club.name}
                                        </h3>
                                        <p className="text-zinc-400 text-sm md:text-base line-clamp-2 mb-4 leading-relaxed">
                                            {club.description || 'Your exclusive community space.'}
                                        </p>

                                        {/* Stats */}
                                        <div className="flex items-center gap-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                                    <FiUsers className="w-3.5 h-3.5 text-amber-400" />
                                                </div>
                                                <span className="text-zinc-300 text-sm font-medium">
                                                    {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                                    <FiActivity className="w-3.5 h-3.5 text-purple-400" />
                                                </div>
                                                <span className="text-zinc-300 text-sm font-medium">
                                                    {club.linkedRoundIds?.length || 0} {(club.linkedRoundIds?.length || 0) === 1 ? 'round' : 'rounds'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Arrow */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/5 group-hover:bg-amber-500/20 flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                                        <FiChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
