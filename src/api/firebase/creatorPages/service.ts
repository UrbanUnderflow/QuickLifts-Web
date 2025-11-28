import { db } from '../config';
import { doc, setDoc, getDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { userService } from '../user';

export type CreatorCtaType = 'link' | 'waitlist';
export type BackgroundType = 'color' | 'image';

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
  ctaType?: CreatorCtaType;
  ctaLabel?: string;
  ctaHref?: string; // for link-button
  ctaButtonColor?: string; // Custom button background color
  ctaTextColor?: string; // Custom button text color (text inside button)
  viewCount?: number; // Track total page views
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
    
    // Check if page already exists to preserve createdAt
    const existingDoc = await getDoc(ref);
    const isNewPage = !existingDoc.exists();
    
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
  }
};



