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
  _earningsData: any
): EmailMismatchHookResult => {
  const [hasEmailMismatch, setHasEmailMismatch] = useState(false);
  const [mismatchDetails, setMismatchDetails] = useState<EmailMismatchDetail[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEmailMismatch = async () => {
    if (!userId || !userEmail) {
      console.log('[EmailMismatchDetection] Missing userId or userEmail, skipping check');
      return;
    }

    // Always check for email mismatches - don't rely on earningsData having accounts
    // because mismatched accounts might not appear properly in earnings data
    console.log('[EmailMismatchDetection] Starting check for user:', userId);

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

  // Auto-check when component mounts and when user data is available
  useEffect(() => {
    checkEmailMismatch();
  }, [userId, userEmail]);

  return {
    hasEmailMismatch,
    mismatchDetails,
    isChecking,
    error,
    recheckEmailMismatch
  };
};