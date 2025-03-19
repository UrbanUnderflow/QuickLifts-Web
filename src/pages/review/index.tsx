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
                  <div className="text-sm text-zinc-500 uppercase tracking-wider">
                    {new Date(review.date).toLocaleString('default', { month: 'long' })}
                  </div>
                  <div className="text-3xl font-bold">
                    {new Date(review.date).getFullYear()}
                  </div>
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

          // Extract date from the filename
          const dateMatch = id.match(/([a-z]+)(\d+)/);
          const month = dateMatch ? dateMatch[1] : '';
          const year = dateMatch ? dateMatch[2] : '';
          const date = `20${year}-${month}`;

          return {
            id,
            title,
            description,
            date,
          };
        })
    );

    // Sort reviews by date (newest first)
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