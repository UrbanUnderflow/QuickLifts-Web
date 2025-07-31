import { convertFirestoreTimestamp, dateToUnixTimestamp } from '../../../utils/formatDate';
import { Exercise } from '../exercise/types';
import { Challenge, SweatlistCollection } from '../workout/types';

// Programming Chat Message Interface
export interface ProgrammingChatMessage {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  timestamp: Date;
  
  // Programming-specific fields
  thinking?: string;
  isAwaitingConfirmation?: boolean;
  suggestedName?: string;
  suggestedDescription?: string;
  suggestedStartDate?: string;
  suggestedEndDate?: string;
  configuredRestDays?: string[];
  shouldEnableRestDays?: boolean;
  shouldAnimateName?: boolean;
  shouldAnimateDescription?: boolean;
  readyToGenerate?: boolean;
  finalPrompt?: string;
}

// Rest Day Configuration
export interface RestDayConfiguration {
  includeRestDays: boolean;
  restDays: string[]; // e.g. ["Monday", "Tuesday"]
  preferences: string[]; // For AI prompts, e.g. ["Schedule rest days on Monday..."]
}

// Equipment Configuration
export interface EquipmentConfiguration {
  selectedEquipment: string[];
  equipmentOnly: boolean;
}

// Challenge Type Configuration
export type ChallengeType = 'workout' | 'steps' | 'calories' | 'hybrid';

export interface StepConfiguration {
  dailyStepGoal: number;
  allowedMissedDays: number;
}

export interface MealTrackingConfiguration {
  isEnabled: boolean;
  configurationType: 'mealPlan' | 'customMacros';
  pointsPerDay: number;
  tolerancePercentage: number;
  linkedMealPlanId?: string;
  mealPlanName?: string;
  customMacroRanges?: {
    calorieRange: { min: number; max: number };
    proteinRange: { min: number; max: number };
    carbRange: { min: number; max: number };
    fatRange: { min: number; max: number };
  };
}

// Challenge Data Structure (matches the existing ChallengeData interface)
export interface ProgrammingChallengeData {
  startDate: Date;
  endDate: Date;
  challengeName: string;
  challengeDesc: string;
  roundType: 'together' | 'locked';
  pinCode: string;
  restDayPreferences?: RestDayConfiguration;
  equipmentPreferences?: EquipmentConfiguration;
  challengeType?: ChallengeType;
  stepConfiguration?: StepConfiguration;
  mealTracking?: MealTrackingConfiguration;
}

// AI Settings
export interface ProgrammingAISettings {
  selectedCreators: string[];
  mustIncludeMoves: Exercise[];
  restDayPreferences?: RestDayConfiguration;
  equipmentPreferences?: EquipmentConfiguration;
  useOnlyCreatorExercises: boolean;
}

// Generation State
export interface GenerationState {
  isGenerating: boolean;
  currentPrompt?: string;
  generationStage?: string;
  startTime?: Date;
  aiConfig?: any;
}

// UI State
export interface ProgrammingUIState {
  isStacksOverviewCollapsed: boolean;
  activeTab: string;
  selectedExistingChallenge?: Challenge;
  isAIMode: boolean;
}

// Note: WorkoutWithRoundId is defined in programming.tsx as a class extending Workout
// We'll import it from there when needed

// Main Programming Conversation Class
export class ProgrammingConversation {
  id: string;
  userId: string;
  title: string;
  messages: ProgrammingChatMessage[];
  summary?: string;
  tags: string[];
  
  // Programming-specific fields
  challengeData: ProgrammingChallengeData;
  selectedStacks: any[]; // WorkoutWithRoundId[] defined in programming.tsx
  aiSettings: ProgrammingAISettings;
  
  // Generation state
  generationState?: GenerationState;
  readyToGenerate?: boolean; // Indicates if the conversation is ready for program generation
  
  // UI state
  uiState?: ProgrammingUIState;
  
  sessionDuration: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: any) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.title = data.title || 'New Programming Session';
    this.summary = data.summary;
    this.tags = data.tags || [];
    this.sessionDuration = data.sessionDuration || 0;

    // Parse messages
    this.messages = (data.messages || []).map((msgData: any) => ({
      id: msgData.id || '',
      role: msgData.role || 'user',
      message: msgData.message || '',
      timestamp: convertFirestoreTimestamp(msgData.timestamp),
      isAwaitingConfirmation: msgData.isAwaitingConfirmation,
      suggestedName: msgData.suggestedName,
      suggestedDescription: msgData.suggestedDescription,
      suggestedStartDate: msgData.suggestedStartDate,
      suggestedEndDate: msgData.suggestedEndDate,
      configuredRestDays: msgData.configuredRestDays,
      shouldEnableRestDays: msgData.shouldEnableRestDays,
      shouldAnimateName: msgData.shouldAnimateName,
      shouldAnimateDescription: msgData.shouldAnimateDescription,
      readyToGenerate: msgData.readyToGenerate,
      finalPrompt: msgData.finalPrompt
    }));

    // Parse challenge data with proper date fallbacks
    const fallbackStartDate = new Date();
    const fallbackEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    this.challengeData = {
      startDate: convertFirestoreTimestamp(data.challengeData?.startDate) || fallbackStartDate,
      endDate: convertFirestoreTimestamp(data.challengeData?.endDate) || fallbackEndDate,
      challengeName: data.challengeData?.challengeName || '',
      challengeDesc: data.challengeData?.challengeDesc || '',
      roundType: data.challengeData?.roundType || 'together',
      pinCode: data.challengeData?.pinCode || '',
      restDayPreferences: data.challengeData?.restDayPreferences,
      equipmentPreferences: data.challengeData?.equipmentPreferences,
      challengeType: data.challengeData?.challengeType || 'workout',
      stepConfiguration: data.challengeData?.stepConfiguration,
      mealTracking: data.challengeData?.mealTracking
    };

    // Parse selected stacks
    this.selectedStacks = data.selectedStacks || [];

    // Parse AI settings
    this.aiSettings = {
      selectedCreators: data.aiSettings?.selectedCreators || [],
      mustIncludeMoves: data.aiSettings?.mustIncludeMoves || [],
      restDayPreferences: data.aiSettings?.restDayPreferences,
      equipmentPreferences: data.aiSettings?.equipmentPreferences,
      useOnlyCreatorExercises: data.aiSettings?.useOnlyCreatorExercises || false
    };

    // Parse generation state
    if (data.generationState) {
      this.generationState = {
        isGenerating: data.generationState.isGenerating || false,
        currentPrompt: data.generationState.currentPrompt,
        generationStage: data.generationState.generationStage,
        startTime: convertFirestoreTimestamp(data.generationState.startTime),
        aiConfig: data.generationState.aiConfig
      };
    }
    
    // Parse readyToGenerate field
    this.readyToGenerate = data.readyToGenerate;

    // Parse UI state
    if (data.uiState) {
      this.uiState = {
        isStacksOverviewCollapsed: data.uiState.isStacksOverviewCollapsed || false,
        activeTab: data.uiState.activeTab || 'creators',
        selectedExistingChallenge: data.uiState.selectedExistingChallenge,
        isAIMode: data.uiState.isAIMode !== false // Default to true
      };
    }

    // Handle dates
    this.createdAt = convertFirestoreTimestamp(data.createdAt) || new Date();
    this.updatedAt = convertFirestoreTimestamp(data.updatedAt) || new Date();
  }

  toDictionary(): { [key: string]: any } {
    // Convert messages to dictionary format
    const messagesData = this.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      message: msg.message,
      timestamp: dateToUnixTimestamp(msg.timestamp),
      isAwaitingConfirmation: msg.isAwaitingConfirmation,
      suggestedName: msg.suggestedName,
      suggestedDescription: msg.suggestedDescription,
      suggestedStartDate: msg.suggestedStartDate,
      suggestedEndDate: msg.suggestedEndDate,
      configuredRestDays: msg.configuredRestDays,
      shouldEnableRestDays: msg.shouldEnableRestDays,
      shouldAnimateName: msg.shouldAnimateName,
      shouldAnimateDescription: msg.shouldAnimateDescription,
      readyToGenerate: msg.readyToGenerate,
      finalPrompt: msg.finalPrompt
    }));

    // Convert challenge data
    const challengeDataDict = {
      startDate: dateToUnixTimestamp(this.challengeData.startDate),
      endDate: dateToUnixTimestamp(this.challengeData.endDate),
      challengeName: this.challengeData.challengeName,
      challengeDesc: this.challengeData.challengeDesc,
      roundType: this.challengeData.roundType,
      pinCode: this.challengeData.pinCode,
      restDayPreferences: this.challengeData.restDayPreferences,
      equipmentPreferences: this.challengeData.equipmentPreferences,
      challengeType: this.challengeData.challengeType,
      stepConfiguration: this.challengeData.stepConfiguration,
      mealTracking: this.challengeData.mealTracking
    };

    let dict: { [key: string]: any } = {
      userId: this.userId,
      title: this.title,
      messages: messagesData,
      tags: this.tags,
      challengeData: challengeDataDict,
      selectedStacks: this.selectedStacks,
      aiSettings: this.aiSettings,
      sessionDuration: this.sessionDuration,
      createdAt: dateToUnixTimestamp(this.createdAt),
      updatedAt: dateToUnixTimestamp(this.updatedAt)
    };

    if (this.summary) {
      dict.summary = this.summary;
    }

    if (this.generationState) {
      dict.generationState = {
        isGenerating: this.generationState.isGenerating,
        currentPrompt: this.generationState.currentPrompt,
        generationStage: this.generationState.generationStage,
        startTime: this.generationState.startTime ? dateToUnixTimestamp(this.generationState.startTime) : null,
        aiConfig: this.generationState.aiConfig
      };
    }

    if (this.readyToGenerate !== undefined) {
      dict.readyToGenerate = this.readyToGenerate;
    }

    if (this.uiState) {
      dict.uiState = this.uiState;
    }

    return dict;
  }

  // Helper method to add a message
  addMessage(message: ProgrammingChatMessage): void {
    this.messages.push(message);
    this.updatedAt = new Date();
  }

  // Helper method to update challenge data
  updateChallengeData(data: Partial<ProgrammingChallengeData>): void {
    this.challengeData = { ...this.challengeData, ...data };
    this.updatedAt = new Date();
  }

  // Helper method to update AI settings
  updateAISettings(settings: Partial<ProgrammingAISettings>): void {
    this.aiSettings = { ...this.aiSettings, ...settings };
    this.updatedAt = new Date();
  }

  // Helper method to update selected stacks
  updateSelectedStacks(stacks: any[]): void { // WorkoutWithRoundId[] defined in programming.tsx
    this.selectedStacks = stacks;
    this.updatedAt = new Date();
  }
} 