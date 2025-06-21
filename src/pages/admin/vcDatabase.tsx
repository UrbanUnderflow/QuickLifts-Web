import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, doc, setDoc, getDocs, query, orderBy, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { GeminiService } from '../../api/firebase/gemini/service';
import { FirebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';
import { Building2, Mail, User, MapPin, Globe, DollarSign, Calendar, Users, Trophy, FileText, Upload, Eye, Loader2, RefreshCw, Edit3, Check, X, AlertTriangle } from 'lucide-react';

interface VCFormData {
  person: string;
  companies: string;
  urls: string;
  linkedin: string;
  continent: string;
  country: string;
  location: string; // NEW: More flexible location field
  addresses: string;
  email: string;
  description: string;
  stage: string;
  founder: string;
  numberOfExits: string;
  status: string;
  source: 'individual_form' | 'bulk_text' | 'bulk_image' | 'ai_research'; // NEW: Track data source
}

interface VCProspect extends VCFormData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  generatedEmail?: string;
  generatedEmailSubject?: string;
  generatedEmailDate?: Date;
}

const VCDatabasePage: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<VCFormData>({
    person: '',
    companies: '',
    urls: '',
    linkedin: '',
    continent: '',
    country: '',
    location: '',
    addresses: '',
    email: '',
    description: '',
    stage: '',
    founder: '',
    numberOfExits: '',
    status: 'new',
    source: 'individual_form'
  });

  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Bulk import state
  const [currentView, setCurrentView] = useState<'form' | 'bulk' | 'scheduled'>('form');
  const [spreadsheetData, setSpreadsheetData] = useState('');
  const [processingBulk, setProcessingBulk] = useState(false);
  const [previewData, setPreviewData] = useState<VCFormData[]>([]);
  const [savingBulk, setSavingBulk] = useState(false);
  
  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Data table state
  const [vcProspects, setVcProspects] = useState<VCProspect[]>([]);
  const [loadingProspects, setLoadingProspects] = useState(false);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  
  // Filter state
  const [selectedStageFilters, setSelectedStageFilters] = useState<string[]>([]);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [selectedSourceFilters, setSelectedSourceFilters] = useState<string[]>([]);

  // Duplicate detection state
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [bulkDuplicates, setBulkDuplicates] = useState<VCFormData[]>([]);

  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState<string>('');

  // Bulk input type state - NEW!
  const [bulkInputType, setBulkInputType] = useState<'text' | 'image' | 'prompt'>('text');

  // Email template state
  const [emailTemplate, setEmailTemplate] = useState<string>('');
  const [selectedProspectForEmail, setSelectedProspectForEmail] = useState<VCProspect | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<string>('');
  const [generatingEmailForProspect, setGeneratingEmailForProspect] = useState<string | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSubject, setEmailSubject] = useState<string>('');
  
  // Email template persistence state
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Email attachments state
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);

  // Email editing state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmailContent, setEditedEmailContent] = useState<string>('');
  const [editedEmailSubject, setEditedEmailSubject] = useState<string>('');
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Preview modal attachment state (separate from template attachments)
  const [previewEmailAttachments, setPreviewEmailAttachments] = useState<File[]>([]);
  const [previewAttachmentUrls, setPreviewAttachmentUrls] = useState<string[]>([]);

  // Stage research state
  const [researchingStages, setResearchingStages] = useState(false);
  const [stageResearchProgress, setStageResearchProgress] = useState({ current: 0, total: 0 });

  // Scheduled emails state
  interface ScheduledEmail {
    messageId: string;
    prospectId: string;
    prospectName: string;
    prospectEmail: string;
    subject: string;
    scheduledAt: Date;
    createdAt: Date;
    status: 'queued' | 'inProgress' | 'processed' | 'cancelled';
  }
  
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [loadingScheduledEmails, setLoadingScheduledEmails] = useState(false);
  const [cancellingEmail, setCancellingEmail] = useState<string | null>(null);

  // Storage service instance
  const storageService = new FirebaseStorageService();

  // Helper functions for multiselect filters
  const toggleStageFilter = (stage: string) => {
    setSelectedStageFilters(prev => 
      prev.includes(stage) 
        ? prev.filter(s => s !== stage)
        : [...prev, stage]
    );
  };

  const toggleStatusFilter = (status: string) => {
    setSelectedStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const toggleSourceFilter = (source: string) => {
    setSelectedSourceFilters(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const clearAllFilters = () => {
    setSelectedStageFilters([]);
    setSelectedStatusFilters([]);
    setSelectedSourceFilters([]);
  };

  // Handle email attachment upload
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        showToast(`File ${file.name} is too large. Maximum size is 10MB.`, 'error');
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        showToast(`File ${file.name} type not supported.`, 'error');
        return false;
      }
      return true;
    });

    setEmailAttachments(prev => [...prev, ...validFiles]);

    // Create preview URLs for images
    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setAttachmentUrls(prev => [...prev, url]);
      }
    });
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setEmailAttachments(prev => prev.filter((_, i) => i !== index));
    // Cleanup preview URLs
    const file = emailAttachments[index];
    if (file?.type.startsWith('image/')) {
      const urlIndex = emailAttachments.slice(0, index).filter(f => f.type.startsWith('image/')).length;
      if (attachmentUrls[urlIndex]) {
        URL.revokeObjectURL(attachmentUrls[urlIndex]);
        setAttachmentUrls(prev => prev.filter((_, i) => i !== urlIndex));
      }
    }
  };

  // Handle preview modal attachment upload
  const handlePreviewAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    const validFiles = files.filter(file => {
      if (file.size > maxFileSize) {
        showToast(`File ${file.name} is too large. Maximum size is 10MB.`, 'error');
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        showToast(`File ${file.name} type not supported.`, 'error');
        return false;
      }
      return true;
    });

    setPreviewEmailAttachments(prev => [...prev, ...validFiles]);

    // Create preview URLs for images
    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewAttachmentUrls(prev => [...prev, url]);
      }
    });
  };

  // Remove preview attachment
  const removePreviewAttachment = (index: number) => {
    setPreviewEmailAttachments(prev => prev.filter((_, i) => i !== index));
    // Cleanup preview URLs
    const file = previewEmailAttachments[index];
    if (file?.type.startsWith('image/')) {
      const urlIndex = previewEmailAttachments.slice(0, index).filter(f => f.type.startsWith('image/')).length;
      if (previewAttachmentUrls[urlIndex]) {
        URL.revokeObjectURL(previewAttachmentUrls[urlIndex]);
        setPreviewAttachmentUrls(prev => prev.filter((_, i) => i !== urlIndex));
      }
    }
  };

  // Clear all preview attachments
  const clearPreviewAttachments = () => {
    // Cleanup preview URLs
    previewAttachmentUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewEmailAttachments([]);
    setPreviewAttachmentUrls([]);
  };

  // Add scheduled email to local tracking
  const addScheduledEmail = (messageId: string, prospect: VCProspect, subject: string, scheduledAt: Date) => {
    const scheduledEmail: ScheduledEmail = {
      messageId,
      prospectId: prospect.id,
      prospectName: prospect.person,
      prospectEmail: prospect.email,
      subject,
      scheduledAt,
      createdAt: new Date(),
      status: 'queued'
    };
    
    setScheduledEmails(prev => [scheduledEmail, ...prev]);
    
    // Also save to localStorage for persistence
    const stored = localStorage.getItem('scheduledEmails') || '[]';
    const existingEmails = JSON.parse(stored);
    const updatedEmails = [scheduledEmail, ...existingEmails];
    localStorage.setItem('scheduledEmails', JSON.stringify(updatedEmails));
  };

  // Load scheduled emails from localStorage
  const loadScheduledEmails = () => {
    try {
      const stored = localStorage.getItem('scheduledEmails') || '[]';
      const emails = JSON.parse(stored).map((email: any) => ({
        ...email,
        scheduledAt: new Date(email.scheduledAt),
        createdAt: new Date(email.createdAt)
      }));
      
      // Filter out old emails (older than 24 hours)
      const now = new Date();
      const recentEmails = emails.filter((email: ScheduledEmail) => {
        const hoursSinceCreated = (now.getTime() - email.createdAt.getTime()) / (1000 * 60 * 60);
        return hoursSinceCreated < 24;
      });
      
      setScheduledEmails(recentEmails);
      
      // Save filtered list back to localStorage
      localStorage.setItem('scheduledEmails', JSON.stringify(recentEmails));
    } catch (error) {
      console.error('Error loading scheduled emails:', error);
    }
  };

  // Cancel scheduled email
  const cancelScheduledEmail = async (messageId: string) => {
    setCancellingEmail(messageId);
    try {
      const response = await fetch(`/api/cancel-scheduled-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel email');
      }

      // Update local state
      setScheduledEmails(prev => prev.map(email => 
        email.messageId === messageId 
          ? { ...email, status: 'cancelled' as const }
          : email
      ));

      // Update localStorage
      const stored = localStorage.getItem('scheduledEmails') || '[]';
      const emails = JSON.parse(stored);
      const updatedEmails = emails.map((email: any) => 
        email.messageId === messageId 
          ? { ...email, status: 'cancelled' }
          : email
      );
      localStorage.setItem('scheduledEmails', JSON.stringify(updatedEmails));

      showToast('Email cancelled successfully', 'success');
    } catch (error) {
      console.error('Error cancelling email:', error);
      showToast(error instanceof Error ? error.message : 'Failed to cancel email', 'error');
    } finally {
      setCancellingEmail(null);
    }
  };

  // Check status of scheduled emails
  const refreshScheduledEmailsStatus = async () => {
    setLoadingScheduledEmails(true);
    try {
      const activeEmails = scheduledEmails.filter(email => 
        email.status === 'queued' || email.status === 'inProgress'
      );

      for (const email of activeEmails) {
        try {
          const response = await fetch(`/api/check-email-status`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messageId: email.messageId }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.status && result.status !== email.status) {
              // Update status if changed
              setScheduledEmails(prev => prev.map(e => 
                e.messageId === email.messageId 
                  ? { ...e, status: result.status }
                  : e
              ));
            }
          }
        } catch (error) {
          console.error(`Error checking status for ${email.messageId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error refreshing email statuses:', error);
    } finally {
      setLoadingScheduledEmails(false);
    }
  };

  // Preview existing generated email
  const previewExistingEmail = (prospect: VCProspect) => {
    if (!prospect.generatedEmail || !prospect.generatedEmailSubject) {
      showToast('No generated email found for this prospect', 'error');
      return;
    }

    setGeneratedEmail(prospect.generatedEmail);
    setEmailSubject(prospect.generatedEmailSubject);
    setEditedEmailContent(prospect.generatedEmail);
    setEditedEmailSubject(prospect.generatedEmailSubject);
    setSelectedProspectForEmail(prospect);
    setShowEmailPreview(true);
    setIsEditingEmail(false); // Start in view mode
    
    // Clear any existing preview attachments
    clearPreviewAttachments();
  };

  // Toggle email edit mode
  const toggleEmailEditMode = () => {
    if (!isEditingEmail) {
      // Entering edit mode - sync edited content with current content
      setEditedEmailContent(generatedEmail);
      setEditedEmailSubject(emailSubject);
    }
    setIsEditingEmail(!isEditingEmail);
  };

  // Cancel email editing
  const cancelEmailEditing = () => {
    setEditedEmailContent(generatedEmail);
    setEditedEmailSubject(emailSubject);
    setIsEditingEmail(false);
  };

  // Update email with edits
  const updateEmailWithEdits = async () => {
    if (!selectedProspectForEmail || !editedEmailContent.trim() || !editedEmailSubject.trim()) {
      showToast('Please provide both subject and email content', 'error');
      return;
    }

    setUpdatingEmail(true);
    try {
      // Update in Firebase
      const prospectRef = doc(db, 'venture-prospects', selectedProspectForEmail.id);
      await updateDoc(prospectRef, {
        generatedEmail: editedEmailContent.trim(),
        generatedEmailSubject: editedEmailSubject.trim(),
        generatedEmailDate: new Date(), // Update the generation date to reflect edit time
        updatedAt: new Date()
      });

      // Update local state
      setVcProspects(prev => prev.map(p => 
        p.id === selectedProspectForEmail.id 
          ? { 
              ...p, 
              generatedEmail: editedEmailContent.trim(),
              generatedEmailSubject: editedEmailSubject.trim(),
              generatedEmailDate: new Date(),
              updatedAt: new Date()
            }
          : p
      ));

      // Update preview state
      setGeneratedEmail(editedEmailContent.trim());
      setEmailSubject(editedEmailSubject.trim());
      
      // Exit edit mode
      setIsEditingEmail(false);
      
      showToast('Email updated successfully!', 'success');
      console.log('✅ Email edits saved to prospect record');
      
    } catch (error) {
      console.error('Error updating email:', error);
      showToast(error instanceof Error ? error.message : 'Failed to update email', 'error');
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Save email template to Firebase
  const saveEmailTemplate = async () => {
    if (!emailTemplate.trim()) {
      showToast('Please enter an email template first', 'error');
      return;
    }

    setSavingTemplate(true);
    try {
      const response = await fetch('/api/save-admin-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailTemplate: emailTemplate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save template');
      }

      showToast('Email template saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving email template:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save template', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Load email template from Firebase
  const loadEmailTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const response = await fetch('/api/load-admin-settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const result = await response.json();
      if (result.success && result.settings.emailTemplate) {
        setEmailTemplate(result.settings.emailTemplate);
        showToast('Email template loaded successfully!', 'success');
      }
    } catch (error) {
      console.error('Error loading email template:', error);
      showToast('Failed to load saved template', 'error');
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Research stages for prospects with missing stage data
  const researchMissingStages = async () => {
    const prospectsWithoutStage = vcProspects.filter(p => !p.stage || p.stage.trim() === '');
    
    if (prospectsWithoutStage.length === 0) {
      showToast('No prospects found without stage information', 'error');
      return;
    }

    const confirmMessage = `Research investment stages for ${prospectsWithoutStage.length} prospects without stage data? This will use AI to determine their investment focus.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setResearchingStages(true);
    setStageResearchProgress({ current: 0, total: prospectsWithoutStage.length });

    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < prospectsWithoutStage.length; i++) {
        const prospect = prospectsWithoutStage[i];
        setStageResearchProgress({ current: i + 1, total: prospectsWithoutStage.length });

        try {
          // Research this prospect using our AI service
          const researchPrompt = `Research the investment stage focus of this VC firm: ${prospect.companies}. 
          
          Additional context:
          - Person: ${prospect.person || 'Unknown'}
          - Website: ${prospect.urls || 'Unknown'}
          - LinkedIn: ${prospect.linkedin || 'Unknown'}
          - Description: ${prospect.description || 'Unknown'}
          
          Determine what investment stages they typically focus on (Pre-Seed, Seed, Series A, Series B, Series C, Series D+, Growth, Late Stage, Multi-Stage) and return only the stage names, comma-separated.`;

          const response = await fetch('/api/extract-vc-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              inputType: 'prompt',
              prompt: researchPrompt,
              singleProspectResearch: true // Flag to indicate this is for stage research only
            }),
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const result = await response.json();
          
          // Extract stage information from the response
          let determinedStage = '';
          if (result.success && result.stageResearch) {
            determinedStage = result.stageResearch;
          } else if (result.success && result.prospects && result.prospects.length > 0) {
            determinedStage = result.prospects[0].stage || '';
          }

          // Update the prospect in Firebase if we found stage information
          if (determinedStage && determinedStage.trim() !== '') {
            const prospectRef = doc(db, 'venture-prospects', prospect.id);
            await updateDoc(prospectRef, {
              stage: determinedStage.trim(),
              updatedAt: new Date()
            });

            // Update local state
            setVcProspects(prev => prev.map(p => 
              p.id === prospect.id 
                ? { ...p, stage: determinedStage.trim(), updatedAt: new Date() }
                : p
            ));

            successCount++;
            console.log(`✅ Updated stage for ${prospect.person} (${prospect.companies}): ${determinedStage}`);
          } else {
            console.log(`⚠️ No stage determined for ${prospect.person} (${prospect.companies})`);
            errorCount++;
          }

        } catch (error) {
          console.error(`❌ Error researching ${prospect.person} (${prospect.companies}):`, error);
          errorCount++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      showToast(
        `Stage research completed! ${successCount} updated successfully, ${errorCount} failed.`,
        successCount > errorCount ? 'success' : 'error'
      );

    } catch (error) {
      console.error('Error during bulk stage research:', error);
      showToast('Failed to complete stage research', 'error');
    } finally {
      setResearchingStages(false);
      setStageResearchProgress({ current: 0, total: 0 });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear duplicate warning when form changes
    setDuplicateWarning(null);
  };

  // Handle image file selection
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validImages = files.filter(file => file.type.startsWith('image/'));
    
    if (validImages.length !== files.length) {
      showToast('Some files were not images and were excluded', 'error');
    }
    
    setUploadedImages(prev => [...prev, ...validImages]);
    
    // Create preview URLs
    validImages.forEach(file => {
      const url = URL.createObjectURL(file);
      setImagePreviewUrls(prev => [...prev, url]);
    });
  };

  // Remove uploaded image
  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviewUrls(prev => {
      // Cleanup the old URL
      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Upload image to Firebase Storage and return URL
  const uploadImageToStorage = async (file: File): Promise<string> => {
    try {
      const result = await storageService.uploadImage(file, UploadImageType.Feedback);
      return result.downloadURL;
    } catch (error) {
      console.error('Error uploading image to storage:', error);
      throw new Error(`Failed to upload image: ${file.name}`);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // Check if a prospect is a duplicate based on person, companies, and email
  const isDuplicate = (prospect: VCFormData): boolean => {
    return vcProspects.some(existing => {
      // Safely compare person field
      const personMatch = existing.person && prospect.person && 
        existing.person.toLowerCase().trim() === prospect.person.toLowerCase().trim();
      
      // Safely compare companies field
      const companiesMatch = existing.companies && prospect.companies && 
        existing.companies.toLowerCase().trim() === prospect.companies.toLowerCase().trim();
      
      // Safely compare email field
      const emailMatch = existing.email && prospect.email && 
        existing.email.toLowerCase().trim() === prospect.email.toLowerCase().trim();
      
      // Consider it a duplicate if any two of the three fields match
      const matchCount = [personMatch, companiesMatch, emailMatch].filter(Boolean).length;
      return matchCount >= 2;
    });
  };

  // Find duplicate details for display
  const findDuplicateDetails = (prospect: VCFormData): VCProspect | null => {
    return vcProspects.find(existing => {
      // Safely compare person field
      const personMatch = existing.person && prospect.person && 
        existing.person.toLowerCase().trim() === prospect.person.toLowerCase().trim();
      
      // Safely compare companies field
      const companiesMatch = existing.companies && prospect.companies && 
        existing.companies.toLowerCase().trim() === prospect.companies.toLowerCase().trim();
      
      // Safely compare email field
      const emailMatch = existing.email && prospect.email && 
        existing.email.toLowerCase().trim() === prospect.email.toLowerCase().trim();
      
      const matchCount = [personMatch, companiesMatch, emailMatch].filter(Boolean).length;
      return matchCount >= 2;
    }) || null;
  };

  // Fetch existing VC prospects
  const fetchVCProspects = async () => {
    setLoadingProspects(true);
    try {
      const ventureProspectsRef = collection(db, 'venture-prospects');
      const q = query(ventureProspectsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const prospects = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        generatedEmailDate: doc.data().generatedEmailDate?.toDate() || null,
      })) as VCProspect[];
      
      // Debug logging to see what data we're working with
      console.log('📊 Loaded VC Prospects:', prospects.length);
      console.log('🏷️ Sample prospect data:', prospects[0]);
      
      // Log unique stages and statuses found in data
      const uniqueStages = Array.from(new Set(prospects.map(p => p.stage).filter(Boolean)));
      const uniqueStatuses = Array.from(new Set(prospects.map(p => p.status).filter(Boolean)));
      const uniqueSources = Array.from(new Set(prospects.map(p => p.source).filter(Boolean)));
      console.log('🎭 Unique stages in data:', uniqueStages);
      console.log('📋 Unique statuses in data:', uniqueStatuses);
      console.log('🏷️ Unique sources in data:', uniqueSources);
      
      setVcProspects(prospects);
      // Clear any duplicate warnings when fresh data loads
      setDuplicateWarning(null);
    } catch (error) {
      console.error('Error fetching VC prospects:', error);
      showToast('Failed to fetch VC prospects', 'error');
    } finally {
      setLoadingProspects(false);
    }
  };

  // Update status for a specific prospect
  const updateProspectStatus = async (prospectId: string, newStatus: string) => {
    setUpdatingStatus(prospectId);
    try {
      const prospectRef = doc(db, 'venture-prospects', prospectId);
      await updateDoc(prospectRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setVcProspects(prev => prev.map(prospect => 
        prospect.id === prospectId 
          ? { ...prospect, status: newStatus, updatedAt: new Date() }
          : prospect
      ));
      
      showToast('Status updated successfully', 'success');
      setEditingStatus(null);
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Failed to update status', 'error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Process bulk data using OpenAI (text, image, or AI prompt)
  const processBulkData = async () => {
    // Validate input based on type
    if (bulkInputType === 'text' && !spreadsheetData.trim()) {
      showToast('Please provide text data to process', 'error');
      return;
    }
    
    if (bulkInputType === 'image' && uploadedImages.length === 0) {
      showToast('Please upload images to process', 'error');
      return;
    }

    if (bulkInputType === 'prompt' && !aiPrompt.trim()) {
      showToast('Please provide a research prompt', 'error');
      return;
    }

    setProcessingBulk(true);
    try {
      let requestData: any = {
        inputType: bulkInputType
      };

      if (bulkInputType === 'text') {
        requestData.data = spreadsheetData;
      } else if (bulkInputType === 'image') {
        // Upload images to Firebase Storage first
        const imageUrls = await Promise.all(
          uploadedImages.map(async (file) => {
            try {
              return await uploadImageToStorage(file);
            } catch (error) {
              console.error(`Failed to upload image ${file.name}:`, error);
              throw error;
            }
          })
        );
        
        console.log('🖼️ Uploaded Image URLs:', imageUrls);
        requestData.imageUrls = imageUrls;
      } else if (bulkInputType === 'prompt') {
        requestData.prompt = aiPrompt;
      }

      console.log('📤 Request Data Sent to OpenAI:', requestData);

      // Call our new OpenAI API endpoint
      const response = await fetch('/api/extract-vc-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract VC data');
      }

      const result = await response.json();
      console.log('🤖 OpenAI Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to process data');
      }

      const prospects = result.prospects || [];
      
      if (prospects.length === 0) {
        showToast('No VC prospect data found in the provided input', 'error');
        return;
      }

      // Add default status to all prospects
      const processedData = prospects.map((item: any) => ({
        ...item,
        status: 'new', // Default status
        source: bulkInputType === 'text' ? 'bulk_text' : 
                bulkInputType === 'image' ? 'bulk_image' : 'ai_research' // Set source based on input type
      }));
      
      console.log('⚙️ Processed Data (with default status):', processedData);

      // Filter out duplicates and track them
      const uniqueData: VCFormData[] = [];
      const duplicateData: VCFormData[] = [];

      processedData.forEach((prospect: VCFormData) => {
        if (isDuplicate(prospect)) {
          duplicateData.push(prospect);
        } else {
          uniqueData.push(prospect);
        }
      });
      
      console.log('✅ Unique Data (after duplicate filtering):', uniqueData);
      console.log('🔄 Duplicate Data (filtered out):', duplicateData);

      setPreviewData(uniqueData);
      setBulkDuplicates(duplicateData);
      
      if (duplicateData.length > 0) {
        showToast(`Processed ${uniqueData.length} unique prospects. ${duplicateData.length} duplicates excluded.`, 'success');
      } else {
        showToast(`Processed ${uniqueData.length} prospects`, 'success');
      }
      
    } catch (error) {
      console.error('Error processing bulk data:', error);
      showToast(error instanceof Error ? error.message : 'Failed to process data', 'error');
    } finally {
      setProcessingBulk(false);
    }
  };

  // Save bulk preview data to Firebase
  const saveBulkData = async () => {
    if (previewData.length === 0) {
      showToast('No data to save', 'error');
      return;
    }

    setSavingBulk(true);
    try {
      const ventureProspectsRef = collection(db, 'venture-prospects');
      const promises = previewData.map(async (prospect) => {
        const newDocRef = doc(ventureProspectsRef);
        const vcData = {
          ...prospect,
          createdAt: new Date(),
          updatedAt: new Date(),
          id: newDocRef.id
        };
        return setDoc(newDocRef, vcData);
      });

      await Promise.all(promises);
      
      showToast(`Successfully saved ${previewData.length} VC prospects`, 'success');
      setPreviewData([]);
      setSpreadsheetData('');
      setBulkDuplicates([]);
      // Clear images
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setUploadedImages([]);
      setImagePreviewUrls([]);
      setCurrentView('form');
      fetchVCProspects(); // Refresh the table
    } catch (error) {
      console.error('Error saving bulk data:', error);
      showToast('Failed to save bulk data', 'error');
    } finally {
      setSavingBulk(false);
    }
  };

  // Generate personalized email using AI with deep research
  const generateEmail = async (prospect: VCProspect) => {
    if (!emailTemplate.trim()) {
      showToast('Please provide an email template first', 'error');
      return;
    }

    setGeneratingEmailForProspect(prospect.id);
    try {
      // Step 1: Research the VC firm deeply
      console.log('🔍 Step 1: Researching VC firm for personalization...');
      
      const researchResponse = await fetch('/api/research-vc-firm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prospect: prospect
        }),
      });

      if (!researchResponse.ok) {
        throw new Error('Failed to research VC firm');
      }

      const researchResult = await researchResponse.json();
      console.log('📊 VC Research Results:', researchResult);

      // Step 2: Generate personalized email with research insights
      console.log('✍️ Step 2: Generating personalized email with research insights...');
      
      const emailResponse = await fetch('/api/generate-vc-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: emailTemplate,
          prospect: prospect,
          researchInsights: researchResult.insights // Pass the research data
        }),
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        throw new Error(errorData.error || 'Failed to generate email');
      }

      const result = await emailResponse.json();
      setGeneratedEmail(result.email);
      setEmailSubject(result.subject || `Partnership Opportunity with ${prospect.companies}`);
      setEditedEmailContent(result.email);
      setEditedEmailSubject(result.subject || `Partnership Opportunity with ${prospect.companies}`);
      setSelectedProspectForEmail(prospect);
      setShowEmailPreview(true);
      setIsEditingEmail(false); // Start in view mode
      
      // Clear any existing preview attachments
      clearPreviewAttachments();

      // Save generated email to the prospect in Firebase
      try {
        const prospectRef = doc(db, 'venture-prospects', prospect.id);
        await updateDoc(prospectRef, {
          generatedEmail: result.email,
          generatedEmailSubject: result.subject,
          generatedEmailDate: new Date(),
          updatedAt: new Date()
        });

        // Update local state
        setVcProspects(prev => prev.map(p => 
          p.id === prospect.id 
            ? { 
                ...p, 
                generatedEmail: result.email,
                generatedEmailSubject: result.subject,
                generatedEmailDate: new Date(),
                updatedAt: new Date()
              }
            : p
        ));

        console.log('✅ Generated email saved to prospect record');
      } catch (error) {
        console.error('Error saving generated email to prospect:', error);
        // Don't show error toast since email generation was successful
      }
      
      showToast('Personalized email generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating email:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate email', 'error');
    } finally {
      setGeneratingEmailForProspect(null);
    }
  };

  // Send email via Brevo with 5-minute delay
  const sendScheduledEmail = async () => {
    if (!selectedProspectForEmail || !generatedEmail || !emailSubject) {
      showToast('Missing email data', 'error');
      return;
    }

    setSendingEmail(true);
    try {
      // Upload attachments to Firebase Storage if any
      let attachments: Array<{url: string; filename: string; contentType: string}> = [];
      if (previewEmailAttachments.length > 0) {
        try {
          attachments = await Promise.all(
            previewEmailAttachments.map(async (file) => {
              const result = await storageService.uploadImage(file, UploadImageType.Feedback);
              return {
                url: result.downloadURL,
                filename: file.name,
                contentType: file.type
              };
            })
          );
          console.log('📎 Uploaded email attachments:', attachments);
        } catch (error) {
          console.error('Error uploading attachments:', error);
          showToast('Failed to upload attachments', 'error');
          setSendingEmail(false);
          return;
        }
      }

      const response = await fetch('/api/send-vc-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: {
            email: selectedProspectForEmail.email,
            name: selectedProspectForEmail.person
          },
          subject: emailSubject,
          htmlContent: generatedEmail,
          prospectId: selectedProspectForEmail.id,
          attachments: attachments // Include attachments
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      const result = await response.json();
      
      // Add to scheduled emails tracking
      if (result.messageId && result.scheduledFor) {
        const scheduledAt = new Date(result.scheduledFor);
        addScheduledEmail(result.messageId, selectedProspectForEmail, emailSubject, scheduledAt);
      }
      
      showToast(`Email scheduled successfully! Will be sent in 5 minutes.`, 'success');
      
      // Update prospect status to 'sent email'
      await updateProspectStatus(selectedProspectForEmail.id, 'sent email');
      
      // Close preview
      setShowEmailPreview(false);
      setSelectedProspectForEmail(null);
      setGeneratedEmail('');
      setEmailSubject('');
      
      // Clear preview attachments
      clearPreviewAttachments();
      
    } catch (error) {
      console.error('Error sending email:', error);
      showToast(error instanceof Error ? error.message : 'Failed to send email', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  // Filter prospects based on selected filters
  const filteredProspects = vcProspects.filter(prospect => {
    // Parse comma-separated stages (e.g., "Seed, Early Stage Venture" -> ["Seed", "Early Stage Venture"])
    const prospectStages = prospect.stage ? prospect.stage.split(',').map(s => s.trim()) : [];
    
    // Debug logging
    if (selectedStageFilters.length > 0 || selectedStatusFilters.length > 0 || selectedSourceFilters.length > 0) {
      console.log('🔍 Filtering prospect:', {
        person: prospect.person,
        rawStage: prospect.stage,
        parsedStages: prospectStages,
        status: prospect.status,
        selectedStageFilters,
        selectedStatusFilters,
        selectedSourceFilters
      });
    }
    
    // Check if any of the prospect's stages match any selected stage filter
    let stageMatch = selectedStageFilters.length === 0;
    
    if (selectedStageFilters.length > 0) {
      // Handle "No Stage" filter
      if (selectedStageFilters.includes('No Stage')) {
        const hasNoStage = !prospect.stage || prospect.stage.trim() === '';
        stageMatch = stageMatch || hasNoStage;
      }
      
      // Handle regular stage filters
      const regularStageFilters = selectedStageFilters.filter(s => s !== 'No Stage');
      if (regularStageFilters.length > 0 && prospectStages.length > 0) {
        const regularStageMatch = regularStageFilters.some(selectedStage => 
          prospectStages.some(prospectStage => 
            prospectStage.toLowerCase().includes(selectedStage.toLowerCase()) ||
            selectedStage.toLowerCase().includes(prospectStage.toLowerCase())
          )
        );
        stageMatch = stageMatch || regularStageMatch;
      }
    }
    
    // Check exact match for status
    const statusMatch = selectedStatusFilters.length === 0 || selectedStatusFilters.includes(prospect.status || '');
    
    // Check exact match for source
    const sourceMatch = selectedSourceFilters.length === 0 || selectedSourceFilters.includes(prospect.source || '');
    
    const matches = stageMatch && statusMatch && sourceMatch;
    
    if (selectedStageFilters.length > 0 || selectedStatusFilters.length > 0 || selectedSourceFilters.length > 0) {
      console.log('🎯 Match result:', { stageMatch, statusMatch, sourceMatch, matches });
    }
    
    return matches;
  });

  // Load data on component mount
  useEffect(() => {
    fetchVCProspects();
    loadEmailTemplate(); // Auto-load saved email template
    loadScheduledEmails(); // Load scheduled emails from localStorage
  }, []);

  // Cleanup image URLs on component unmount
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
      previewAttachmentUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls, previewAttachmentUrls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.person.trim() || !formData.companies.trim()) {
      showToast('Please fill in at least the Person and Companies fields', 'error');
      return;
    }

    // Check for duplicates
    if (isDuplicate(formData)) {
      const duplicate = findDuplicateDetails(formData);
      setDuplicateWarning(
        `Potential duplicate found: ${duplicate?.person} (${duplicate?.companies}) already exists. Please check the table below.`
      );
      return;
    }

    setLoading(true);
    setDuplicateWarning(null);

    try {
      // Create a new document with auto-generated ID
      const ventureProspectsRef = collection(db, 'venture-prospects');
      const newDocRef = doc(ventureProspectsRef);
      
      const vcData = {
        ...formData,
        createdAt: new Date(),
        updatedAt: new Date(),
        id: newDocRef.id
      };

      await setDoc(newDocRef, vcData);
      
      showToast('VC added successfully!', 'success');
      
      // Reset form
      setFormData({
        person: '',
        companies: '',
        urls: '',
        linkedin: '',
        continent: '',
        country: '',
        location: '',
        addresses: '',
        email: '',
        description: '',
        stage: '',
        founder: '',
        numberOfExits: '',
        status: 'new',
        source: 'individual_form'
      });
    } catch (error) {
      console.error('Error adding VC:', error);
      showToast('Failed to add VC. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const stageOptions = [
    'Pre-Seed',
    'Seed',
    'Series A',
    'Series B',
    'Series C',
    'Series D+',
    'Growth',
    'Late Stage',
    'Multi-Stage'
  ];

  const statusOptions = [
    'new',
    'sent email',
    'received response', 
    'had meeting',
    'needs follow up',
    'diligence',
    'not interested'
  ];

  const continentOptions = [
    'North America',
    'South America',
    'Europe',
    'Asia',
    'Africa',
    'Australia/Oceania'
  ];

  return (
    <AdminRouteGuard>
      <Head>
        <title>VC Database | Pulse Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold flex items-center">
              <span className="text-[#d7ff00] mr-2">
                <Building2 className="w-7 h-7" />
              </span>
              VC Database
            </h1>
            
            <button
              onClick={() => fetchVCProspects()}
              disabled={loadingProspects}
              className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
            >
              {loadingProspects ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
              {loadingProspects ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>

          {/* Segment Control */}
          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <div className="flex items-center justify-center mb-6">
              <div className="flex bg-[#262a30] rounded-lg p-1">
                <button
                  onClick={() => setCurrentView('form')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    currentView === 'form'
                      ? 'bg-[#d7ff00] text-black'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4 mr-2 inline" />
                  Add Individual VC
                </button>
                <button
                  onClick={() => setCurrentView('bulk')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    currentView === 'bulk'
                      ? 'bg-[#d7ff00] text-black'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4 mr-2 inline" />
                  Bulk Import
                </button>
                <button
                  onClick={() => setCurrentView('scheduled')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    currentView === 'scheduled'
                      ? 'bg-[#d7ff00] text-black'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4 mr-2 inline" />
                  Scheduled Emails
                  {scheduledEmails.filter(e => e.status === 'queued' || e.status === 'inProgress').length > 0 && (
                    <span className="ml-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                      {scheduledEmails.filter(e => e.status === 'queued' || e.status === 'inProgress').length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Individual Form View */}
          {currentView === 'form' && (
            <div className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden mb-6">
              {/* Top gradient border */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
              
              {/* Left gradient border */}
              <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-xl font-medium mb-6 text-white">Add New VC Prospect</h2>
              
              {/* Row 1: Person and Companies */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="person" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Person *
                  </label>
                  <input
                    type="text"
                    id="person"
                    name="person"
                    value={formData.person}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="Contact person name"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="companies" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Building2 className="w-4 h-4 mr-2" />
                    Companies *
                  </label>
                  <input
                    type="text"
                    id="companies"
                    name="companies"
                    value={formData.companies}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="VC firm names (comma separated)"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Email and LinkedIn */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="email" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="contact@vcfirm.com"
                  />
                </div>
                
                <div>
                  <label htmlFor="linkedin" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    LinkedIn
                  </label>
                  <input
                    type="url"
                    id="linkedin"
                    name="linkedin"
                    value={formData.linkedin}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>
              </div>

              {/* Row 3: URLs and Stage */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="urls" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    URLs
                  </label>
                  <input
                    type="text"
                    id="urls"
                    name="urls"
                    value={formData.urls}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="Website URLs (comma separated)"
                  />
                </div>
                
                <div>
                  <label htmlFor="stage" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Investment Stage
                  </label>
                  <select
                    id="stage"
                    name="stage"
                    value={formData.stage}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:border-[#d7ff00] focus:outline-none transition-colors"
                  >
                    <option value="">Select stage</option>
                    {stageOptions.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4: Continent and Country */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="continent" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Globe className="w-4 h-4 mr-2" />
                    Continent
                  </label>
                  <select
                    id="continent"
                    name="continent"
                    value={formData.continent}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:border-[#d7ff00] focus:outline-none transition-colors"
                  >
                    <option value="">Select continent</option>
                    {continentOptions.map(continent => (
                      <option key={continent} value={continent}>{continent}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="country" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    Country
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="United States"
                  />
                </div>
              </div>

              {/* Row 4.5: Location Field */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="location" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="City, State, Region, or any location info (e.g. San Francisco, CA or New York)"
                  />
                </div>
              </div>

              {/* Row 5: Founder and Number of Exits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="founder" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    Founder
                  </label>
                  <input
                    type="text"
                    id="founder"
                    name="founder"
                    value={formData.founder}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="Founder name"
                  />
                </div>
                
                <div>
                  <label htmlFor="numberOfExits" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <Trophy className="w-4 h-4 mr-2" />
                    Number of Exits
                  </label>
                  <input
                    type="number"
                    id="numberOfExits"
                    name="numberOfExits"
                    value={formData.numberOfExits}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Row 6: Addresses and Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="addresses" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <MapPin className="w-4 h-4 mr-2" />
                    Addresses
                  </label>
                  <input
                    type="text"
                    id="addresses"
                    name="addresses"
                    value={formData.addresses}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors"
                    placeholder="Office addresses"
                  />
                </div>
                
                <div>
                  <label htmlFor="status" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                    <FileText className="w-4 h-4 mr-2" />
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:border-[#d7ff00] focus:outline-none transition-colors"
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-gray-300 mb-2 text-sm font-medium flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors resize-vertical"
                  placeholder="Additional notes, investment focus, portfolio details, etc."
                />
              </div>

              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="p-3 bg-orange-900/30 text-orange-400 border border-orange-700 rounded-lg flex items-center">
                  <AlertTriangle size={20} className="mr-2 flex-shrink-0" />
                  {duplicateWarning}
                </div>
              )}

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-[#40c9ff] to-[#d7ff00] text-black font-medium py-3 px-8 rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                      Adding VC...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4 mr-2" />
                      Add VC Prospect
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bulk Import View */}
        {currentView === 'bulk' && (
          <div className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden mb-6">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            <div className="space-y-6">
              <h2 className="text-xl font-medium mb-6 text-white">Bulk Import VC Prospects</h2>
              
              {/* Segment Control for Input Type */}
              <div className="bg-[#262a30] p-1 rounded-lg inline-flex mb-6">
                <button
                  onClick={() => setBulkInputType('text')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    bulkInputType === 'text'
                      ? 'bg-[#d7ff00] text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  📄 Spreadsheet Text
                </button>
                <button
                  onClick={() => setBulkInputType('image')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    bulkInputType === 'image'
                      ? 'bg-[#d7ff00] text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🖼️ Image Upload
                </button>
                <button
                  onClick={() => setBulkInputType('prompt')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    bulkInputType === 'prompt'
                      ? 'bg-[#d7ff00] text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  🤖 AI Research
                </button>
              </div>

              {/* Conditional Input Based on Type */}
              {bulkInputType === 'text' ? (
                // Text Input Section
                <div className="space-y-4">
                  <div>
                    <label htmlFor="spreadsheetData" className="block text-gray-300 mb-2 text-sm font-medium">
                      Paste Spreadsheet Data
                    </label>
                    <textarea
                      id="spreadsheetData"
                      value={spreadsheetData}
                      onChange={(e) => setSpreadsheetData(e.target.value)}
                      rows={8}
                      className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors resize-vertical font-mono text-sm"
                      placeholder="Paste your VC prospect data here (CSV, tab-separated, or any structured text format)..."
                    />
                  </div>
                  <p className="text-gray-400 text-sm">
                    Paste data from spreadsheets, CSV files, or any structured text containing VC prospect information. OpenAI will intelligently parse the data structure.
                  </p>
                </div>
              ) : bulkInputType === 'image' ? (
                // Image Input Section  
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm font-medium">
                      Upload Images
                    </label>
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="bulk-image-upload"
                      />
                      <label htmlFor="bulk-image-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                        <p className="text-white mb-2">Click to upload images</p>
                        <p className="text-gray-400 text-sm">Screenshots of spreadsheets, tables, or VC prospect lists</p>
                      </label>
                    </div>
                  </div>

                  {/* Image Previews */}
                  {uploadedImages.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-300 mb-3">Uploaded Images ({uploadedImages.length})</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {uploadedImages.map((file, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={imagePreviewUrls[index]}
                              alt={`Upload ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-600"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 rounded-b-lg truncate">
                              {file.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-gray-400 text-sm">
                    Upload screenshots or photos of VC prospect data. GPT-4 Vision will extract information from spreadsheets, tables, or any structured lists.
                  </p>
                </div>
              ) : (
                // AI Prompt Input Section
                <div className="space-y-4">
                  <div>
                    <label htmlFor="aiPrompt" className="block text-gray-300 mb-2 text-sm font-medium">
                      AI Research Prompt
                    </label>
                    <textarea
                      id="aiPrompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors resize-vertical"
                      placeholder="Research this VC and get all the information I would need to reach out (all the fields)

Examples:
• Research Andreessen Horowitz and get contact info for partners
• Find information about Sequoia Capital team members and their focus areas  
• Get details on Bessemer Venture Partners healthcare investors
• Research early-stage VCs in NYC focusing on fintech"
                    />
                  </div>
                  
                  <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                    <h4 className="text-blue-300 font-medium mb-2 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      AI Research Capabilities
                    </h4>
                    <ul className="text-sm text-blue-200 space-y-1">
                      <li>• Research VC firms and individual partners</li>
                      <li>• Find contact information and investment focus</li>
                      <li>• Gather background and portfolio details</li>
                      <li>• Extract LinkedIn and website information</li>
                      <li>• Identify recent investments and exits</li>
                    </ul>
                  </div>

                  <p className="text-gray-400 text-sm">
                    Provide specific instructions for what VC information you need. AI will research and return structured prospect data matching all your required fields.
                  </p>
                </div>
              )}

              {/* Process Button */}
              <div className="flex justify-between items-center">
                <div className="flex gap-3">
                  <button
                    onClick={processBulkData}
                    disabled={processingBulk || (bulkInputType === 'text' && !spreadsheetData.trim()) || (bulkInputType === 'image' && uploadedImages.length === 0) || (bulkInputType === 'prompt' && !aiPrompt.trim())}
                    className="flex items-center px-6 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingBulk ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Processing with OpenAI...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Process & Preview
                      </>
                    )}
                  </button>
                  
                  {/* Clear All Button */}
                  {(spreadsheetData.trim() || uploadedImages.length > 0 || aiPrompt.trim()) && (
                    <button
                                              onClick={() => {
                        setSpreadsheetData('');
                        setAiPrompt('');
                        // Clear images
                        imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
                        setUploadedImages([]);
                        setImagePreviewUrls([]);
                        setPreviewData([]);
                        setBulkDuplicates([]);
                      }}
                      disabled={processingBulk}
                      className="flex items-center px-4 py-3 rounded-lg font-medium bg-gray-600 text-white hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear All
                    </button>
                  )}
                </div>

                {previewData.length > 0 && (
                  <button
                    onClick={saveBulkData}
                    disabled={savingBulk}
                    className="flex items-center px-6 py-3 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingBulk ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save {previewData.length} Prospects
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Excluded Duplicates */}
              {bulkDuplicates.length > 0 && (
                <div className="mb-6">
                  <div className="p-4 bg-orange-900/20 border border-orange-700 rounded-lg">
                    <h3 className="text-lg font-semibold text-orange-400 flex items-center mb-3">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Excluded Duplicates ({bulkDuplicates.length})
                    </h3>
                    <p className="text-orange-300 text-sm mb-3">
                      The following prospects were excluded because they appear to be duplicates of existing records:
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {bulkDuplicates.map((duplicate, index) => (
                        <div key={index} className="text-sm text-orange-200 bg-orange-900/30 p-2 rounded">
                          {duplicate.person} ({duplicate.companies}) - {duplicate.email}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Data */}
              {previewData.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-4 text-white">Preview ({previewData.length} prospects)</h3>
                  <div className="max-h-96 overflow-y-auto border border-gray-600 rounded-lg">
                    <div className="grid grid-cols-1 gap-4 p-4">
                      {previewData.map((prospect, index) => (
                        <div key={index} className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-gray-400">Person:</span>
                              <div className="text-white font-medium">{prospect.person || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Companies:</span>
                              <div className="text-white">{prospect.companies || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Email:</span>
                              <div className="text-white break-all">{prospect.email || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">URLs:</span>
                              <div className="text-blue-400 break-all">{prospect.urls || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">LinkedIn:</span>
                              <div className="text-blue-400 break-all">{prospect.linkedin || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Stage:</span>
                              <div className="text-white">{prospect.stage || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Country:</span>
                              <div className="text-white">{prospect.country || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Location:</span>
                              <div className="text-white">{prospect.location || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Addresses:</span>
                              <div className="text-white">{prospect.addresses || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Founder:</span>
                              <div className="text-white">{prospect.founder || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Exits:</span>
                              <div className="text-white">{prospect.numberOfExits || '-'}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Status:</span>
                              <div className="text-[#d7ff00]">{prospect.status}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Source:</span>
                              <div className={`text-sm font-medium ${
                                prospect.source === 'bulk_text' ? 'text-blue-400' :
                                prospect.source === 'bulk_image' ? 'text-purple-400' :
                                prospect.source === 'ai_research' ? 'text-orange-400' :
                                'text-gray-400'
                              }`}>
                                {prospect.source === 'bulk_text' ? 'Bulk Text' :
                                 prospect.source === 'bulk_image' ? 'Bulk Image' :
                                 prospect.source === 'ai_research' ? 'AI Research' : prospect.source}
                                {(prospect.source === 'ai_research' || prospect.source === 'bulk_image') && (
                                  <span className="ml-1 text-yellow-400" title="Requires verification">⚠️</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {prospect.description && (
                            <div className="mt-3 pt-3 border-t border-gray-700">
                              <span className="text-gray-400">Description:</span>
                              <div className="text-gray-300 mt-1">{prospect.description}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scheduled Emails View */}
        {currentView === 'scheduled' && (
          <div className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden mb-6">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500 via-yellow-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 via-yellow-500 to-[#d7ff00]"></div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium text-white flex items-center">
                  <Calendar className="w-6 h-6 mr-2 text-[#d7ff00]" />
                  Scheduled Emails ({scheduledEmails.length})
                </h2>
                <button
                  onClick={refreshScheduledEmailsStatus}
                  disabled={loadingScheduledEmails}
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-[#262a30] text-[#d7ff00] hover:bg-[#31363c] border border-gray-700 transition disabled:opacity-70"
                >
                  {loadingScheduledEmails ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw size={16} className="mr-2"/>}
                  {loadingScheduledEmails ? 'Checking Status...' : 'Refresh Status'}
                </button>
              </div>

              {scheduledEmails.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Prospect</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Email</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Subject</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Scheduled For</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Message ID</th>
                        <th className="text-center py-3 px-4 text-gray-300 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledEmails.map((email) => (
                        <tr key={email.messageId} className="border-b border-gray-800 hover:bg-[#262a30] transition-colors">
                          <td className="py-3 px-4 text-white font-medium">{email.prospectName}</td>
                          <td className="py-3 px-4 text-gray-300 max-w-xs truncate">{email.prospectEmail}</td>
                          <td className="py-3 px-4 text-gray-300 max-w-xs truncate" title={email.subject}>
                            {email.subject}
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            <div className="text-sm">
                              <div>{email.scheduledAt.toLocaleDateString()}</div>
                              <div className="text-xs text-gray-400">
                                {email.scheduledAt.toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span 
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                email.status === 'queued' ? 'bg-blue-900 text-blue-300' :
                                email.status === 'inProgress' ? 'bg-yellow-900 text-yellow-300' :
                                email.status === 'processed' ? 'bg-green-900 text-green-300' :
                                'bg-red-900 text-red-300'
                              }`}
                            >
                              {email.status === 'queued' ? 'Queued' :
                               email.status === 'inProgress' ? 'In Progress' :
                               email.status === 'processed' ? 'Sent' :
                               'Cancelled'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs font-mono max-w-xs truncate" title={email.messageId}>
                            {email.messageId}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {(email.status === 'queued' || email.status === 'inProgress') && (
                              <button
                                onClick={() => cancelScheduledEmail(email.messageId)}
                                disabled={cancellingEmail === email.messageId}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center ${
                                  cancellingEmail === email.messageId
                                    ? 'bg-gray-700/30 text-gray-500 border-gray-700 cursor-wait'
                                    : 'bg-red-900/30 text-red-400 border-red-900 hover:bg-red-800/40'
                                }`}
                              >
                                {cancellingEmail === email.messageId ? (
                                  <>
                                    <Loader2 className="animate-spin h-3 w-3 mr-1" />
                                    Cancelling...
                                  </>
                                ) : (
                                  <>
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </>
                                )}
                              </button>
                            )}
                            {email.status === 'processed' && (
                              <span className="text-xs text-green-400">✓ Sent</span>
                            )}
                            {email.status === 'cancelled' && (
                              <span className="text-xs text-red-400">✗ Cancelled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <Calendar className="h-12 w-12 text-gray-600" />
                    <div>
                      <p className="text-lg font-medium mb-2">No scheduled emails</p>
                      <p className="text-sm">Scheduled emails will appear here after you send them from the prospects table.</p>
                    </div>
                  </div>
                </div>
              )}

              {scheduledEmails.length > 0 && (
                <div className="text-xs text-gray-500 bg-[#262a30] p-3 rounded-lg border border-gray-700">
                  <strong>💡 Note:</strong> This table tracks emails scheduled in the last 24 hours. 
                  <ul className="mt-1 ml-4 list-disc space-y-1">
                    <li><strong>Queued:</strong> Email is scheduled and waiting to be sent</li>
                    <li><strong>In Progress:</strong> Email is currently being processed</li>
                    <li><strong>Sent:</strong> Email has been successfully delivered to Brevo</li>
                    <li><strong>Cancelled:</strong> Email was cancelled before sending</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Email Template Section */}
        <div className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden mb-6">
          {/* Top gradient border */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-green-500 via-blue-500 to-[#d7ff00]"></div>
          
          {/* Left gradient border */}
          <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-green-500 via-blue-500 to-[#d7ff00]"></div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-white flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-[#d7ff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email Template & Outreach
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Email Template Input */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="emailTemplate" className="block text-gray-300 text-sm font-medium">
                      Email Template
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={loadEmailTemplate}
                        disabled={loadingTemplate}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                          loadingTemplate
                            ? 'bg-blue-900/30 text-blue-400 border-blue-900 cursor-wait'
                            : 'bg-gray-700/30 text-gray-300 border-gray-700 hover:bg-gray-700/50'
                        }`}
                        title="Load saved email template"
                      >
                        {loadingTemplate ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            📥 Load
                          </>
                        )}
                      </button>
                      <button
                        onClick={saveEmailTemplate}
                        disabled={savingTemplate || !emailTemplate.trim()}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                          savingTemplate
                            ? 'bg-green-900/30 text-green-400 border-green-900 cursor-wait'
                            : !emailTemplate.trim()
                            ? 'bg-gray-700/30 text-gray-500 border-gray-700 cursor-not-allowed'
                            : 'bg-green-900/30 text-green-400 border-green-900 hover:bg-green-800/40'
                        }`}
                        title="Save email template for future use"
                      >
                        {savingTemplate ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            💾 Save Template
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs mb-3">
                    Write your template email. AI will analyze the tone and style to generate personalized emails for each prospect.
                  </p>
                  <textarea
                    id="emailTemplate"
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors resize-vertical"
                    placeholder="Hi [Name],

I hope this email finds you well. I'm reaching out because...

[Your email template here]

Best regards,
[Your name]"
                  />
                </div>
                
                {/* Email Attachments */}
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">
                    Email Attachments
                  </label>
                  <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                      onChange={handleAttachmentUpload}
                      className="hidden"
                      id="email-attachments"
                    />
                    <label htmlFor="email-attachments" className="cursor-pointer">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-white mb-1">Click to upload attachments</p>
                      <p className="text-gray-400 text-xs">PDF, DOC, TXT, Images (Max 10MB each)</p>
                    </label>
                  </div>

                  {/* Attachment List */}
                  {emailAttachments.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-300 mb-2">Attachments ({emailAttachments.length})</h4>
                      <div className="space-y-2">
                        {emailAttachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-[#262a30] p-2 rounded border border-gray-700">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-400" />
                              <span className="text-sm text-white truncate">{file.name}</span>
                              <span className="text-xs text-gray-400">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                            </div>
                            <button
                              onClick={() => removeAttachment(index)}
                              className="text-red-400 hover:text-red-300 transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-500 bg-[#262a30] p-3 rounded-lg border border-gray-700">
                  <strong>💡 Tip:</strong> Write in your natural style. The AI will:
                  <ul className="mt-1 ml-4 list-disc space-y-1">
                    <li>Match your tone and voice</li>
                    <li>Personalize with prospect data</li>
                    <li>Maintain your email structure</li>
                    <li>Generate relevant subject lines</li>
                  </ul>
                </div>
              </div>

              {/* Instructions & Preview Area */}
              <div className="space-y-4">
                <div className="bg-[#262a30] rounded-lg p-4 border border-gray-700">
                  <h3 className="text-white font-medium mb-3">How to Use</h3>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex items-start gap-2">
                      <span className="bg-[#d7ff00] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                      <span>Write your email template in your preferred style</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-[#d7ff00] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                      <span>Click "Generate Email" on any prospect in the table below</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-[#d7ff00] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                      <span>Review the AI-generated personalized email</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-[#d7ff00] text-black rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                      <span>Send immediately or schedule for 5 minutes later</span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                  <h4 className="text-blue-300 font-medium mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Email Features
                  </h4>
                  <ul className="text-sm text-blue-200 space-y-1">
                    <li>• Deep VC firm research for specific portfolio alignments</li>
                    <li>• References to actual portfolio companies & investment thesis</li>
                    <li>• Partner background research and personalization</li>
                    <li>• Smart subject line generation with research insights</li>
                    <li>• Tone and style matching from your template</li>
                    <li>• 5-minute scheduled sending via Brevo</li>
                    <li>• Auto-update prospect status to "sent email"</li>
                  </ul>
                </div>
                
                <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
                  <h4 className="text-yellow-300 font-medium mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Data Integrity Warning
                  </h4>
                  <div className="text-sm text-yellow-200 space-y-2">
                    <p>Prospects marked with ⚠️ are AI-generated and may contain inaccurate information:</p>
                    <ul className="ml-4 list-disc space-y-1">
                      <li><span className="text-orange-400 font-medium">AI Research</span> - Verify contact details, company info, and investment focus</li>
                      <li><span className="text-purple-400 font-medium">Bulk Image</span> - Confirm extracted data accuracy from screenshots</li>
                      <li><span className="text-blue-400 font-medium">Bulk Text</span> - Generally reliable from structured data</li>
                      <li><span className="text-green-400 font-medium">Manual Entry</span> - Highest confidence, manually verified</li>
                    </ul>
                    <p className="font-medium text-yellow-300">Always verify AI-generated prospects before sending emails to maintain professional credibility.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Existing VC Prospects Table */}
        <div className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden">
          {/* Top gradient border */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
          
          {/* Left gradient border */}
          <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-medium text-white">
                VC Prospects ({filteredProspects.length}{filteredProspects.length !== vcProspects.length ? ` of ${vcProspects.length}` : ''})
              </h2>
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-6 mb-6 p-4 bg-[#262a30] rounded-lg border border-gray-700">
              {/* Stage Filter */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-gray-300 text-sm font-medium">Stage:</label>
                  {/* Research Missing Stages Button */}
                  <button
                    onClick={researchMissingStages}
                    disabled={researchingStages}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
                      researchingStages
                        ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900 cursor-wait'
                        : 'bg-blue-900/30 text-blue-400 border-blue-900 hover:bg-blue-800/40'
                    }`}
                    title="Research and update investment stages for prospects missing stage data"
                  >
                    {researchingStages ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Researching {stageResearchProgress.current}/{stageResearchProgress.total}
                      </>
                    ) : (
                      <>
                        🤖 Research Missing Stages
                      </>
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* No Stage Button */}
                  <button
                    onClick={() => toggleStageFilter('No Stage')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      selectedStageFilters.includes('No Stage')
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-[#1a1e24] text-orange-400 border-orange-700 hover:border-orange-600'
                    }`}
                  >
                    No Stage ({vcProspects.filter(p => !p.stage || p.stage.trim() === '').length})
                  </button>
                  
                  {/* Regular Stage Buttons */}
                  {stageOptions.map(stage => (
                    <button
                      key={stage}
                      onClick={() => toggleStageFilter(stage)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        selectedStageFilters.includes(stage)
                          ? 'bg-[#d7ff00] text-black border-[#d7ff00]'
                          : 'bg-[#1a1e24] text-gray-300 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-300 text-sm font-medium">Status:</label>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => toggleStatusFilter(status)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        selectedStatusFilters.includes(status)
                          ? 'bg-[#d7ff00] text-black border-[#d7ff00]'
                          : 'bg-[#1a1e24] text-gray-300 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-300 text-sm font-medium">Source:</label>
                <div className="flex flex-wrap gap-2">
                  {['individual_form', 'bulk_text', 'bulk_image', 'ai_research'].map(source => (
                    <button
                      key={source}
                      onClick={() => toggleSourceFilter(source)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        selectedSourceFilters.includes(source)
                          ? 'bg-[#d7ff00] text-black border-[#d7ff00]'
                          : 'bg-[#1a1e24] text-gray-300 border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      {source === 'individual_form' ? 'Individual Form' :
                       source === 'bulk_text' ? 'Bulk Text' :
                       source === 'bulk_image' ? 'Bulk Image' :
                       source === 'ai_research' ? 'AI Research' : source}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {(selectedStageFilters.length > 0 || selectedStatusFilters.length > 0 || selectedSourceFilters.length > 0) && (
                <div className="flex items-end">
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 bg-gray-700/30 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700/50 transition border border-gray-600 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                </div>
              )}
            </div>

            {loadingProspects ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-[#d7ff00]" />
              </div>
            ) : filteredProspects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Person</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Companies</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">URLs</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">LinkedIn</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Stage</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Location</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Source</th>
                      <th className="text-center py-3 px-4 text-gray-300 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProspects.map((prospect) => (
                      <tr key={prospect.id} className="border-b border-gray-800 hover:bg-[#262a30] transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{prospect.person}</td>
                        <td className="py-3 px-4 text-gray-300 max-w-xs truncate">{prospect.companies}</td>
                        <td className="py-3 px-4 text-gray-300 max-w-xs truncate">{prospect.email || '-'}</td>
                        <td className="py-3 px-4 text-blue-400 max-w-xs truncate">
                          {prospect.urls ? (
                            <a href={prospect.urls} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {prospect.urls}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-blue-400 max-w-xs truncate">
                          {prospect.linkedin ? (
                            <a href={prospect.linkedin} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              LinkedIn
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-4 text-gray-300">{prospect.stage || '-'}</td>
                        <td className="py-3 px-4 text-gray-300">{prospect.location || prospect.country || '-'}</td>
                        <td className="py-3 px-4">
                          {editingStatus === prospect.id ? (
                            <div className="flex items-center space-x-2">
                              <select
                                value={prospect.status}
                                onChange={(e) => updateProspectStatus(prospect.id, e.target.value)}
                                disabled={updatingStatus === prospect.id}
                                className="bg-[#262a30] border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-[#d7ff00] focus:outline-none"
                              >
                                {statusOptions.map(status => (
                                  <option key={status} value={status}>
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => setEditingStatus(null)}
                                className="p-1 text-gray-400 hover:text-white"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span 
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  prospect.status === 'new' ? 'bg-blue-900 text-blue-300' :
                                  prospect.status === 'sent email' ? 'bg-yellow-900 text-yellow-300' :
                                  prospect.status === 'received response' ? 'bg-green-900 text-green-300' :
                                  prospect.status === 'had meeting' ? 'bg-purple-900 text-purple-300' :
                                  prospect.status === 'needs follow up' ? 'bg-orange-900 text-orange-300' :
                                  prospect.status === 'diligence' ? 'bg-indigo-900 text-indigo-300' :
                                  'bg-red-900 text-red-300'
                                }`}
                              >
                                {prospect.status}
                              </span>
                              <button
                                onClick={() => setEditingStatus(prospect.id)}
                                className="ml-2 p-1 text-gray-400 hover:text-[#d7ff00] transition-colors"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span 
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                prospect.source === 'individual_form' ? 'bg-green-900 text-green-300' :
                                prospect.source === 'bulk_text' ? 'bg-blue-900 text-blue-300' :
                                prospect.source === 'bulk_image' ? 'bg-purple-900 text-purple-300' :
                                prospect.source === 'ai_research' ? 'bg-orange-900 text-orange-300' :
                                'bg-gray-900 text-gray-300'
                              }`}
                            >
                              {prospect.source === 'individual_form' ? 'Manual Entry' :
                               prospect.source === 'bulk_text' ? 'Bulk Text' :
                               prospect.source === 'bulk_image' ? 'Bulk Image' :
                               prospect.source === 'ai_research' ? 'AI Research' : prospect.source || '-'}
                            </span>
                            {(prospect.source === 'ai_research' || prospect.source === 'bulk_image') && (
                              <span title="Requires extra verification - AI generated data may need fact-checking">
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-1 justify-center">
                            {/* Preview Button - show if email exists */}
                            {prospect.generatedEmail && (
                              <button
                                onClick={() => previewExistingEmail(prospect)}
                                className="px-2 py-1.5 rounded-lg text-xs font-medium border transition flex items-center bg-blue-900/30 text-blue-400 border-blue-900 hover:bg-blue-800/40"
                                title={`Preview generated email from ${prospect.generatedEmailDate ? new Date(prospect.generatedEmailDate).toLocaleDateString() : 'unknown date'}`}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Preview
                              </button>
                            )}
                            
                            {/* Generate Button */}
                            <button
                              onClick={() => generateEmail(prospect)}
                              disabled={!emailTemplate.trim() || generatingEmailForProspect === prospect.id || !prospect.email}
                              className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition flex items-center ${
                                !emailTemplate.trim() || !prospect.email
                                  ? 'bg-gray-700/30 text-gray-500 border-gray-700 cursor-not-allowed'
                                  : generatingEmailForProspect === prospect.id
                                  ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900 cursor-wait'
                                  : 'bg-green-900/30 text-green-400 border-green-900 hover:bg-green-800/40'
                              }`}
                              title={
                                !emailTemplate.trim() 
                                  ? "Add email template first" 
                                  : !prospect.email 
                                  ? "No email address available"
                                  : prospect.generatedEmail
                                  ? "Regenerate personalized email"
                                  : "Generate personalized email"
                              }
                            >
                              {generatingEmailForProspect === prospect.id ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Researching...
                                </>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  {prospect.generatedEmail ? 'Regenerate' : 'Generate'}
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {prospect.createdAt.toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : vcProspects.length > 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="flex flex-col items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <div>
                    <p className="text-lg font-medium mb-2">No prospects match your filters</p>
                    <p className="text-sm">Try adjusting your stage or status filters to see more results.</p>
                  </div>
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                No VC prospects found. Add your first prospect above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Email Preview Modal */}
      {showEmailPreview && selectedProspectForEmail && generatedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1e24] rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#d7ff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="text-xl font-medium text-white">
                  {isEditingEmail ? 'Edit Email' : 'Email Preview'}
                </h2>
                <span className="px-3 py-1 bg-blue-900/30 text-blue-300 rounded-full text-sm border border-blue-800">
                  {selectedProspectForEmail.person} ({selectedProspectForEmail.companies})
                </span>
                {isEditingEmail && (
                  <span className="px-2 py-1 bg-orange-900/30 text-orange-300 rounded-full text-xs border border-orange-800">
                    Editing Mode
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Edit/Cancel Button */}
                <button
                  onClick={isEditingEmail ? cancelEmailEditing : toggleEmailEditMode}
                  disabled={updatingEmail}
                  className={`p-2 rounded-lg transition ${
                    isEditingEmail 
                      ? 'text-orange-400 hover:text-orange-300 bg-orange-900/20 hover:bg-orange-900/30' 
                      : 'text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/30'
                  }`}
                  title={isEditingEmail ? 'Cancel editing' : 'Edit email'}
                >
                  {isEditingEmail ? (
                    <X className="h-5 w-5" />
                  ) : (
                    <Edit3 className="h-5 w-5" />
                  )}
                </button>
                
                {/* Close Button */}
                <button
                  onClick={() => setShowEmailPreview(false)}
                  className="p-2 text-gray-400 hover:text-gray-200 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Email Details */}
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-medium">To:</label>
                  <div className="bg-[#262a30] rounded-lg p-3 border border-gray-700">
                    <div className="text-white">{selectedProspectForEmail.person}</div>
                    <div className="text-gray-400 text-sm">{selectedProspectForEmail.email}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-medium">Subject:</label>
                  <input
                    type="text"
                    value={isEditingEmail ? editedEmailSubject : emailSubject}
                    onChange={(e) => {
                      if (isEditingEmail) {
                        setEditedEmailSubject(e.target.value);
                      } else {
                        setEmailSubject(e.target.value);
                      }
                    }}
                    disabled={!isEditingEmail && updatingEmail}
                    className={`w-full px-3 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:border-[#d7ff00] focus:outline-none transition-colors ${
                      !isEditingEmail ? 'cursor-default' : ''
                    }`}
                    readOnly={!isEditingEmail}
                  />
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="space-y-4 mb-6">
              <label className="block text-gray-300 mb-2 text-sm font-medium">Email Content:</label>
              {isEditingEmail ? (
                <textarea
                  value={editedEmailContent}
                  onChange={(e) => setEditedEmailContent(e.target.value)}
                  rows={16}
                  className="w-full px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-[#d7ff00] focus:outline-none transition-colors resize-vertical"
                  placeholder="Email content..."
                />
              ) : (
                <div className="bg-[#262a30] rounded-lg border border-gray-700 p-4 max-h-96 overflow-y-auto">
                  <div 
                    className="text-gray-200 whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: generatedEmail }}
                  />
                </div>
              )}
            </div>

            {/* Email Attachments */}
            <div className="space-y-4 mb-6">
              <label className="block text-gray-300 mb-2 text-sm font-medium">
                Email Attachments
                {previewEmailAttachments.length > 0 && (
                  <span className="ml-2 text-xs text-blue-400">({previewEmailAttachments.length} file{previewEmailAttachments.length !== 1 ? 's' : ''})</span>
                )}
              </label>
              
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-gray-500 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
                  onChange={handlePreviewAttachmentUpload}
                  className="hidden"
                  id="preview-email-attachments"
                />
                <label htmlFor="preview-email-attachments" className="cursor-pointer">
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-white mb-1">Click to add attachments</p>
                  <p className="text-gray-400 text-xs">PDF, DOC, TXT, Images (Max 10MB each)</p>
                </label>
              </div>

              {/* Attachment List */}
              {previewEmailAttachments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-300">Attached Files</h4>
                    <button
                      onClick={clearPreviewAttachments}
                      className="text-xs text-red-400 hover:text-red-300 transition"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {previewEmailAttachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-[#262a30] p-3 rounded border border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            {file.type.startsWith('image/') ? (
                              <div className="w-8 h-8 rounded overflow-hidden bg-gray-700 flex items-center justify-center">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <FileText className="w-6 h-6 text-blue-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white truncate" title={file.name}>
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {(file.size / 1024 / 1024).toFixed(1)}MB • {file.type.split('/')[1].toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removePreviewAttachment(index)}
                          className="flex-shrink-0 text-red-400 hover:text-red-300 transition p-1"
                          title="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400">
                {!isEditingEmail && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Email will be sent in 5 minutes via Brevo
                    </div>
                    {previewEmailAttachments.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="text-green-400">
                          {previewEmailAttachments.length} attachment{previewEmailAttachments.length !== 1 ? 's' : ''} will be included
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {isEditingEmail && (
                  <div className="flex items-center gap-2 text-orange-400">
                    <Edit3 className="h-4 w-4" />
                    Make changes to personalize the email further
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEmailPreview(false)}
                  disabled={updatingEmail}
                  className="px-4 py-2 bg-gray-700/30 text-gray-300 rounded-lg font-medium hover:bg-gray-700/50 transition border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditingEmail ? 'Close' : 'Cancel'}
                </button>
                
                {isEditingEmail ? (
                  <button
                    onClick={updateEmailWithEdits}
                    disabled={updatingEmail || !editedEmailContent.trim() || !editedEmailSubject.trim()}
                    className={`px-6 py-2 rounded-lg font-medium transition flex items-center ${
                      updatingEmail || !editedEmailContent.trim() || !editedEmailSubject.trim()
                        ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 border border-blue-600'
                    }`}
                  >
                    {updatingEmail ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Update Email
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={sendScheduledEmail}
                    disabled={sendingEmail || !emailSubject.trim()}
                    className={`px-6 py-2 rounded-lg font-medium transition flex items-center ${
                      sendingEmail || !emailSubject.trim()
                        ? 'bg-gray-700/30 text-gray-500 cursor-not-allowed border border-gray-700'
                        : 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700 border border-green-600'
                    }`}
                  >
                    {sendingEmail ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send Email
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastVisible && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          toastType === 'success' 
            ? 'bg-green-500 text-white' 
            : 'bg-red-500 text-white'
        }`}>
          <div className="flex items-center">
            {toastType === 'success' ? (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {toastMessage}
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default VCDatabasePage; 