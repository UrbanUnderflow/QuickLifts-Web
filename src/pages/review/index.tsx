import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { GetStaticProps } from 'next';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Types
interface Review {
  id: string;
  title: string;
  description: string;
  date: string;
  reviewType: 'month' | 'year' | 'quarter';
}

interface ReviewsIndexProps {
  reviews: Review[];
}

const ReviewsIndex: React.FC<ReviewsIndexProps> = ({ reviews }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white py-32">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="font-['Thunder'] text-8xl sm:text-[160px] leading-none">
            Months in
            <span className="block text-[#E0FE10]">Review</span>
          </h1>
          <p className="mt-8 text-xl text-zinc-400 max-w-2xl">
            A chronological journey through our progress, achievements, and learnings 
            as we build the future of social fitness.
          </p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="max-w-6xl mx-auto px-4 -mt-20">
        <div className="grid gap-8">
          {reviews.map((review) => (
            <Link 
              href={`/review/${review.id}`} 
              key={review.id}
              className="group bg-white rounded-xl shadow-lg p-8 relative overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#E0FE10] opacity-0 group-hover:opacity-5 transition-opacity rounded-full -translate-x-16 translate-y-[-50%]" />
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 relative">
                <div className="flex-shrink-0 w-32">
                  {review.reviewType === 'year' ? (
                    <div className="text-3xl font-bold">
                      {review.date.substring(0, 4)} 
                    </div>
                  ) : review.reviewType === 'quarter' ? (
                    <>
                       <div className="text-sm text-zinc-500 uppercase tracking-wider">
                         Q{Math.ceil(parseInt(review.date.substring(5, 7)) / 3)} {/* Calculate Q from month */} 
                       </div>
                       <div className="text-3xl font-bold">
                         {review.date.substring(0, 4)} {/* Year */} 
                       </div>
                    </>
                  ) : (
                    // Monthly Review
                    <>
                      <div className="text-sm text-zinc-500 uppercase tracking-wider">
                         {new Date(review.date).toLocaleString('default', { month: 'long' })}
                      </div>
                      <div className="text-3xl font-bold">
                         {new Date(review.date).getFullYear()}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex-grow">
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                    {review.title}
                    <ArrowUpRight 
                      className="opacity-0 group-hover:opacity-100 transition-opacity" 
                      size={24} 
                    />
                  </h2>
                  <p className="text-zinc-600">{review.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Preview of Next Month */}
      <div className="max-w-6xl mx-auto px-4 mt-16 mb-12">
        <div className="bg-zinc-50 rounded-xl p-8 text-center">
          <div className="text-zinc-400 uppercase tracking-wider mb-2">Coming Soon</div>
          <div className="text-2xl font-bold">January 2025</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-16 mb-12">
        <div className="bg-zinc-50 rounded-xl p-8 text-center">
          <div className="text-zinc-400 uppercase tracking-wider mb-2">Coming Soon</div>
          <div className="text-2xl font-bold">2024 Year In Review</div>
        </div>
      </div>
    </div>
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
            // Handle the year in review file specifically
            date = '2024-12-31'; // Assign end-of-year date for sorting
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
            reviewType, // Include reviewType
          };
        })
    );

    // Filter out any reviews that failed date parsing (if we assigned a default)
    // const validReviews = reviews.filter(review => review.date !== '1970-01-01');
    // For now, we keep them to see them, but you might want to filter later.

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