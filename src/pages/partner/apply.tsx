import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../hooks/useUser';
import Header, { Section } from '../../components/Header';
import Footer from '../../components/Footer/Footer';
import PageHead from '../../components/PageHead';
import { 
  FaCheckCircle, 
  FaUsers, 
  FaDollarSign,
  FaChartLine,
  FaArrowRight
} from 'react-icons/fa';

const PartnerApplication: React.FC = () => {
  const currentUser = useUser();
  const router = useRouter();
  const [referralCode, setReferralCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<Section>('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSectionChange = (section: Section) => {
    setCurrentSection(section);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const setIsSignInModalVisible = () => {
    console.log('Sign in modal triggered from partner apply');
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('Please sign in to continue with your partner application.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[PartnerApplication] Submitting partner application for:', { 
        userId: currentUser.id, 
        referralCode
      });

      const response = await fetch('/.netlify/functions/create-partner-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: currentUser.id,
          referralCode: referralCode || undefined,
          userType: 'partner'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit partner application.');
      }

      // Redirect to success page
      console.log(`[PartnerApplication] Partner application submitted successfully`);
      router.push('/partner/onboarding-success');

    } catch (err: any) {
      console.error('[PartnerApplication] Error submitting application:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (currentUser === undefined) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E0FE10] mx-auto mb-4"></div>
          <div className="text-white text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  // If not authenticated, AuthWrapper will handle showing sign-in modal
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Authentication Required</div>
          <div className="text-zinc-400">Please sign in to continue with your partner application.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHead 
        metaData={{
          pageId: "partner-apply",
          pageTitle: "Partner Application - Pulse",
          metaDescription: "Apply to become a Pulse partner coach and start earning revenue from your athletes.",
          lastUpdated: new Date().toISOString()
        }}
        pageOgUrl="https://fitwithpulse.ai/partner/apply"
      />
      
      <div className="min-h-screen bg-black text-white">
        <Header 
          onSectionChange={handleSectionChange}
          currentSection={currentSection}
          toggleMobileMenu={toggleMobileMenu}
          setIsSignInModalVisible={setIsSignInModalVisible}
          theme="dark"
        />
        
        <main className="pt-20 pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Header */}
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-gradient-to-r from-[#E0FE10] to-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaUsers className="h-10 w-10 text-black" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                Partner Application
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                Welcome, {currentUser.displayName || currentUser.email}! Complete your application to become a Pulse partner coach.
              </p>
            </div>

            {/* Partnership Benefits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center">
                <div className="w-12 h-12 bg-[#E0FE10]/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FaDollarSign className="h-6 w-6 text-[#E0FE10]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">40% Revenue Share</h3>
                <p className="text-zinc-400 text-sm">
                  Earn 40% of all revenue from athletes you bring to the platform
                </p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center">
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FaUsers className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">No Subscription Fees</h3>
                <p className="text-zinc-400 text-sm">
                  Partners don't pay monthly fees - you earn revenue instead
                </p>
              </div>

              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center">
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <FaChartLine className="h-6 w-6 text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Growth Potential</h3>
                <p className="text-zinc-400 text-sm">
                  Scale your coaching business with our platform and tools
                </p>
              </div>
            </div>

            {/* Application Form */}
            <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800">
              <h2 className="text-2xl font-semibold text-white mb-6">Complete Your Application</h2>
              
              <form onSubmit={handleSubmitApplication} className="space-y-6">
                {/* User Info Display */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">Name</label>
                    <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-400">
                      {currentUser.displayName || currentUser.email || 'User'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white font-medium mb-2">Email</label>
                    <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-400">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                {/* Referral Code */}
                <div>
                  <label htmlFor="referralCode" className="block text-white font-medium mb-2">
                    Your Referral Code (Optional)
                  </label>
                  <input
                    type="text"
                    id="referralCode"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:border-[#E0FE10] transition-colors"
                    placeholder="e.g., COACH123"
                    maxLength={8}
                  />
                  <p className="text-zinc-400 text-sm mt-2">
                    Leave blank to auto-generate a unique code for you
                  </p>
                </div>

                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                {/* Partnership Agreement */}
                <div className="p-6 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Partnership Terms</h3>
                  <div className="space-y-3 text-sm text-zinc-300">
                    <div className="flex items-start gap-3">
                      <FaCheckCircle className="h-4 w-4 text-[#E0FE10] mt-0.5 flex-shrink-0" />
                      <span>You will earn 40% of all subscription revenue from athletes you refer</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FaCheckCircle className="h-4 w-4 text-[#E0FE10] mt-0.5 flex-shrink-0" />
                      <span>No monthly subscription fees - partners earn revenue instead of paying fees</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FaCheckCircle className="h-4 w-4 text-[#E0FE10] mt-0.5 flex-shrink-0" />
                      <span>Access to partner dashboard for managing athletes and tracking earnings</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <FaCheckCircle className="h-4 w-4 text-[#E0FE10] mt-0.5 flex-shrink-0" />
                      <span>Monthly payouts processed automatically</span>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-center pt-6">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-3 bg-gradient-to-r from-[#E0FE10] to-amber-400 text-black px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                        Submitting Application...
                      </>
                    ) : (
                      <>
                        Submit Partner Application
                        <FaArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default PartnerApplication;
