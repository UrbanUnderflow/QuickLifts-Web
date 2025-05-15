import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowUpRight, Download, Search, Loader2, AlertTriangle, X } from 'lucide-react';
import { useScrollFade } from '../../hooks/useScrollFade';
import Header from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { adminMethods } from '../../api/firebase/admin/methods'; // Added for getServerSideProps
import { PageMetaData } from '../../api/firebase/admin/types'; // Added for type hint
import { GetServerSideProps } from 'next'; // Added for getServerSideProps type

interface PressKitAssets {
  overviewPdf?: string;
  founderLandscape?: string;
  founderPortrait1?: string;
  founderPortrait2?: string;
  founderBioPdf?: string;
  productOnePagerPdf?: string;
  factCheckSheetPdf?: string;
  talkingPointsFaqsPdf?: string;
  completeKitZip?: string;
  logoSigSvg?: string;
  logoSigPng?: string;
}

// OverviewModal Component
interface OverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const OverviewModal: React.FC<OverviewModalProps> = ({ isOpen, onClose }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      // Dynamically import html2pdf to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      setIsGenerating(true);
      
      // Create a completely new white-themed document for PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.className = "bg-white text-zinc-900";
      pdfContainer.style.backgroundColor = "#ffffff";
      pdfContainer.style.color = "#18181b";
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.padding = '20px';
      pdfContainer.style.maxWidth = '100%';
      
      // Header with logo
      const header = document.createElement('header');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '30px';
      header.style.borderBottom = '1px solid #e5e7eb';
      header.style.paddingBottom = '20px';
      
      const logoContainer = document.createElement('div');
      logoContainer.style.display = 'flex';
      logoContainer.style.alignItems = 'center';
      logoContainer.style.gap = '10px';
      
      // Use the SVG logo
      const logoImg = document.createElement('img');
      logoImg.src = window.location.origin + '/pulse-logo.svg';
      logoImg.alt = 'Pulse Logo';
      logoImg.style.height = '32px';
      logoImg.style.width = 'auto';
      
      logoContainer.appendChild(logoImg);
      header.appendChild(logoContainer);
      pdfContainer.appendChild(header);
      
      // Main content
      const main = document.createElement('main');
      main.style.width = '100%';
      
      // Title and Subtitle
      const title = document.createElement('h1');
      title.style.fontSize = '28px';
      title.style.fontWeight = 'bold';
      title.style.textAlign = 'center';
      title.style.marginBottom = '12px';
      title.style.color = '#18181b';
      title.textContent = 'Pulse: Lean Business Plan';
      
      const subtitle = document.createElement('p');
      subtitle.style.textAlign = 'center';
      subtitle.style.fontSize = '14px';
      subtitle.style.color = '#6b7280';
      subtitle.style.marginBottom = '32px';
      subtitle.textContent = 'A fitness app and community platform that redefines how we create, share, and experience workouts together.';
      
      main.appendChild(title);
      main.appendChild(subtitle);
      
      // Create the business plan table
      const businessPlan = document.createElement('table');
      businessPlan.style.width = '100%';
      businessPlan.style.borderCollapse = 'collapse';
      businessPlan.style.marginBottom = '40px';
      businessPlan.style.fontSize = '14px';
      businessPlan.style.border = '1px solid #e5e7eb';
      
      // Table header
      const tableHeader = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.style.backgroundColor = '#f3f4f6';
      headerRow.style.textAlign = 'center';
      
      const headerCell = document.createElement('th');
      headerCell.style.padding = '12px';
      headerCell.style.fontWeight = 'bold';
      headerCell.style.fontSize = '18px';
      headerCell.colSpan = 2;
      headerCell.textContent = 'Lean Business Plan';
      
      headerRow.appendChild(headerCell);
      tableHeader.appendChild(headerRow);
      businessPlan.appendChild(tableHeader);
      
      // Table body
      const tableBody = document.createElement('tbody');
      
      // Create a function to add a row to the table
      const addRow = (title: string | [string, string], content: string | [string, string], isFullWidth = false, borderBottom = true) => {
        const row = document.createElement('tr');
        if (borderBottom) {
          row.style.borderBottom = '1px solid #e5e7eb';
        }
        
        if (isFullWidth) {
          const cell = document.createElement('td');
          cell.colSpan = 2;
          cell.style.padding = '16px';
          cell.style.verticalAlign = 'top';
          
          const titleEl = document.createElement('p');
          titleEl.style.fontSize = '12px';
          titleEl.style.fontWeight = '600';
          titleEl.style.color = '#6b7280';
          titleEl.style.marginBottom = '8px';
          titleEl.style.textTransform = 'uppercase';
          titleEl.textContent = title as string; // Type assertion
          
          const contentEl = document.createElement('p');
          contentEl.style.color = '#374151';
          contentEl.innerHTML = content as string; // Type assertion
          
          cell.appendChild(titleEl);
          cell.appendChild(contentEl);
          row.appendChild(cell);
        } else {
          const titleCell = document.createElement('td');
          titleCell.style.width = '50%';
          titleCell.style.padding = '16px';
          titleCell.style.borderRight = '1px solid #e5e7eb';
          titleCell.style.verticalAlign = 'top';
          
          const titleTitleEl = document.createElement('p');
          titleTitleEl.style.fontSize = '12px';
          titleTitleEl.style.fontWeight = '600';
          titleTitleEl.style.color = '#6b7280';
          titleTitleEl.style.marginBottom = '8px';
          titleTitleEl.style.textTransform = 'uppercase';
          titleTitleEl.textContent = (title as [string, string])[0]; // Type assertion
          
          const titleContentEl = document.createElement('p');
          titleContentEl.style.color = '#374151';
          titleContentEl.innerHTML = (title as [string, string])[1]; // Type assertion
          
          titleCell.appendChild(titleTitleEl);
          titleCell.appendChild(titleContentEl);
          
          const contentCell = document.createElement('td');
          contentCell.style.width = '50%';
          contentCell.style.padding = '16px';
          contentCell.style.verticalAlign = 'top';
          
          const contentTitleEl = document.createElement('p');
          contentTitleEl.style.fontSize = '12px';
          contentTitleEl.style.fontWeight = '600';
          contentTitleEl.style.color = '#6b7280';
          contentTitleEl.style.marginBottom = '8px';
          contentTitleEl.style.textTransform = 'uppercase';
          contentTitleEl.textContent = (content as [string, string])[0]; // Type assertion
          
          const contentContentEl = document.createElement('p');
          contentContentEl.style.color = '#374151';
          contentContentEl.innerHTML = (content as [string, string])[1]; // Type assertion
          
          contentCell.appendChild(contentTitleEl);
          contentCell.appendChild(contentContentEl);
          
          row.appendChild(titleCell);
          row.appendChild(contentCell);
        }
        
        tableBody.appendChild(row);
      };
      
      // IDENTITY Section (full width)
      addRow('IDENTITY', 'Pulse: The Fitness Collective is a fitness app and community platform that redefines how we create, share, and experience workouts together.', true);
      
      // PROBLEM & SOLUTION Row
      addRow(
        ['PROBLEM WORTH SOLVING', 'The fitness app market is fragmented, which directs people to use social media for their primary fitness discovery tool, however social media fails to inspire genuine fitness commitment, and action.'],
        ['OUR SOLUTION', 'Pulse centralizes and democratizes fitness expertise, with an app where creators can easily share and monetize their fitness content, and fitness seekers can find quality content in one place.']
      );
      
      // TARGET MARKET & COMPETITION Row
      addRow(
        ['TARGET MARKET', '<strong>Fitness content creators</strong> - particularly those with established audiences, who can share expertise and monetize their content through the platform.<br><br><strong>Fitness seekers</strong> - with established workout habits, looking for new routines, progress tracking, and community connections.<br><br>Pulse aims to connect these two groups, creating a community-driven fitness experience that makes fitness more accessible and rewarding for both creators and users.'],
        ['THE COMPETITION', 'Pulse operates in a fragmented fitness app market, with its primary competitor being Instagram, which hosts an estimated 280 million fitness content creators. Other competitors include specialized fitness apps like FitBod and Nike Fit Club.<br><br>Pulse differentiated itself by harnessing the collective wisdom of its community. Unlike traditional apps Pulse\'s magic lies in its video-first, community-driven approach, where every user becomes both student and teacher. By seamlessly blending social engagement with practical fitness tools, Pulse transforms passive scrolling into active participation.']
      );
      
      // SALES & MARKETING Row
      addRow(
        ['SALES CHANNELS', 'Pulse employs a strategic, segmented approach to sales and user acquisition. The platform targets content creators across three tiers: Micro (100-5000 followers), Median (5000-50,000 followers), and Macro (50,000+ followers), with tailored outreach and support for each segment.'],
        ['MARKETING ACTIVITIES', 'Digital marketing platforms such as Apple Search Ads, Google Ads, Instagram, TikTok.<br><br>We will also do direct sale through gym partnerships, in-person events, and direct content creator recruiting through social media.']
      );
      
      // REVENUE & EXPENSES Row
      addRow(
        ['REVENUE', 'Fitness users can subscribe to the app for $4.99 monthly or $39.99 annually.<br><br>Content creators opt into a $79.99 annual subscription to monetize their content through an engagement-based profit-sharing model'],
        ['EXPENSES', 'Content Creator Recruitment, Digital Marketing & Sales, Technology Stack, Product Development, Research and Development, Operational Expenses, Headcount (Salaries), In-person Events']
      );
      
      // MILESTONES Row
      addRow(
        ['MILESTONES', 'MVP launched in January 2024, 275 users in open beta, 364 exercise videos uploaded, 20 content creators recruited, 115,000 email list built, UI/UX designer hired, Digital Marketing Manager hired, 5-star Apple App Store rating achieved'],
        ['', '']
      );
      
      // TEAM & PARTNERS Row
      addRow(
        ['TEAM AND KEY ROLES', '- &nbsp;&nbsp;Lead Software Engineer(Myself)<br>- &nbsp;&nbsp;Brand/ Product Designer(Joseph)<br>- &nbsp;&nbsp;Social Media Manager(Funso) - Looking for replacement'],
        ['PARTNERS AND RESOURCES', 'We are looking to build gym partnerships, and corporate partnerships with notable brands(Lulu Lemon is our dream partnership)'],
        false,
        false
      );
      
      businessPlan.appendChild(tableBody);
      main.appendChild(businessPlan);
      
      // Elevator pitch section
      const elevatorPitchTitle = document.createElement('h2');
      elevatorPitchTitle.style.fontSize = '20px';
      elevatorPitchTitle.style.fontWeight = '600';
      elevatorPitchTitle.style.marginBottom = '12px';
      elevatorPitchTitle.style.color = '#18181b';
      elevatorPitchTitle.textContent = 'Elevator Pitch';
      
      const elevatorPitchContent = document.createElement('p');
      elevatorPitchContent.style.marginBottom = '24px';
      elevatorPitchContent.style.lineHeight = '1.6';
      elevatorPitchContent.textContent = 'Pulse is a fitness app where creators capture and share their Moves—we turn those into gamified, community-driven fitness experiences for their audiences. At its core, we help people move together.';
      
      main.appendChild(elevatorPitchTitle);
      main.appendChild(elevatorPitchContent);
      
      // Why Now section
      const whyNowTitle = document.createElement('h2');
      whyNowTitle.style.fontSize = '20px';
      whyNowTitle.style.fontWeight = '600';
      whyNowTitle.style.marginBottom = '12px';
      whyNowTitle.style.color = '#18181b';
      whyNowTitle.textContent = 'Why Now? Narrative';
      
      const whyNowContent1 = document.createElement('p');
      whyNowContent1.style.marginBottom = '12px';
      whyNowContent1.style.lineHeight = '1.6';
      whyNowContent1.textContent = 'In the post-COVID era, people are yearning for authentic connection in fitness. We\'re seeing explosive growth in in-person run clubs, community workouts, and fitness communities seeking meaningful engagement beyond digital screens.';
      
      const whyNowContent2 = document.createElement('p');
      whyNowContent2.style.marginBottom = '24px';
      whyNowContent2.style.lineHeight = '1.6';
      whyNowContent2.textContent = 'Meanwhile, short-form content has revolutionized how people consume information, creating perfect conditions for bite-sized fitness content. The fitness industry continues to grow exponentially, with digital fitness projected to reach $44.7 billion by 2026, creating space for a dominant digital platform that connects people through movement.';
      
      main.appendChild(whyNowTitle);
      main.appendChild(whyNowContent1);
      main.appendChild(whyNowContent2);
      
      pdfContainer.appendChild(main);
      
      // Footer
      const footer = document.createElement('footer');
      footer.style.marginTop = '40px';
      footer.style.borderTop = '1px solid #e5e7eb';
      footer.style.paddingTop = '16px';
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
      
      const footerText = document.createElement('p');
      footerText.style.fontSize = '12px';
      footerText.style.color = '#6b7280';
      footerText.textContent = `Last updated: May 2025 • Generated on ${new Date().toLocaleDateString()}`;
      
      const footerLogo = document.createElement('div');
      footerLogo.style.display = 'flex';
      footerLogo.style.alignItems = 'center';
      footerLogo.style.gap = '8px';
      
      // Use the SVG logo in the footer as well
      const footerLogoImg = document.createElement('img');
      footerLogoImg.src = window.location.origin + '/pulse-logo.svg';
      footerLogoImg.alt = 'Pulse Logo';
      footerLogoImg.style.height = '20px';
      footerLogoImg.style.width = 'auto';
      
      footerLogo.appendChild(footerLogoImg);
      
      footer.appendChild(footerText);
      footer.appendChild(footerLogo);
      
      pdfContainer.appendChild(footer);
      
      // PDF generation options
      const opt = {
        margin: [10, 10],
        filename: 'Pulse_Fitness_Collective_Overview.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // Generate PDF
      await html2pdf().from(pdfContainer).set(opt).save();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('There was an error generating the PDF. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1e24] rounded-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
          <h3 className="text-lg font-medium text-white">Pulse Fitness Collective: Overview</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div ref={contentRef} className="overflow-y-auto p-6 max-h-[calc(90vh-120px)] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
          <div className="space-y-8">
            <div className="rounded-lg overflow-hidden border border-zinc-700">
              <div className="bg-[#F5F5F4] p-4 text-center">
                <h3 className="text-black text-2xl font-bold">Lean Business Plan</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2">
                {/* IDENTITY */}
                <div className="col-span-1 md:col-span-2 bg-white p-5 border-b border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">IDENTITY</p>
                  <p className="text-black">Pulse: The Fitness Collective is a fitness app and community platform that redefines how we create, share, and experience workouts together.</p>
                </div>
                
                {/* PROBLEM & SOLUTION */}
                <div className="bg-white p-5 border-b border-r md:border-r border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">PROBLEM WORTH SOLVING</p>
                  <p className="text-black">The fitness app market is fragmented, which directs people to use social media for their primary fitness discovery tool, however social media fails to inspire genuine fitness commitment, and action.</p>
                </div>
                
                <div className="bg-white p-5 border-b border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">OUR SOLUTION</p>
                  <p className="text-black">Pulse centralizes and democratizes fitness expertise, with an app where creators can easily share and monetize their fitness content, and fitness seekers can find quality content in one place.</p>
                </div>
                
                {/* TARGET MARKET & COMPETITION */}
                <div className="bg-white p-5 border-b border-r md:border-r border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">TARGET MARKET</p>
                  <p className="text-black font-medium mb-2">Fitness content creators - particularly those with established audiences, who can share expertise and monetize their content through the platform.</p>
                  <p className="text-black font-medium mb-2">Fitness seekers - with established workout habits, looking for new routines, progress tracking, and community connections.</p>
                  <p className="text-black">Pulse aims to connect these two groups, creating a community-driven fitness experience that makes fitness more accessible and rewarding for both creators and users.</p>
                </div>
                
                <div className="bg-white p-5 border-b border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">THE COMPETITION</p>
                  <p className="text-black mb-3">Pulse operates in a fragmented fitness app market, with its primary competitor being Instagram, which hosts an estimated 280 million fitness content creators. Other competitors include specialized fitness apps like FitBod and Nike Fit Club.</p>
                  <p className="text-black">Pulse differentiated itself by harnessing the collective wisdom of its community. Unlike traditional apps Pulse&apos;s magic lies in its video-first, community-driven approach, where every user becomes both student and teacher. By seamlessly blending social engagement with practical fitness tools, Pulse transforms passive scrolling into active participation.</p>
                </div>
                
                {/* SALES & MARKETING */}
                <div className="bg-white p-5 border-b border-r md:border-r border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">SALES CHANNELS</p>
                  <p className="text-black">Pulse employs a strategic, segmented approach to sales and user acquisition. The platform targets content creators across three tiers: Micro (100-5000 followers), Median (5000-50,000 followers), and Macro (50,000+ followers), with tailored outreach and support for each segment.</p>
                </div>
                
                <div className="bg-white p-5 border-b border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">MARKETING ACTIVITIES</p>
                  <p className="text-black mb-2">Digital marketing platforms such as Apple Search Ads, Google Ads, Instagram, TikTok.</p>
                  <p className="text-black">We will also do direct sale through gym partnerships, in-person events, and direct content creator recruiting through social media.</p>
                </div>
                
                {/* REVENUE & EXPENSES */}
                <div className="bg-white p-5 border-b border-r md:border-r border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">REVENUE</p>
                  <p className="text-black mb-3">Fitness users can subscribe to the app for $4.99 monthly or $39.99 annually.</p>
                  <p className="text-black">Content creators opt into a $79.99 annual subscription to monetize their content through an engagement-based profit-sharing model</p>
                </div>
                
                <div className="bg-white p-5 border-b border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">EXPENSES</p>
                  <p className="text-black">Content Creator Recruitment, Digital Marketing & Sales, Technology Stack, Product Development, Research and Development, Operational Expenses, Headcount (Salaries), In-person Events</p>
                </div>
                
                {/* MILESTONES */}
                <div className="bg-white p-5 border-b border-r md:border-r border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">MILESTONES</p>
                  <p className="text-black">MVP launched in January 2024, 275 users in open beta, 364 exercise videos uploaded, 20 content creators recruited, 115,000 email list built, UI/UX designer hired, Digital Marketing Manager hired, 5-star Apple App Store rating achieved</p>
                </div>
                
                {/* TEAM & PARTNERS */}
                <div className="bg-white p-5 border-r md:border-r border-zinc-300">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">TEAM AND KEY ROLES</p>
                  <p className="text-black">
                    - &nbsp;&nbsp;Lead Software Engineer(Myself)<br />
                    - &nbsp;&nbsp;Brand/Product Designer(Joseph)<br />
                    - &nbsp;&nbsp;Social Media Manager(Funso) - Looking for replacement
                  </p>
                </div>
                
                <div className="bg-white p-5">
                  <p className="text-zinc-500 text-xs uppercase font-semibold mb-1">PARTNERS AND RESOURCES</p>
                  <p className="text-black">We are looking to build gym partnerships, and corporate partnerships with notable brands(Lulu Lemon is our dream partnership)</p>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">Elevator Pitch</h4>
              <p className="text-zinc-400 text-lg mb-6">
                Pulse is a fitness app where creators capture and share their Moves—we turn those into gamified, community-driven fitness experiences for their audiences. At its core, we help people move together.
              </p>
              
              <h4 className="text-white text-xl font-semibold mb-4 mt-8">Why Now? Narrative</h4>
              <p className="text-zinc-400 text-lg mb-4">
                In the post-COVID era, people are yearning for authentic connection in fitness. We\'re seeing explosive growth in in-person run clubs, community workouts, and fitness communities seeking meaningful engagement beyond digital screens.
              </p>
              <p className="text-zinc-400 text-lg mb-4">
                Meanwhile, short-form content has revolutionized how people consume information, creating perfect conditions for bite-sized fitness content. The fitness industry continues to grow exponentially, with digital fitness projected to reach $44.7 billion by 2026, creating space for a dominant digital platform that connects people through movement.
              </p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-between items-center">
          <p className="text-zinc-400 text-sm">Last updated: May 2025</p>
          <button 
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// FactSheetModal Component
interface FactSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FactSheetModal: React.FC<FactSheetModalProps> = ({ isOpen, onClose }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    try {
      // Dynamically import html2pdf to avoid SSR issues
      const html2pdf = (await import('html2pdf.js')).default;
      setIsGenerating(true);
      
      // Create a completely new white-themed document for PDF
      const pdfContainer = document.createElement('div');
      pdfContainer.className = "bg-white text-zinc-900";
      pdfContainer.style.backgroundColor = "#ffffff";
      pdfContainer.style.color = "#18181b";
      pdfContainer.style.fontFamily = 'Arial, sans-serif';
      pdfContainer.style.padding = '20px';
      pdfContainer.style.maxWidth = '100%';
      
      // Header with logo
      const header = document.createElement('header');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '30px';
      header.style.borderBottom = '1px solid #e5e7eb';
      header.style.paddingBottom = '20px';
      
      const logoContainer = document.createElement('div');
      logoContainer.style.display = 'flex';
      logoContainer.style.alignItems = 'center';
      logoContainer.style.gap = '10px';
      
      // Use the SVG logo
      const logoImg = document.createElement('img');
      logoImg.src = window.location.origin + '/pulse-logo.svg';
      logoImg.alt = 'Pulse Logo';
      logoImg.style.height = '32px';
      logoImg.style.width = 'auto';
      
      logoContainer.appendChild(logoImg);
      header.appendChild(logoContainer);
      pdfContainer.appendChild(header);
      
      // Main content
      const main = document.createElement('main');
      main.style.width = '100%';
      
      // Title and Subtitle
      const title = document.createElement('h1');
      title.style.fontSize = '28px';
      title.style.fontWeight = 'bold';
      title.style.textAlign = 'center';
      title.style.marginBottom = '12px';
      title.style.color = '#18181b';
      title.textContent = 'Pulse: Fact-Check Sheet';
      
      const subtitle = document.createElement('p');
      subtitle.style.textAlign = 'center';
      subtitle.style.fontSize = '14px';
      subtitle.style.color = '#6b7280';
      subtitle.style.marginBottom = '32px';
      subtitle.textContent = 'All the official information about Pulse, compiled for easy reference to ensure accuracy in reporting.';
      
      main.appendChild(title);
      main.appendChild(subtitle);
      
      // I'll define a helper function to create content sections
      const createSection = (title: string, items: Array<{label: string, content: string | string[]}>) => {
        const section = document.createElement('div');
        section.style.border = '1px solid #e5e7eb';
        section.style.borderRadius = '12px';
        section.style.padding = '24px';
        section.style.marginBottom = '24px';
        section.style.backgroundColor = '#ffffff';
        section.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
        
        const sectionTitle = document.createElement('h2');
        sectionTitle.style.fontSize = '20px';
        sectionTitle.style.fontWeight = '600';
        sectionTitle.style.marginBottom = '24px';
        sectionTitle.style.color = '#18181b';
        sectionTitle.textContent = title;
        section.appendChild(sectionTitle);
        
        items.forEach((item: {label: string, content: string | string[]}) => {
          const itemContainer = document.createElement('div');
          itemContainer.style.marginBottom = '20px';
          itemContainer.style.paddingBottom = '12px';
          itemContainer.style.borderBottom = '1px solid #f3f4f6';
          
          const label = document.createElement('p');
          label.style.fontSize = '12px';
          label.style.fontWeight = '500';
          label.style.marginBottom = '4px';
          label.style.color = '#6b7280';
          label.style.textTransform = 'uppercase';
          label.textContent = item.label;
          itemContainer.appendChild(label);
          
          if (typeof item.content === 'string') {
            const content = document.createElement('p');
            content.style.color = '#18181b';
            content.textContent = item.content;
            itemContainer.appendChild(content);
          } else {
            const list = document.createElement('ul');
            list.style.listStyleType = 'disc';
            list.style.paddingLeft = '20px';
            list.style.marginTop = '8px';
            
            item.content.forEach((li: string) => {
              const listItem = document.createElement('li');
              listItem.style.color = '#18181b';
              listItem.style.marginBottom = '4px';
              listItem.textContent = li;
              list.appendChild(listItem);
            });
            
            itemContainer.appendChild(list);
          }
          
          section.appendChild(itemContainer);
        });
        
        return section;
      };
      
      // Create all sections
      const companyInfo = createSection('Company Information', [
        { label: 'LEGAL NAME', content: 'Pulse Fitness Collective LLC' },
        { label: 'BRAND NAMES', content: 'Pulse, Pulse Fitness Collective' },
        { label: 'FOUNDER & CEO', content: 'Tremaine Grant' },
        { label: 'FOUNDED', content: 'June 2023' },
        { label: 'HEADQUARTERS', content: 'Atlanta, Georgia, USA' },
        { label: 'LEGAL ENTITY TYPE', content: 'C-Corporation' },
        { label: 'EIN', content: '99-2545975' },
        { label: 'PRODUCT STAGE', content: 'Product Live + Post Revenue' },
        { label: 'PLATFORM AVAILABILITY', content: 'iOS App Store, Web App (https://fitwithpulse.ai)' }
      ]);
      
      const productTerms = createSection('Product Terminology', [
        { label: 'MOVES', content: 'Bite-sized video demonstrations of a single exercise (5–30s).' },
        { label: 'STACKS', content: 'Custom-built workouts composed of several Moves.' },
        { label: 'ROUNDS', content: 'Community-driven fitness challenges; gamified workout programs where multiple participants track and compete together.' },
        { label: 'PULSE PROGRAMMING', content: 'AI-driven trainer tool that creates personalized workouts and Rounds in minutes by combining trainer prompts with Moves from our content vault.' },
        { label: 'SWEAT SYNC LIVE', content: 'Real-time syncing feature allowing users to work out together virtually, with live progress indicators and join-in capability.' }
      ]);
      
      const businessModel = createSection('Business Model', [
        { label: 'FITNESS SEEKERS', content: '$4.99/month or $39.99/year' },
        { label: 'CONTENT CREATORS', content: '$79.99/year to unlock monetization (Sweat Equity Program)' },
        { label: 'PLANNED REVENUE STREAMS', content: [
          'Brand sponsorships',
          'Affiliate marketplace',
          'Creator monetization commissions',
          'Corporate wellness B2B licensing'
        ]}
      ]);
      
      const keyMetrics = createSection('Key Metrics (as of May 2025)', [
        { label: 'ACTIVE USERS', content: '12,800+' },
        { label: 'CREATOR COMMUNITY', content: '1,100+ founding creators onboarded' },
        { label: 'CONTENT STATS', content: '17,000+ workouts shared\n55,000+ moves created' },
        { label: 'MORNING MOBILITY CHALLENGE', content: '2,500+ participants (87% completion rate)' },
        { label: 'EMAIL SUBSCRIBERS', content: '115,000' }
      ]);
      
      const legalHighlights = createSection('IP & Legal Highlights', [
        { label: 'TRADEMARKS FILED', content: 'Pulse Programming™, Sweat Sync Live™, Pulse Rounds™, Pulse Stacks™' },
        { label: 'PROVISIONAL PATENTS PENDING', content: [
          'AI-powered workout programming system',
          'Real-time social workout synchronization',
          'User-generated content monetization engine'
        ]}
      ]);
      
      const pressMedia = createSection('Press & Media', [
        { label: 'CONTACT', content: 'press@fitwithpulse.ai' },
        { label: 'DOWNLOADABLE KIT', content: 'fitwithpulse.ai/press' },
        { label: 'NOTABLE MENTIONS', content: [
          'SoulCycle ATL Collaboration',
          'Black Ambition Prize Applicant',
          'FitFest ATL Demo'
        ]}
      ]);
      
      const socialVision = createSection('Social Presence & Vision', [
        { label: 'SOCIAL MEDIA', content: [
          'Instagram: @fitwithpulse',
          'TikTok: @fitwithpulse',
          'YouTube: First Player Series by Tremaine Grant'
        ]},
        { label: 'VISION STATEMENT', content: 'To become the dominant digital fitness platform globally. We see this position as open and ready for the taking, with no singular platform currently serving as the go-to destination. We will achieve dominance through comprehensive content categories, innovative health-based products, and by leading the frontier of fitness technology.' },
        { label: 'MISSION STATEMENT', content: 'To create meaningful fitness connections in an era that prioritizes media consumption over social interaction, while simultaneously opening new economic opportunities in the fitness space. We aim to democratize fitness expertise the way Spotify revolutionized the music industry, creating new passive income streams for fitness professionals and enthusiasts alike.' }
      ]);
      
      // Create a grid layout for the sections
      const gridRow1 = document.createElement('div');
      gridRow1.style.display = 'grid';
      gridRow1.style.gridTemplateColumns = 'repeat(2, 1fr)';
      gridRow1.style.gap = '24px';
      gridRow1.style.marginBottom = '24px';
      
      gridRow1.appendChild(companyInfo);
      gridRow1.appendChild(productTerms);
      
      const gridRow2 = document.createElement('div');
      gridRow2.style.display = 'grid';
      gridRow2.style.gridTemplateColumns = 'repeat(2, 1fr)';
      gridRow2.style.gap = '24px';
      gridRow2.style.marginBottom = '24px';
      
      gridRow2.appendChild(businessModel);
      gridRow2.appendChild(keyMetrics);
      
      const gridRow3 = document.createElement('div');
      gridRow3.style.display = 'grid';
      gridRow3.style.gridTemplateColumns = 'repeat(2, 1fr)';
      gridRow3.style.gap = '24px';
      gridRow3.style.marginBottom = '24px';
      
      gridRow3.appendChild(legalHighlights);
      gridRow3.appendChild(pressMedia);
      
      main.appendChild(gridRow1);
      main.appendChild(gridRow2);
      main.appendChild(gridRow3);
      main.appendChild(socialVision);
      
      pdfContainer.appendChild(main);
      
      // Footer
      const footer = document.createElement('footer');
      footer.style.marginTop = '40px';
      footer.style.borderTop = '1px solid #e5e7eb';
      footer.style.paddingTop = '16px';
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
      
      const footerText = document.createElement('p');
      footerText.style.fontSize = '12px';
      footerText.style.color = '#6b7280';
      footerText.textContent = `Last updated: May 2025 • Generated on ${new Date().toLocaleDateString()}`;
      
      const footerLogo = document.createElement('div');
      footerLogo.style.display = 'flex';
      footerLogo.style.alignItems = 'center';
      footerLogo.style.gap = '8px';
      
      // Use the SVG logo in the footer as well
      const footerLogoImg = document.createElement('img');
      footerLogoImg.src = window.location.origin + '/pulse-logo.svg';
      footerLogoImg.alt = 'Pulse Logo';
      footerLogoImg.style.height = '20px';
      footerLogoImg.style.width = 'auto';
      
      footerLogo.appendChild(footerLogoImg);
      
      footer.appendChild(footerText);
      footer.appendChild(footerLogo);
      
      pdfContainer.appendChild(footer);
      
      // PDF generation options
      const opt = {
        margin: [10, 10],
        filename: 'Pulse_Fitness_Collective_Fact_Sheet.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // Generate PDF
      await html2pdf().from(pdfContainer).set(opt).save();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('There was an error generating the PDF. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1a1e24] rounded-xl w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-800">
          <h3 className="text-lg font-medium text-white">Pulse Fitness Collective: Fact-Check Sheet</h3>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div ref={contentRef} className="overflow-y-auto p-6 max-h-[calc(90vh-120px)] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Company Information */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">Company Information</h4>
              
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">COMPANY NAME</p>
                  <p className="text-white">Pulse Fitness Collective LLC (legal), "Pulse" or "Pulse Fitness Collective" (informal)</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">FOUNDING</p>
                  <p className="text-white">Founded in June 2023 by Tremaine Grant in Atlanta, Georgia</p>
                </div>
                <div>
                  <div className="mb-4">
                    <p className="text-zinc-500 text-sm mb-1">VISION STATEMENT</p>
                    <p className="text-white text-sm">To become the dominant digital fitness platform globally. We see this position as open and ready for the taking, with no singular platform currently serving as the go-to destination. We will achieve dominance through comprehensive content categories, innovative health-based products, and by leading the frontier of fitness technology.</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">MISSION STATEMENT</p>
                    <p className="text-white text-sm">To create meaningful fitness connections in an era that prioritizes media consumption over social interaction, while simultaneously opening new economic opportunities in the fitness space. We aim to democratize fitness expertise the way Spotify revolutionized the music industry, creating new passive income streams for fitness professionals and enthusiasts alike.</p>
                  </div>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">PRODUCT TERMINOLOGY</p>
                  <p className="text-white">Moves (individual exercise videos)</p>
                  <p className="text-white">Stacks (workout routines)</p>
                  <p className="text-white">Rounds (community challenges)</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">PLATFORM AVAILABILITY</p>
                  <p className="text-white">iOS App Store, Web app (fitwithpulse.ai)</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">HEADQUARTERS</p>
                  <p className="text-white">Atlanta, Georgia, USA</p>
                </div>
              </div>
            </div>
            
            {/* Product Terminology */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">Product Terminology</h4>
              
              <div className="space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">MOVES</p>
                  <p className="text-white">Bite-sized video demonstrations of a single exercise (5–30s).</p>
                </div>
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">STACKS</p>
                  <p className="text-white">Custom-built workouts composed of several Moves.</p>
                </div>
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">ROUNDS</p>
                  <p className="text-white">Community-driven fitness challenges; gamified workout programs where multiple participants track and compete together.</p>
                </div>
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">PULSE PROGRAMMING</p>
                  <p className="text-white">AI-driven trainer tool that creates personalized workouts and Rounds in minutes by combining trainer prompts with Moves from our content vault.</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">SWEAT SYNC LIVE</p>
                  <p className="text-white">Real-time syncing feature allowing users to work out together virtually, with live progress indicators and join-in capability.</p>
                </div>
              </div>
            </div>
            
            {/* Business Model */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">Business Model</h4>
              
              <div className="space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">FITNESS SEEKERS</p>
                  <p className="text-white">$4.99/month or $39.99/year</p>
                </div>
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">CONTENT CREATORS</p>
                  <p className="text-white">$79.99/year to unlock monetization (Sweat Equity Program)</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">PLANNED REVENUE STREAMS</p>
                  <ul className="text-white list-disc ml-5 mt-2 space-y-1">
                    <li>Brand sponsorships</li>
                    <li>Affiliate marketplace</li>
                    <li>Creator monetization commissions</li>
                    <li>Corporate wellness B2B licensing</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Key Metrics */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">Key Metrics (as of May 2025)</h4>
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">USERS</p>
                  <p className="text-white">1,000+ customer reached(through beta + full launch) as of May 2025</p>
                  <p className="text-white">150+ paid members</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Internal analytics, AppStore Connect</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">CREATOR COMMUNITY</p>
                  <p className="text-white">50 creators onboarded(<a href="https://www.fitwithpulse.ai/100trainers" className="text-[#E0FE10] hover:text-white">persuing 100 tariners through pilot program</a>)</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: User registration data, verified May 2025</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">CONTENT STATS</p>
                  <p className="text-white">800+ unique workout share links generated</p>
                  <p className="text-white">1000+ moves created</p>
                  <p className="text-white">30,000+ workouts completed</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Platform database, May 2025</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">ROUND PARTICIPATION</p>
                  <p className="text-white">3 Rounds launched since Jan 2025</p>
                  <p className="text-white">200+ participants</p>
                  <p className="text-white">12,000+ workouts completed</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Challenge analytics, May 2025</p>
                </div>
              </div>
            </div>
            
            {/* IP & Legal Highlights */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">IP & Legal Highlights</h4>
              
              <div className="space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">TRADEMARKS FILED</p>
                  <p className="text-white">Pulse Programming™, Sweat Sync Live™, Pulse Rounds™, Pulse Stacks™</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">PROVISIONAL PATENTS PENDING</p>
                  <ul className="text-white list-disc ml-5 mt-2 space-y-1">
                    <li>AI-powered workout programming system</li>
                    <li>Real-time social workout synchronization</li>
                    <li>User-generated content monetization engine</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Press & Media */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-4">Press & Media</h4>
              
              <div className="space-y-4">
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">CONTACT</p>
                  <p className="text-white">press@fitwithpulse.ai</p>
                </div>
                <div className="border-b border-zinc-800 pb-3">
                  <p className="text-zinc-500 text-sm mb-1">DOWNLOADABLE KIT</p>
                  <p className="text-white">fitwithpulse.ai/press</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">NOTABLE MENTIONS</p>
                  <ul className="text-white list-disc ml-5 mt-2 space-y-1">
                    <li>SoulCycle ATL Collaboration</li>
                    <li>Black Ambition Prize Applicant</li>
                    <li>FitFest ATL Demo</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Social Presence */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300 md:col-span-2">
              <h4 className="text-white text-xl font-semibold mb-4">Social Presence & Vision</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-zinc-500 text-sm mb-2">SOCIAL MEDIA</p>
                  <ul className="text-white list-disc ml-5 space-y-1">
                    <li>Instagram: @fitwithpulse</li>
                    <li>TikTok: @fitwithpulse</li>
                    <li>YouTube: First Player Series by Tremaine Grant</li>
                  </ul>
                </div>                
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-zinc-800 flex justify-between items-center">
          <p className="text-zinc-400 text-sm">Last updated: May 2025</p>
          <button 
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PressKitPageProps {
  metaData?: PageMetaData | null;
  // You can add other props fetched in getServerSideProps here if needed
}

const PressKit: React.FC<PressKitPageProps> = ({ metaData }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [pressKitAssets, setPressKitAssets] = useState<PressKitAssets | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showFactSheetModal, setShowFactSheetModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [appScreenshots, setAppScreenshots] = useState<{
    moves: string | null;
    stacks: string | null;
    rounds: string | null;
  }>({
    moves: null,
    stacks: null,
    rounds: null
  });

  useEffect(() => {
    const fetchPressKitAssets = async () => {
      setIsLoadingAssets(true);
      setFetchError(null);
      try {
        const docRef = doc(db, "pressKitData", "liveAssets");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPressKitAssets(docSnap.data() as PressKitAssets);
          console.log("Press kit assets loaded:", docSnap.data());
        } else {
          console.log("No live press kit assets document found!");
          setFetchError("Press kit assets are not available at the moment.");
          setPressKitAssets({});
        }
      } catch (error) {
        console.error("Error fetching press kit assets:", error);
        setFetchError("Failed to load press kit assets. Please try again later.");
        setPressKitAssets({});
      } finally {
        setIsLoadingAssets(false);
      }
    };

    fetchPressKitAssets();
  }, []);

  useEffect(() => {
    const fetchAppScreenshots = async () => {
      try {
        const docRef = doc(db, "pressKitData", "liveAssets");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const liveAssets = docSnap.data();
          
          // Get the first image from each key category
          setAppScreenshots({
            moves: liveAssets.appScreenshot_moves_1 || null,
            stacks: liveAssets.appScreenshot_stacks_1 || null,
            rounds: liveAssets.appScreenshot_rounds_1 || null
          });
          
          console.log("App screenshots loaded for press kit");
        }
      } catch (error) {
        console.error("Error fetching app screenshots:", error);
      }
    };

    fetchAppScreenshots();
  }, []);

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
    <div className="min-h-screen bg-zinc-900">
      {/* Fact Sheet Modal */}
      <FactSheetModal isOpen={showFactSheetModal} onClose={() => setShowFactSheetModal(false)} />
      
      {/* Overview Modal */}
      <OverviewModal isOpen={showOverviewModal} onClose={() => setShowOverviewModal(false)} />

      <Head>
        <title>{metaData?.pageTitle || 'Press Kit - Pulse Fitness Collective'}</title>
        <meta name="description" content={metaData?.metaDescription || 'Pulse press resources, media materials, and downloadable assets for journalists and creators.'} />
        
        {/* OpenGraph Meta Tags for sharing */}
        <meta property="og:title" content={metaData?.ogTitle || 'Pulse Fitness Collective Press Kit'} />
        <meta property="og:description" content={metaData?.ogDescription || 'Official media resources, brand assets, and downloadable materials for Pulse Fitness Collective.'} />
        {metaData?.ogImage && <meta property="og:image" content={metaData.ogImage} />}
        {!metaData?.ogImage && <meta property="og:image" content="https://fitwithpulse.ai/PressKitPreview.png" /> } {/* Fallback if not in DB */}
        <meta property="og:url" content={metaData?.ogUrl || 'https://fitwithpulse.ai/press'} />
        <meta property="og:type" content={metaData?.ogType || 'website'} />
        
        {/* Twitter Card Tags */}
        <meta name="twitter:card" content={metaData?.twitterCard || 'summary_large_image'} />
        <meta name="twitter:title" content={metaData?.twitterTitle || 'Pulse Fitness Collective Press Kit'} />
        <meta name="twitter:description" content={metaData?.twitterDescription || 'Official media resources, brand assets, and downloadable materials for Pulse Fitness Collective.'} />
        {metaData?.twitterImage && <meta name="twitter:image" content={metaData.twitterImage} />}
        {!metaData?.twitterImage && <meta name="twitter:image" content="https://fitwithpulse.ai/PressKitPreview.png" /> } {/* Fallback if not in DB */}
      </Head>

      {/* Hero Section */}
      <section ref={useScrollFade()} className="relative min-h-[70vh] flex flex-col items-center justify-center text-center px-8 py-20 overflow-hidden animate-gradient-background">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-zinc-900"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-800 opacity-40"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#E0FE10]/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full filter blur-3xl animate-pulse-slow animation-delay-1000"></div>
        </div>
        
        {/* Animated grid pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[url('/grid-pattern.svg')] bg-repeat"></div>
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-4xl mx-auto">
          <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer animate-fade-in-up animation-delay-300">
            Media Resources
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
          </h2>
          <h1 className="text-white text-5xl sm:text-7xl font-bold mb-8 animate-fade-in-up animation-delay-600">
            Pulse Press Kit
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed mb-12 animate-fade-in-up animation-delay-900">
            Everything you need to tell the Pulse story - from founder bios to product screenshots
          </p>
        </div>
      </section>

      {/* Overview Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Overview
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">The 30-second pitch</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-4">Elevator Pitch</h4>
                                  <p className="text-zinc-400 text-lg mb-6">
                  Pulse is a fitness app where creators capture and share their Moves—we turn those into gamified, community-driven fitness experiences for their audiences. At its core, we help people move together.
                </p>
                
                <h4 className="text-white text-xl font-semibold mb-4 mt-8">Why Now? Narrative</h4>
                <p className="text-zinc-400 text-lg mb-4">
                  In the post-COVID era, people are yearning for authentic connection in fitness. We\'re seeing explosive growth in in-person run clubs, community workouts, and fitness communities seeking meaningful engagement beyond digital screens.
                </p>
                <p className="text-zinc-400 text-lg mb-4">
                  Meanwhile, short-form content has revolutionized how people consume information, creating perfect conditions for bite-sized fitness content. The fitness industry continues to grow exponentially, with digital fitness projected to reach $44.7 billion by 2026, creating space for a dominant digital platform that connects people through movement.
                </p>
                
                <a 
                  onClick={() => setShowOverviewModal(true)}
                  className="mt-8 inline-flex items-center text-[#E0FE10] hover:text-white cursor-pointer"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Full Overview PDF
                </a>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-6">Quick Stats</h4>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">FOUNDED</p>
                    <p className="text-white text-xl">2023</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">HEADQUARTERS</p>
                    <p className="text-white text-xl">Atlanta, GA</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">USERS</p>
                    <p className="text-white text-xl">1,000+</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">UNIQUE MOVES</p>
                    <p className="text-white text-xl">500+</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">WORKOUTS COMPLETED</p>
                    <p className="text-white text-xl">30,000+</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">FUNDING</p>
                    <p className="text-white text-xl">Seed Stage</p>
                  </div>
                </div>
                
                <div className="mt-8 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <h5 className="text-[#E0FE10] text-sm font-semibold mb-2">MEDIA NOTE</h5>
                  <p className="text-zinc-400 text-sm">For the most current stats and metrics, please contact our press team directly at press@pulse.ai</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Bio Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Founder Bio & Photos
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Tremaine Grant</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-4">Short Bio (150 words)</h4>
                <p className="text-zinc-400 text-lg mb-6">
                  Tremaine Grant is the founder and CEO of Pulse, the fitness collective redefining how people experience, share, and build community around fitness. With a background in software engineering and a lifelong passion for fitness, Tremaine identified a crucial gap in the market: the lack of platforms where everyday fitness enthusiasts could create and share content as easily as fitness professionals. Before founding Pulse, Tremaine worked as a senior developer at prominent tech companies, where he honed his skills in creating intuitive, user-centric digital experiences. A former collegiate athlete, Tremaine brings a unique perspective that bridges the technological and fitness worlds. He's building Pulse to be more than an app—it's a movement to democratize fitness content creation and build genuine community through shared physical activity.
                </p>
                
                <h4 className="text-white text-xl font-semibold mb-4 mt-8">Long Bio (600 words)</h4>
                <p className="text-zinc-400 text-lg mb-4">
                  Tremaine Grant is the visionary founder and CEO of Pulse, a groundbreaking fitness collective platform that's redefining the intersection of technology, community, and physical wellbeing. His journey to creating Pulse represents a perfect synthesis of his technical expertise, entrepreneurial spirit, and lifelong commitment to fitness.
                </p>
                <p className="text-zinc-400 text-lg mb-4">
                  Born and raised in Atlanta, Tremaine discovered his dual passions for technology and athletics early in life. As a scholarship track athlete in college, he experienced firsthand the transformative power of structured fitness and community support. Simultaneously, he pursued computer science, fascinated by technology's potential to connect people and solve real-world problems.
                </p>
                <p className="text-zinc-400 text-lg mb-4">
                  After graduating, Tremaine built a successful career as a software engineer at several leading tech companies, working on projects that reached millions of users. Throughout his corporate journey, he remained deeply connected to fitness communities, participating in and eventually leading workout groups in his spare time.
                </p>
                <p className="text-zinc-400 text-lg">
                  The idea for Pulse emerged from a simple observation: while social media had transformed nearly every aspect of daily life, fitness platforms remained surprisingly one-dimensional, primarily focusing on content consumption rather than creation and community engagement. Tremaine envisioned a platform where anyone—not just professional trainers—could easily create, share, and build community around fitness content.
                </p>
                
                <div className="mt-8 p-4 bg-black/30 border border-zinc-800 rounded-lg">
                  <h5 className="text-[#E0FE10] text-sm font-semibold mb-2">INTERESTING FACTS</h5>
                  <ul className="text-zinc-400 text-sm list-disc ml-4 space-y-2">
                    <li>Former collegiate track athlete (110m,400m hurdles specialist)</li>
                    <li>Self-taught programmer at age 12 (went on to major in computer science)</li>
                    <li>Passionate advocate for diversity in tech and fitness spaces</li>
                    <li>Has traveled to 31 countries</li>
                  </ul>
                </div>
                
                <a 
                  href={pressKitAssets?.founderBioPdf || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`mt-8 inline-flex items-center text-[#E0FE10] hover:text-white ${
                    !pressKitAssets?.founderBioPdf ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={(e) => !pressKitAssets?.founderBioPdf && e.preventDefault()}
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download full bio and photos
                </a>
              </div>
            </div>
            
            <div className="lg:w-1/2 order-1 lg:order-2">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 aspect-[4/3] bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src={pressKitAssets?.founderLandscape || "/founder-landscape.jpg"} 
                    alt="Tremaine Grant - Landscape" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4">
                      <p className="text-white font-medium">Tremaine Grant</p>
                      <p className="text-zinc-300 text-sm">Landscape - High Res</p>
                    </div>
                  </div>
                </div>
                <div className="aspect-[3/4] bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src={pressKitAssets?.founderPortrait1 || "/founder-portrait-1.jpg"} 
                    alt="Tremaine Grant - Portrait 1" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4">
                      <p className="text-white font-medium">Portrait 1</p>
                      <p className="text-zinc-300 text-sm">Studio Setting</p>
                    </div>
                  </div>
                </div>
                <div className="aspect-[3/4] bg-zinc-800 rounded-xl overflow-hidden relative group">
                  <img 
                    src={pressKitAssets?.founderPortrait2 || "/founder-portrait-2.jpg"} 
                    alt="Tremaine Grant - Portrait 2" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4">
                      <p className="text-white font-medium">Portrait 2</p>
                      <p className="text-zinc-300 text-sm">Casual Setting</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product One-Pager Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Product One-Pager
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">How Pulse Works</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 mb-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-4">Problem → Solution</h4>
                <div className="mb-6">
                  <p className="text-[#E0FE10] mb-2 font-medium">THE PROBLEM:</p>
                  <p className="text-zinc-400 text-lg">
                    Fitness has become increasingly isolated and consumption-driven. Existing platforms treat users as passive consumers rather than active creators. People struggle to maintain motivation without community support.
                  </p>
                </div>
                
                <div className="mb-6">
                  <p className="text-[#E0FE10] mb-2 font-medium">THE SOLUTION:</p>
                  <p className="text-zinc-400 text-lg">
                    Pulse transforms fitness into a social experience by enabling anyone to create, share, and participate in community-driven workouts. Our three-tiered system (Moves → Stacks → Rounds) provides the building blocks for a truly collaborative fitness ecosystem.
                  </p>
                </div>
                
                <div className="mb-6">
                  <h5 className="text-white text-lg font-medium mb-3">User Testimonials</h5>
                  <div className="space-y-4">
                    <div className="p-4 bg-black/30 rounded-lg">
                      <p className="text-zinc-300 italic">"Pulse reminds me of the best classrooms — They're places where every student can feel success."</p>
                      <p className="text-[#E0FE10] mt-2 text-sm">Deray Mckesson, NYC</p>
                    </div>
                    <div className="p-4 bg-black/30 rounded-lg">
                      <p className="text-zinc-300 italic">"The Mobility Challenge is Amazing! I do it after my workouts and it feels soooo good!"</p>
                      <p className="text-[#E0FE10] mt-2 text-sm">Marques Zak, NYC</p>
                    </div>
                  </div>
                </div>
                
                <a 
                  href={pressKitAssets?.productOnePagerPdf || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`mt-8 inline-flex items-center text-[#E0FE10] hover:text-white ${
                    !pressKitAssets?.productOnePagerPdf ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  onClick={(e) => !pressKitAssets?.productOnePagerPdf && e.preventDefault()}
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Full Product Overview
                </a>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <h4 className="text-white text-xl font-semibold mb-6">The Pulse Ecosystem</h4>
                
                <div className="space-y-6">
                  <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-black">1</span>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold text-lg mb-1">Moves</h5>
                      <p className="text-zinc-400">5-30 second video clips of exercises that form the building blocks of your fitness journey. Create or follow moves from the community.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/70 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-black">2</span>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold text-lg mb-1">Stacks</h5>
                      <p className="text-zinc-400">Combine multiple Moves to create complete workout routines. Personalize with sets, reps, and timing to match your fitness level.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-black/30 rounded-lg">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/40 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-black">3</span>
                    </div>
                    <div>
                      <h5 className="text-white font-semibold text-lg mb-1">Rounds</h5>
                      <p className="text-zinc-400">Community fitness challenges where members complete Stacks together, compete for points, and support each other's progress.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 grid grid-cols-3 gap-6">
                  <div className="aspect-[9/19.5] bg-zinc-800 rounded-lg overflow-hidden">
                    <img 
                      src={appScreenshots.moves || "/app-screens/moves-screen.jpg"} 
                      alt="Moves Screen" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="aspect-[9/19.5] bg-zinc-800 rounded-lg overflow-hidden">
                    <img 
                      src={appScreenshots.stacks || "/app-screens/stacks-screen.jpg"} 
                      alt="Stacks Screen" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="aspect-[9/19.5] bg-zinc-800 rounded-lg overflow-hidden">
                    <img 
                      src={appScreenshots.rounds || "/app-screens/rounds-screen.jpg"} 
                      alt="Rounds Screen" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Media Assets Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-12">
            <div>
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Media Assets
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-2">Visual Resources</h3>
              <p className="text-zinc-400 max-w-2xl">
                Download official Pulse brand assets, app screenshots, and media materials. All assets are available in high resolution formats suitable for both print and digital media.
              </p>
            </div>
            <div className="mt-4 lg:mt-0 w-full lg:w-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search media assets"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full lg:w-80 px-4 py-3 pr-10 bg-zinc-900/80 border border-zinc-800 focus:border-[#E0FE10] rounded-full text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#E0FE10]"
                />
                <Search className="w-5 h-5 text-zinc-500 absolute right-3 top-1/2 transform -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="group">
              <div className="aspect-video bg-white rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src={pressKitAssets?.logoSigPng || pressKitAssets?.logoSigPng || "/media-assets/logos-thumbnail.jpg"} 
                  alt="Pulse Logos Preview" 
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 p-4"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Logos</p>
                    <p className="text-zinc-300 text-sm">SVG, PNG, Dark/Light</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Logos</h3>
              <p className="text-zinc-400 mb-4">Official Pulse brand logos in various formats and color schemes</p>
              <Link href="/press/logos">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src={appScreenshots.moves || "/media-assets/app-screens-thumbnail.jpg"} 
                  alt="App Screenshots - Moves" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">App Screenshots</p>
                    <p className="text-zinc-300 text-sm">High-resolution, all features</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">App Screenshots</h3>
              <p className="text-zinc-400 mb-4">High-resolution images of all key app screens and features</p>
              <Link href="/press/app-screenshots">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            
            {/* <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src={appScreenshots.rounds || "/media-assets/b-roll-thumbnail.jpg"} 
                  alt="Rounds Feature" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Rounds Feature</p>
                    <p className="text-zinc-300 text-sm">Community workout challenges</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Rounds Feature</h3>
              <p className="text-zinc-400 mb-4">See how Pulse Rounds engage users in group workout challenges</p>
              <Link href="/press/app-screenshots">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
             */}
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/brandGuidelines.png" 
                  alt="Brand Guidelines" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Brand Guidelines</p>
                    <p className="text-zinc-300 text-sm">Colors, typography, usage</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Brand Guidelines</h3>
              <p className="text-zinc-400 mb-4">Comprehensive guide to Pulse's visual identity and brand usage</p>
              <Link href="/press/brand-guidelines">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link>
            </div>
            
            <div className="group">
              <div className="aspect-video bg-zinc-800 rounded-xl overflow-hidden mb-4 relative">
                <img 
                  src="/PulseProgrammingPreview.png" 
                  alt="Press Releases" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-6">
                    <p className="text-white font-medium text-lg">Press Releases</p>
                    <p className="text-zinc-300 text-sm">Latest news and announcements</p>
                  </div>
                </div>
              </div>
              <h3 className="text-white text-xl font-medium mb-2">Press Releases</h3>
              <p className="text-zinc-400 mb-4">Official announcements and news from the Pulse team</p>
              <p className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">Coming soon</p>
              {/* <Link href="/press/press-releases">
                <span className="flex items-center text-[#E0FE10] hover:text-white group cursor-pointer">
                  View all
                  <ArrowUpRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
                </span>
              </Link> */}
            </div>
          </div>
        </div>
      </section>

      {/* Fact-Check Sheet Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="mb-12">
            <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
              Fact-Check Sheet
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
            </h2>
            <h3 className="text-white text-4xl font-bold mb-4">Get Your Facts Straight</h3>
            <p className="text-zinc-400 max-w-2xl">
              All the official names, numbers, and terminology used at Pulse, compiled for easy reference to ensure accuracy in your reporting.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Company Information</h4>
              
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">COMPANY NAME</p>
                  <p className="text-white">Pulse Fitness Collective LLC (legal), "Pulse" or "Pulse Fitness Collective" (informal)</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">FOUNDING</p>
                  <p className="text-white">Founded in June 2023 by Tremaine Grant in Atlanta, Georgia</p>
                </div>
                <div>
                  <div className="mb-4">
                    <p className="text-zinc-500 text-sm mb-1">VISION STATEMENT</p>
                    <p className="text-white text-sm">To become the dominant digital fitness platform globally. We see this position as open and ready for the taking, with no singular platform currently serving as the go-to destination. We will achieve dominance through comprehensive content categories, innovative health-based products, and by leading the frontier of fitness technology.</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-sm mb-1">MISSION STATEMENT</p>
                    <p className="text-white text-sm">To create meaningful fitness connections in an era that prioritizes media consumption over social interaction, while simultaneously opening new economic opportunities in the fitness space. We aim to democratize fitness expertise the way Spotify revolutionized the music industry, creating new passive income streams for fitness professionals and enthusiasts alike.</p>
                  </div>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">PRODUCT TERMINOLOGY</p>
                  <p className="text-white">Moves (individual exercise videos)</p>
                  <p className="text-white">Stacks (workout routines)</p>
                  <p className="text-white">Rounds (community challenges)</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">PLATFORM AVAILABILITY</p>
                  <p className="text-white">iOS App Store, Web app (fitwithpulse.ai)</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">HEADQUARTERS</p>
                  <p className="text-white">Atlanta, Georgia, USA</p>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
              <h4 className="text-white text-xl font-semibold mb-6">Key Metrics</h4>
              
              <div className="space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">USERS</p>
                  <p className="text-white">1,000+ customer reached(through beta + full launch) as of May 2025</p>
                  <p className="text-white">150+ paid members</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Internal analytics, AppStore Connect</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">CREATOR COMMUNITY</p>
                  <p className="text-white">50 creators onboarded(<a href="https://www.fitwithpulse.ai/100trainers" className="text-[#E0FE10] hover:text-white">persuing 100 tariners through pilot program</a>)</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: User registration data, verified May 2025</p>
                </div>
                <div className="border-b border-zinc-800 pb-4">
                  <p className="text-zinc-500 text-sm mb-1">CONTENT STATS</p>
                  <p className="text-white">800+ unique workout share links generated</p>
                  <p className="text-white">1000+ moves created</p>
                  <p className="text-white">30,000+ workouts completed</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Platform database, May 2025</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-sm mb-1">ROUND PARTICIPATION</p>
                  <p className="text-white">3 Rounds launched since Jan 2025</p>
                  <p className="text-white">200+ participants</p>
                  <p className="text-white">12,000+ workouts completed</p>
                  <p className="text-zinc-500 text-xs mt-1">Source: Challenge analytics, May 2025</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <button 
              onClick={() => setShowFactSheetModal(true)}
              className="inline-flex items-center text-[#E0FE10] hover:text-white"
            >
              <Download className="mr-2 h-5 w-5" />
              View and download complete fact-check sheet
            </button>
          </div>
        </div>
      </section>

      {/* Talking Points & FAQs Section */}
      <section ref={useScrollFade()} className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Talking Points
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Key Message Pillars</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">1</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">The Creator Economy for Fitness</h4>
                      <p className="text-zinc-400">Pulse is pioneering a creator economy specifically for fitness, where anyone with passion can create, share, and potentially monetize their fitness content.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">2</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">Community-Driven Innovation</h4>
                      <p className="text-zinc-400">Unlike traditional top-down fitness platforms, Pulse evolves based on how our community uses it. Our users directly shape the future of the platform.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">3</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">Democratizing Fitness Content</h4>
                      <p className="text-zinc-400">We're breaking down barriers between "experts" and "consumers" by giving everyone the tools to create high-quality fitness content.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">4</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">From Content to Community</h4>
                      <p className="text-zinc-400">Pulse transforms passive content consumption into active community participation through our Rounds feature, where users workout together virtually.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">5</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">The Social Fitness Revolution</h4>
                      <p className="text-zinc-400">Fitness has historically been an individual journey. Pulse is making it inherently social, without sacrificing personalization.</p>
                    </div>
                  </li>
                  
                  <li className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#E0FE10] flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-black">6</span>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-2">Inclusive Leadership in Tech</h4>
                      <p className="text-zinc-400">As a Black-founded tech startup in the fitness space, Pulse represents the importance of diverse leadership in shaping inclusive platforms.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                FAQs
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Frequently Asked Questions</h3>
              
              <div className="space-y-6">
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">How does Pulse differ from other fitness apps?</h4>
                  <p className="text-zinc-400">Most fitness apps treat users as passive consumers of expert-created content. Pulse flips this model by enabling every user to be a creator, sharing their own exercises and workouts while building community through challenges.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">Do users need to be fitness experts to create content?</h4>
                  <p className="text-zinc-400">Not at all. Pulse is designed for everyone from beginners to professionals. Our intuitive tools make it easy for anyone to create high-quality fitness content, whether you're sharing your first push-up or your specialized training regimen.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">What is the Morning Mobility Challenge?</h4>
                  <p className="text-zinc-400">The Morning Mobility Challenge is our flagship community event where participants commit to daily morning mobility exercises for 30 days. It combines user-generated content with community accountability, representing the essence of what makes Pulse unique.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">How does Pulse plan to monetize?</h4>
                  <p className="text-zinc-400">Our primary focus is building a vibrant community and platform. Our future monetization will include premium features for creators, community challenge sponsorships, and tools that help fitness professionals expand their reach while maintaining our commitment to an accessible core platform.</p>
                </div>
                
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 hover:border-[#E0FE10]/20 transition-colors duration-300">
                  <h4 className="text-white text-lg font-medium mb-2">Is Pulse available internationally?</h4>
                  <p className="text-zinc-400">Yes, Pulse is available worldwide on iOS and through our web app. While our primary market is currently the United States, we're seeing organic growth in international markets, particularly in Canada, the UK, and Australia.</p>
                </div>
              </div>
              
              <a 
                href={pressKitAssets?.talkingPointsFaqsPdf || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`mt-8 inline-flex items-center text-[#E0FE10] hover:text-white ${
                  !pressKitAssets?.talkingPointsFaqsPdf ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={(e) => !pressKitAssets?.talkingPointsFaqsPdf && e.preventDefault()}
              >
                <Download className="mr-2 h-5 w-5" />
                Download complete talking points and FAQs
              </a>
            </div>
          </div>
        </div>
      </section>
      
      {/* Contact Card Section */}
      <section ref={useScrollFade()} className="py-20 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-[#E0FE10] uppercase tracking-wide font-semibold mb-4 relative inline-block hover:text-white transition-colors duration-300 group cursor-pointer">
                Media Contact
                <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#E0FE10] transition-all duration-300 transform scale-x-0 group-hover:scale-x-100 origin-left"></span>
              </h2>
              <h3 className="text-white text-4xl font-bold mb-8">Get In Touch</h3>
              
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-8 hover:border-[#E0FE10]/20 transition-colors duration-300">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-1">Email</h4>
                      <p className="text-zinc-400">press@pulse.ai</p>
                      <p className="text-zinc-500 text-sm mt-1">For all media inquiries (most responsive)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-1">Phone</h4>
                      <p className="text-zinc-400">(404) 555-0123</p>
                      <p className="text-zinc-500 text-sm mt-1">For urgent requests during business hours (EST)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white text-lg font-medium mb-1">Book an Interview</h4>
                      <p className="text-zinc-400">calendly.com/pulse-media/press</p>
                      <p className="text-zinc-500 text-sm mt-1">Schedule time with our founders or executives</p>
                    </div>
                  </div>
                  
                  <div className="pt-6 mt-6 border-t border-zinc-800">
                    <h4 className="text-white text-lg font-medium mb-4">Social Media</h4>
                    <div className="flex gap-4">
                      <a href="https://twitter.com/pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                        </svg>
                      </a>
                      <a href="https://instagram.com/pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                        </svg>
                      </a>
                      <a href="https://linkedin.com/company/pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                          <rect x="2" y="9" width="4" height="12"></rect>
                          <circle cx="4" cy="4" r="2"></circle>
                        </svg>
                      </a>
                      <a href="https://tiktok.com/@pulseapp" className="w-10 h-10 rounded-full bg-[#E0FE10]/20 flex items-center justify-center hover:bg-[#E0FE10]/40 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>
                          <path d="M20 9V4a1 1 0 0 0-1-1h-5"></path>
                          <path d="M15 12v3a4 4 0 0 1-4 4H9"></path>
                          <line x1="20" y1="9" x2="9" y2="9"></line>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:w-1/2 flex justify-center">
              <div className="max-w-md relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#E0FE10] to-teal-500 rounded-xl blur opacity-30"></div>
                <div className="relative bg-zinc-900 rounded-xl overflow-hidden p-8">
                  <h4 className="text-white text-2xl font-semibold mb-6">Download Press Kit</h4>
                  <p className="text-zinc-400 mb-8">Get everything in one place for offline access. Our complete press kit includes all PDFs, high-resolution images, and video assets.</p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">All company & product info PDFs</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">High-resolution logos & images</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">App walkthrough video</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#E0FE10]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <span className="text-zinc-300">Usage guidelines</span>
                    </div>
                  </div>
                  
                  <a 
                    href={pressKitAssets?.completeKitZip || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`block w-full bg-[#E0FE10] hover:bg-[#c8e40d] text-black font-medium py-3 px-6 rounded-lg text-center transition-colors ${
                      !pressKitAssets?.completeKitZip ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={(e) => !pressKitAssets?.completeKitZip && e.preventDefault()}
                  >
                    Download Complete Kit ({(isLoadingAssets || !pressKitAssets) ? 'Calculating...' : '42MB'})
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<PressKitPageProps> = async (context) => {
  try {
    const metaData = await adminMethods.getPageMetaData('press');
    
    // Ensure that Timestamp objects are converted to a serializable format if they exist
    // For PageMetaData, lastUpdated is a Timestamp.
    // Firebase Timestamps are not directly serializable by Next.js's JSON serializer.
    // We can convert it to a string or number, or just not pass it if not needed by the client.
    // If you need it on the client, convert: e.g., lastUpdated: metaData.lastUpdated.toMillis()
    // For this use case, the client component `PressKit` doesn't directly use `lastUpdated` in the Head, so we can omit it or pass it as is.
    // Next.js will handle basic object serialization for props.

    // If metaData is null, we still pass null to the component, which will use its fallbacks.
    return {
      props: {
        metaData: metaData ? JSON.parse(JSON.stringify(metaData)) : null,
      },
    };
  } catch (error) {
    console.error("Error fetching metaData for press page in getServerSideProps:", error);
    return {
      props: {
        metaData: null, // Fallback to default meta tags in component
      },
    };
  }
};

export default PressKit;