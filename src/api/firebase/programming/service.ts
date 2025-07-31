import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  setDoc,
  deleteDoc,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';

import { db } from '../config';
import { 
  ProgrammingConversation, 
  ProgrammingChatMessage,
  ProgrammingChallengeData,
  ProgrammingAISettings,
  GenerationState,
  ProgrammingUIState
} from './types';
import { generateId } from '../../../utils/generateId';

interface FirestoreError {
  code: string;
  message: string;
}

class ProgrammingConversationService {
  private readonly collectionName = 'programming-conversations';

  /**
   * Recursively removes undefined values from an object
   * Firestore doesn't support undefined values, so we clean them out
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Creates a new programming conversation
   */
  async createConversation(
    userId: string, 
    initialData?: Partial<ProgrammingConversation>
  ): Promise<string> {
    try {
      const conversationId = generateId();
      
      // Generate smart title based on existing conversations and challenge name
      const challengeName = initialData?.challengeData?.challengeName;
      const smartTitle = await this.generateSmartTitle(userId, challengeName);
      
      // Default conversation data
      const defaultData: Partial<ProgrammingConversation> = {
        id: conversationId,
        userId: userId,
        title: smartTitle, // Use smart title instead of hardcoded
        messages: [],
        tags: [],
        challengeData: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          challengeName: '',
          challengeDesc: '',
          roundType: 'together',
          pinCode: '',
          challengeType: 'workout'
        },
        selectedStacks: [],
        aiSettings: {
          selectedCreators: [],
          mustIncludeMoves: [],
          useOnlyCreatorExercises: false
        },
        uiState: {
          isStacksOverviewCollapsed: false,
          activeTab: 'creators',
          isAIMode: true
        },
        sessionDuration: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Merge with provided data and ensure proper serialization
      const conversationData = { ...defaultData, ...initialData };
      
      // Convert any Date objects in challengeData to proper format
      if (conversationData.challengeData) {
        if (conversationData.challengeData.startDate instanceof Date) {
          (conversationData.challengeData as any).startDate = conversationData.challengeData.startDate.getTime() / 1000;
        }
        if (conversationData.challengeData.endDate instanceof Date) {
          (conversationData.challengeData as any).endDate = conversationData.challengeData.endDate.getTime() / 1000;
        }
      }
      
      const conversation = new ProgrammingConversation(conversationData);
      const dictionaryData = conversation.toDictionary();
      
      // Clean the data by removing undefined values (Firestore doesn't support undefined)
      const cleanedData = this.removeUndefinedValues(dictionaryData);
      
      const conversationRef = doc(db, this.collectionName, conversationId);
      await setDoc(conversationRef, cleanedData);

      console.log(`✅ Created conversation "${smartTitle}" with ID: ${conversationId}`);
      return conversationId;
    } catch (error) {
      console.error('❌ Error creating programming conversation:', error);
      throw error;
    }
  }

  /**
   * Fetches a programming conversation by ID
   */
  async fetchConversation(conversationId: string): Promise<ProgrammingConversation | null> {
    try {
      const conversationRef = doc(db, this.collectionName, conversationId);
      const conversationSnap = await getDoc(conversationRef);

      if (!conversationSnap.exists()) {
        console.warn(`Programming conversation not found: ${conversationId}`);
        return null;
      }

      const data = conversationSnap.data();
      return new ProgrammingConversation({ id: conversationSnap.id, ...data });
    } catch (error) {
      console.error('❌ Error fetching programming conversation:', error);
      throw error;
    }
  }

  /**
   * Fetches all conversations for a user
   */
  async fetchUserConversations(userId: string): Promise<ProgrammingConversation[]> {
    try {
      const conversationsRef = collection(db, this.collectionName);
      const q = query(
        conversationsRef,
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      const conversations: ProgrammingConversation[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        try {
          const conversation = new ProgrammingConversation({ id: doc.id, ...data });
          conversations.push(conversation);
        } catch (convError) {
          console.error('❌ Error processing conversation document:', doc.id, convError);
        }
      });

      return conversations;
    } catch (error) {
      console.error('❌ Error fetching user conversations:', error);
      throw error;
    }
  }

  /**
   * Updates a programming conversation
   */
  async updateConversation(
    conversationId: string, 
    updates: Partial<ProgrammingConversation>
  ): Promise<void> {
    try {
      const conversationRef = doc(db, this.collectionName, conversationId);
      
      // First fetch the existing conversation to preserve all existing fields
      const existingConversation = await this.fetchConversation(conversationId);
      if (!existingConversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      
      // Update conversation with new data
      
      // Safely merge existing data with updates to preserve fields like userId, createdAt, etc.
      const existingData = existingConversation.toDictionary();
      const mergedData = { ...existingData, ...updates };
      
      // Merge existing data with updates
      
      // Create a temporary conversation object with the merged data
      const tempConversation = new ProgrammingConversation({ id: conversationId, ...mergedData });
      const updateData = tempConversation.toDictionary();
      
      // Remove id from update data as it shouldn't be updated
      delete updateData.id;
      
      // Prepare final data for Firestore
      
      // Clean the data by removing undefined values (Firestore doesn't support undefined)
      const cleanedUpdateData = this.removeUndefinedValues(updateData);
      
      await updateDoc(conversationRef, cleanedUpdateData);
      // Conversation updated successfully
    } catch (error) {
      console.error('❌ Error updating programming conversation:', error);
      throw error;
    }
  }

  /**
   * Deletes a programming conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const conversationRef = doc(db, this.collectionName, conversationId);
      await deleteDoc(conversationRef);
      console.log(`✅ Deleted programming conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error deleting programming conversation:', error);
      throw error;
    }
  }

  /**
   * Adds a message to a conversation
   */
  async addMessage(
    conversationId: string, 
    message: ProgrammingChatMessage
  ): Promise<void> {
    try {
      // Fetch the current conversation
      const conversation = await this.fetchConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      // Add the message
      conversation.addMessage(message);

      // Update the conversation
      await this.updateConversation(conversationId, conversation);
      console.log(`✅ Added message to conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error adding message to conversation:', error);
      throw error;
    }
  }

  /**
   * Updates challenge data for a conversation
   */
  async updateChallengeData(
    conversationId: string, 
    challengeData: Partial<ProgrammingChallengeData>
  ): Promise<void> {
    try {
      const conversation = await this.fetchConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      conversation.updateChallengeData(challengeData);
      await this.updateConversation(conversationId, conversation);
      console.log(`✅ Updated challenge data for conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating challenge data:', error);
      throw error;
    }
  }

  /**
   * Updates the title of a conversation
   */
  async updateConversationTitle(
    conversationId: string, 
    newTitle: string
  ): Promise<void> {
    try {
      const conversationRef = doc(db, this.collectionName, conversationId);
      await updateDoc(conversationRef, {
        title: newTitle,
        updatedAt: new Date().getTime() / 1000
      });
      console.log(`✅ Updated conversation title: ${conversationId} -> "${newTitle}"`);
    } catch (error) {
      console.error('❌ Error updating conversation title:', error);
      throw error;
    }
  }

  /**
   * Generates a smart title for new conversations based on existing ones
   */
  async generateSmartTitle(userId: string, challengeName?: string): Promise<string> {
    try {
      // If there's a challenge name, use it
      if (challengeName && challengeName.trim()) {
        return challengeName.trim();
      }

      // Otherwise, find the next available "New Programming Session" number
      const conversations = await this.fetchUserConversations(userId);
      const baseName = "New Programming Session";
      
      // Find all existing titles that match the pattern
      const existingNumbers: number[] = [];
      conversations.forEach(conv => {
        if (conv.title === baseName) {
          existingNumbers.push(1);
        } else if (conv.title.startsWith(baseName + " (") && conv.title.endsWith(")")) {
          const numberMatch = conv.title.match(/\((\d+)\)$/);
          if (numberMatch) {
            existingNumbers.push(parseInt(numberMatch[1], 10));
          }
        }
      });

      // If no existing conversations with this pattern, return base name
      if (existingNumbers.length === 0) {
        return baseName;
      }

      // Find the next available number
      existingNumbers.sort((a, b) => a - b);
      let nextNumber = 2;
      for (const num of existingNumbers) {
        if (num >= nextNumber) {
          nextNumber = num + 1;
        }
      }

      return `${baseName} (${nextNumber})`;
    } catch (error) {
      console.error('❌ Error generating smart title:', error);
      return "New Programming Session";
    }
  }

  /**
   * Updates AI settings for a conversation
   */
  async updateAISettings(
    conversationId: string, 
    aiSettings: Partial<ProgrammingAISettings>
  ): Promise<void> {
    try {
      const conversation = await this.fetchConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      conversation.updateAISettings(aiSettings);
      await this.updateConversation(conversationId, conversation);
      console.log(`✅ Updated AI settings for conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating AI settings:', error);
      throw error;
    }
  }

  /**
   * Updates selected stacks for a conversation
   */
  async updateSelectedStacks(
    conversationId: string, 
    stacks: any[] // WorkoutWithRoundId[] defined in programming.tsx
  ): Promise<void> {
    try {
      const conversation = await this.fetchConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      conversation.updateSelectedStacks(stacks);
      await this.updateConversation(conversationId, conversation);
      console.log(`✅ Updated selected stacks for conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating selected stacks:', error);
      throw error;
    }
  }

  /**
   * Updates generation state for a conversation
   */
  async updateGenerationState(
    conversationId: string, 
    generationState: Partial<GenerationState>
  ): Promise<void> {
    try {
      const conversationRef = doc(db, this.collectionName, conversationId);
      const updateData: any = {
        generationState: generationState,
        updatedAt: new Date().getTime() / 1000 // Unix timestamp
      };

      await updateDoc(conversationRef, updateData);
      console.log(`✅ Updated generation state for conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating generation state:', error);
      throw error;
    }
  }

  /**
   * Updates UI state for a conversation
   */
  async updateUIState(
    conversationId: string, 
    uiState: Partial<ProgrammingUIState>
  ): Promise<void> {
    try {
      const conversationRef = doc(db, this.collectionName, conversationId);
      const updateData: any = {
        uiState: uiState,
        updatedAt: new Date().getTime() / 1000 // Unix timestamp
      };

      await updateDoc(conversationRef, updateData);
      console.log(`✅ Updated UI state for conversation: ${conversationId}`);
    } catch (error) {
      console.error('❌ Error updating UI state:', error);
      throw error;
    }
  }

  /**
   * Auto-save function with debouncing capabilities
   */
  async autoSave(conversation: ProgrammingConversation): Promise<void> {
    try {
      await this.updateConversation(conversation.id, conversation);
      console.log(`💾 Auto-saved conversation: ${conversation.id}`);
    } catch (error) {
      console.error('❌ Error auto-saving conversation:', error);
      // Don't throw error for auto-save to avoid disrupting user experience
    }
  }

  /**
   * Gets the latest conversation for a user (most recently updated)
   */
  async getLatestUserConversation(userId: string): Promise<ProgrammingConversation | null> {
    try {
      const conversationsRef = collection(db, this.collectionName);
      const q = query(
        conversationsRef,
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return new ProgrammingConversation({ id: doc.id, ...data });
    } catch (error) {
      console.error('❌ Error fetching latest user conversation:', error);
      throw error;
    }
  }

  /**
   * Archives old conversations (sets them as archived, doesn't delete)
   */
  async archiveOldConversations(userId: string, daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffTimestamp = cutoffDate.getTime() / 1000;

      const conversationsRef = collection(db, this.collectionName);
      const q = query(
        conversationsRef,
        where('userId', '==', userId),
        where('updatedAt', '<', cutoffTimestamp)
      );

      const querySnapshot = await getDocs(q);
      const batch: Promise<void>[] = [];

      querySnapshot.forEach((doc) => {
        batch.push(updateDoc(doc.ref, { 
          tags: [...(doc.data().tags || []), 'archived'],
          updatedAt: new Date().getTime() / 1000
        }));
      });

      await Promise.all(batch);
      console.log(`✅ Archived ${batch.length} old conversations for user: ${userId}`);
    } catch (error) {
      console.error('❌ Error archiving old conversations:', error);
      throw error;
    }
  }

  /**
   * Debug method to inspect all conversations and their userId field structure
   */
  async debugConversations(): Promise<void> {
    try {
      console.log('🔧 Debug: Fetching ALL conversations to inspect structure...');
      const conversationsRef = collection(db, this.collectionName);
      const querySnapshot = await getDocs(conversationsRef);
      
      console.log(`🔧 Debug: Found ${querySnapshot.size} total conversations in collection`);
      
      if (querySnapshot.size === 0) {
        console.log('🔧 Debug: No conversations exist in the collection yet. This is normal for first-time users.');
        return;
      }
      
      let index = 0;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        index++;
        console.log(`🔧 Debug: Conversation ${index}:`, {
          id: doc.id,
          hasUserId: 'userId' in data,
          userId: data.userId || 'MISSING',
          title: data.title || 'No title',
          messageCount: data.messages?.length || 0,
          allFields: Object.keys(data)
        });
      });
    } catch (error) {
      console.error('❌ Debug: Error inspecting conversations:', error);
    }
  }

  /**
   * Migration helper: Add userId field to conversations that don't have it
   */
  async addUserIdToConversations(targetUserId: string): Promise<void> {
    try {
      console.log('🔧 Migration: Adding userId field to conversations without it...');
      const conversationsRef = collection(db, this.collectionName);
      const querySnapshot = await getDocs(conversationsRef);
      
      let updatedCount = 0;
      const batch: Promise<void>[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.userId) {
          console.log(`🔧 Migration: Adding userId to conversation ${doc.id}`);
          batch.push(updateDoc(doc.ref, { 
            userId: targetUserId,
            updatedAt: new Date().getTime() / 1000
          }));
          updatedCount++;
        }
      });
      
      if (batch.length > 0) {
        await Promise.all(batch);
        console.log(`✅ Migration: Added userId to ${updatedCount} conversations`);
      } else {
        console.log('✅ Migration: All conversations already have userId field');
      }
    } catch (error) {
      console.error('❌ Migration: Error adding userId to conversations:', error);
      throw error;
    }
  }
}

export const programmingConversationService = new ProgrammingConversationService(); 