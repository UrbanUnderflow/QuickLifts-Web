// Content model for Pulse Intelligence Labs education modules.
// Mirrors the readiness-assessment content pattern: typed data here, rendered by a delivery page.

export type AudienceId = 'parent' | 'coach' | 'athleticTrainer';
export type CourseFormat = 'self-paced' | 'live';

/** A "say this, not that" communication example — used heavily in parent content. */
export interface SayThisExample {
  avoid: string;
  say: string;
  why: string;
}

/** A single self-paced lesson. */
export interface Lesson {
  id: string;
  title: string;
  duration: string; // e.g. "7 min"
  bigIdea: string; // one-sentence takeaway shown up top
  body: string[]; // teaching paragraphs
  keyPoints?: string[];
  sayThis?: SayThisExample[];
  tryThis?: string; // a concrete practice/action for the parent
}

/** A group of lessons. */
export interface Module {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

/** An interactive scenario-lab item (reuses the assessment's choose-and-learn shape). */
export interface ScenarioLabItem {
  id: string;
  prompt: string;
  options: Array<{ label: string; feedback: string; best?: boolean }>;
}

/** A live-session agenda (for instructor-led courses). */
export interface LiveSession {
  id: string;
  title: string;
  duration: string;
  objectives: string[];
  agenda: Array<{ segment: string; detail: string }>;
}

/** A printable take-home guide section. */
export interface GuideSection {
  title: string;
  intro?: string;
  items: string[];
}

export interface Course {
  id: string;
  audience: AudienceId;
  format: CourseFormat;
  title: string;
  tagline: string;
  price: string;
  durationLabel: string; // e.g. "~45 min self-paced" or "2 live sessions"
  forWhom: string; // who this is for / the promise
  domains: string[]; // assessment domains this maps to (for routing from results)
  modules?: Module[]; // self-paced
  scenarioLab?: ScenarioLabItem[]; // self-paced
  sessions?: LiveSession[]; // live
  takeHomeGuide?: GuideSection[]; // either format
}
