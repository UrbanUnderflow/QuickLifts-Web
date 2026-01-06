import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  where,
  limit,
  DocumentReference
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config';
import { adminMethods } from '../admin/methods';
import { 
  WeeklyContext, 
  DraftReview, 
  WeeklyContextData, 
  DraftReviewData,
  ReviewContextSummary,
  ReviewHighlight,
  ReviewMetric,
  getCurrentWeekOfMonth,
  getCurrentMonthYear,
  getMonthYearFromDate
} from './types';

class ReviewContextService {
  private static instance: ReviewContextService;
  private readonly weeklyContextCollection = 'reviewWeeklyContext';
  private readonly draftReviewCollection = 'reviewDrafts';

  static getInstance(): ReviewContextService {
    if (!ReviewContextService.instance) {
      ReviewContextService.instance = new ReviewContextService();
    }
    return ReviewContextService.instance;
  }

  // ==================== WEEKLY CONTEXT METHODS ====================

  /**
   * Add a new weekly context entry
   */
  async addWeeklyContext(
    content: string,
    source: 'email' | 'manual',
    emailSubject?: string
  ): Promise<WeeklyContext> {
    try {
      const now = new Date();
      const weekNumber = getCurrentWeekOfMonth(); // Week of the month (1-5)
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const contextRef = doc(collection(db, this.weeklyContextCollection));
      
      const contextData: WeeklyContextData = {
        id: contextRef.id,
        weekNumber,
        year,
        month,
        content,
        source,
        createdAt: now,
        updatedAt: now,
        ...(emailSubject && { emailSubject }),
      };

      const context = new WeeklyContext(contextData);
      await setDoc(contextRef, context.toDictionary());
      
      console.log('[ReviewContextService] Weekly context added:', context.id);
      return context;
    } catch (error) {
      console.error('[ReviewContextService] Error adding weekly context:', error);
      throw error;
    }
  }

  /**
   * Fetch all weekly context entries for a specific month
   */
  async fetchWeeklyContextByMonth(year: number, month: number): Promise<WeeklyContext[]> {
    try {
      const contextRef = collection(db, this.weeklyContextCollection);
      const q = query(
        contextRef,
        where('year', '==', year),
        where('month', '==', month),
        orderBy('weekNumber', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const contexts = querySnapshot.docs.map(doc => 
        WeeklyContext.fromFirestore(doc.data(), doc.id)
      );

      console.log(`[ReviewContextService] Fetched ${contexts.length} weekly contexts for ${month}/${year}`);
      return contexts;
    } catch (error) {
      console.error('[ReviewContextService] Error fetching weekly context by month:', error);
      throw error;
    }
  }

  /**
   * Fetch all weekly context entries (most recent first)
   */
  async fetchAllWeeklyContext(): Promise<WeeklyContext[]> {
    try {
      const contextRef = collection(db, this.weeklyContextCollection);
      // Use simple query first to avoid index requirements
      const q = query(contextRef, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const contexts = querySnapshot.docs.map(doc => 
        WeeklyContext.fromFirestore(doc.data(), doc.id)
      );

      console.log(`[ReviewContextService] Fetched ${contexts.length} total weekly contexts`);
      return contexts;
    } catch (error: any) {
      // If collection doesn't exist or is empty, return empty array
      if (error?.code === 'failed-precondition' || error?.code === 'permission-denied') {
        console.log('[ReviewContextService] Collection may be empty or index needed, returning empty array');
        return [];
      }
      console.error('[ReviewContextService] Error fetching all weekly context:', error);
      throw error;
    }
  }

  /**
   * Update a weekly context entry
   */
  async updateWeeklyContext(id: string, content: string): Promise<void> {
    try {
      const contextRef = doc(db, this.weeklyContextCollection, id);
      await updateDoc(contextRef, {
        content,
        updatedAt: new Date(),
      });
      
      console.log('[ReviewContextService] Weekly context updated:', id);
    } catch (error) {
      console.error('[ReviewContextService] Error updating weekly context:', error);
      throw error;
    }
  }

  /**
   * Delete a weekly context entry
   */
  async deleteWeeklyContext(id: string): Promise<void> {
    try {
      const contextRef = doc(db, this.weeklyContextCollection, id);
      await deleteDoc(contextRef);
      
      console.log('[ReviewContextService] Weekly context deleted:', id);
    } catch (error) {
      console.error('[ReviewContextService] Error deleting weekly context:', error);
      throw error;
    }
  }

  // ==================== DRAFT REVIEW METHODS ====================

  /**
   * Create or update a draft review with structured data
   */
  async saveDraftReview(
    draftData: Omit<DraftReviewData, 'id' | 'createdAt' | 'updatedAt' | 'generatedAt'>
  ): Promise<DraftReview> {
    try {
      // Check if draft already exists for this month
      const existing = await this.fetchDraftByMonthYear(draftData.monthYear);
      const now = new Date();

      if (existing) {
        // Update existing draft
        const draftRef = doc(db, this.draftReviewCollection, existing.id);
        
        // Filter out undefined values (Firestore doesn't accept undefined)
        const cleanData: Record<string, any> = {};
        for (const [key, value] of Object.entries(draftData)) {
          if (value !== undefined) {
            cleanData[key] = value;
          }
        }
        cleanData.updatedAt = now;
        
        await updateDoc(draftRef, cleanData);
        
        console.log('[ReviewContextService] Draft review updated:', existing.id);
        return new DraftReview({
          ...existing,
          ...draftData,
          updatedAt: now,
        } as DraftReviewData);
      } else {
        // Create new draft
        const draftRef = doc(collection(db, this.draftReviewCollection));
        
        const fullDraftData: DraftReviewData = {
          id: draftRef.id,
          ...draftData,
          generatedAt: now,
          createdAt: now,
          updatedAt: now,
        };

        const draft = new DraftReview(fullDraftData);
        await setDoc(draftRef, draft.toDictionary());
        
        console.log('[ReviewContextService] Draft review created:', draft.id);
        return draft;
      }
    } catch (error) {
      console.error('[ReviewContextService] Error saving draft review:', error);
      throw error;
    }
  }

  /**
   * Fetch draft review by month/year
   */
  async fetchDraftByMonthYear(monthYear: string): Promise<DraftReview | null> {
    try {
      const draftRef = collection(db, this.draftReviewCollection);
      const q = query(draftRef, where('monthYear', '==', monthYear), limit(1));
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      return DraftReview.fromFirestore(doc.data(), doc.id);
    } catch (error) {
      console.error('[ReviewContextService] Error fetching draft by monthYear:', error);
      throw error;
    }
  }

  /**
   * Fetch all draft reviews
   */
  async fetchAllDrafts(): Promise<DraftReview[]> {
    try {
      // IMPORTANT: Draft reviews should never be readable by unauthenticated users
      // (or non-admins) from the client. Even though UI gates draft visibility,
      // this prevents accidental exposure via any other callsite.
      const auth = getAuth();
      const email = auth.currentUser?.email;
      if (!email) {
        console.log('[ReviewContextService] No authenticated user; returning empty draft list');
        return [];
      }
      const isAdmin = await adminMethods.isAdmin(email.toLowerCase());
      if (!isAdmin) {
        console.log('[ReviewContextService] Non-admin user; returning empty draft list');
        return [];
      }

      const draftRef = collection(db, this.draftReviewCollection);
      const q = query(draftRef, orderBy('createdAt', 'desc'));
      
      const querySnapshot = await getDocs(q);
      const drafts = querySnapshot.docs.map(doc => 
        DraftReview.fromFirestore(doc.data(), doc.id)
      );

      console.log(`[ReviewContextService] Fetched ${drafts.length} draft reviews`);
      return drafts;
    } catch (error: any) {
      // If collection doesn't exist or is empty, return empty array
      if (error?.code === 'failed-precondition' || error?.code === 'permission-denied') {
        console.log('[ReviewContextService] Drafts collection may be empty, returning empty array');
        return [];
      }
      console.error('[ReviewContextService] Error fetching all drafts:', error);
      throw error;
    }
  }

  /**
   * Update draft review status
   */
  async updateDraftStatus(id: string, status: 'draft' | 'ready' | 'published'): Promise<void> {
    try {
      const draftRef = doc(db, this.draftReviewCollection, id);
      const updateData: Record<string, any> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'published') {
        updateData.publishedAt = new Date();
      }

      await updateDoc(draftRef, updateData);
      
      console.log('[ReviewContextService] Draft status updated:', id, status);
    } catch (error) {
      console.error('[ReviewContextService] Error updating draft status:', error);
      throw error;
    }
  }

  /**
   * Delete a draft review
   */
  async deleteDraft(id: string): Promise<void> {
    try {
      const draftRef = doc(db, this.draftReviewCollection, id);
      await deleteDoc(draftRef);
      
      console.log('[ReviewContextService] Draft review deleted:', id);
    } catch (error) {
      console.error('[ReviewContextService] Error deleting draft:', error);
      throw error;
    }
  }

  // ==================== SUMMARY METHODS ====================

  /**
   * Get a summary of all months with context/drafts
   */
  async getReviewSummaries(): Promise<ReviewContextSummary[]> {
    try {
      // Fetch all weekly contexts
      const contexts = await this.fetchAllWeeklyContext();
      const drafts = await this.fetchAllDrafts();

      // Group by month/year
      const summaryMap = new Map<string, ReviewContextSummary>();

      // Add context data
      for (const context of contexts) {
        const monthYear = `${context.year}-${String(context.month).padStart(2, '0')}`;
        
        if (!summaryMap.has(monthYear)) {
          summaryMap.set(monthYear, {
            monthYear,
            weekCount: 0,
            latestWeek: 0,
            hasDraft: false,
          });
        }

        const summary = summaryMap.get(monthYear)!;
        summary.weekCount++;
        summary.latestWeek = Math.max(summary.latestWeek, context.weekNumber);
      }

      // Add draft data
      for (const draft of drafts) {
        if (!summaryMap.has(draft.monthYear)) {
          summaryMap.set(draft.monthYear, {
            monthYear: draft.monthYear,
            weekCount: 0,
            latestWeek: 0,
            hasDraft: true,
            draftStatus: draft.status,
          });
        } else {
          const summary = summaryMap.get(draft.monthYear)!;
          summary.hasDraft = true;
          summary.draftStatus = draft.status;
        }
      }

      // Convert to array and sort by monthYear descending
      const summaries = Array.from(summaryMap.values()).sort((a, b) => 
        b.monthYear.localeCompare(a.monthYear)
      );

      return summaries;
    } catch (error) {
      console.error('[ReviewContextService] Error getting review summaries:', error);
      throw error;
    }
  }

  /**
   * Generate a draft review from weekly contexts
   * Uses AI to polish content into investor-ready copy
   */
  async generateDraftFromContext(year: number, month: number): Promise<DraftReview> {
    try {
      const contexts = await this.fetchWeeklyContextByMonth(year, month);
      
      if (contexts.length === 0) {
        throw new Error('No weekly context found for this month');
      }

      const monthYear = `${year}-${String(month).padStart(2, '0')}`;
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthNamesUpper = monthNames.map(m => m.toUpperCase());
      const monthName = monthNames[month - 1];
      
      let title: string;
      let description: string;
      let featuredHighlights: ReviewHighlight[];
      let businessHighlights: ReviewHighlight[];
      let productHighlights: ReviewHighlight[];
      let metrics: ReviewMetric[];
      let lookingAhead: string[];
      let metricsNote: string | null = null;

      try {
        // Use AI to polish the content into investor-ready copy
        console.log('[ReviewContextService] Using AI to polish review content...');
        const polished = await this.polishReviewContent(contexts, monthName, year);
        
        title = `${monthName} ${year}: ${polished.title}`;
        description = polished.description;
        featuredHighlights = polished.featuredHighlights;
        businessHighlights = polished.businessHighlights;
        productHighlights = polished.productHighlights;
        
        // Use AI-extracted metrics if available, otherwise use placeholders
        if (polished.metrics && polished.metrics.length > 0) {
          metrics = polished.metrics;
          metricsNote = null; // No note needed if we have real metrics
        } else {
          metrics = [
            { label: 'Subscribed Members', currentValue: 0, previousValue: 0, showGrowth: true },
            { label: 'Unique Moves Added', currentValue: 0, previousValue: 0, showGrowth: true },
            { label: 'Total Workouts Logged', currentValue: 0, previousValue: 0, showGrowth: true },
            { label: 'Earnings', currentValue: 0, previousValue: 0, isCurrency: true, showGrowth: true },
          ];
          metricsNote = 'Update metrics with actual values before publishing.';
        }
        
        // Use AI-extracted lookingAhead if available
        lookingAhead = polished.lookingAhead && polished.lookingAhead.length > 0 
          ? polished.lookingAhead 
          : ['[Add upcoming priorities]'];
        
        console.log('[ReviewContextService] AI polishing complete');
      } catch (aiError) {
        // Fall back to basic parsing if AI fails
        console.warn('[ReviewContextService] AI polishing failed, falling back to basic parsing:', aiError);
        
        const allHighlights = this.parseContextToHighlights(contexts);
        featuredHighlights = allHighlights.filter(h => h.isFeatured).slice(0, 2);
        businessHighlights = allHighlights.filter(h => !h.isFeatured).slice(0, 4);
        productHighlights = this.extractProductHighlights(contexts);
        title = this.generateTitle(contexts, monthName, year);
        description = this.generateDescription(contexts);
        metrics = [
          { label: 'Subscribed Members', currentValue: 0, previousValue: 0, showGrowth: true },
          { label: 'Unique Moves Added', currentValue: 0, previousValue: 0, showGrowth: true },
          { label: 'Total Workouts Logged', currentValue: 0, previousValue: 0, showGrowth: true },
          { label: 'Earnings', currentValue: 0, previousValue: 0, isCurrency: true, showGrowth: true },
        ];
        metricsNote = 'Update metrics with actual values before publishing.';
        lookingAhead = ['[Add upcoming priorities]'];
      }

      const draftData: Omit<DraftReviewData, 'id' | 'createdAt' | 'updatedAt' | 'generatedAt'> = {
        monthYear,
        reviewType: 'month',
        title,
        subtitle: `${monthNamesUpper[month - 1]} ${year}`,
        description,
        featuredHighlights,
        metrics,
        metricsNote: metricsNote ?? undefined,
        businessHighlights,
        productHighlights,
        lookingAhead,
        status: 'draft',
        weeklyContextIds: contexts.map(c => c.id),
      };

      const draft = await this.saveDraftReview(draftData);
      return draft;
    } catch (error) {
      console.error('[ReviewContextService] Error generating draft from context:', error);
      throw error;
    }
  }

  /**
   * Parse weekly context entries into highlight items
   */
  private parseContextToHighlights(contexts: WeeklyContext[]): ReviewHighlight[] {
    const highlights: ReviewHighlight[] = [];
    
    // Keywords that indicate featured/important items
    const featuredKeywords = ['investment', 'launch', 'selected', 'won', 'graduated', 'secured', 'milestone', 'partnership'];
    
    for (const ctx of contexts) {
      // Split context into sentences/items
      const lines = ctx.content.split(/[.\n]/).filter(line => line.trim().length > 10);
      
      for (const line of lines) {
        const cleanLine = line.trim();
        if (cleanLine.length < 15) continue;
        
        // Check if this is a featured item
        const isFeatured = featuredKeywords.some(kw => 
          cleanLine.toLowerCase().includes(kw)
        );
        
        // Extract a title (first few words or up to first comma)
        const titleMatch = cleanLine.match(/^([^,]+)/);
        const title = titleMatch ? titleMatch[1].trim().slice(0, 50) : cleanLine.slice(0, 50);
        
        highlights.push({
          title: title,
          description: cleanLine,
          isFeatured,
        });
      }
    }
    
    return highlights;
  }

  /**
   * Extract product-related highlights from context
   */
  private extractProductHighlights(contexts: WeeklyContext[]): ReviewHighlight[] {
    const productKeywords = ['shipped', 'built', 'launched', 'feature', 'update', 'redesign', 'dashboard', 'app', 'web', 'ui', 'ux'];
    const highlights: ReviewHighlight[] = [];
    
    for (const ctx of contexts) {
      const lines = ctx.content.split(/[.\n]/).filter(line => line.trim().length > 10);
      
      for (const line of lines) {
        const cleanLine = line.trim();
        if (productKeywords.some(kw => cleanLine.toLowerCase().includes(kw))) {
          const titleMatch = cleanLine.match(/^([^,]+)/);
          const title = titleMatch ? titleMatch[1].trim().slice(0, 50) : cleanLine.slice(0, 50);
          
          highlights.push({
            title,
            description: cleanLine,
          });
        }
      }
    }
    
    return highlights.slice(0, 4);
  }

  /**
   * Generate a title based on context themes
   */
  private generateTitle(contexts: WeeklyContext[], monthName: string, year: number): string {
    const allContent = contexts.map(c => c.content.toLowerCase()).join(' ');
    
    // Check for common themes
    if (allContent.includes('launch') || allContent.includes('shipped')) {
      return `${monthName} ${year}: Shipping Season`;
    }
    if (allContent.includes('investment') || allContent.includes('funding')) {
      return `${monthName} ${year}: Building Momentum`;
    }
    if (allContent.includes('growth') || allContent.includes('milestone')) {
      return `${monthName} ${year}: Hitting Milestones`;
    }
    
    return `${monthName} ${year} Review`;
  }

  /**
   * Generate a description from context
   */
  private generateDescription(contexts: WeeklyContext[]): string {
    if (contexts.length === 0) return 'Monthly review of our progress and achievements.';
    
    // Use the first context as a base, trimmed
    const firstContent = contexts[0].content;
    const firstSentence = firstContent.split(/[.!?]/)[0];
    
    if (firstSentence && firstSentence.length > 20) {
      return firstSentence.trim() + '.';
    }
    
    return 'A recap of our progress, learnings, and achievements this month.';
  }

  // ==================== AI POLISHING METHODS ====================

  /**
   * Send a prompt to Gemini via Firebase and get a response
   */
  private async sendGeminiPrompt(prompt: string): Promise<string> {
    try {
      const generateRef = await addDoc(collection(db, 'generate'), {
        prompt: prompt
      });

      console.log('[ReviewContextService] Gemini prompt sent:', generateRef.id);
      const response = await this.fetchGeminiOutputWithRetry(generateRef, 30, 2000);
      return response;
    } catch (error) {
      console.error('[ReviewContextService] Error sending Gemini prompt:', error);
      throw error;
    }
  }

  /**
   * Retry fetching Gemini output until it's ready
   */
  private async fetchGeminiOutputWithRetry(
    docRef: DocumentReference,
    attempts: number,
    delay: number
  ): Promise<string> {
    if (attempts === 0) {
      throw new Error('Max retry attempts reached waiting for AI response');
    }

    const snapshot = await getDoc(docRef);
    const data = snapshot.data();

    if (data?.output) {
      return data.output;
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    return this.fetchGeminiOutputWithRetry(docRef, attempts - 1, delay);
  }

  /**
   * Polish raw context into investor-ready review copy using AI
   */
  async polishReviewContent(rawContexts: WeeklyContext[], monthName: string, year: number): Promise<{
    title: string;
    description: string;
    featuredHighlights: ReviewHighlight[];
    businessHighlights: ReviewHighlight[];
    productHighlights: ReviewHighlight[];
    metrics: ReviewMetric[];
    lookingAhead: string[];
  }> {
    const rawContent = rawContexts.map(ctx => ctx.content).join('\n\n');
    
    const prompt = `You are writing an investor update for a fitness tech startup called Pulse. The founder sends monthly updates to investors like Jason Calacanis (LAUNCH fund).

The writing style should be:
- Precise and punchy - short declarative sentences
- Confident but not arrogant
- Signal what each achievement means for the business
- Professional, no fluff or filler words
- 1-2 sentences per item maximum

IMPORTANT: The context may contain section tags like [METRICS], [LOOKING AHEAD], [BUSINESS DEVELOPMENT], [PRODUCT DEVELOPMENT], [KEY MILESTONE]. Use these to categorize content correctly.

Here is the raw context from ${monthName} ${year}:

${rawContent}

Based on this context, generate a JSON response with the following structure:
{
  "title": "A punchy 3-5 word title for the month (e.g., 'Shipping Season', 'Building Momentum', 'Closing the Loop')",
  "description": "One punchy sentence summarizing the month's key theme. Use short declarative phrases separated by periods if listing achievements.",
  "metrics": {
    "subscribedMembers": 0,
    "uniqueMovesAdded": 0,
    "totalWorkoutsLogged": 0,
    "earnings": 0
  },
  "featuredHighlights": [
    {
      "title": "Short punchy title (3-6 words)",
      "description": "One clear sentence describing the achievement",
      "isFeatured": true
    }
  ],
  "businessHighlights": [
    {
      "title": "Short punchy title",
      "description": "One sentence max. Be direct and specific."
    }
  ],
  "productHighlights": [
    {
      "title": "Feature or product name",
      "description": "One sentence describing what was shipped and why it matters."
    }
  ],
  "lookingAhead": [
    "Priority 1 for next month",
    "Priority 2 for next month"
  ]
}

Rules:
- metrics: Extract any numbers mentioned for subscribers, revenue/earnings, workouts logged, moves added. If tagged with [METRICS], extract ALL numbers. Use 0 if not mentioned.
- featuredHighlights: 1-2 items maximum, only the MOST significant achievements (funding, major partnerships, key milestones). Look for [KEY MILESTONE] tags.
- businessHighlights: 2-4 items about business development (partnerships, programs, corporate structure). Look for [BUSINESS DEVELOPMENT] tags. Do NOT include metrics here.
- productHighlights: 2-4 items about what was shipped/built. Look for [PRODUCT DEVELOPMENT] tags.
- lookingAhead: 2-4 items about future priorities. Look for [LOOKING AHEAD] tags. If none found, return empty array.
- If something doesn't fit, omit it rather than forcing it
- Be specific with numbers and names when mentioned in the context
- NEVER put metric numbers into businessHighlights or productHighlights - metrics go in the metrics object only

Return ONLY valid JSON, no markdown or explanation.`;

    try {
      const response = await this.sendGeminiPrompt(prompt);
      
      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response as JSON');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Extract metrics
      const metricsData = parsed.metrics || {};
      const metrics: ReviewMetric[] = [];
      
      if (metricsData.subscribedMembers !== undefined && metricsData.subscribedMembers > 0) {
        metrics.push({
          label: 'Subscribed Members',
          currentValue: metricsData.subscribedMembers,
          previousValue: metricsData.previousSubscribers || 0,
          showGrowth: true
        });
      }
      if (metricsData.uniqueMovesAdded !== undefined && metricsData.uniqueMovesAdded > 0) {
        metrics.push({
          label: 'Unique Moves Added',
          currentValue: metricsData.uniqueMovesAdded,
          previousValue: 0,
          showGrowth: false
        });
      }
      if (metricsData.totalWorkoutsLogged !== undefined && metricsData.totalWorkoutsLogged > 0) {
        metrics.push({
          label: 'Total Workouts Logged',
          currentValue: metricsData.totalWorkoutsLogged,
          previousValue: 0,
          showGrowth: false
        });
      }
      if (metricsData.earnings !== undefined && metricsData.earnings > 0) {
        metrics.push({
          label: 'Earnings',
          currentValue: metricsData.earnings,
          previousValue: 0,
          isCurrency: true,
          showGrowth: false
        });
      }
      
      return {
        title: parsed.title || `${monthName} ${year} Review`,
        description: parsed.description || 'Monthly progress update.',
        featuredHighlights: (parsed.featuredHighlights || []).map((h: any) => ({
          title: h.title,
          description: h.description,
          isFeatured: true
        })),
        businessHighlights: (parsed.businessHighlights || []).map((h: any) => ({
          title: h.title,
          description: h.description,
          isFeatured: false
        })),
        productHighlights: (parsed.productHighlights || []).map((h: any) => ({
          title: h.title,
          description: h.description,
          isFeatured: false
        })),
        metrics,
        lookingAhead: parsed.lookingAhead || []
      };
    } catch (error) {
      console.error('[ReviewContextService] Error polishing content with AI:', error);
      // Fall back to basic parsing if AI fails
      throw error;
    }
  }

  /**
   * Update a draft review
   */
  async updateDraft(id: string, updates: Partial<DraftReviewData>): Promise<void> {
    try {
      const draftRef = doc(db, this.draftReviewCollection, id);
      await updateDoc(draftRef, {
        ...updates,
        updatedAt: new Date(),
      });
      console.log('[ReviewContextService] Draft updated:', id);
    } catch (error) {
      console.error('[ReviewContextService] Error updating draft:', error);
      throw error;
    }
  }

  /**
   * Fetch a draft by ID
   */
  async fetchDraftById(id: string): Promise<DraftReview | null> {
    try {
      const draftRef = doc(db, this.draftReviewCollection, id);
      const draftDoc = await getDoc(draftRef);
      
      if (!draftDoc.exists()) {
        return null;
      }

      return DraftReview.fromFirestore(draftDoc.data(), draftDoc.id);
    } catch (error) {
      console.error('[ReviewContextService] Error fetching draft by ID:', error);
      throw error;
    }
  }
}

export const reviewContextService = ReviewContextService.getInstance();

