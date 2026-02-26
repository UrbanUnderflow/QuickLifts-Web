import React from 'react';
import { Download, Swords, Medal, BookOpen, Crown } from 'lucide-react';

const HunterWorldTab: React.FC = () => {
    const sections = [
        {
            title: 'Leveling & Global Leaderboards',
            icon: <Medal className="w-5 h-5 text-blue-400" />,
            description: 'The core conversion of athletic effort into rank (Pulse Points). Includes Rank Maintenance (Pulse Power) and multi-tiered leaderboards (which are cached every 6 hours via Cloud Functions to optimize reads).',
            link: '/docs/hunter-world-leveling.md',
        },
        {
            title: 'Specialty Classes',
            icon: <Swords className="w-5 h-5 text-red-400" />,
            description: 'Dynamic class allocation based on how users train (Iron Fist, Shadow Runner, Inferno, Phantom). Determined by categoryPoints backfills across strength, endurance, and burn disciplines.',
            link: '/docs/hunter-world-specialty.md',
        },
        {
            title: 'Creator Integration (Architects)',
            icon: <Crown className="w-5 h-5 text-yellow-400" />,
            description: 'The narrative positioning of Creators. Earning "creator" points to become a Grand Architect. The Top 100 Architects are cached via Cloud Functions for efficient global leaderboard fetching.',
            link: '/docs/hunter-world-creator.md',
        },
    ];

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                    <BookOpen className="w-6 h-6 text-purple-400" />
                    Hunter World Ecosystem
                </h2>
                <p className="text-zinc-400 text-sm max-w-2xl">
                    The fitness world gamified. This tab serves as the source of truth for all leveling, class identity, and creator mechanics operating under the hood of QuickLifts.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sections.map((section) => (
                    <div key={section.title} className="bg-[#090d14] border border-zinc-800 rounded-2xl p-6 flex flex-col h-full hover:border-zinc-700 transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/5 rounded-lg border border-white/10">
                                {section.icon}
                            </div>
                            <h3 className="font-semibold text-white">{section.title}</h3>
                        </div>
                        <p className="text-zinc-400 text-sm flex-grow mb-6">
                            {section.description}
                        </p>
                        <a
                            href={section.link}
                            download
                            className="inline-flex items-center justify-center gap-2 w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-sm font-medium transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download .md
                        </a>
                    </div>
                ))}
            </div>

            <div className="bg-[#090d14] border border-zinc-800 rounded-2xl p-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">The Creator Concept: "Grand Architects"</h3>
                <div className="space-y-4 text-sm text-zinc-300">
                    <p>
                        Narratively, if the users are "Hunters" exploring the world and entering Gate Events, then the Creators are the <strong>Architects</strong> or <strong>Forge Masters</strong> who build the Dungeons (Custom Rounds).
                    </p>
                    <p>
                        When a user completes a round designed by an Architect, they earn points for their physical exertion (e.g. Iron Fist `strength` points), while the Creator earns passive <code className="bg-black/40 px-1 py-0.5 rounded border border-zinc-800">creator</code> points as a native part of the <code className="bg-black/40 px-1 py-0.5 rounded border border-zinc-800">categoryPoints</code> dictionary on the User model.
                    </p>
                    <p>
                        This naturally pipelines Creators into a unique class—the <strong>Grand Architect</strong>—with their own separate leaderboard based strictly on how enthusiastically the community engages with their programming.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HunterWorldTab;
