// Review Context Types for Weekly Progress Tracking

export interface WeeklyContextData {
  id: string;
  weekNumber: number; // 1-52
  year: number;
  month: number; // 1-12
  content: string;
  source: 'email' | 'manual';
  createdAt: Date;
  updatedAt: Date;
  emailSubject?: string; // If from email, store the subject
}

// Structured highlight item for business/product development
export interface ReviewHighlight {
  title: string;
  description: string;
  isFeatured?: boolean; // Key milestone
  signal?: string; // For business highlights
}

// Metric item
export interface ReviewMetric {
  label: string;
  currentValue: number;
  previousValue?: number;
  isCurrency?: boolean;
  showGrowth?: boolean;
}

// Structured draft review data matching the review page format
export interface DraftReviewData {
  id: string;
  monthYear: string; // Format: "2025-01" for January 2025
  reviewType: 'month' | 'quarter'; // Type of review
  
  // Header
  title: string;
  subtitle?: string; // e.g., "DECEMBER 2025" or "Q4 2025 • OCTOBER - DECEMBER"
  description: string;
  
  // Featured highlights (Key Milestones)
  featuredHighlights: ReviewHighlight[];
  
  // Metrics
  metrics: ReviewMetric[];
  metricsNote?: string; // Optional note about metrics
  
  // Business Development
  businessHighlights: ReviewHighlight[];
  
  // Product Development
  productHighlights: ReviewHighlight[];
  
  // Looking Ahead (optional)
  lookingAhead?: string[];
  
  // Status
  status: 'draft' | 'ready' | 'published';
  weeklyContextIds: string[]; // References to weekly context entries used
  
  // Timestamps
  generatedAt: Date;
  publishedAt?: Date;
  publishedReviewId?: string; // ID of the actual review page if published
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewContextSummary {
  monthYear: string;
  weekCount: number;
  latestWeek: number;
  hasDraft: boolean;
  draftStatus?: 'draft' | 'ready' | 'published';
}

export class WeeklyContext {
  id: string;
  weekNumber: number;
  year: number;
  month: number;
  content: string;
  source: 'email' | 'manual';
  createdAt: Date;
  updatedAt: Date;
  emailSubject?: string;

  constructor(data: WeeklyContextData) {
    this.id = data.id;
    this.weekNumber = data.weekNumber;
    this.year = data.year;
    this.month = data.month;
    this.content = data.content;
    this.source = data.source;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
    this.emailSubject = data.emailSubject;
  }

  static fromFirestore(data: any, id: string): WeeklyContext {
    return new WeeklyContext({
      id,
      weekNumber: data.weekNumber,
      year: data.year,
      month: data.month,
      content: data.content,
      source: data.source,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
      emailSubject: data.emailSubject,
    });
  }

  toDictionary(): Record<string, any> {
    return {
      weekNumber: this.weekNumber,
      year: this.year,
      month: this.month,
      content: this.content,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...(this.emailSubject && { emailSubject: this.emailSubject }),
    };
  }

  // Get week label (e.g., "Week 1 of January 2025")
  getWeekLabel(): string {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const weekInMonth = Math.ceil((this.weekNumber - this.getFirstWeekOfMonth()) + 1);
    return `Week ${weekInMonth} of ${monthNames[this.month - 1]} ${this.year}`;
  }

  // Helper to get the first week number of the month
  private getFirstWeekOfMonth(): number {
    const firstDay = new Date(this.year, this.month - 1, 1);
    return this.getWeekNumber(firstDay);
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
}

export class DraftReview {
  id: string;
  monthYear: string;
  reviewType: 'month' | 'quarter';
  title: string;
  subtitle?: string;
  description: string;
  featuredHighlights: ReviewHighlight[];
  metrics: ReviewMetric[];
  metricsNote?: string;
  businessHighlights: ReviewHighlight[];
  productHighlights: ReviewHighlight[];
  lookingAhead?: string[];
  status: 'draft' | 'ready' | 'published';
  weeklyContextIds: string[];
  generatedAt: Date;
  publishedAt?: Date;
  publishedReviewId?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: DraftReviewData) {
    this.id = data.id;
    this.monthYear = data.monthYear;
    this.reviewType = data.reviewType || 'month';
    this.title = data.title;
    this.subtitle = data.subtitle;
    this.description = data.description;
    this.featuredHighlights = data.featuredHighlights || [];
    this.metrics = data.metrics || [];
    this.metricsNote = data.metricsNote;
    this.businessHighlights = data.businessHighlights || [];
    this.productHighlights = data.productHighlights || [];
    this.lookingAhead = data.lookingAhead;
    this.status = data.status;
    this.weeklyContextIds = data.weeklyContextIds;
    this.generatedAt = data.generatedAt instanceof Date ? data.generatedAt : new Date(data.generatedAt);
    this.publishedAt = data.publishedAt ? (data.publishedAt instanceof Date ? data.publishedAt : new Date(data.publishedAt)) : undefined;
    this.publishedReviewId = data.publishedReviewId;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  static fromFirestore(data: any, id: string): DraftReview {
    return new DraftReview({
      id,
      monthYear: data.monthYear,
      reviewType: data.reviewType || 'month',
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      featuredHighlights: data.featuredHighlights || [],
      metrics: data.metrics || [],
      metricsNote: data.metricsNote,
      businessHighlights: data.businessHighlights || [],
      productHighlights: data.productHighlights || [],
      lookingAhead: data.lookingAhead,
      status: data.status,
      weeklyContextIds: data.weeklyContextIds || [],
      generatedAt: data.generatedAt?.toDate ? data.generatedAt.toDate() : new Date(data.generatedAt),
      publishedAt: data.publishedAt?.toDate ? data.publishedAt.toDate() : (data.publishedAt ? new Date(data.publishedAt) : undefined),
      publishedReviewId: data.publishedReviewId,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
    });
  }

  toDictionary(): Record<string, any> {
    const dict: Record<string, any> = {
      monthYear: this.monthYear,
      reviewType: this.reviewType,
      title: this.title,
      subtitle: this.subtitle,
      description: this.description,
      featuredHighlights: this.featuredHighlights,
      metrics: this.metrics,
      businessHighlights: this.businessHighlights,
      productHighlights: this.productHighlights,
      lookingAhead: this.lookingAhead || [],
      status: this.status,
      weeklyContextIds: this.weeklyContextIds || [],
      generatedAt: this.generatedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    
    // Only include metricsNote if it has a value (Firestore doesn't accept undefined)
    if (this.metricsNote !== undefined && this.metricsNote !== null) {
      dict.metricsNote = this.metricsNote;
    }
    
    if (this.publishedAt) {
      dict.publishedAt = this.publishedAt;
    }
    
    if (this.publishedReviewId) {
      dict.publishedReviewId = this.publishedReviewId;
    }
    
    return dict;
  }

  // Get month/year label (e.g., "January 2025")
  getMonthYearLabel(): string {
    const [year, month] = this.monthYear.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }

  // Get subtitle for display (e.g., "DECEMBER 2025")
  getDisplaySubtitle(): string {
    if (this.subtitle) return this.subtitle;
    const [year, month] = this.monthYear.split('-');
    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  }
}

// Helper functions

// Get week number of the year (1-52)
export const getCurrentWeekOfYear = (): number => {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

// Get week number of the current month (1-5)
export const getCurrentWeekOfMonth = (): number => {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayOfMonth = now.getDate();
  const firstDayWeekday = firstDayOfMonth.getDay(); // 0 = Sunday
  return Math.ceil((dayOfMonth + firstDayWeekday) / 7);
};

// Get current month name
export const getCurrentMonthName = (): string => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames[new Date().getMonth()];
};

// Legacy alias for backward compatibility
export const getCurrentWeekNumber = getCurrentWeekOfYear;

export const getCurrentMonthYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getMonthYearFromDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

