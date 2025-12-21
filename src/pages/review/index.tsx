import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { ArrowRight, ArrowUpRight, Edit3 } from 'lucide-react';
import { GetStaticProps } from 'next';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { reviewContextService } from '../../api/firebase/reviewContext/service';
import { DraftReview } from '../../api/firebase/reviewContext/types';

// Types
interface Review {
  id: string;
  title: string;
  description: string;
  date: string;
  reviewType: 'month' | 'year' | 'quarter';
  isDraft?: boolean;
  draftId?: string;
}

interface ReviewsIndexProps {
  reviews: Review[];
}

const ReviewsIndex: React.FC<ReviewsIndexProps> = ({ reviews: staticReviews }) => {
  const [drafts, setDrafts] = useState<DraftReview[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>(staticReviews);

  // Fetch drafts client-side
  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const draftData = await reviewContextService.fetchAllDrafts();
        // Filter to only show non-published drafts
        const unpublishedDrafts = draftData.filter(d => d.status !== 'published');
        setDrafts(unpublishedDrafts);

        // Convert drafts to Review format and merge
        const draftReviews: Review[] = unpublishedDrafts.map(d => {
          const [year, month] = d.monthYear.split('-');
          return {
            id: `draft/${d.id}`,
            title: d.title,
            description: d.description,
            date: `${year}-${month}-01`,
            reviewType: d.reviewType === 'quarter' ? 'quarter' : 'month',
            isDraft: true,
            draftId: d.id,
          };
        });

        // Merge and sort by date (drafts should appear at top if recent)
        const merged = [...draftReviews, ...staticReviews];
        merged.sort((a, b) => b.date.localeCompare(a.date));
        setAllReviews(merged);
      } catch (err) {
        console.error('Error fetching drafts:', err);
        // Just use static reviews if drafts fail to load
        setAllReviews(staticReviews);
      }
    };

    fetchDrafts();
  }, [staticReviews]);

  const featuredReview = allReviews[0];
  const otherReviews = allReviews.slice(1);

  return (
    <>
      <Head>
        <title>Reviews | Pulse</title>
        <meta name="description" content="A chronological journey through Pulse's progress, achievements, and learnings as we build the future of social fitness." />
      </Head>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
        {/* Subtle gradient orbs for depth */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-gray-200/40 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-80 h-80 bg-gradient-to-br from-gray-100/60 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-gradient-to-br from-gray-200/30 to-transparent rounded-full blur-3xl" />
        </div>

        {/* Header */}
        <div className="relative border-b border-gray-200/60 backdrop-blur-sm bg-white/70">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
              Reviews
            </p>
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Progress & Achievements
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
              A chronological journey through our progress, achievements, and learnings 
              as we build the future of social fitness.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="relative max-w-4xl mx-auto px-6 py-16 pb-24">
          
          {/* Featured Review (Most Recent) */}
          {featuredReview && (
            <div className="mb-12">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">
                Latest Update
              </p>
              <Link 
                href={`/review/${featuredReview.id}`}
                className="group block"
              >
                <div className="relative overflow-hidden rounded-2xl bg-white/60 backdrop-blur-xl border border-gray-200/60 shadow-lg shadow-gray-200/40 hover:shadow-xl hover:shadow-gray-300/40 hover:bg-white/80 transition-all duration-300">
                  {/* Gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900" />
                  
                  <div className="p-8">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-4">
                          <span className="text-3xl font-bold text-gray-900">
                            {featuredReview.date.substring(0, 4)}
                          </span>
                          {featuredReview.reviewType === 'quarter' && (
                            <span className="px-2.5 py-1 bg-gray-100/80 backdrop-blur-sm rounded-full text-xs font-medium text-gray-600">
                              Q{Math.ceil(parseInt(featuredReview.date.substring(5, 7)) / 3)}
                            </span>
                          )}
                          {featuredReview.reviewType === 'year' && (
                            <span className="px-2.5 py-1 bg-gray-900 text-white rounded-full text-xs font-medium">
                              Year in Review
                            </span>
                          )}
                          {featuredReview.isDraft && (
                            <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-black rounded-full text-xs font-medium">
                              <Edit3 size={10} />
                              Draft
                            </span>
                          )}
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3 group-hover:text-gray-700 transition-colors">
                          {featuredReview.title}
                        </h2>
                        <p className="text-gray-600 leading-relaxed line-clamp-2">
                          {featuredReview.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                          <ArrowUpRight size={20} className="text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Other Reviews */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-6">
              Previous Updates
            </p>
            <div className="space-y-4">
              {otherReviews.map((review) => (
                <Link 
                  href={`/review/${review.id}`} 
                  key={review.id}
                  className="group block"
                >
                  <div className={`relative overflow-hidden rounded-xl backdrop-blur-lg transition-all duration-300 ${
                    review.isDraft
                      ? 'bg-gradient-to-br from-orange-50/60 to-amber-50/40 border border-orange-200/60 hover:from-orange-50/80 hover:to-amber-50/60 hover:border-orange-300/70 hover:shadow-lg hover:shadow-orange-100/40'
                      : review.reviewType === 'year' 
                        ? 'bg-gradient-to-br from-amber-50/60 to-yellow-50/40 border border-amber-200/60 hover:bg-gradient-to-br hover:from-amber-50/80 hover:to-yellow-50/60 hover:border-amber-300/70 hover:shadow-lg hover:shadow-amber-100/40' 
                        : 'bg-white/40 border border-gray-200/50 hover:bg-white/70 hover:border-gray-300/60 hover:shadow-lg hover:shadow-gray-200/30'
                  }`}>
                    {review.isDraft && (
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400" />
                    )}
                    {review.reviewType === 'year' && !review.isDraft && (
                      <>
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400" />
                        {/* Decorative confetti pieces */}
                        <div className="absolute top-3 right-8 w-2 h-2 bg-amber-400 rounded-full opacity-60" />
                        <div className="absolute top-5 right-16 w-1.5 h-1.5 bg-yellow-500 rotate-45 opacity-50" />
                        <div className="absolute top-4 right-24 w-1 h-3 bg-amber-300 rotate-12 opacity-40" />
                        <div className="absolute bottom-4 right-12 w-2 h-1 bg-yellow-400 -rotate-12 opacity-50" />
                        <div className="absolute top-6 right-32 w-1.5 h-1.5 bg-amber-500 rounded-full opacity-40" />
                        <div className="absolute bottom-3 right-20 w-1 h-2 bg-yellow-300 rotate-45 opacity-50" />
                        <div className="absolute top-8 left-28 w-1.5 h-1.5 bg-amber-400 rotate-12 opacity-30" />
                        <div className="absolute bottom-5 left-32 w-2 h-1 bg-yellow-500 -rotate-6 opacity-40" />
                      </>
                    )}
                    <div className="p-6">
                      <div className="flex items-start gap-6">
                        {/* Date Column */}
                        <div className="flex-shrink-0 w-20">
                          {review.reviewType === 'year' ? (
                            <div className="text-xl font-bold text-amber-700">
                              {review.date.substring(0, 4)} 
                            </div>
                          ) : review.reviewType === 'quarter' ? (
                            <>
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                                Q{Math.ceil(parseInt(review.date.substring(5, 7)) / 3)}
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {review.date.substring(0, 4)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                                {new Date(review.date + 'T12:00:00').toLocaleString('default', { month: 'short' })}
                              </div>
                              <div className="text-xl font-bold text-gray-900">
                                {review.date.substring(0, 4)}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                              {review.title}
                            </h3>
                            {review.isDraft && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-black rounded-full text-xs font-medium">
                                <Edit3 size={10} />
                                Draft
                              </span>
                            )}
                          </div>
                          <p className="text-gray-500 text-sm leading-relaxed line-clamp-2">
                            {review.description}
                          </p>
                        </div>

                        {/* Arrow */}
                        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight size={18} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  try {
    const reviewsDirectory = path.join(process.cwd(), 'src', 'pages', 'review');
    const filenames = fs.readdirSync(reviewsDirectory);

    // Month abbreviation to number mapping
    const monthMap: { [key: string]: string } = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    const reviews = await Promise.all(
      filenames
        .filter((filename) => filename !== 'index.tsx' && filename.endsWith('.tsx'))
        .map(async (filename) => {
          const id = filename.replace(/\.tsx$/, '');
          const fullPath = path.join(reviewsDirectory, filename);
          const fileContent = fs.readFileSync(fullPath, 'utf8');

          // Use JSDOM to parse and extract content
          const dom = new JSDOM(fileContent);
          const document = dom.window.document;

          // Extract title from <h1>
          const title = document.querySelector('h1')?.textContent?.trim() || id;

          // Extract description using the custom attribute
          const description =
            document.querySelector('[data-description="true"]')?.textContent?.trim() ||
            'Monthly review of our progress and achievements.';

          let date: string;
          let reviewType: 'month' | 'year' | 'quarter';

          if (id === 'yearInReview') {
            // Handle the 2024 year in review file specifically
            date = '2024-12-31'; // Assign end-of-year date for sorting
            reviewType = 'year';
          } else if (id === 'year2025') {
            // Handle the 2025 year in review file specifically
            date = '2025-12-31'; // Assign end-of-year date for sorting (will appear at top)
            reviewType = 'year';
          } else if (id.startsWith('q')) {
            // Handle quarterly reviews (e.g., q1-25)
            reviewType = 'quarter';
            const quarterMatch = id.match(/q([1-4])-(\d+)/);
            const quarter = quarterMatch ? parseInt(quarterMatch[1]) : null;
            const yearShort = quarterMatch ? quarterMatch[2] : null;
            const year = yearShort ? `20${yearShort}` : null;

            if (year && quarter) {
              // Assign date representing the end of the quarter for sorting
              const endMonth = String(quarter * 3).padStart(2, '0'); // Q1->03, Q2->06, etc.
              const endDay = (quarter === 1 || quarter === 4) ? '31' : '30'; // Approx end day
              date = `${year}-${endMonth}-${endDay}`;
            } else {
              console.error(`Failed to parse date from quarterly filename: ${filename}. Assigning default date.`);
              date = '1970-01-01'; // Default past date
            }
          } else {
            // Handle monthly reviews
            reviewType = 'month';
            const dateMatch = id.match(/([a-z]+)(\d+)/);
            const monthName = dateMatch ? dateMatch[1] : null;
            const yearShort = dateMatch ? dateMatch[2] : null;
            const monthNumber = monthName ? monthMap[monthName.toLowerCase()] : null;
            const year = yearShort ? `20${yearShort}` : null;

            if (year && monthNumber) {
              // Construct date string in YYYY-MM-DD format (use day 01)
              date = `${year}-${monthNumber}-01`;
            } else {
              // Handle files that don't match the expected format
              console.error(`Failed to parse date from filename: ${filename}. Assigning default date.`);
              date = '1970-01-01'; // Assign a default past date for sorting
            }
          }

          return {
            id,
            title,
            description,
            date, 
            reviewType,
          };
        })
    );

    // Sort reviews by date (YYYY-MM-DD strings sort correctly)
    reviews.sort((a, b) => b.date.localeCompare(a.date));

    return {
      props: {
        reviews,
      },
    };
  } catch (error) {
    console.error('Error reading reviews:', error);
    return {
      props: {
        reviews: [],
      },
    };
  }
};

export default ReviewsIndex;
