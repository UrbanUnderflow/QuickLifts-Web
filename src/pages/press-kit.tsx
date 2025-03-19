import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

const PressKit = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const sections = [
    {
      title: "Our Story",
      content: "At Pulse, we've created a vibrant community where fitness enthusiasts connect, share, and grow together. Born from the belief that fitness is better when shared, we've built a platform that combines the power of social connection with personalized fitness tracking.",
      bgColor: "bg-[#192126]",
      textColor: "text-white",
      buttonClass: "border-white text-white",
      imageGrid: true
    },
    {
      title: "Our Mission",
      content: "To democratize fitness by creating an inclusive platform where everyone can find inspiration, share their journey, and achieve their fitness goals. We believe in making fitness accessible, engaging, and community-driven.",
      bgColor: "bg-white",
      textColor: "text-neutral-600",
      buttonClass: "border-black text-black",
      imageGrid: true
    },
    {
      title: "Our Vision",
      content: "To build a world where fitness is not just about personal achievement, but about collective growth and support. We envision a future where every workout shared inspires someone else to start their fitness journey.",
      bgColor: "bg-[#192126]",
      textColor: "text-white",
      buttonClass: "border-white text-white",
      imageGrid: true
    },
    {
      title: "Our Values",
      content: "Community First: We believe in the power of shared experiences and mutual support. Innovation: Constantly evolving to provide the best fitness experience. Inclusivity: Creating a space where everyone feels welcome and supported.",
      bgColor: "bg-white",
      textColor: "text-neutral-600",
      buttonClass: "border-black text-black",
      imageGrid: true
    }
  ];

  const mediaAssets = [
    { title: "Logos", description: "Official Pulse brand logos in various formats" },
    { title: "Brand Materials", description: "Brand guidelines, color palettes, and typography" },
    { title: "Product Screenshots", description: "High-resolution app interface images" },
    { title: "Deck", description: "Presentation materials and company overview" },
    { title: "The Team", description: "Team photos and leadership profiles" },
    { title: "Press Releases", description: "Latest news and announcements" }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-5xl sm:text-7xl font-bold mb-6 tracking-wide">
          Pulse Fitness Collective
        </h1>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          Building the future of social fitness through community, technology, and shared experiences
        </p>
      </div>

      {/* Main Content Sections */}
      {sections.map((section, index) => (
        <div key={section.title} className={`${section.bgColor} py-20`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-center">
              {index % 2 === 0 ? (
                <>
                  <div className="lg:w-1/2">
                    <h2 className={`text-4xl font-medium mb-6 ${section.textColor}`}>
                      {section.title}
                    </h2>
                    <p className={`mb-8 ${section.textColor}`}>
                      {section.content}
                    </p>
                    <button className={`px-6 py-4 border rounded-full flex items-center gap-2 ${section.buttonClass} hover:opacity-80`}>
                      READ MORE
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="lg:w-1/2 grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                        <img 
                          src={`/api/placeholder/200/200`} 
                          alt="Placeholder" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="lg:w-1/2 grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                        <img 
                          src={`/api/placeholder/200/200`} 
                          alt="Placeholder" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="lg:w-1/2">
                    <h2 className={`text-4xl font-medium mb-6 ${section.textColor}`}>
                      {section.title}
                    </h2>
                    <p className={`mb-8 ${section.textColor}`}>
                      {section.content}
                    </p>
                    <button className={`px-6 py-4 border rounded-full flex items-center gap-2 ${section.buttonClass} hover:opacity-80`}>
                      READ MORE
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Media Assets Section */}
      <div className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-12">
            <div>
              <h2 className="text-4xl font-medium mb-2">Media Assets</h2>
              <p className="text-neutral-600 max-w-2xl">
                Download official Pulse brand assets, logos, and media materials. For press inquiries, please contact our media relations team.
              </p>
            </div>
            <div className="mt-4 lg:mt-0">
              <input
                type="text"
                placeholder="Search media assets"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border border-black rounded-full w-full lg:w-80"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mediaAssets.map((asset) => (
              <div key={asset.title} className="flex flex-col">
                <div className="aspect-video bg-[#192126] rounded-lg mb-4"></div>
                <h3 className="text-xl font-semibold mb-2">{asset.title}</h3>
                <p className="text-neutral-600 mb-4">{asset.description}</p>
                <button className="flex items-center text-lg font-medium hover:opacity-80">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Story Section */}
      <div className="bg-[#192126] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-center">
            <div className="lg:w-1/2 grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                  <img 
                    src={`/api/placeholder/200/200`} 
                    alt="Placeholder" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <div className="lg:w-1/2">
              <h2 className="text-4xl font-medium mb-6 text-white">
                Featured Story
              </h2>
              <p className="mb-8 text-white">
                Discover how Pulse is transforming the fitness landscape by bringing people together and making workouts more engaging and social than ever before.
              </p>
              <button className="px-6 py-4 border border-white text-white rounded-full flex items-center gap-2 hover:opacity-80">
                READ MORE
                <ArrowUpRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PressKit;