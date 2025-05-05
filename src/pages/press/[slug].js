import { useRouter } from 'next/router';
import Head from 'next/head';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { MDXRemote } from 'next-mdx-remote';
import { serialize } from 'next-mdx-remote/serialize';
import Link from 'next/link';
import { ArrowLeft, Calendar, Share } from 'lucide-react';
import { format } from 'date-fns';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import PressBody from '../../components/Press/PressBody';

// MDX components
const components = {
  PressBody,
};

export default function PressRelease({ frontMatter, mdxSource }) {
  const router = useRouter();

  if (router.isFallback) {
    return <div className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <Head>
        <title>{frontMatter.title} | Pulse Press</title>
        <meta name="description" content={frontMatter.summary} />
        <meta property="og:title" content={`${frontMatter.title} | Pulse Press`} />
        <meta property="og:description" content={frontMatter.summary} />
        {frontMatter.image && <meta property="og:image" content={frontMatter.image} />}
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <Header />

      <main className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <Link href="/press/press-releases" className="inline-flex items-center text-zinc-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Press Releases
          </Link>

          {/* Header */}
          <div className="mb-12">
            {frontMatter.image && (
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-8">
                <img 
                  src={frontMatter.image} 
                  alt={frontMatter.title} 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex items-center text-[#E0FE10] text-sm mb-4">
              <Calendar className="w-4 h-4 mr-2" />
              {format(new Date(frontMatter.date), 'MMMM d, yyyy')}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-6">{frontMatter.title}</h1>
            
            <p className="text-xl text-zinc-300">{frontMatter.summary}</p>
            
            <div className="mt-6 flex items-center">
              <button 
                className="flex items-center text-zinc-400 hover:text-white"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard');
                }}
              >
                <Share className="w-4 h-4 mr-2" />
                Share
              </button>
            </div>
          </div>

          {/* Content */}
          <article className="prose prose-invert prose-lg max-w-none">
            <MDXRemote {...mdxSource} components={components} />
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export async function getStaticPaths() {
  try {
    const contentDirectory = path.join(process.cwd(), 'content/press/releases');
    
    if (!fs.existsSync(contentDirectory)) {
      console.warn('Press releases directory does not exist yet:', contentDirectory);
      return {
        paths: [],
        fallback: true,
      };
    }
    
    const filenames = fs.readdirSync(contentDirectory);
    const paths = filenames
      .filter(filename => filename.endsWith('.mdx') || filename.endsWith('.md'))
      .map(filename => ({
        params: {
          slug: filename.replace(/\.mdx?$/, ''),
        },
      }));

    return {
      paths,
      fallback: true,
    };
  } catch (error) {
    console.error('Error in getStaticPaths:', error);
    return {
      paths: [],
      fallback: true,
    };
  }
}

export async function getStaticProps({ params }) {
  try {
    const contentDirectory = path.join(process.cwd(), 'content/press/releases');
    
    if (!fs.existsSync(contentDirectory)) {
      console.warn('Press releases directory does not exist yet:', contentDirectory);
      return {
        notFound: true,
      };
    }
    
    // Try with both .md and .mdx extensions
    let filePath;
    if (fs.existsSync(path.join(contentDirectory, `${params.slug}.mdx`))) {
      filePath = path.join(contentDirectory, `${params.slug}.mdx`);
    } else if (fs.existsSync(path.join(contentDirectory, `${params.slug}.md`))) {
      filePath = path.join(contentDirectory, `${params.slug}.md`);
    } else {
      // If we can't find the file by slug directly, try to match by date-slug pattern
      const allFiles = fs.readdirSync(contentDirectory);
      const matchingFile = allFiles.find(file => 
        file.endsWith(`-${params.slug}.mdx`) || file.endsWith(`-${params.slug}.md`)
      );
      
      if (matchingFile) {
        filePath = path.join(contentDirectory, matchingFile);
      } else {
        return {
          notFound: true,
        };
      }
    }

    const source = fs.readFileSync(filePath, 'utf8');
    const { content, data } = matter(source);
    const mdxSource = await serialize(content);

    return {
      props: {
        frontMatter: data,
        mdxSource,
      },
      // Re-generate the page every hour
      revalidate: 3600, 
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      notFound: true,
    };
  }
} 