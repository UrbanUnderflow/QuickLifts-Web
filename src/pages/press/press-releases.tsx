import type { NextPage, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React, { useState } from 'react';
import { Download, FileText, Calendar, ArrowLeft, Filter, ChevronDown, ExternalLink } from 'lucide-react';
import Footer from '../../components/Footer/Footer';
import { useScrollFade } from '../../hooks/useScrollFade';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { format, parseISO } from 'date-fns';

interface PressRelease {
  id: string;
  title: string;
  date: string;
  summary: string;
  category: 'product' | 'company' | 'milestone' | 'feature';
  pdfUrl: string;
  coverImageUrl: string;
}

interface MediaStory {
  id: string;
  title: string;
  angle: string;
  category: string;
  contactName: string;
  contactEmail: string;
}

// Define types for press releases coming from MDX files
interface MdxPressRelease {
  slug: string;
  title: string;
  date: string;
  summary: string;
  image: string;
  tags: string[];
}

interface PressReleasesPageProps {
  mdxReleases: MdxPressRelease[];
}

const PressReleases: NextPage<PressReleasesPageProps> = ({ mdxReleases }) => {
  const [activeTab, setActiveTab] = useState<'releases' | 'coverage' | 'story-ideas'>('releases');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Replace the static pressReleases data with the dynamic mdxReleases
  const pressReleases: PressRelease[] = mdxReleases.map(release => ({
    id: release.slug,
    title: release.title,
    date: release.date,
    summary: release.summary,
    category: release.tags?.includes('feature') 
      ? 'feature' 
      : release.tags?.includes('milestone') 
        ? 'milestone' 
        : release.tags?.includes('company') 
          ? 'company' 
          : 'product',
    pdfUrl: `/press/releases/${release.slug}.pdf`,
    coverImageUrl: release.image
  }));

  // Sample media stories/pitch ideas
  const mediaStories: MediaStory[] = [
    {
      id: 'story-001',
      title: 'How Pulse is Democratizing the Fitness Creator Economy',
      angle: 'Explore how Pulse is providing tools for everyday fitness enthusiasts to create quality content, shifting power from established fitness influencers to a more inclusive community.',
      category: 'Trend',
      contactName: 'Alexandra Chen',
      contactEmail: 'alexandra@pulse.ai'
    },
    {
      id: 'story-002',
      title: 'The Role of Community in Digital Fitness Motivation',
      angle: 'Data from Pulse\'s Morning Mobility Challenge demonstrates how social features dramatically improve fitness program adherence compared to solo workout apps.',
      category: 'Research',
      contactName: 'Marcus Johnson',
      contactEmail: 'marcus@pulse.ai'
    },
    {
      id: 'story-003',
      title: 'From Engineer to Fitness Tech Founder: Tremaine Grant\'s Journey',
      angle: 'Profile the pathway from collegiate athlete to software engineer to fitness tech startup founder, exploring how diverse experiences shape innovation.',
      category: 'Profile',
      contactName: 'Tremaine Grant',
      contactEmail: 'tremaine@pulse.ai'
    },
    {
      id: 'story-004',
      title: 'The Psychology Behind Pulse\'s Three-Tiered Fitness System',
      angle: 'Explore the psychological principles that inform Pulse\'s Moves → Stacks → Rounds progression and how it addresses common barriers to fitness consistency.',
      category: 'Research',
      contactName: 'Dr. Sarah Williams',
      contactEmail: 'research@pulse.ai'
    },
    {
      id: 'story-005',
      title: 'Diversity in Fitness Tech: How Pulse is Building an Inclusive Platform',
      angle: 'Examine how Pulse\'s UI/UX design, creator policies, and community guidelines foster representation across different body types, fitness levels, and backgrounds.',
      category: 'Feature',
      contactName: 'Diversity Team',
      contactEmail: 'diversity@pulse.ai'
    }
  ];

  // Filter press releases based on selected category
  const filteredReleases = categoryFilter === 'all' 
    ? pressReleases 
    : pressReleases.filter(release => release.category === categoryFilter);

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>Press Releases - Pulse</title>
        <meta name="description" content="Official press releases, media stories, and newsworthy updates from Pulse Fitness Collective." />
      </Head>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header Section */}
        <div className="mb-12">
          <Link href="/press">
            <span className="flex items-center text-zinc-400 hover:text-white mb-6 group">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Press Kit
            </span>
          </Link>
          <h1 className="text-5xl sm:text-6xl font-bold mb-6">Press Releases</h1>
          <p className="text-zinc-400 text-lg max-w-3xl mb-8">
            Official announcements, news, and updates from Pulse. For media inquiries or additional information, please contact our press team at <a href="mailto:press@pulse.ai" className="text-[#E0FE10] hover:underline">press@pulse.ai</a>.
          </p>

          {/* Tab Navigation */}
          <div className="border-b border-zinc-800 mb-8">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('releases')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'releases'
                    ? 'border-[#E0FE10] text-[#E0FE10]'
                    : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                Press Releases
              </button>
              <button
                onClick={() => setActiveTab('coverage')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'coverage'
                    ? 'border-[#E0FE10] text-[#E0FE10]'
                    : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                Media Coverage
              </button>
              <button
                onClick={() => setActiveTab('story-ideas')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'story-ideas'
                    ? 'border-[#E0FE10] text-[#E0FE10]'
                    : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-500'
                }`}
              >
                Story Ideas
              </button>
            </nav>
          </div>
        </div>

        {/* Press Releases Tab Content */}
        {activeTab === 'releases' && (
          <div className="animate-fade-in-up" ref={useScrollFade() as React.RefObject<HTMLDivElement>}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-semibold">Latest Announcements</h2>
              
              <div className="relative">
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-4 py-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  <span>Filter</span>
                  <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
                
                {showFilters && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-zinc-800 ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                      <button
                        onClick={() => {
                          setCategoryFilter('all');
                          setShowFilters(false);
                        }}
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          categoryFilter === 'all' ? 'bg-zinc-700 text-[#E0FE10]' : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        All Categories
                      </button>
                      <button
                        onClick={() => {
                          setCategoryFilter('product');
                          setShowFilters(false);
                        }}
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          categoryFilter === 'product' ? 'bg-zinc-700 text-[#E0FE10]' : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        Product Updates
                      </button>
                      <button
                        onClick={() => {
                          setCategoryFilter('company');
                          setShowFilters(false);
                        }}
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          categoryFilter === 'company' ? 'bg-zinc-700 text-[#E0FE10]' : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        Company News
                      </button>
                      <button
                        onClick={() => {
                          setCategoryFilter('milestone');
                          setShowFilters(false);
                        }}
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          categoryFilter === 'milestone' ? 'bg-zinc-700 text-[#E0FE10]' : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        Milestones
                      </button>
                      <button
                        onClick={() => {
                          setCategoryFilter('feature');
                          setShowFilters(false);
                        }}
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          categoryFilter === 'feature' ? 'bg-zinc-700 text-[#E0FE10]' : 'text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        Feature Launches
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Press Releases List */}
            <div className="space-y-8">
              {filteredReleases.map((release) => (
                <div 
                  key={release.id} 
                  className="bg-zinc-800 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[#E0FE10]/10"
                >
                  <div className="aspect-video bg-zinc-700 relative overflow-hidden">
                    <img 
                      src={release.coverImageUrl} 
                      alt={release.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center text-zinc-400 text-sm mb-2">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(release.date).toLocaleDateString('en-US', { 
                        year: 'numeric',
                        month: 'long', 
                        day: 'numeric'
                      })}
                    </div>
                    <h3 className="text-white text-xl font-medium mb-2 line-clamp-2">{release.title}</h3>
                    <p className="text-zinc-400 text-sm mb-4 line-clamp-3">{release.summary}</p>
                    
                    <div className="flex items-center justify-between mt-4">
                      <Link href={`/press/${release.id}`} className="text-[#E0FE10] hover:text-white flex items-center">
                        View
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Link>
                      <a 
                        href={release.pdfUrl}
                        download
                        className="text-zinc-400 hover:text-white flex items-center"
                      >
                        PDF
                        <Download className="w-4 h-4 ml-2" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bulk Download section */}
            <div className="mt-12 bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 text-center">
              <h3 className="text-xl font-medium mb-4">Need all press releases?</h3>
              <p className="text-zinc-400 mb-6 max-w-2xl mx-auto">
                Download our complete press release archive in PDF format including all releases, background information, and high-resolution images.
              </p>
              <a 
                href="#" 
                className="inline-flex items-center px-6 py-3 bg-[#E0FE10] text-black rounded-lg text-sm font-medium hover:bg-[#c8e40d] transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                Download Full Press Kit
              </a>
            </div>
          </div>
        )}

        {/* Media Coverage Tab Content */}
        {activeTab === 'coverage' && (
          <div className="animate-fade-in-up" ref={useScrollFade() as React.RefObject<HTMLDivElement>}>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Pulse in the News</h2>
              <p className="text-zinc-400 mb-6">Recent media coverage of Pulse and our impact on the fitness community.</p>
            </div>

            {/* Media Coverage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <a 
                href="#" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-700/80 transition-colors group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm text-zinc-500">TechCrunch</span>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#E0FE10] transition-colors" />
                </div>
                <h3 className="text-lg font-medium mb-2 group-hover:text-[#E0FE10] transition-colors">Pulse Raises $3M Seed to Reimagine Social Fitness</h3>
                <p className="text-zinc-400 text-sm mb-4">The Atlanta-based startup is creating a new category at the intersection of fitness content creation and community engagement.</p>
                <div className="text-sm text-zinc-500">May 15, 2023</div>
              </a>

              <a 
                href="#" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-700/80 transition-colors group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm text-zinc-500">Forbes</span>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#E0FE10] transition-colors" />
                </div>
                <h3 className="text-lg font-medium mb-2 group-hover:text-[#E0FE10] transition-colors">The Creator Economy Expands to Fitness with Pulse</h3>
                <p className="text-zinc-400 text-sm mb-4">How one startup is transforming fitness enthusiasts into content creators and building community around shared workouts.</p>
                <div className="text-sm text-zinc-500">April 28, 2023</div>
              </a>

              <a 
                href="#" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-700/80 transition-colors group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm text-zinc-500">Men's Health</span>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#E0FE10] transition-colors" />
                </div>
                <h3 className="text-lg font-medium mb-2 group-hover:text-[#E0FE10] transition-colors">Morning Mobility Challenge: The 30-Day Program That's Taking Over</h3>
                <p className="text-zinc-400 text-sm mb-4">We tested Pulse's community-driven challenge approach and found surprising results for consistency and motivation.</p>
                <div className="text-sm text-zinc-500">April 10, 2023</div>
              </a>

              <a 
                href="#" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-700/80 transition-colors group"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-sm text-zinc-500">Atlanta Business Chronicle</span>
                  <ExternalLink className="w-4 h-4 text-zinc-500 group-hover:text-[#E0FE10] transition-colors" />
                </div>
                <h3 className="text-lg font-medium mb-2 group-hover:text-[#E0FE10] transition-colors">Atlanta Tech Scene Spotlight: Tremaine Grant's Pulse</h3>
                <p className="text-zinc-400 text-sm mb-4">Former engineer turned entrepreneur brings tech expertise and athletic background to growing Atlanta startup ecosystem.</p>
                <div className="text-sm text-zinc-500">March 22, 2023</div>
              </a>
            </div>

            {/* Featured In Section */}
            <div className="mt-12 p-8 bg-zinc-800 rounded-xl">
              <h3 className="text-xl font-medium mb-6 text-center">Featured In</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
                <img src="/press/logos/techcrunch.svg" alt="TechCrunch" className="h-8 opacity-60 hover:opacity-100 transition-opacity" />
                <img src="/press/logos/forbes.svg" alt="Forbes" className="h-8 opacity-60 hover:opacity-100 transition-opacity" />
                <img src="/press/logos/mens-health.svg" alt="Men's Health" className="h-8 opacity-60 hover:opacity-100 transition-opacity" />
                <img src="/press/logos/wired.svg" alt="Wired" className="h-8 opacity-60 hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        )}

        {/* Story Ideas Tab Content */}
        {activeTab === 'story-ideas' && (
          <div className="animate-fade-in-up" ref={useScrollFade() as React.RefObject<HTMLDivElement>}>
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Story Ideas for Media</h2>
              <p className="text-zinc-400 mb-6">
                Below are potential story angles and ideas for journalists and content creators interested in covering Pulse. 
                For more information or to arrange interviews, please contact our press team.
              </p>
            </div>

            {/* Story Ideas */}
            <div className="space-y-6">
              {mediaStories.map((story) => (
                <div key={story.id} className="bg-zinc-800 rounded-xl p-6 hover:bg-zinc-700/80 transition-colors">
                  <span className="inline-block px-3 py-1 text-xs font-medium rounded-full bg-[#E0FE10]/20 text-[#E0FE10] mb-3">
                    {story.category}
                  </span>
                  <h3 className="text-xl font-bold mb-3">{story.title}</h3>
                  <p className="text-zinc-400 mb-6">{story.angle}</p>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-4 border-t border-zinc-700">
                    <div>
                      <p className="text-sm text-zinc-300">Contact: {story.contactName}</p>
                      <a href={`mailto:${story.contactEmail}`} className="text-sm text-[#E0FE10] hover:underline">
                        {story.contactEmail}
                      </a>
                    </div>
                    <button className="sm:self-end px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors">
                      Request Interview
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Media Resources Box */}
            <div className="mt-12 bg-black rounded-xl p-8 border border-zinc-800">
              <h3 className="text-xl font-medium mb-4">Additional Resources for Press</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-zinc-800/50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium mb-2">Executive Bios</h4>
                  <p className="text-zinc-400 text-sm mb-4">Detailed backgrounds on Pulse leadership team members available for interviews and quotes.</p>
                  <a href="#" className="text-[#E0FE10] text-sm hover:underline flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Download Bios (PDF)
                  </a>
                </div>
                <div className="bg-zinc-800/50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium mb-2">Latest Statistics</h4>
                  <p className="text-zinc-400 text-sm mb-4">Current user metrics, engagement statistics, and growth numbers for your reporting.</p>
                  <a href="#" className="text-[#E0FE10] text-sm hover:underline flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Download Stats (PDF)
                  </a>
                </div>
                <div className="bg-zinc-800/50 p-6 rounded-lg">
                  <h4 className="text-lg font-medium mb-2">Media Assets</h4>
                  <p className="text-zinc-400 text-sm mb-4">High-resolution logos, product screenshots, and brand images for your articles.</p>
                  <Link href="/press">
                    <span className="text-[#E0FE10] text-sm hover:underline flex items-center cursor-pointer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Browse Media Kit
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Contact Box */}
        <div className="mt-16 bg-zinc-800/30 border border-zinc-700 rounded-xl p-8">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="md:w-2/3">
              <h3 className="text-2xl font-semibold mb-4">Media Inquiries</h3>
              <p className="text-zinc-400">
                For press inquiries, interview requests, or additional information not found in our press kit, 
                please contact our dedicated press team. We typically respond within 24 hours.
              </p>
            </div>
            <div className="md:w-1/3 flex justify-center">
              <a 
                href="mailto:press@pulse.ai" 
                className="inline-flex items-center px-6 py-3 bg-[#E0FE10] text-black rounded-full text-sm font-medium hover:bg-[#c8e40d] transition-colors"
              >
                Contact Press Team
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export const getStaticProps: GetStaticProps = async () => {
  const contentDirectory = path.join(process.cwd(), 'content/press/releases');
  let mdxReleases: MdxPressRelease[] = [];

  // Check if directory exists before trying to read it
  if (fs.existsSync(contentDirectory)) {
    try {
      const filenames = fs.readdirSync(contentDirectory);
      
      // Get data from each MDX file
      mdxReleases = filenames
        .filter(filename => filename.endsWith('.mdx') || filename.endsWith('.md'))
        .map(filename => {
          const filePath = path.join(contentDirectory, filename);
          const source = fs.readFileSync(filePath, 'utf8');
          const { data } = matter(source);
          
          // Extract slug from filename (remove extension)
          const slug = filename.replace(/\.mdx?$/, '');
          
          return {
            slug,
            title: data.title,
            date: data.date,
            summary: data.summary,
            image: data.image,
            tags: data.tags || [],
          };
        })
        // Sort by date (newest first)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error reading press release files:', error);
    }
  }

  return {
    props: {
      mdxReleases,
    },
    // Re-generate at most once per hour
    revalidate: 3600,
  };
};

export default PressReleases; 