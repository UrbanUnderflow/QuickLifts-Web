import { db } from '../config';
import { doc, setDoc, getDoc, collection, serverTimestamp, getDocs, query, where, deleteDoc, addDoc, orderBy } from 'firebase/firestore';
import { userService } from '../user';

export type CreatorCtaType = 'link' | 'waitlist';
export type BackgroundType = 'color' | 'image';

export interface SponsorLogo {
  url: string;
  label?: string;
  href?: string;
}

// Survey Types
export type SurveyQuestionType = 'text' | 'multiple_choice' | 'number' | 'yes_no';

export interface SurveyQuestionOption {
  id: string;
  text: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  question: string;
  required?: boolean;
  options?: SurveyQuestionOption[]; // For multiple choice
  minValue?: number; // For number picker
  maxValue?: number; // For number picker
}

export interface Survey {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  userId: string;
  pageSlug: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentName?: string;
  respondentEmail?: string;
  answers: { [questionId: string]: string | number | string[] };
  createdAt?: any;
}

// Check-in Types
export interface WaiverSignature {
  signatureDataUrl: string; // Base64 data URL of signature
  signedAt?: any; // Added by service via serverTimestamp()
  signedByName: string;
  signedByEmail?: string;
}

export interface CheckInRecord {
  id: string;
  waitlistEntryId: string;
  name: string;
  email: string;
  phone?: string;
  checkedInAt: any;
  waiverSigned: boolean;
  waiverSignature?: WaiverSignature;
  checkedInBy?: string; // userId of person who checked them in
}

export interface CreatorLandingPage {
  slug: string; // pagename in URL
  userId: string;
  username: string;
  roundId?: string; // optional: attach landing page to a specific round
  title?: string;
  headline?: string;
  body?: string;
  backgroundType?: BackgroundType;
  backgroundColor?: string; // e.g., #0f0f10
  backgroundImageUrl?: string;
  pageTextColor?: string; // Color for page text (headline, body)
  sponsorLogos?: SponsorLogo[]; // Logos for sponsors displayed on the page
  ctaType?: CreatorCtaType;
  ctaLabel?: string;
  ctaHref?: string; // for link-button
  ctaButtonColor?: string; // Custom button background color
  ctaTextColor?: string; // Custom button text color (text inside button)
  viewCount?: number; // Track total page views
  // Optional email template fields for waitlist communications
  waitlistEmailFromName?: string;
  waitlistEmailSubject?: string;
  waitlistEmailBody?: string;
  updatedAt?: any;
  createdAt?: any;
}

export interface SaveLandingPageInput extends Partial<Omit<CreatorLandingPage, 'userId'|'username'|'slug'>> {
  slug: string;
}

const ROOT = 'creator-pages';

export const creatorPagesService = {
  async savePage(userId: string, username: string, input: SaveLandingPageInput): Promise<void> {
    const sanitizedSlug = (input.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!sanitizedSlug) throw new Error('Page name (slug) is required');
    const ref = doc(db, ROOT, userId, 'pages', sanitizedSlug);
    
    // Check if page already exists to preserve createdAt and existing sponsor logos when not provided
    const existingDoc = await getDoc(ref);
    const isNewPage = !existingDoc.exists();
    const existingData = existingDoc.exists() ? (existingDoc.data() as CreatorLandingPage) : undefined;
    
    const payload: CreatorLandingPage = {
      slug: sanitizedSlug,
      userId,
      username,
      title: input.title || '',
      headline: input.headline || '',
      body: input.body || '',
      backgroundType: input.backgroundType || 'color',
      backgroundColor: input.backgroundColor || '#0b0b0c',
      backgroundImageUrl: input.backgroundImageUrl || '',
      pageTextColor: input.pageTextColor || '#FFFFFF',
      sponsorLogos: input.sponsorLogos ?? existingData?.sponsorLogos ?? [],
      ctaType: input.ctaType || 'waitlist',
      ctaLabel: input.ctaLabel || 'Join Waitlist',
      ctaHref: input.ctaHref || '',
      ctaButtonColor: input.ctaButtonColor || '#E0FE10',
      ctaTextColor: input.ctaTextColor || '#000000',
      updatedAt: serverTimestamp(),
      // Only set createdAt and viewCount on new pages
      ...(isNewPage ? { 
        createdAt: serverTimestamp(),
        viewCount: 0 
      } : {}),
    };
    await setDoc(ref, payload, { merge: true });
  },

  async getPageByUsernameAndSlug(username: string, slug: string): Promise<CreatorLandingPage | null> {
    const user = await userService.getUserByUsername(username);
    if (!user) return null;
    const ref = doc(db, ROOT, user.id, 'pages', slug);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as CreatorLandingPage) : null;
  },

  async incrementPageView(userId: string, slug: string): Promise<void> {
    const ref = doc(db, ROOT, userId, 'pages', slug);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    
    const currentData = snap.data() as CreatorLandingPage;
    const newViewCount = (currentData.viewCount || 0) + 1;
    
    await setDoc(ref, {
      viewCount: newViewCount,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  async findUserIdByUsername(username: string): Promise<string | null> {
    const users = collection(db, 'users');
    const q = query(users, where('username', '==', username));
    const res = await getDocs(q);
    if (res.empty) return null;
    return res.docs[0].id;
  },

  // Survey methods
  async saveSurvey(userId: string, pageSlug: string, survey: Omit<Survey, 'id' | 'userId' | 'pageSlug' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const surveysRef = collection(db, ROOT, userId, 'pages', pageSlug, 'surveys');
    
    if (survey.id) {
      // Update existing survey
      const surveyRef = doc(surveysRef, survey.id);
      await setDoc(surveyRef, {
        ...survey,
        userId,
        pageSlug,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return survey.id;
    } else {
      // Create new survey
      const newSurveyRef = await addDoc(surveysRef, {
        ...survey,
        userId,
        pageSlug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return newSurveyRef.id;
    }
  },

  async getSurveys(userId: string, pageSlug: string): Promise<Survey[]> {
    const surveysRef = collection(db, ROOT, userId, 'pages', pageSlug, 'surveys');
    const q = query(surveysRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as Survey));
  },

  async getSurveyById(userId: string, pageSlug: string, surveyId: string): Promise<Survey | null> {
    const surveyRef = doc(db, ROOT, userId, 'pages', pageSlug, 'surveys', surveyId);
    const snap = await getDoc(surveyRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } as Survey : null;
  },

  async deleteSurvey(userId: string, pageSlug: string, surveyId: string): Promise<void> {
    const surveyRef = doc(db, ROOT, userId, 'pages', pageSlug, 'surveys', surveyId);
    await deleteDoc(surveyRef);
  },

  async submitSurveyResponse(userId: string, pageSlug: string, surveyId: string, response: Omit<SurveyResponse, 'id' | 'surveyId' | 'createdAt'>): Promise<string> {
    const responsesRef = collection(db, ROOT, userId, 'pages', pageSlug, 'surveys', surveyId, 'responses');
    const newResponseRef = await addDoc(responsesRef, {
      ...response,
      surveyId,
      createdAt: serverTimestamp(),
    });
    return newResponseRef.id;
  },

  async getSurveyResponses(userId: string, pageSlug: string, surveyId: string): Promise<SurveyResponse[]> {
    const responsesRef = collection(db, ROOT, userId, 'pages', pageSlug, 'surveys', surveyId, 'responses');
    const q = query(responsesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as SurveyResponse));
  },

  // Check-in methods
  async checkInAttendee(
    userId: string, 
    pageSlug: string, 
    waitlistEntryId: string,
    checkInData: Omit<CheckInRecord, 'id' | 'checkedInAt'>
  ): Promise<string> {
    console.log('[CheckIn Service] Starting check-in:', { userId, pageSlug, waitlistEntryId });
    
    try {
      // Build check-in payload, excluding undefined values (Firestore doesn't allow undefined)
      const checkInPayload: Record<string, any> = {
        waitlistEntryId: checkInData.waitlistEntryId,
        name: checkInData.name,
        email: checkInData.email,
        waiverSigned: checkInData.waiverSigned,
        checkedInAt: serverTimestamp(),
      };

      // Only add optional fields if they have values
      if (checkInData.phone) {
        checkInPayload.phone = checkInData.phone;
      }
      if (checkInData.checkedInBy) {
        checkInPayload.checkedInBy = checkInData.checkedInBy;
      }
      if (checkInData.waiverSignature) {
        checkInPayload.waiverSignature = {
          signatureDataUrl: checkInData.waiverSignature.signatureDataUrl,
          signedByName: checkInData.waiverSignature.signedByName,
          signedAt: serverTimestamp(),
        };
        if (checkInData.waiverSignature.signedByEmail) {
          checkInPayload.waiverSignature.signedByEmail = checkInData.waiverSignature.signedByEmail;
        }
      }

      // Save to check-ins collection
      const checkInsRef = collection(db, ROOT, userId, 'pages', pageSlug, 'check-ins');
      console.log('[CheckIn Service] Saving to check-ins collection...', checkInPayload);
      const newCheckInRef = await addDoc(checkInsRef, checkInPayload);
      console.log('[CheckIn Service] Check-in saved with ID:', newCheckInRef.id);

      // Update the waitlist entry to mark as checked in
      const waitlistEntryRef = doc(db, ROOT, userId, 'waitlist', waitlistEntryId);
      console.log('[CheckIn Service] Updating waitlist entry...');
      await setDoc(waitlistEntryRef, {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
        checkInId: newCheckInRef.id,
      }, { merge: true });
      console.log('[CheckIn Service] Waitlist entry updated');

      return newCheckInRef.id;
    } catch (err) {
      console.error('[CheckIn Service] Error:', err);
      throw err;
    }
  },

  async getCheckIns(userId: string, pageSlug: string): Promise<CheckInRecord[]> {
    const checkInsRef = collection(db, ROOT, userId, 'pages', pageSlug, 'check-ins');
    const q = query(checkInsRef, orderBy('checkedInAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as CheckInRecord));
  },

  async getCheckInByWaitlistId(userId: string, pageSlug: string, waitlistEntryId: string): Promise<CheckInRecord | null> {
    const checkInsRef = collection(db, ROOT, userId, 'pages', pageSlug, 'check-ins');
    const q = query(checkInsRef, where('waitlistEntryId', '==', waitlistEntryId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CheckInRecord;
  },

  async getWaitlistWithCheckInStatus(userId: string, pageSlug: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    phone?: string;
    createdAt: any;
    checkedIn: boolean;
    checkedInAt?: any;
  }>> {
    // Get waitlist entries for this page
    const waitlistRef = collection(db, ROOT, userId, 'waitlist');
    const q = query(waitlistRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs
      .map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        email: doc.data().email || '',
        phone: doc.data().phone,
        pageName: doc.data().pageName || doc.data().page || '',
        createdAt: doc.data().createdAt,
        checkedIn: doc.data().checkedIn || false,
        checkedInAt: doc.data().checkedInAt,
      }))
      .filter(entry => entry.pageName === pageSlug);
  }
};



