import { useState, useEffect } from 'react';

interface EmailMismatchDetail {
  accountType: 'creator' | 'winner';
  stripeEmail: string;
  stripeAccountId: string;
}

interface EmailMismatchHookResult {
  hasEmailMismatch: boolean;
  mismatchDetails: EmailMismatchDetail[];
  isChecking: boolean;
  error: string | null;
  recheckEmailMismatch: () => Promise<void>;
}

export const useEmailMismatchDetection = (
  userId: string | undefined,
  userEmail: string | undefined,
  earningsData: any
): EmailMismatchHookResult => {
  const [hasEmailMismatch, setHasEmailMismatch] = useState(false);
  const [mismatchDetails, setMismatchDetails] = useState<EmailMismatchDetail[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEmailMismatch = async () => {
    if (!userId || !userEmail || !earningsData) {
      return;
    }

    // Only check if user has Stripe accounts
    const hasCreatorAccount = earningsData.creatorEarnings?.stripeAccountId;
    const hasWinnerAccount = earningsData.prizeWinnings?.stripeAccountId;

    if (!hasCreatorAccount && !hasWinnerAccount) {
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      console.log('[EmailMismatchDetection] Checking for email mismatch...');
      
      const response = await fetch(`/.netlify/functions/validate-user-stripe-accounts?userId=${userId}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to validate Stripe accounts');
      }

      console.log('[EmailMismatchDetection] Validation result:', data);

      // Check for email mismatch issues
      const emailMismatches = data.issues?.filter((issue: any) => 
        issue.type === 'email_mismatch'
      ) || [];

      if (emailMismatches.length > 0) {
        console.log('[EmailMismatchDetection] Email mismatches found:', emailMismatches);
        
        const details: EmailMismatchDetail[] = emailMismatches.map((issue: any) => ({
          accountType: issue.accountType,
          stripeEmail: issue.actualEmail,
          stripeAccountId: issue.stripeAccountId
        }));

        setHasEmailMismatch(true);
        setMismatchDetails(details);
      } else {
        console.log('[EmailMismatchDetection] No email mismatches found');
        setHasEmailMismatch(false);
        setMismatchDetails([]);
      }

    } catch (err) {
      console.error('[EmailMismatchDetection] Error checking email mismatch:', err);
      setError(err instanceof Error ? err.message : 'Failed to check email mismatch');
      setHasEmailMismatch(false);
      setMismatchDetails([]);
    } finally {
      setIsChecking(false);
    }
  };

  const recheckEmailMismatch = async () => {
    await checkEmailMismatch();
  };

  // Auto-check when component mounts and when earningsData changes
  useEffect(() => {
    checkEmailMismatch();
  }, [userId, userEmail, earningsData?.creatorEarnings?.stripeAccountId, earningsData?.prizeWinnings?.stripeAccountId]);

  return {
    hasEmailMismatch,
    mismatchDetails,
    isChecking,
    error,
    recheckEmailMismatch
  };
};