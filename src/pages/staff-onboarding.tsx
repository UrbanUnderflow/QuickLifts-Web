import React, { useState, useEffect } from 'react';
import type { NextPage } from 'next';
import { FaCheckCircle, FaPlay, FaArrowRight, FaArrowLeft, FaUsers, FaLightbulb, FaRocket, FaTools, FaFileContract, FaClock, FaTasks, FaDownload, FaSignature } from 'react-icons/fa';
import PageHead from '../components/PageHead';
import Footer from '../components/Footer/Footer';
import { useUser } from '../hooks/useUser';
import { userService } from '../api/firebase/user';
import { StaffOnboardingProgress } from '../api/firebase/user/types';

// Types
interface PhaseSection {
  id: string;
  title: string;
  content: string;
  completed?: boolean;
}

interface OnboardingPhase {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  day: string;
  sections: PhaseSection[];
  deliverable: string;
  deliverableCompleted?: boolean;
}

const StaffOnboardingPage: NextPage = () => {
  const currentUser = useUser();
  const [progress, setProgress] = useState<StaffOnboardingProgress>({
    currentPhase: 1,
    completedPhases: [],
    sectionProgress: {},
    deliverableProgress: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load progress from database on mount
  useEffect(() => {
    if (currentUser?.id) {
      const savedProgress = currentUser.staffOnboardingProgress;
      if (savedProgress) {
        setProgress(savedProgress);
      }
      setIsLoading(false);
    } else if (currentUser === null) {
      // User is not authenticated, this should be handled by AuthWrapper
      setError('Authentication required');
      setIsLoading(false);
    }
  }, [currentUser]);

  // Save progress to database
  const saveProgress = async (newProgress: StaffOnboardingProgress) => {
    if (!currentUser?.id) return;
    
    setIsSaving(true);
    try {
      await userService.updateStaffOnboardingProgress(currentUser.id, newProgress);
      setProgress(newProgress);
      setError(null);
    } catch (err) {
      console.error('Error saving onboarding progress:', err);
      setError('Failed to save progress. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const phases: OnboardingPhase[] = [
    {
      id: 1,
      title: "Welcome & Foundation",
      subtitle: "Set the stage and get excited about Pulse",
      description: "Learn about our mission, vision, and culture",
      icon: <FaRocket className="w-8 h-8" />,
      day: "Day 1",
      sections: [
        {
          id: "welcome-message",
          title: "Welcome Message",
          content: "A personal introduction from the founder, setting expectations and expressing excitement about having you join the team."
        },
        {
          id: "pulse-story",
          title: "Pulse Story",
          content: "Our mission is to revolutionize fitness through community and technology. We believe that fitness is more powerful when shared, and we're building the platform to make that happen at scale."
        },
        {
          id: "current-state",
          title: "Current State", 
          content: "Today, Pulse serves thousands of active users with our mobile app and web platform. We've achieved strong user engagement and are growing rapidly in the fitness tech space."
        },
        {
          id: "vision",
          title: "The Vision",
          content: "Our 12-month goals include expanding to 100K+ users, launching new features like AI-powered programming, and establishing partnerships with major fitness brands."
        },
        {
          id: "team-culture",
          title: "Team Culture",
          content: "We operate with transparency, move fast but think long-term, prioritize user feedback, and maintain a high bar for quality. Every team member owns their domain and contributes to strategy."
        }
      ],
      deliverable: "Complete 'I understand Pulse's mission' acknowledgment"
    },
    {
      id: 2,
      title: "Product Deep Dive",
      subtitle: "Become a power user of what we're building",
      description: "Master our platform and understand our users",
      icon: <FaLightbulb className="w-8 h-8" />,
      day: "Day 2",
      sections: [
        {
          id: "product-walkthrough",
          title: "Product Walkthrough",
          content: "Hands-on tour of the Pulse mobile app and web platform, covering key features like workout creation, community rounds, exercise discovery, and social features."
        },
        {
          id: "user-journey",
          title: "User Journey Mapping",
          content: "Our users are fitness enthusiasts aged 18-45 who value community and structured workouts. They discover us through social media, join for the community aspect, and stay for the programming quality."
        },
        {
          id: "business-model",
          title: "Business Model",
          content: "Revenue through premium subscriptions ($9.99/month), creator partnerships, and brand collaborations. Key metrics: Monthly Active Users, subscription conversion rate, and creator engagement."
        },
        {
          id: "competitive-landscape",
          title: "Competitive Landscape",
          content: "We compete with apps like Strava (social), Nike Training Club (content), and Peloton (community). Our differentiator is the combination of user-generated content with structured programming."
        },
        {
          id: "product-roadmap",
          title: "Product Roadmap",
          content: "Q1: AI programming assistant, Q2: Enhanced creator tools, Q3: Corporate wellness partnerships, Q4: International expansion and advanced analytics."
        }
      ],
      deliverable: "Complete product knowledge quiz and write: 'How I'd explain Pulse to a friend'"
    },
    {
      id: 3,
      title: "Role Definition & Expectations",
      subtitle: "Get crystal clear on your specific contribution",
      description: "Define your role and success metrics",
      icon: <FaUsers className="w-8 h-8" />,
      day: "Day 3",
      sections: [
        {
          id: "role-charter",
          title: "Role Charter",
          content: "As Chief of Staff, you'll drive operational excellence, coordinate cross-functional initiatives, manage special projects, and serve as an extension of leadership in strategy execution."
        },
        {
          id: "ownership-areas",
          title: "Ownership Areas",
          content: "You own: operational processes, board meeting preparation, team coordination. You collaborate on: strategy development, hiring, product decisions. You observe: day-to-day development, customer support."
        },
        {
          id: "working-relationship",
          title: "Working Relationship",
          content: "Direct partnership with the founder, weekly 1:1s, daily async updates via Slack. You'll interface with all team members and external stakeholders as needed."
        },
        {
          id: "performance-expectations",
          title: "Performance Expectations",
          content: "Success measured by: project completion rates, process improvement impact, stakeholder satisfaction, and strategic initiative progress. Formal reviews quarterly."
        },
        {
          id: "growth-path",
          title: "Growth Path",
          content: "This role can evolve toward Head of Operations, Chief Operating Officer, or specialized leadership roles in areas like Business Development or Strategic Partnerships."
        }
      ],
      deliverable: "Submit role acceptance form and complete initial goal-setting exercise"
    },
    {
      id: 4,
      title: "Tools & System Access",
      subtitle: "Get operational and productive",
      description: "Set up all necessary tools and systems",
      icon: <FaTools className="w-8 h-8" />,
      day: "Day 4",
      sections: [
        {
          id: "tool-setup",
          title: "Tool Setup Checklist",
          content: "Set up accounts for: Notion (documentation), Slack (communication), Google Workspace (email/drive), 1Password (security), GitHub (development access), Analytics platforms."
        },
        {
          id: "file-organization",
          title: "File Organization",
          content: "Google Drive structure: /Operations, /Board Materials, /Team Resources, /Projects. Notion workspace organization and naming conventions for consistent documentation."
        },
        {
          id: "communication-protocols",
          title: "Communication Protocols",
          content: "Slack for daily updates, email for external communication, scheduled calls for complex discussions, text for urgent matters only. Response time expectations: 4 hours during business hours."
        },
        {
          id: "security-compliance",
          title: "Security & Compliance",
          content: "2FA required on all accounts, use 1Password for password management, VPN for sensitive access, confidentiality protocols for user data and business information."
        },
        {
          id: "workspace-setup",
          title: "Workspace Setup",
          content: "Home office setup reimbursement up to $1,000, laptop and monitor provided, ergonomic equipment available. Co-working space membership if preferred."
        }
      ],
      deliverable: "Complete and verify all tool setup checklists"
    },
    {
      id: 5,
      title: "Legal & Agreements",
      subtitle: "Formalize the working relationship",
      description: "Review and sign all required documents",
      icon: <FaFileContract className="w-8 h-8" />,
      day: "Day 5",
      sections: [
        {
          id: "employment-agreement",
          title: "Employment Agreement",
          content: "Review terms of employment including compensation structure, equity participation (if applicable), benefits, vacation policy, and termination clauses."
        },
        {
          id: "confidentiality-agreement",
          title: "Confidentiality Agreement",
          content: "NDA covering protection of company information, user data, business strategies, financial information, and proprietary technology. Remains in effect indefinitely."
        },
        {
          id: "ip-assignment",
          title: "IP Assignment",
          content: "All work product, innovations, and intellectual property created during employment belongs to Pulse. Includes inventions, improvements, and creative works."
        },
        {
          id: "code-of-conduct",
          title: "Code of Conduct",
          content: "Professional standards covering workplace behavior, diversity and inclusion expectations, conflict resolution procedures, and ethical business practices."
        },
        {
          id: "emergency-contacts",
          title: "Emergency Contacts",
          content: "HR contact for policy questions, IT support for technical issues, legal counsel for contract questions, direct leadership contacts for urgent business matters."
        }
      ],
      deliverable: "Digitally sign all required legal documents"
    },
    {
      id: 6,
      title: "Operational Rhythm",
      subtitle: "Establish sustainable working patterns",
      description: "Set up meetings and communication cadence",
      icon: <FaClock className="w-8 h-8" />,
      day: "Week 2",
      sections: [
        {
          id: "meeting-cadence",
          title: "Meeting Cadence",
          content: "Weekly leadership 1:1s (Mondays), monthly all-hands (first Friday), quarterly board meetings, project standups as needed. Calendar blocking for deep work time."
        },
        {
          id: "communication-norms",
          title: "Communication Norms",
          content: "Available 9 AM - 6 PM ET, respond to Slack within 4 hours, email within 24 hours. After-hours only for true emergencies. Use status indicators effectively."
        },
        {
          id: "reporting-structure",
          title: "Reporting Structure",
          content: "Weekly progress reports via Notion, monthly KPI dashboards, quarterly OKR reviews. Escalation path: immediate supervisor → founder → board for major issues."
        },
        {
          id: "project-management",
          title: "Project Management",
          content: "Use Notion for project tracking, weekly priority setting, milestone tracking. Agile methodology for development projects, waterfall for operational projects."
        },
        {
          id: "time-tracking",
          title: "Time Tracking",
          content: "No formal time tracking required for full-time roles. Project-based time allocation tracking for reporting and planning purposes. Focus on outcomes over hours."
        }
      ],
      deliverable: "Complete first week reflection and set 30-60-90 day goals"
    },
    {
      id: 7,
      title: "First Project Assignment",
      subtitle: "Own something meaningful immediately",
      description: "Launch your first strategic initiative",
      icon: <FaTasks className="w-8 h-8" />,
      day: "Week 2",
      sections: [
        {
          id: "project-brief",
          title: "Project Brief",
          content: "Lead the Q1 OKR planning process: coordinate team input, facilitate planning sessions, document objectives and key results, create tracking mechanisms."
        },
        {
          id: "success-criteria",
          title: "Success Criteria",
          content: "Complete OKR planning by end of month, achieve 100% team participation, establish quarterly review rhythm, create dashboard for progress tracking."
        },
        {
          id: "resources-support",
          title: "Resources & Support",
          content: "Access to all team members, OKR framework templates, previous quarter data, external OKR consultant if needed, founder availability for strategic input."
        },
        {
          id: "check-in-schedule",
          title: "Check-in Schedule",
          content: "Daily async updates first week, then weekly check-ins. Mid-project review at 50% completion. Final presentation to leadership team upon completion."
        },
        {
          id: "completion-celebration",
          title: "Completion Celebration",
          content: "Team announcement of successful completion, inclusion in company newsletter, formal recognition at all-hands meeting, and celebration dinner with leadership team."
        }
      ],
      deliverable: "Schedule project kickoff meeting and define first milestone"
    }
  ];

  const toggleSectionCompletion = async (sectionId: string) => {
    const newProgress = {
      ...progress,
      sectionProgress: {
        ...progress.sectionProgress,
        [sectionId]: !progress.sectionProgress[sectionId]
      }
    };
    await saveProgress(newProgress);
  };

  const toggleDeliverableCompletion = async (phaseId: number) => {
    const newDeliverableProgress = {
      ...progress.deliverableProgress,
      [phaseId]: !progress.deliverableProgress[phaseId]
    };
    
    let completedPhases = [...progress.completedPhases];
    if (newDeliverableProgress[phaseId]) {
      if (!completedPhases.includes(phaseId)) {
        completedPhases.push(phaseId);
      }
      
      // Handle terms acceptance for legal phase (Phase 5)
      if (phaseId === 5 && currentUser?.id) {
        try {
          await userService.acceptStaffOnboardingTerms(currentUser.id);
        } catch (err) {
          console.error('Error accepting terms:', err);
        }
      }
      
      // Check if all phases are complete
      if (completedPhases.length === phases.length && currentUser?.id) {
        try {
          await userService.completeStaffOnboarding(currentUser.id);
        } catch (err) {
          console.error('Error marking onboarding complete:', err);
        }
      }
    } else {
      completedPhases = completedPhases.filter(id => id !== phaseId);
    }

    const newProgress = {
      ...progress,
      deliverableProgress: newDeliverableProgress,
      completedPhases
    };
    
    await saveProgress(newProgress);
  };

  const navigateToPhase = async (phaseId: number) => {
    const newProgress = {
      ...progress,
      currentPhase: phaseId
    };
    await saveProgress(newProgress);
  };

  const currentPhaseData = phases.find(p => p.id === progress.currentPhase);
  const overallProgress = (progress.completedPhases.length / phases.length) * 100;

  const getSectionProgress = (phaseId: number) => {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return 0;
    
    const completedSections = phase.sections.filter(section => 
      progress.sectionProgress[section.id]
    ).length;
    
    return (completedSections / phase.sections.length) * 100;
  };

  // Show loading while checking authentication or loading progress
  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-zinc-300">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  // Show error if authentication failed
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-[#E0FE10] text-black px-4 py-2 rounded-lg font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Require authentication
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-300 mb-4">Please sign in to access staff onboarding.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <PageHead
        metaData={{
          pageId: "staff-onboarding",
          pageTitle: "Staff Onboarding — Pulse Team",
          metaDescription: "Comprehensive onboarding program for new Pulse team members",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/staff-onboarding"
      />

      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#E0FE10]">Pulse Staff Onboarding</h1>
              <p className="text-zinc-400 text-sm">Your comprehensive introduction to the team</p>
            </div>
                              <div className="text-right">
                <div className="text-sm text-zinc-400">Overall Progress</div>
                <div className="text-2xl font-bold text-[#E0FE10]">{Math.round(overallProgress)}%</div>
                {currentUser?.staffOnboardingProgress?.completedAt && (
                  <div className="text-xs text-green-400 flex items-center gap-1 mt-1">
                    <FaCheckCircle />
                    Completed {new Date(currentUser.staffOnboardingProgress.completedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
          </div>
          
          {/* Overall Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div 
                className="h-2 bg-gradient-to-r from-[#E0FE10] to-lime-400 rounded-full transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-32">
              <h2 className="text-lg font-semibold mb-4 text-[#E0FE10]">Phases</h2>
              <nav className="space-y-2">
                {phases.map((phase) => {
                  const isCompleted = progress.completedPhases.includes(phase.id);
                  const isCurrent = progress.currentPhase === phase.id;
                  const phaseProgress = getSectionProgress(phase.id);
                  
                  return (
                    <button
                      key={phase.id}
                      onClick={() => navigateToPhase(phase.id)}
                      disabled={isSaving}
                      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 disabled:opacity-50 ${
                        isCurrent
                          ? 'border-[#E0FE10] bg-[#E0FE10]/10 text-white'
                          : isCompleted
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`${isCompleted ? 'text-green-400' : isCurrent ? 'text-[#E0FE10]' : 'text-zinc-500'}`}>
                          {isCompleted ? <FaCheckCircle /> : phase.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold opacity-75">{phase.day}</div>
                          <div className="text-sm font-semibold truncate">{phase.title}</div>
                          {phaseProgress > 0 && (
                            <div className="mt-1">
                              <div className="w-full bg-zinc-700 rounded-full h-1">
                                <div 
                                  className={`h-1 rounded-full transition-all duration-300 ${
                                    isCompleted ? 'bg-green-400' : 'bg-[#E0FE10]'
                                  }`}
                                  style={{ width: `${phaseProgress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {currentPhaseData && (
              <div className="space-y-8">
                
                {/* Phase Header */}
                <div className="text-center py-8 border-b border-zinc-800">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-[#E0FE10]/20 rounded-full flex items-center justify-center text-[#E0FE10]">
                      {currentPhaseData.icon}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-[#E0FE10] mb-2">{currentPhaseData.day}</div>
                  <h1 className="text-3xl font-bold mb-4">{currentPhaseData.title}</h1>
                  <p className="text-xl text-zinc-400 mb-2">{currentPhaseData.subtitle}</p>
                  <p className="text-zinc-500">{currentPhaseData.description}</p>
                </div>

                {/* Sections */}
                <div className="space-y-6">
                  {currentPhaseData.sections.map((section, index) => {
                    const isCompleted = progress.sectionProgress[section.id];
                    
                    return (
                      <div
                        key={section.id}
                        className={`border rounded-lg p-6 transition-all duration-200 ${
                          isCompleted 
                            ? 'border-green-500 bg-green-500/5' 
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <button
                            onClick={() => toggleSectionCompletion(section.id)}
                            disabled={isSaving}
                            className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 disabled:opacity-50 ${
                              isCompleted
                                ? 'border-green-500 bg-green-500 text-white'
                                : 'border-zinc-500 hover:border-[#E0FE10]'
                            }`}
                          >
                            {isSaving ? (
                              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : isCompleted ? (
                              <FaCheckCircle className="w-4 h-4" />
                            ) : null}
                          </button>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold mb-2 text-white">{section.title}</h3>
                            <p className="text-zinc-300 leading-relaxed">{section.content}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Deliverable */}
                <div className="border-t border-zinc-800 pt-8">
                  <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
                    <h3 className="text-lg font-semibold mb-4 text-[#E0FE10] flex items-center gap-2">
                      <FaSignature />
                      Phase Deliverable
                    </h3>
                    <p className="text-zinc-300 mb-4">{currentPhaseData.deliverable}</p>
                    <button
                      onClick={() => toggleDeliverableCompletion(currentPhaseData.id)}
                      disabled={isSaving}
                      className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 flex items-center gap-2 ${
                        progress.deliverableProgress[currentPhaseData.id]
                          ? 'bg-green-500 text-white'
                          : 'bg-[#E0FE10] text-black hover:bg-[#c8e60e]'
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </>
                      ) : progress.deliverableProgress[currentPhaseData.id] ? (
                        'Completed ✓'
                      ) : (
                        'Mark as Complete'
                      )}
                    </button>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center pt-8 border-t border-zinc-800">
                  <button
                    onClick={() => navigateToPhase(Math.max(1, progress.currentPhase - 1))}
                    disabled={progress.currentPhase === 1 || isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FaArrowLeft />
                    Previous Phase
                  </button>
                  
                  <div className="text-center">
                    <div className="text-sm text-zinc-400">
                      Phase {progress.currentPhase} of {phases.length}
                    </div>
                    {isSaving && (
                      <div className="text-xs text-[#E0FE10] flex items-center justify-center gap-2 mt-1">
                        <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                        Saving progress...
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => navigateToPhase(Math.min(phases.length, progress.currentPhase + 1))}
                    disabled={progress.currentPhase === phases.length || isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next Phase
                    <FaArrowRight />
                  </button>
                </div>

              </div>
            )}
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default StaffOnboardingPage;