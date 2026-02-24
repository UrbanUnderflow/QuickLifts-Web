import { GetServerSideProps } from 'next';
import React from 'react';
import { useRouter } from 'next/router';
import PageHead from '../../components/PageHead';
import { clubService } from '../../api/firebase/club/service';

interface ClubPageProps {
    clubData?: any | null;
    creatorData?: any | null;
    error?: string | null;
}

const ClubPage: React.FC<ClubPageProps> = ({ clubData, creatorData, error }) => {
    const router = useRouter();

    if (error || !clubData) {
        return (
            <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center text-white">
                <PageHead pageOgUrl={`https://fitwithpulse.ai/club/${router.query.id as string}`} />
                <h1 className="text-xl font-semibold">{error || 'Club not found'}</h1>
            </div>
        );
    }

    const title = clubData.name || 'Pulse Community Fitness';
    const description = clubData.description || 'Join my fitness community on Pulse!';

    // Use the club's cover image if available, else let PageHead fall back to generating a dynamic one 
    // or use the global default if appropriate.
    const ogImage = clubData.coverImageURL || undefined;

    return (
        <div className="min-h-screen bg-[#0E0E10] flex items-center justify-center p-4">
            <PageHead
                pageOgUrl={`https://fitwithpulse.ai/club/${clubData.id}`}
                metaData={{
                    pageId: clubData.id,
                    pageTitle: `${title} | Pulse`,
                    metaDescription: description,
                    ogTitle: title,
                    ogDescription: description,
                    ogImage: ogImage,
                    ogUrl: `https://fitwithpulse.ai/club/${clubData.id}`,
                    twitterTitle: title,
                    twitterDescription: description,
                    twitterImage: ogImage,
                    lastUpdated: new Date().toISOString()
                }}
                pageOgImage={ogImage}
            />

            <div className="max-w-md w-full bg-[#151518] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                <div className="h-48 relative bg-black">
                    <img
                        src={clubData.coverImageURL || "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=2070&auto=format&fit=crop"}
                        className="w-full h-full object-cover opacity-70"
                        alt={title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#151518] to-transparent"></div>
                </div>
                <div className="p-8 relative -mt-12 text-center text-white">
                    <h1 className="text-3xl font-black mb-3">{title}</h1>
                    <p className="text-gray-400 mb-8">{description}</p>

                    <button
                        onClick={() => router.push(creatorData?.username ? `/${creatorData.username}` : '/')}
                        className="w-full bg-[#E0FE10] text-black font-bold py-4 rounded-xl hover:bg-[#c8e60e] transition-colors"
                    >
                        View Creator Profile
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full mt-4 bg-transparent border border-white/20 text-white font-semibold py-4 rounded-xl hover:bg-white/5 transition-colors"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps<ClubPageProps> = async ({ params, res }) => {
    try {
        const id = params?.id as string;
        if (!id) {
            return { props: { error: 'Club ID is required' } };
        }

        // Cache the page for performance
        res.setHeader(
            'Cache-Control',
            'public, s-maxage=30, stale-while-revalidate=59'
        );

        // Fetch club data using the service directly on the server
        const club = await clubService.getClubById(id);

        if (!club) {
            return { props: { error: 'Club not found' } };
        }

        // Prepare serializable data
        const clubData = {
            id: club.id,
            name: club.name || '',
            description: club.description || '',
            coverImageURL: club.coverImageURL || null,
            creatorId: club.creatorId || ''
        };

        return {
            props: {
                clubData,
                creatorData: club.creatorInfo || null
            }
        };
    } catch (error) {
        console.error('Error fetching club:', error);
        return {
            props: {
                error: 'Failed to load club information'
            }
        };
    }
};

export default ClubPage;
