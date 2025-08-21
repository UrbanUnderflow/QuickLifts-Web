import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, doc, setDoc, getDocs, query, orderBy, updateDoc, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Building2, Mail, User, MapPin, Globe, DollarSign, Calendar, Users, Trophy, FileText, Upload, Eye, Loader2, RefreshCw, Edit3, Check, X, AlertTriangle, Phone, Star, Target, Image as ImageIcon, Trash2, CheckSquare } from 'lucide-react';
import { FirebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';

interface PartnerFormData {
  companyName: string;
  contactPerson: string;
  contactNames: string; // Multiple contacts support
  email: string;
  phone: string;
  website: string;
  linkedin: string;
  industry: string;
  companySize: string;
  location: string;
  country: string;
  partnershipType: string;
  partnershipTier: string; // Partnership tier classification
  fitScore: string; // 1-5 rating (keeping for backward compatibility)
  missionFit: string; // 1-5 rating
  audienceOverlap: string; // 1-5 rating
  activationPotential: string; // 1-5 rating
  brandReputation: string; // 1-5 rating
  scalability: string; // 1-5 rating
  resourcesBeyondMoney: string; // 1-5 rating
  weightedPriorityScore: string; // Calculated or manual numeric field
  notes: string;
  notesJustification: string; // More specific notes field
  status: string;
  contactStatus: string; // Contact-specific status
  lastContactDate: string;
  nextFollowUpDate: string;
  leadSource: string;
  priority: string;
  potentialValue: string;
  source: 'individual_form' | 'bulk_text' | 'bulk_image';
}

interface PartnerProspect extends PartnerFormData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

const CorporatePartnersPage: React.FC = () => {
  // Form state
  const [formData, setFormData] = useState<PartnerFormData>({
    companyName: '',
    contactPerson: '',
    contactNames: '',
    email: '',
    phone: '',
    website: '',
    linkedin: '',
    industry: '',
    companySize: '',
    location: '',
    country: '',
    partnershipType: '',
    partnershipTier: '',
    fitScore: '',
    missionFit: '',
    audienceOverlap: '',
    activationPotential: '',
    brandReputation: '',
    scalability: '',
    resourcesBeyondMoney: '',
    weightedPriorityScore: '',
    notes: '',
    notesJustification: '',
    status: 'inactive',
    contactStatus: 'not-contacted',
    lastContactDate: '',
    nextFollowUpDate: '',
    leadSource: '',
    priority: 'medium',
    potentialValue: '',
    source: 'individual_form'
  });

  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Bulk import state
  const [currentView, setCurrentView] = useState<'form' | 'bulk' | 'table'>('form');
  const [spreadsheetData, setSpreadsheetData] = useState('');
  const [processingBulk, setProcessingBulk] = useState(false);
  const [previewData, setPreviewData] = useState<PartnerFormData[]>([]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkInputType, setBulkInputType] = useState<'text' | 'image'>('text');
  
  // Image upload state
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // Data table state
  const [partners, setPartners] = useState<PartnerProspect[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  
  // Inline editing state
  const [editingPartner, setEditingPartner] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<PartnerFormData>>({});
  const [savingChanges, setSavingChanges] = useState(false);

  // Bulk editing state
  const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<PartnerFormData>>>({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Custom options state
  const [customOptions, setCustomOptions] = useState<Record<string, string[]>>({});
  const [showAddOption, setShowAddOption] = useState<string | null>(null);
  const [newOptionValue, setNewOptionValue] = useState('');

  // Multi-select delete state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPartners, setSelectedPartners] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // Sort state
  const [sortBy, setSortBy] = useState<string>('companyName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sort options
  const sortOptions = [
    { value: 'companyName', label: 'Company Name' },
    { value: 'contactPerson', label: 'Contact Person' },
    { value: 'industry', label: 'Industry' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'weightedPriorityScore', label: 'Weighted Score' },
    { value: 'potentialValue', label: 'Potential Value' },
    { value: 'partnershipTier', label: 'Partnership Tier' },
    { value: 'missionFit', label: 'Mission Fit' },
    { value: 'audienceOverlap', label: 'Audience Overlap' },
    { value: 'activationPotential', label: 'Activation Potential' },
    { value: 'brandAlignment', label: 'Brand Alignment' },
    { value: 'lastContactDate', label: 'Last Contact Date' },
    { value: 'nextFollowUpDate', label: 'Next Follow-up Date' }
  ];

  // Modal state
  const [selectedPartnerForModal, setSelectedPartnerForModal] = useState<PartnerProspect | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Inline add new prospect state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newProspectData, setNewProspectData] = useState<Partial<PartnerFormData>>({});
  const [savingNewProspect, setSavingNewProspect] = useState(false);

  // Filter state
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[]>([]);
  const [selectedIndustryFilters, setSelectedIndustryFilters] = useState<string[]>([]);
  const [selectedPriorityFilters, setSelectedPriorityFilters] = useState<string[]>([]);
  const [selectedPartnershipTypeFilters, setSelectedPartnershipTypeFilters] = useState<string[]>([]);

  // Column reordering state
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Define column structure
  const baseColumns = [
    { key: 'company', label: 'Company', field: 'companyName' },
    { key: 'contact', label: 'Contact', field: 'contactPerson' },
    { key: 'email', label: 'Email', field: 'email' },
    { key: 'industry', label: 'Industry', field: 'industry' },
    { key: 'partnershipType', label: 'Partnership Type', field: 'partnershipType' },
    { key: 'partnershipTier', label: 'Tier', field: 'partnershipTier' },
    { key: 'missionFit', label: 'Mission Fit', field: 'missionFit' },
    { key: 'audienceOverlap', label: 'Audience Overlap', field: 'audienceOverlap' },
    { key: 'activationPotential', label: 'Activation Potential', field: 'activationPotential' },
    { key: 'brandReputation', label: 'Brand Reputation', field: 'brandReputation' },
    { key: 'scalability', label: 'Scalability', field: 'scalability' },
    { key: 'resourcesBeyondMoney', label: 'Resources Beyond Money', field: 'resourcesBeyondMoney' },
    { key: 'weightedScore', label: 'Weighted Score', field: 'weightedPriorityScore' },
    { key: 'status', label: 'Status', field: 'status' },
    { key: 'contactStatus', label: 'Contact Status', field: 'contactStatus' },
    { key: 'priority', label: 'Priority', field: 'priority' },
    { key: 'potentialValue', label: 'Potential Value', field: 'potentialValue' },
    { key: 'actions', label: 'Actions', field: 'actions' }
  ];

  // Create columns array with conditional select column
  const defaultColumns = useMemo(() => {
    const selectColumn = { key: 'select', label: 'Select', field: 'select' };
    return isSelectionMode ? [selectColumn, ...baseColumns] : baseColumns;
  }, [isSelectionMode]);

  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumns.map(col => col.key));

  // Update column order when selection mode changes
  useEffect(() => {
    setColumnOrder(defaultColumns.map(col => col.key));
  }, [defaultColumns]);

  // Local storage keys
  const PENDING_CHANGES_KEY = 'corporate-partners-pending-changes';
  const COLUMN_ORDER_KEY = 'corporate-partners-column-order';

  // Local storage functions
  const savePendingChangesToStorage = (changes: Record<string, Partial<PartnerFormData>>) => {
    try {
      localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify(changes));
    } catch (error) {
      console.error('Failed to save pending changes to localStorage:', error);
    }
  };

  const loadPendingChangesFromStorage = (): Record<string, Partial<PartnerFormData>> => {
    try {
      const stored = localStorage.getItem(PENDING_CHANGES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load pending changes from localStorage:', error);
      return {};
    }
  };

  const clearPendingChangesFromStorage = () => {
    try {
      localStorage.removeItem(PENDING_CHANGES_KEY);
    } catch (error) {
      console.error('Failed to clear pending changes from localStorage:', error);
    }
  };

  // Column order storage functions
  const saveColumnOrderToStorage = (order: string[]) => {
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
    } catch (error) {
      console.error('Failed to save column order to storage:', error);
    }
  };

  const loadColumnOrderFromStorage = (): string[] | null => {
    try {
      const stored = localStorage.getItem(COLUMN_ORDER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load column order from storage:', error);
      return null;
    }
  };

  const clearColumnOrderFromStorage = () => {
    try {
      localStorage.removeItem(COLUMN_ORDER_KEY);
    } catch (error) {
      console.error('Failed to clear column order from storage:', error);
    }
  };

  // Constants for dropdown options
  const statusOptions = ['inactive', 'contacted', 'interested', 'negotiating', 'closed-won', 'closed-lost', 'on-hold'];
  const contactStatusOptions = ['not-contacted', 'initial-outreach', 'follow-up-sent', 'meeting-scheduled', 'meeting-completed', 'proposal-sent', 'awaiting-response', 'decision-pending'];
  const industryOptions = [
    'Fitness & Movement',
    'Health, Wellness and Nutrition', 
    'Tech & Innovation',
    'Lifestyle & Culture',
    'Corporate Wellness & B2B',
    'Education & Community',
    'Media & Storytelling',
    'Athletic Apparel',
    'Beauty & Self Care'
  ];
  const companySizeOptions = ['Startup (1-10)', 'Small (11-50)', 'Medium (51-200)', 'Large (201-1000)', 'Enterprise (1000+)'];
  const partnershipTypeOptions = ['Sponsorship', 'Technology Integration', 'Content Partnership', 'Distribution', 'Co-Marketing', 'Strategic Alliance', 'Investment'];
  const partnershipTierOptions = ['Tier 1 - Strategic', 'Tier 2 - Premium', 'Tier 3 - Standard', 'Tier 4 - Basic'];
  const priorityOptions = ['high', 'medium', 'low'];
  const ratingOptions = [
    '1. Very Poor Fit',
    '2. Weak Fit', 
    '3. Moderate Fit',
    '4. Strong Fit',
    '5. Excellent Fit'
  ]; // For all 1-5 rating fields
  const leadSourceOptions = ['Referral', 'Cold Outreach', 'Inbound', 'Event', 'Social Media', 'Website', 'Other'];

  // Initialize storage service
  const storageService = new FirebaseStorageService();

  // Show toast
  const showToast = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
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

  // Load all partners
  const loadPartners = async () => {
    try {
      setLoadingPartners(true);
      const partnersRef = collection(db, 'corporate-partners');
      const q = query(partnersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const partnersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as PartnerProspect[];
      
      setPartners(partnersData);
    } catch (error) {
      console.error('Error loading partners:', error);
      showToast('Error loading partners', 'error');
    } finally {
      setLoadingPartners(false);
    }
  };

  // Save individual form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName.trim()) {
      showToast('Company name is required', 'error');
      return;
    }

    try {
      setLoading(true);
      const partnersRef = collection(db, 'corporate-partners');
      
      const partnerData = {
        ...formData,
        weightedPriorityScore: calculateWeightedScore(formData).toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await addDoc(partnersRef, partnerData);
      
      showToast('Partner prospect added successfully!', 'success');
      
      // Reset form
      setFormData({
        companyName: '',
        contactPerson: '',
        contactNames: '',
        email: '',
        phone: '',
        website: '',
        linkedin: '',
        industry: '',
        companySize: '',
        location: '',
        country: '',
        partnershipType: '',
        partnershipTier: '',
        fitScore: '',
        missionFit: '',
        audienceOverlap: '',
        activationPotential: '',
        brandReputation: '',
        scalability: '',
        resourcesBeyondMoney: '',
        weightedPriorityScore: '',
        notes: '',
        notesJustification: '',
        status: 'inactive',
        contactStatus: 'not-contacted',
        lastContactDate: '',
        nextFollowUpDate: '',
        leadSource: '',
        priority: 'medium',
        potentialValue: '',
        source: 'individual_form'
      });
      
      // Reload partners if we're viewing the table
      if (currentView === 'table') {
        loadPartners();
      }
    } catch (error) {
      console.error('Error saving partner:', error);
      showToast('Error saving partner prospect', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Process bulk data
  const processBulkData = async () => {
    // Validate input based on type
    if (bulkInputType === 'text' && !spreadsheetData.trim()) {
      showToast('Please enter text data to process', 'error');
      return;
    }

    if (bulkInputType === 'image' && uploadedImages.length === 0) {
      showToast('Please upload at least one image to process', 'error');
      return;
    }

    try {
      setProcessingBulk(true);
      
      // Get existing company names for duplicate checking
      const existingCompanies = partners.map(partner => partner.companyName).filter(Boolean);
      
      let requestData: any = {
        inputType: bulkInputType,
        existingCompanies
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
      }

      console.log('📤 Request Data Sent to OpenAI:', requestData);

      // Call our OpenAI API endpoint
      const response = await fetch('/api/extract-partner-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract partner data');
      }

      const result = await response.json();
      console.log('🤖 API Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to process data');
      }
      
      const prospects = result.prospects || [];
      
      if (prospects.length === 0) {
        showToast('No partner prospect data found in the provided input', 'error');
        return;
      }

      // Add default status and source to all prospects
      const processedData = prospects.map((prospect: any) => ({
        ...prospect,
        status: prospect.status || 'inactive',
        priority: prospect.priority || 'medium',
        source: bulkInputType === 'image' ? 'bulk_image' : 'bulk_text'
      }));

      setPreviewData(processedData);
      
      // Show appropriate message based on duplicates
      const duplicateCount = result.duplicateCount || 0;
      const newCount = result.newCount || processedData.length;
      
      if (duplicateCount > 0) {
        showToast(
          `Extracted ${processedData.length} prospects (${newCount} new, ${duplicateCount} duplicates found)`, 
          'info'
        );
      } else {
        showToast(`Successfully extracted ${processedData.length} new partner prospects!`, 'success');
      }
      
    } catch (error) {
      console.error('Error processing bulk data:', error);
      
      // Show more helpful error messages
      let errorMessage = 'Error processing bulk data';
      if (error instanceof Error) {
        if (error.message.includes('AI returned invalid JSON format')) {
          errorMessage = 'AI had trouble reading the image. Please try with a clearer image or different format.';
        } else if (error.message.includes('OpenAI API failed')) {
          errorMessage = 'AI service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('Cannot access or read')) {
          errorMessage = 'Unable to read the uploaded image. Please check the image format and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      showToast(errorMessage, 'error');
    } finally {
      setProcessingBulk(false);
    }
  };

  // Save bulk data to Firestore
  const saveBulkData = async () => {
    if (previewData.length === 0) {
      showToast('No data to save', 'error');
      return;
    }

    try {
      setSavingBulk(true);
      const partnersRef = collection(db, 'corporate-partners');
      
      // Filter prospects based on duplicate actions
      const prospectsToAdd = previewData.filter(prospect => 
        !prospect.isDuplicate || prospect.duplicateAction === 'add'
      );
      
      const prospectsToUpdate = previewData.filter(prospect => 
        prospect.isDuplicate && prospect.duplicateAction === 'update'
      );
      
      const prospectsToSkip = previewData.filter(prospect => 
        prospect.isDuplicate && prospect.duplicateAction === 'skip'
      );

      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = prospectsToSkip.length;

      // Add new prospects
      if (prospectsToAdd.length > 0) {
        const addPromises = prospectsToAdd.map(async (prospect) => {
          const partnerData = {
            ...prospect,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          // Remove duplicate tracking fields
          delete partnerData.isDuplicate;
          delete partnerData.duplicateAction;
          
          return addDoc(partnersRef, partnerData);
        });

        await Promise.all(addPromises);
        addedCount = prospectsToAdd.length;
      }

      // Update existing prospects
      if (prospectsToUpdate.length > 0) {
        const updatePromises = prospectsToUpdate.map(async (prospect) => {
          // Find existing partner by company name
          const existingPartner = partners.find(p => 
            p.companyName.toLowerCase().trim() === prospect.companyName.toLowerCase().trim()
          );
          
          if (existingPartner) {
            const partnerData = {
              ...prospect,
              updatedAt: new Date(),
            };
            // Remove duplicate tracking fields
            delete partnerData.isDuplicate;
            delete partnerData.duplicateAction;
            
            const docRef = doc(db, 'corporate-partners', existingPartner.id);
            return updateDoc(docRef, partnerData);
          }
        });

        await Promise.all(updatePromises.filter(Boolean));
        updatedCount = prospectsToUpdate.length;
      }

      // Show detailed success message
      const messages = [];
      if (addedCount > 0) messages.push(`${addedCount} added`);
      if (updatedCount > 0) messages.push(`${updatedCount} updated`);
      if (skippedCount > 0) messages.push(`${skippedCount} skipped`);
      
      showToast(`Successfully processed ${previewData.length} prospects: ${messages.join(', ')}`, 'success');
      
      // Clear preview data and reset form
      setPreviewData([]);
      setSpreadsheetData('');
      setUploadedImages([]);
      setImagePreviewUrls([]);
      
      // Reload partners if we're viewing the table
      if (currentView === 'table') {
        loadPartners();
      }
      
    } catch (error) {
      console.error('Error saving bulk data:', error);
      showToast('Error saving partner prospects', 'error');
    } finally {
      setSavingBulk(false);
    }
  };

  // Update preview data
  const updatePreviewData = (index: number, field: keyof PartnerFormData, value: string) => {
    setPreviewData(prev => prev.map((item, i) => {
      if (i === index) {
        const updatedItem = { ...item, [field]: value };
        
        // If this is a rating field, auto-calculate weighted score
        const ratingFields = ['missionFit', 'audienceOverlap', 'activationPotential', 'brandReputation', 'scalability', 'resourcesBeyondMoney'];
        if (ratingFields.includes(field)) {
          const weightedScore = calculateWeightedScore(updatedItem);
          updatedItem.weightedPriorityScore = weightedScore.toString();
        }
        
        return updatedItem;
      }
      return item;
    }));
  };

  // Remove preview item
  const removePreviewItem = (index: number) => {
    setPreviewData(prev => prev.filter((_, i) => i !== index));
  };

  // Start inline editing
  const startEditing = (partnerId: string, field: string, currentValue: any) => {
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return;

    setEditingPartner(partnerId);
    setEditingField(field);
    
    // Get the current value including any pending changes
    const valueToEdit = getCurrentValue(partner, field as keyof PartnerFormData);
    
    setEditingValues({ [field]: valueToEdit });
  };

  // Update editing value and immediately add to pending changes
  const updateEditingValue = (field: string, value: any) => {
    setEditingValues(prev => ({ ...prev, [field]: value }));
    
    // Immediately add to pending changes
    if (editingPartner) {
      // Get the current partner data
      const partner = partners.find(p => p.id === editingPartner);
      if (!partner) return;

      // Create updated changes object
      const updatedChanges = {
        ...pendingChanges[editingPartner],
        [field]: value
      };

      // If this is a rating field, auto-calculate weighted score
      const ratingFields = ['missionFit', 'audienceOverlap', 'activationPotential', 'brandReputation', 'scalability', 'resourcesBeyondMoney'];
      if (ratingFields.includes(field)) {
        // Get all current rating values (including pending changes)
        const currentRatings = {
          missionFit: updatedChanges.missionFit ?? partner.missionFit,
          audienceOverlap: updatedChanges.audienceOverlap ?? partner.audienceOverlap,
          activationPotential: updatedChanges.activationPotential ?? partner.activationPotential,
          brandReputation: updatedChanges.brandReputation ?? partner.brandReputation,
          scalability: updatedChanges.scalability ?? partner.scalability,
          resourcesBeyondMoney: updatedChanges.resourcesBeyondMoney ?? partner.resourcesBeyondMoney,
        };

        // Calculate and set weighted score
        const weightedScore = calculateWeightedScore(currentRatings);
        updatedChanges.weightedPriorityScore = weightedScore.toString();
      }
      
      const newPendingChanges = {
        ...pendingChanges,
        [editingPartner]: updatedChanges
      };
      
      setPendingChanges(newPendingChanges);
      savePendingChangesToStorage(newPendingChanges);
      setHasUnsavedChanges(true);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingPartner(null);
    setEditingField(null);
    setEditingValues({});
  };

  // Finish editing (changes are already in pending changes)
  const finishEditing = () => {
    if (!editingPartner) return;
    
    // Just close the editing mode - changes are already in pending changes
    cancelEditing();
  };

  // Column reordering functions
  const handleColumnDragStart = (columnKey: string) => {
    setDraggedColumn(columnKey);
    setIsDragging(true);
  };

  const handleColumnDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    setDragOverColumn(columnKey);
  };

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    
    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      setIsDragging(false);
      return;
    }

    const newColumnOrder = [...columnOrder];
    const draggedIndex = newColumnOrder.indexOf(draggedColumn);
    const targetIndex = newColumnOrder.indexOf(targetColumnKey);

    // Remove dragged column and insert at target position
    newColumnOrder.splice(draggedIndex, 1);
    newColumnOrder.splice(targetIndex, 0, draggedColumn);

    setColumnOrder(newColumnOrder);
    saveColumnOrderToStorage(newColumnOrder); // Save to localStorage
    setDraggedColumn(null);
    setDragOverColumn(null);
    setIsDragging(false);
    
    showToast('Column order updated', 'success');
  };

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
    setIsDragging(false);
  };

  // Long press handlers for mobile
  const handleLongPressStart = (columnKey: string) => {
    const timer = setTimeout(() => {
      handleColumnDragStart(columnKey);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Reset column order
  const resetColumnOrder = () => {
    const defaultOrder = defaultColumns.map(col => col.key);
    setColumnOrder(defaultOrder);
    clearColumnOrderFromStorage(); // Clear from localStorage
    showToast('Column order reset to default', 'success');
  };

  // Custom options functions
  const getOptionsForField = (field: string) => {
    const baseOptions = {
      'status': statusOptions,
      'contactStatus': contactStatusOptions,
      'industry': industryOptions,
      'companySize': companySizeOptions,
      'partnershipType': partnershipTypeOptions,
      'partnershipTier': partnershipTierOptions,
      'priority': priorityOptions,
      'leadSource': leadSourceOptions,
      'missionFit': ratingOptions,
      'audienceOverlap': ratingOptions,
      'activationPotential': ratingOptions,
      'brandReputation': ratingOptions,
      'scalability': ratingOptions,
      'resourcesBeyondMoney': ratingOptions
    }[field] || [];

    return [...baseOptions, ...(customOptions[field] || [])];
  };

  const addCustomOption = (field: string) => {
    if (!newOptionValue.trim()) return;
    
    const newOptions = {
      ...customOptions,
      [field]: [...(customOptions[field] || []), newOptionValue.trim()]
    };
    
    setCustomOptions(newOptions);
    localStorage.setItem('corporate-partners-custom-options', JSON.stringify(newOptions));
    setNewOptionValue('');
    setShowAddOption(null);
    showToast(`Added custom option "${newOptionValue.trim()}" to ${field}`, 'success');
  };

  const loadCustomOptions = () => {
    try {
      const stored = localStorage.getItem('corporate-partners-custom-options');
      if (stored) {
        setCustomOptions(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load custom options:', error);
    }
  };

  // Modal functions
  const openDetailModal = (partner: PartnerProspect) => {
    setSelectedPartnerForModal(partner);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setSelectedPartnerForModal(null);
    setShowDetailModal(false);
  };

  // Selection mode functions
  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedPartners(new Set());
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedPartners(new Set());
  };

  // Multi-select functions
  const togglePartnerSelection = (partnerId: string) => {
    setSelectedPartners(prev => {
      const newSet = new Set(prev);
      if (newSet.has(partnerId)) {
        newSet.delete(partnerId);
      } else {
        newSet.add(partnerId);
      }
      return newSet;
    });
  };

  const selectAllPartners = () => {
    const allPartnerIds = new Set(filteredPartners.map(p => p.id));
    setSelectedPartners(allPartnerIds);
  };

  const clearSelection = () => {
    setSelectedPartners(new Set());
  };

  const deleteSelectedPartners = async () => {
    if (selectedPartners.size === 0) {
      showToast('No partners selected for deletion', 'error');
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedPartners.size} partner prospect${selectedPartners.size > 1 ? 's' : ''}? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      
      // Delete from Firestore using batch
      const batch = writeBatch(db);
      selectedPartners.forEach(partnerId => {
        const docRef = doc(db, 'corporate-partners', partnerId);
        batch.delete(docRef);
      });
      
      await batch.commit();
      
      // Update local state
      setPartners(prev => prev.filter(p => !selectedPartners.has(p.id)));
      
      // Clear pending changes for deleted partners
      const newPendingChanges = { ...pendingChanges };
      selectedPartners.forEach(partnerId => {
        delete newPendingChanges[partnerId];
      });
      setPendingChanges(newPendingChanges);
      savePendingChangesToStorage(newPendingChanges);
      
      // Clear selection
      setSelectedPartners(new Set());
      
      showToast(`Successfully deleted ${selectedPartners.size} partner prospect${selectedPartners.size > 1 ? 's' : ''}`, 'success');
      
    } catch (error) {
      console.error('Error deleting partners:', error);
      showToast('Error deleting partner prospects', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Inline add new prospect functions
  const startAddingNew = () => {
    setIsAddingNew(true);
    setNewProspectData({
      companyName: '',
      contactPerson: '',
      email: '',
      phone: '',
      website: '',
      linkedin: '',
      industry: '',
      companySize: '',
      location: '',
      country: '',
      partnershipType: '',
      partnershipTier: '',
      contactNames: '',
      missionFit: '',
      audienceOverlap: '',
      activationPotential: '',
      brandReputation: '',
      scalability: '',
      resourcesBeyondMoney: '',
      weightedPriorityScore: '',
      notes: '',
      notesJustification: '',
      status: 'inactive',
      contactStatus: 'not-contacted',
      lastContactDate: '',
      nextFollowUpDate: '',
      leadSource: '',
      priority: 'medium',
      potentialValue: ''
    });
  };

  const cancelAddingNew = () => {
    setIsAddingNew(false);
    setNewProspectData({});
  };

  const updateNewProspectData = (field: string, value: any) => {
    const updatedData = { ...newProspectData, [field]: value };
    
    // If this is a rating field, auto-calculate weighted score
    const ratingFields = ['missionFit', 'audienceOverlap', 'activationPotential', 'brandReputation', 'scalability', 'resourcesBeyondMoney'];
    if (ratingFields.includes(field)) {
      const weightedScore = calculateWeightedScore(updatedData);
      updatedData.weightedPriorityScore = weightedScore.toString();
    }
    
    setNewProspectData(updatedData);
  };

  const saveNewProspect = async () => {
    if (!newProspectData.companyName?.trim()) {
      showToast('Company name is required', 'error');
      return;
    }

    try {
      setSavingNewProspect(true);
      
      const prospectData = {
        ...newProspectData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'corporate-partners'), prospectData);
      
      // Add to local state
      const newProspect: PartnerProspect = {
        id: docRef.id,
        ...prospectData
      } as PartnerProspect;
      
      setPartners(prev => [newProspect, ...prev]);
      
      showToast('New partner prospect added successfully', 'success');
      cancelAddingNew();
      
    } catch (error) {
      console.error('Error adding new prospect:', error);
      showToast('Error adding new prospect', 'error');
    } finally {
      setSavingNewProspect(false);
    }
  };

  // Bulk save all pending changes to Firestore
  const saveBulkChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      setIsBulkSaving(true);
      const batch = writeBatch(db);
      const timestamp = new Date();

      // Add each pending change to the batch
      Object.entries(pendingChanges).forEach(([partnerId, changes]) => {
        const partnerRef = doc(db, 'corporate-partners', partnerId);
        batch.update(partnerRef, {
          ...changes,
          updatedAt: timestamp
        });
      });

      // Commit all changes at once
      await batch.commit();

      // Update local state with timestamps
      setPartners(prev => prev.map(partner => {
        const changes = pendingChanges[partner.id];
        return changes 
          ? { ...partner, ...changes, updatedAt: timestamp }
          : partner;
      }));

      // Clear pending changes
      setPendingChanges({});
      clearPendingChangesFromStorage();
      setHasUnsavedChanges(false);

      showToast(`Successfully saved ${Object.keys(pendingChanges).length} partner updates`, 'success');

    } catch (error) {
      console.error('Error saving bulk changes:', error);
      showToast('Error saving changes. Please try again.', 'error');
    } finally {
      setIsBulkSaving(false);
    }
  };

  // Discard all pending changes
  const discardBulkChanges = () => {
    // Revert local state to original values
    setPartners(prev => prev.map(partner => {
      const changes = pendingChanges[partner.id];
      if (!changes) return partner;

      // Revert each changed field to its original value
      const revertedPartner = { ...partner };
      Object.keys(changes).forEach(field => {
        // This is a simplified revert - in a real app you'd want to store original values
        // For now, we'll just reload the data
      });
      return revertedPartner;
    }));

    // Clear pending changes
    setPendingChanges({});
    clearPendingChangesFromStorage();
    setHasUnsavedChanges(false);

    // Reload fresh data from Firestore
    loadPartners();

    showToast('All pending changes discarded', 'info');
  };

  // Update partner status
  const updatePartnerStatus = async (partnerId: string, newStatus: string) => {
    try {
      setUpdatingStatus(partnerId);
      const partnerRef = doc(db, 'corporate-partners', partnerId);
      await updateDoc(partnerRef, { 
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setPartners(prev => prev.map(partner => 
        partner.id === partnerId 
          ? { ...partner, status: newStatus, updatedAt: new Date() }
          : partner
      ));
      
      showToast('Status updated successfully', 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Error updating status', 'error');
    } finally {
      setUpdatingStatus(null);
      setEditingStatus(null);
    }
  };

  // Filter partners
  const getFilteredPartners = () => {
    return partners.filter(partner => {
      if (selectedStatusFilters.length > 0 && !selectedStatusFilters.includes(partner.status)) return false;
      if (selectedIndustryFilters.length > 0 && !selectedIndustryFilters.includes(partner.industry)) return false;
      if (selectedPriorityFilters.length > 0 && !selectedPriorityFilters.includes(partner.priority)) return false;
      if (selectedPartnershipTypeFilters.length > 0 && !selectedPartnershipTypeFilters.includes(partner.partnershipType)) return false;
      return true;
    });
  };

  // Load partners when switching to table view
  useEffect(() => {
    if (currentView === 'table') {
      loadPartners();
    }
  }, [currentView]);

  // Load pending changes, custom options, and column order from localStorage on component mount
  useEffect(() => {
    const storedChanges = loadPendingChangesFromStorage();
    if (Object.keys(storedChanges).length > 0) {
      setPendingChanges(storedChanges);
      setHasUnsavedChanges(true);
      showToast(`Restored ${Object.keys(storedChanges).length} unsaved changes from previous session`, 'info');
    }
    
    // Load custom options
    loadCustomOptions();
    
    // Load column order
    const storedColumnOrder = loadColumnOrderFromStorage();
    if (storedColumnOrder) {
      setColumnOrder(storedColumnOrder);
    }
  }, []);

  // Page refresh protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Helper function to get current display value (including pending changes)
  // Sort function
  const sortPartners = (partners: PartnerProspect[]) => {
    return [...partners].sort((a, b) => {
      const aValue = getCurrentValue(a, sortBy as keyof PartnerFormData);
      const bValue = getCurrentValue(b, sortBy as keyof PartnerFormData);
      
      // Handle different data types
      let comparison = 0;
      
      if (sortBy === 'weightedPriorityScore' || sortBy === 'potentialValue') {
        // Numeric comparison
        const aNum = parseFloat(aValue?.toString() || '0');
        const bNum = parseFloat(bValue?.toString() || '0');
        comparison = aNum - bNum;
      } else if (sortBy === 'lastContactDate' || sortBy === 'nextFollowUpDate') {
        // Date comparison
        const aDate = aValue ? new Date(aValue) : new Date(0);
        const bDate = bValue ? new Date(bValue) : new Date(0);
        comparison = aDate.getTime() - bDate.getTime();
      } else if (sortBy.includes('Fit') || sortBy.includes('Overlap') || sortBy.includes('Potential') || sortBy.includes('Alignment')) {
        // Rating comparison (extract number from "4 - Good" format)
        const aRating = parseInt(aValue?.toString().split(' ')[0] || '0');
        const bRating = parseInt(bValue?.toString().split(' ')[0] || '0');
        comparison = aRating - bRating;
      } else {
        // String comparison
        const aStr = aValue?.toString().toLowerCase() || '';
        const bStr = bValue?.toString().toLowerCase() || '';
        comparison = aStr.localeCompare(bStr);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Search function
  const searchPartners = (partners: PartnerProspect[]) => {
    if (!searchQuery.trim()) return partners;
    
    const query = searchQuery.toLowerCase().trim();
    
    return partners.filter(partner => {
      // Define searchable fields
      const searchableFields = [
        getCurrentValue(partner, 'companyName'),
        getCurrentValue(partner, 'contactPerson'),
        getCurrentValue(partner, 'email'),
        getCurrentValue(partner, 'industry'),
        getCurrentValue(partner, 'partnershipType'),
        getCurrentValue(partner, 'partnershipTier'),
        getCurrentValue(partner, 'status'),
        getCurrentValue(partner, 'priority'),
        getCurrentValue(partner, 'leadSource'),
        getCurrentValue(partner, 'notes'),
        getCurrentValue(partner, 'notesJustification')
      ];
      
      // Search across all fields
      return searchableFields.some(field => 
        field?.toString().toLowerCase().includes(query)
      );
    });
  };

  const getCurrentValue = (partner: PartnerProspect, field: keyof PartnerFormData) => {
    const pendingValue = pendingChanges[partner.id]?.[field];
    return pendingValue !== undefined ? pendingValue : partner[field];
  };

  // Helper function to calculate weighted score from rating fields
  const calculateWeightedScore = (ratings: {
    missionFit?: string;
    audienceOverlap?: string;
    activationPotential?: string;
    brandReputation?: string;
    scalability?: string;
    resourcesBeyondMoney?: string;
  }) => {
    // Extract numeric values from rating strings (e.g., "4. Strong Fit" -> 4)
    const extractRating = (ratingStr: string | undefined): number => {
      if (!ratingStr) return 0;
      const match = ratingStr.match(/^(\d+)/);
      return match ? parseInt(match[1]) : 0;
    };

    const missionFit = extractRating(ratings.missionFit);
    const audienceOverlap = extractRating(ratings.audienceOverlap);
    const activationPotential = extractRating(ratings.activationPotential);
    const brandReputation = extractRating(ratings.brandReputation);
    const scalability = extractRating(ratings.scalability);
    const resourcesBeyondMoney = extractRating(ratings.resourcesBeyondMoney);

    // Define weights for each factor (you can adjust these based on importance)
    const weights = {
      missionFit: 0.25,           // 25% - How well aligned with mission
      audienceOverlap: 0.20,     // 20% - Audience alignment
      activationPotential: 0.20, // 20% - Potential for activation
      brandReputation: 0.15,     // 15% - Brand strength
      scalability: 0.10,         // 10% - Scalability potential
      resourcesBeyondMoney: 0.10  // 10% - Additional resources
    };

    // Calculate weighted average
    const weightedSum = 
      (missionFit * weights.missionFit) +
      (audienceOverlap * weights.audienceOverlap) +
      (activationPotential * weights.activationPotential) +
      (brandReputation * weights.brandReputation) +
      (scalability * weights.scalability) +
      (resourcesBeyondMoney * weights.resourcesBeyondMoney);

    // Return rounded to 2 decimal places
    return Math.round(weightedSum * 100) / 100;
  };

  // Separate active and inactive prospects using current values (including pending changes)
  const filteredPartners = useMemo(() => {
    const filtered = getFilteredPartners();
    const searched = searchPartners(filtered);
    return sortPartners(searched);
  }, [partners, selectedStatusFilters, selectedIndustryFilters, selectedPriorityFilters, selectedPartnershipTypeFilters, searchQuery, sortBy, sortDirection, pendingChanges]);
  const activeProspects = useMemo(() => 
    filteredPartners.filter(partner => getCurrentValue(partner, 'status') !== 'inactive'),
    [filteredPartners, pendingChanges]
  );
  const inactiveProspects = useMemo(() => 
    filteredPartners.filter(partner => getCurrentValue(partner, 'status') === 'inactive'),
    [filteredPartners, pendingChanges]
  );

  // Helper function to render editable cell
  const renderEditableCell = (partner: PartnerProspect, field: keyof PartnerFormData, value: any, type: 'text' | 'select' | 'number' | 'email' | 'tel' | 'url' = 'text', options?: string[]) => {
    const isEditing = editingPartner === partner.id && editingField === field;
    const hasPendingChange = pendingChanges[partner.id]?.[field] !== undefined;
    const currentValue = getCurrentValue(partner, field);
    const displayValue = isEditing 
      ? (editingValues[field] !== undefined ? editingValues[field] : currentValue)
      : currentValue;

    if (isEditing) {
      if (type === 'select' && options) {
        const allOptions = getOptionsForField(field);
        return (
          <div className="relative">
            <select
              value={displayValue || ''}
              onChange={(e) => {
                if (e.target.value === '__ADD_CUSTOM__') {
                  setShowAddOption(field);
                } else {
                  updateEditingValue(field, e.target.value);
                }
              }}
              onBlur={() => {
                if (showAddOption !== field) {
                  finishEditing();
                }
              }}
              className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
              autoFocus
            >
              <option value="">Select {field}</option>
              {allOptions.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                </option>
              ))}
              <option value="__ADD_CUSTOM__" className="text-[#d7ff00] font-medium">
                + Add Custom Option
              </option>
            </select>
            
            {showAddOption === field && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-[#262a30] border border-[#d7ff00] rounded z-50">
                <input
                  type="text"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addCustomOption(field);
                    } else if (e.key === 'Escape') {
                      setShowAddOption(null);
                      setNewOptionValue('');
                    }
                  }}
                  placeholder={`Enter new ${field} option`}
                  className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-[#d7ff00]"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => addCustomOption(field)}
                    className="px-2 py-1 bg-[#d7ff00] text-black rounded text-xs hover:bg-[#c5e600]"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddOption(null);
                      setNewOptionValue('');
                    }}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      } else {
        return (
          <input
            type={type}
            value={displayValue || ''}
            onChange={(e) => updateEditingValue(field, e.target.value)}
            onBlur={() => finishEditing()}
            onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
            className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
            autoFocus
            step={type === 'number' ? '0.1' : undefined}
          />
        );
      }
    }

    return (
      <div
        className={`cursor-pointer hover:bg-[#262a30] px-2 py-1 rounded transition-colors relative ${
          hasPendingChange ? 'bg-yellow-900/20 border border-yellow-500/30' : ''
        }`}
        onClick={() => startEditing(partner.id, field, value)}
        title={`Click to edit ${field}${hasPendingChange ? ' (has unsaved changes)' : ''}`}
      >
        {hasPendingChange && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        )}
        {displayValue || <span className="text-gray-500 italic">Click to add</span>}
      </div>
    );
  };

  // Helper function to render rating stars with editing
  const renderEditableRating = (partner: PartnerProspect, field: keyof PartnerFormData, value: string, color: string) => {
    const isEditing = editingPartner === partner.id && editingField === field;
    const hasPendingChange = pendingChanges[partner.id]?.[field] !== undefined;
    const currentValue = getCurrentValue(partner, field);
    const displayValue = isEditing 
      ? (editingValues[field] !== undefined ? editingValues[field] : currentValue)
      : currentValue;

    if (isEditing) {
      const allOptions = getOptionsForField(field);
      return (
        <div className="relative">
          <select
            value={displayValue || ''}
            onChange={(e) => {
              if (e.target.value === '__ADD_CUSTOM__') {
                setShowAddOption(field);
              } else {
                updateEditingValue(field, e.target.value);
              }
            }}
            onBlur={() => {
              if (showAddOption !== field) {
                finishEditing();
              }
            }}
            className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
            autoFocus
          >
            <option value="">Select rating</option>
            {allOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value="__ADD_CUSTOM__" className="text-[#d7ff00] font-medium">
              + Add Custom Rating
            </option>
          </select>
          
          {showAddOption === field && (
            <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-[#262a30] border border-[#d7ff00] rounded z-50">
              <input
                type="text"
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addCustomOption(field);
                  } else if (e.key === 'Escape') {
                    setShowAddOption(null);
                    setNewOptionValue('');
                  }
                }}
                placeholder={`Enter new ${field} rating`}
                className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-[#d7ff00]"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addCustomOption(field)}
                  className="px-2 py-1 bg-[#d7ff00] text-black rounded text-xs hover:bg-[#c5e600]"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddOption(null);
                    setNewOptionValue('');
                  }}
                  className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        className={`flex items-center cursor-pointer hover:bg-[#262a30] px-2 py-1 rounded transition-colors relative ${
          hasPendingChange ? 'bg-yellow-900/20 border border-yellow-500/30' : ''
        }`}
        onClick={() => startEditing(partner.id, field, value)}
        title={`Click to edit ${field}${hasPendingChange ? ' (has unsaved changes)' : ''}`}
      >
        {hasPendingChange && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        )}
        {displayValue && (() => {
          const rating = parseInt(displayValue.toString().charAt(0)) || 0;
          return (
            <>
              {Array.from({ length: rating }).map((_, i) => (
                <Star key={i} className={`w-3 h-3 ${color} fill-current`} />
              ))}
              {Array.from({ length: 5 - rating }).map((_, i) => (
                <Star key={i} className="w-3 h-3 text-gray-600" />
              ))}
            </>
          );
        })()}
        <span className="ml-1 text-xs text-gray-400">{displayValue || 'Click to rate'}</span>
      </div>
    );
  };

  // Helper function to render active prospect card
  const renderActiveProspectCard = (partner: PartnerProspect) => {
    const currentStatus = getCurrentValue(partner, 'status');
    return (
      <div key={partner.id} className="bg-[#1a1e24] border border-[#d7ff00] rounded-xl p-6 hover:bg-[#1e2329] transition-all duration-200 hover:shadow-lg">
        {/* Header with Company Name and Status */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-xl mb-2 truncate">
              {renderEditableCell(partner, 'companyName', getCurrentValue(partner, 'companyName'), 'text')}
            </h3>
            <p className="text-gray-400 text-base">
              {renderEditableCell(partner, 'contactPerson', getCurrentValue(partner, 'contactPerson'), 'text')}
            </p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              currentStatus === 'contacted' ? 'bg-blue-900 text-blue-200' :
              currentStatus === 'interested' ? 'bg-green-900 text-green-200' :
              currentStatus === 'negotiating' ? 'bg-yellow-900 text-yellow-200' :
              currentStatus === 'closed-won' ? 'bg-emerald-900 text-emerald-200' :
              currentStatus === 'closed-lost' ? 'bg-red-900 text-red-200' :
              currentStatus === 'on-hold' ? 'bg-gray-900 text-gray-200' :
              'bg-gray-900 text-gray-200'
            }`}>
              {renderEditableCell(partner, 'status', getCurrentValue(partner, 'status'), 'select', getOptionsForField('status'))}
            </span>
            <button
              onClick={() => openDetailModal(partner)}
              className="p-2 bg-[#262a30] hover:bg-[#2a2e35] rounded-lg transition-colors text-gray-400 hover:text-[#d7ff00]"
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Basic Info Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Industry</p>
            <div className="text-white text-sm">
              {renderEditableCell(partner, 'industry', getCurrentValue(partner, 'industry'), 'select', getOptionsForField('industry'))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Partnership Type</p>
            <div className="text-white text-sm">
              {renderEditableCell(partner, 'partnershipType', getCurrentValue(partner, 'partnershipType'), 'select', getOptionsForField('partnershipType'))}
            </div>
          </div>
        </div>

        {/* Ratings Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Mission Fit</p>
            <div>
              {renderEditableRating(partner, 'missionFit', getCurrentValue(partner, 'missionFit'), 'text-yellow-400')}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Audience Overlap</p>
            <div>
              {renderEditableRating(partner, 'audienceOverlap', getCurrentValue(partner, 'audienceOverlap'), 'text-blue-400')}
            </div>
          </div>
        </div>

        {/* Score and Priority */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Weighted Score</p>
            <div className="text-[#d7ff00] font-semibold text-lg bg-gray-800/50 px-3 py-1 rounded">
              {getCurrentValue(partner, 'weightedPriorityScore') || '0.00'}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Priority</p>
            <div className="text-white">
              {renderEditableCell(partner, 'priority', getCurrentValue(partner, 'priority'), 'select', getOptionsForField('priority'))}
            </div>
          </div>
        </div>

        {/* Footer with Links */}
        <div className="flex items-center gap-4 pt-4 border-t border-gray-700">
          {getCurrentValue(partner, 'website') && (
            <a
              href={getCurrentValue(partner, 'website')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#d7ff00] hover:text-[#c5e600] flex items-center gap-2 transition-colors"
              title="Visit website"
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm font-medium">Website</span>
            </a>
          )}
          {getCurrentValue(partner, 'linkedin') && (
            <a
              href={getCurrentValue(partner, 'linkedin')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"
              title="View LinkedIn"
            >
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">LinkedIn</span>
            </a>
          )}
          {getCurrentValue(partner, 'email') && (
            <a
              href={`mailto:${getCurrentValue(partner, 'email')}`}
              className="text-gray-400 hover:text-gray-300 flex items-center gap-2 transition-colors"
              title="Send email"
            >
              <Mail className="w-4 h-4" />
              <span className="text-sm font-medium">Email</span>
            </a>
          )}
        </div>
      </div>
    );
  };

  // Helper function to render new prospect row
  const renderNewProspectCell = (columnKey: string) => {
    const renderNewEditableCell = (field: keyof PartnerFormData, type: 'text' | 'select' | 'number' | 'email' | 'tel' | 'url' = 'text', options?: string[]) => {
      const value = newProspectData[field] || '';

      if (type === 'select' && options) {
        const allOptions = getOptionsForField(field);
        return (
          <div className="relative">
            <select
              value={value}
              onChange={(e) => {
                if (e.target.value === '__ADD_CUSTOM__') {
                  setShowAddOption(field);
                } else {
                  updateNewProspectData(field, e.target.value);
                }
              }}
              className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
            >
              <option value="">Select {field}</option>
              {allOptions.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                </option>
              ))}
              <option value="__ADD_CUSTOM__" className="text-[#d7ff00] font-medium">
                + Add Custom Option
              </option>
            </select>
            
            {showAddOption === field && (
              <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-[#262a30] border border-[#d7ff00] rounded z-50">
                <input
                  type="text"
                  value={newOptionValue}
                  onChange={(e) => setNewOptionValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addCustomOption(field);
                    } else if (e.key === 'Escape') {
                      setShowAddOption(null);
                      setNewOptionValue('');
                    }
                  }}
                  placeholder={`Enter new ${field} option`}
                  className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-[#d7ff00]"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => addCustomOption(field)}
                    className="px-2 py-1 bg-[#d7ff00] text-black rounded text-xs hover:bg-[#c5e600]"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowAddOption(null);
                      setNewOptionValue('');
                    }}
                    className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      } else {
        return (
          <input
            type={type}
            value={value}
            onChange={(e) => updateNewProspectData(field, e.target.value)}
            placeholder={`Enter ${field}`}
            className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none placeholder-gray-400"
            step={type === 'number' ? '0.1' : undefined}
          />
        );
      }
    };

    const renderNewRatingCell = (field: keyof PartnerFormData) => {
      const allOptions = getOptionsForField(field);
      return (
        <div className="relative">
          <select
            value={newProspectData[field] || ''}
            onChange={(e) => {
              if (e.target.value === '__ADD_CUSTOM__') {
                setShowAddOption(field);
              } else {
                updateNewProspectData(field, e.target.value);
              }
            }}
            className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
          >
            <option value="">Select rating</option>
            {allOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value="__ADD_CUSTOM__" className="text-[#d7ff00] font-medium">
              + Add Custom Rating
            </option>
          </select>
          
          {showAddOption === field && (
            <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-[#262a30] border border-[#d7ff00] rounded z-50">
              <input
                type="text"
                value={newOptionValue}
                onChange={(e) => setNewOptionValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addCustomOption(field);
                  } else if (e.key === 'Escape') {
                    setShowAddOption(null);
                    setNewOptionValue('');
                  }
                }}
                placeholder={`Enter new ${field} rating`}
                className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-[#d7ff00]"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addCustomOption(field)}
                  className="px-2 py-1 bg-[#d7ff00] text-black rounded text-xs hover:bg-[#c5e600]"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddOption(null);
                    setNewOptionValue('');
                  }}
                  className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      );
    };

    switch (columnKey) {
      case 'select':
        return isSelectionMode ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 bg-gray-600 rounded border border-gray-500 flex items-center justify-center">
              <span className="text-xs text-gray-400">+</span>
            </div>
          </div>
        ) : null;
      case 'company':
        return (
          <div>
            <div className="font-medium text-white mb-1">
              {renderNewEditableCell('companyName', 'text')}
            </div>
            <div className="text-sm">
              {renderNewEditableCell('location', 'text')}
            </div>
          </div>
        );
      case 'contact':
        return (
          <div>
            <div className="text-white mb-1">
              {renderNewEditableCell('contactPerson', 'text')}
            </div>
            <div className="text-xs">
              {renderNewEditableCell('contactNames', 'text')}
            </div>
          </div>
        );
      case 'email':
        return renderNewEditableCell('email', 'email');
      case 'industry':
        return renderNewEditableCell('industry', 'select', getOptionsForField('industry'));
      case 'partnershipType':
        return renderNewEditableCell('partnershipType', 'select', getOptionsForField('partnershipType'));
      case 'partnershipTier':
        return renderNewEditableCell('partnershipTier', 'select', getOptionsForField('partnershipTier'));
      case 'missionFit':
        return renderNewRatingCell('missionFit');
      case 'audienceOverlap':
        return renderNewRatingCell('audienceOverlap');
      case 'activationPotential':
        return renderNewRatingCell('activationPotential');
      case 'brandReputation':
        return renderNewRatingCell('brandReputation');
      case 'scalability':
        return renderNewRatingCell('scalability');
      case 'resourcesBeyondMoney':
        return renderNewRatingCell('resourcesBeyondMoney');
      case 'weightedScore':
        // Auto-calculate weighted score for new prospects
        const newProspectRatings = {
          missionFit: newProspectData.missionFit,
          audienceOverlap: newProspectData.audienceOverlap,
          activationPotential: newProspectData.activationPotential,
          brandReputation: newProspectData.brandReputation,
          scalability: newProspectData.scalability,
          resourcesBeyondMoney: newProspectData.resourcesBeyondMoney,
        };
        const calculatedScore = calculateWeightedScore(newProspectRatings);
        
        return (
          <div className="font-medium text-[#d7ff00] bg-gray-800/50 px-2 py-1 rounded">
            {calculatedScore.toFixed(2)}
          </div>
        );
      case 'status':
        return (
          <div className="text-white">
            {renderNewEditableCell('status', 'select', getOptionsForField('status'))}
          </div>
        );
      case 'contactStatus':
        return (
          <div className="text-white">
            {renderNewEditableCell('contactStatus', 'select', getOptionsForField('contactStatus'))}
          </div>
        );
      case 'priority':
        return (
          <div className="text-white">
            {renderNewEditableCell('priority', 'select', getOptionsForField('priority'))}
          </div>
        );
      case 'potentialValue':
        return renderNewEditableCell('potentialValue', 'text');
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">New prospect</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Helper function to render table cell content based on column type
  const renderTableCell = (partner: PartnerProspect, columnKey: string) => {
    switch (columnKey) {
      case 'select':
        return isSelectionMode ? (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={selectedPartners.has(partner.id)}
              onChange={() => togglePartnerSelection(partner.id)}
              className="w-4 h-4 text-[#d7ff00] bg-gray-700 border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-2"
            />
          </div>
        ) : null;
      case 'company':
        return (
          <div>
            <div className="font-medium text-white">
              {renderEditableCell(partner, 'companyName', getCurrentValue(partner, 'companyName'), 'text')}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {renderEditableCell(partner, 'location', getCurrentValue(partner, 'location'), 'text')}
            </div>
          </div>
        );
      case 'contact':
        return (
          <div>
            <div className="text-white">
              {renderEditableCell(partner, 'contactPerson', getCurrentValue(partner, 'contactPerson'), 'text')}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {renderEditableCell(partner, 'contactNames', getCurrentValue(partner, 'contactNames'), 'text')}
            </div>
          </div>
        );
      case 'email':
        return renderEditableCell(partner, 'email', getCurrentValue(partner, 'email'), 'email');
      case 'industry':
        return renderEditableCell(partner, 'industry', getCurrentValue(partner, 'industry'), 'select', getOptionsForField('industry'));
      case 'partnershipType':
        return renderEditableCell(partner, 'partnershipType', getCurrentValue(partner, 'partnershipType'), 'select', getOptionsForField('partnershipType'));
      case 'partnershipTier':
        return renderEditableCell(partner, 'partnershipTier', getCurrentValue(partner, 'partnershipTier'), 'select', getOptionsForField('partnershipTier'));
      case 'missionFit':
        return renderEditableRating(partner, 'missionFit', getCurrentValue(partner, 'missionFit'), 'text-yellow-400');
      case 'audienceOverlap':
        return renderEditableRating(partner, 'audienceOverlap', getCurrentValue(partner, 'audienceOverlap'), 'text-blue-400');
      case 'activationPotential':
        return renderEditableRating(partner, 'activationPotential', getCurrentValue(partner, 'activationPotential'), 'text-green-400');
      case 'brandReputation':
        return renderEditableRating(partner, 'brandReputation', getCurrentValue(partner, 'brandReputation'), 'text-purple-400');
      case 'scalability':
        return renderEditableRating(partner, 'scalability', getCurrentValue(partner, 'scalability'), 'text-orange-400');
      case 'resourcesBeyondMoney':
        return renderEditableRating(partner, 'resourcesBeyondMoney', getCurrentValue(partner, 'resourcesBeyondMoney'), 'text-pink-400');
      case 'weightedScore':
        return (
          <div className="font-medium text-[#d7ff00] bg-gray-800/50 px-2 py-1 rounded">
            {getCurrentValue(partner, 'weightedPriorityScore') || '0.00'}
          </div>
        );
      case 'status':
        return (
          <div className="text-white">
            {renderEditableCell(partner, 'status', getCurrentValue(partner, 'status'), 'select', getOptionsForField('status'))}
          </div>
        );
      case 'contactStatus':
        return (
          <div className="text-white">
            {renderEditableCell(partner, 'contactStatus', getCurrentValue(partner, 'contactStatus'), 'select', getOptionsForField('contactStatus'))}
          </div>
        );
      case 'priority':
        return (
          <div className="text-white">
            {renderEditableCell(partner, 'priority', getCurrentValue(partner, 'priority'), 'select', getOptionsForField('priority'))}
          </div>
        );
      case 'potentialValue':
        return renderEditableCell(partner, 'potentialValue', getCurrentValue(partner, 'potentialValue'), 'text');
      case 'actions':
        return (
          <div className="flex items-center gap-2">
            {partner.website && (
              <a
                href={partner.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d7ff00] hover:text-[#c5e600]"
                title="Visit website"
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
            {partner.linkedin && (
              <a
                href={partner.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
                title="View LinkedIn"
              >
                <User className="w-4 h-4" />
              </a>
            )}
            {partner.email && (
              <a
                href={`mailto:${partner.email}`}
                className="text-gray-400 hover:text-gray-300"
                title="Send email"
              >
                <Mail className="w-4 h-4" />
              </a>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Helper function to render detailed modal
  const renderDetailModal = () => {
    if (!selectedPartnerForModal) return null;

    const partner = selectedPartnerForModal;
    const currentStatus = getCurrentValue(partner, 'status');

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1a1e24] border border-[#d7ff00] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {getCurrentValue(partner, 'companyName') || 'Partner Details'}
              </h2>
              <p className="text-gray-400 mt-1">
                {getCurrentValue(partner, 'contactPerson')}
              </p>
            </div>
            <button
              onClick={closeDetailModal}
              className="p-2 bg-[#262a30] hover:bg-[#2a2e35] rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-8">
            {/* Status and Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Status</label>
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  currentStatus === 'contacted' ? 'bg-blue-900 text-blue-200' :
                  currentStatus === 'interested' ? 'bg-green-900 text-green-200' :
                  currentStatus === 'negotiating' ? 'bg-yellow-900 text-yellow-200' :
                  currentStatus === 'closed-won' ? 'bg-emerald-900 text-emerald-200' :
                  currentStatus === 'closed-lost' ? 'bg-red-900 text-red-200' :
                  currentStatus === 'on-hold' ? 'bg-gray-900 text-gray-200' :
                  'bg-gray-900 text-gray-200'
                }`}>
                  {renderEditableCell(partner, 'status', getCurrentValue(partner, 'status'), 'select', getOptionsForField('status'))}
                </span>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Priority</label>
                <div className="text-white">
                  {renderEditableCell(partner, 'priority', getCurrentValue(partner, 'priority'), 'select', getOptionsForField('priority'))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Weighted Score</label>
                <div className="text-[#d7ff00] font-semibold text-xl bg-gray-800/50 px-3 py-2 rounded">
                  {getCurrentValue(partner, 'weightedPriorityScore') || '0.00'}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Email</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'email', getCurrentValue(partner, 'email'), 'email')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Phone</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'phone', getCurrentValue(partner, 'phone'), 'tel')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Website</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'website', getCurrentValue(partner, 'website'), 'url')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">LinkedIn</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'linkedin', getCurrentValue(partner, 'linkedin'), 'url')}
                  </div>
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Industry</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'industry', getCurrentValue(partner, 'industry'), 'select', getOptionsForField('industry'))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Company Size</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'companySize', getCurrentValue(partner, 'companySize'), 'select', getOptionsForField('companySize'))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Location</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'location', getCurrentValue(partner, 'location'), 'text')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Country</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'country', getCurrentValue(partner, 'country'), 'text')}
                  </div>
                </div>
              </div>
            </div>

            {/* Partnership Details */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Partnership Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Partnership Type</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'partnershipType', getCurrentValue(partner, 'partnershipType'), 'select', getOptionsForField('partnershipType'))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Partnership Tier</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'partnershipTier', getCurrentValue(partner, 'partnershipTier'), 'select', getOptionsForField('partnershipTier'))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Potential Value</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'potentialValue', getCurrentValue(partner, 'potentialValue'), 'text')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Lead Source</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'leadSource', getCurrentValue(partner, 'leadSource'), 'select', getOptionsForField('leadSource'))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ratings */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Assessment Ratings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Mission Fit</label>
                  <div>
                    {renderEditableRating(partner, 'missionFit', getCurrentValue(partner, 'missionFit'), 'text-yellow-400')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Audience Overlap</label>
                  <div>
                    {renderEditableRating(partner, 'audienceOverlap', getCurrentValue(partner, 'audienceOverlap'), 'text-blue-400')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Activation Potential</label>
                  <div>
                    {renderEditableRating(partner, 'activationPotential', getCurrentValue(partner, 'activationPotential'), 'text-green-400')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Brand Reputation</label>
                  <div>
                    {renderEditableRating(partner, 'brandReputation', getCurrentValue(partner, 'brandReputation'), 'text-purple-400')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Scalability</label>
                  <div>
                    {renderEditableRating(partner, 'scalability', getCurrentValue(partner, 'scalability'), 'text-orange-400')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Resources Beyond Money</label>
                  <div>
                    {renderEditableRating(partner, 'resourcesBeyondMoney', getCurrentValue(partner, 'resourcesBeyondMoney'), 'text-pink-400')}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Notes & Justification</h3>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">General Notes</label>
                  <div className="text-white">
                    {renderEditableCell(partner, 'notes', getCurrentValue(partner, 'notes'), 'text')}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-300">Notes & Justification</label>
                  <textarea
                    value={getCurrentValue(partner, 'notesJustification') || ''}
                    onChange={(e) => {
                      // Handle notes editing
                      const newPendingChanges = {
                        ...pendingChanges,
                        [partner.id]: {
                          ...pendingChanges[partner.id],
                          notesJustification: e.target.value
                        }
                      };
                      setPendingChanges(newPendingChanges);
                      savePendingChangesToStorage(newPendingChanges);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Add detailed notes and justification for ratings..."
                    className="w-full h-32 px-4 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00] resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 p-6 border-t border-gray-700">
            <button
              onClick={closeDetailModal}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBulkImport = () => (
    <div className="space-y-6">
      {/* Input Type Selection */}
      <div className="flex space-x-4">
        <button
          onClick={() => setBulkInputType('text')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            bulkInputType === 'text'
              ? 'bg-[#d7ff00] text-black'
              : 'bg-[#262a30] text-gray-300 hover:bg-[#2a2e35]'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Text/Spreadsheet Data
        </button>
        <button
          onClick={() => setBulkInputType('image')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            bulkInputType === 'image'
              ? 'bg-[#d7ff00] text-black'
              : 'bg-[#262a30] text-gray-300 hover:bg-[#2a2e35]'
          }`}
        >
          <ImageIcon className="w-4 h-4 inline mr-2" />
          Screenshot/Image
        </button>
      </div>

      {/* Text Input */}
      {bulkInputType === 'text' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Paste your spreadsheet data or partner list here:
          </label>
          <textarea
            value={spreadsheetData}
            onChange={(e) => setSpreadsheetData(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Paste your data here... (CSV, tab-separated, or any structured text format)"
          />
        </div>
      )}

      {/* Image Upload */}
      {bulkInputType === 'image' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Upload screenshots or images of your partner data:
          </label>
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="image-upload"
            />
            <label
              htmlFor="image-upload"
              className="cursor-pointer flex flex-col items-center space-y-2"
            >
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-gray-400">Click to upload images or drag and drop</span>
              <span className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB each</span>
            </label>
          </div>

          {/* Image Previews */}
          {imagePreviewUrls.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
              {imagePreviewUrls.map((url, index) => (
                <div key={index} className="relative">
                  <img
                    src={url}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-gray-600"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Process Button */}
      <div className="flex gap-4">
        <button
          onClick={processBulkData}
          disabled={processingBulk || (bulkInputType === 'text' && !spreadsheetData.trim()) || (bulkInputType === 'image' && uploadedImages.length === 0)}
          className="px-6 py-2 bg-[#d7ff00] text-black font-medium rounded-lg hover:bg-[#c5e600] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {processingBulk ? <Loader2 className="animate-spin w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {processingBulk ? 'Processing with AI...' : 'Extract Data with AI'}
        </button>
      </div>

      {/* Preview Data */}
      {previewData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Preview Extracted Data ({previewData.length} prospects)
              </h3>
              {previewData.some(p => p.isDuplicate) && (
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="text-green-300">
                    {previewData.filter(p => !p.isDuplicate).length} new
                  </span>
                  <span className="text-orange-300">
                    {previewData.filter(p => p.isDuplicate).length} duplicates
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBulkData}
                disabled={savingBulk}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingBulk ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                {savingBulk ? 'Saving...' : 'Save All'}
              </button>
              <button
                onClick={() => setPreviewData([])}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear All
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {previewData.map((prospect, index) => (
              <div key={index} className={`rounded-lg p-4 border ${
                prospect.isDuplicate 
                  ? 'bg-orange-900/20 border-orange-500/50' 
                  : 'bg-[#262a30] border-gray-600'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">Prospect {index + 1}</h4>
                    {prospect.isDuplicate && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                        <span className="text-xs text-orange-300 font-medium">DUPLICATE</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {prospect.isDuplicate && (
                      <select
                        value={prospect.duplicateAction || 'skip'}
                        onChange={(e) => updatePreviewData(index, 'duplicateAction', e.target.value)}
                        className="px-2 py-1 bg-[#1a1e24] border border-orange-500 rounded text-white text-xs"
                      >
                        <option value="skip">Skip</option>
                        <option value="update">Update Existing</option>
                        <option value="add">Add Anyway</option>
                      </select>
                    )}
                    <button
                      onClick={() => removePreviewItem(index)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={prospect.companyName}
                      onChange={(e) => updatePreviewData(index, 'companyName', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Primary Contact</label>
                    <input
                      type="text"
                      value={prospect.contactPerson}
                      onChange={(e) => updatePreviewData(index, 'contactPerson', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">All Contacts</label>
                    <input
                      type="text"
                      value={prospect.contactNames}
                      onChange={(e) => updatePreviewData(index, 'contactNames', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={prospect.email}
                      onChange={(e) => updatePreviewData(index, 'email', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Industry</label>
                    <select
                      value={prospect.industry}
                      onChange={(e) => updatePreviewData(index, 'industry', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select industry</option>
                      {getOptionsForField('industry').map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Partnership Type</label>
                    <select
                      value={prospect.partnershipType}
                      onChange={(e) => updatePreviewData(index, 'partnershipType', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select type</option>
                      {getOptionsForField('partnershipType').map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Partnership Tier</label>
                    <select
                      value={prospect.partnershipTier}
                      onChange={(e) => updatePreviewData(index, 'partnershipTier', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select tier</option>
                      {partnershipTierOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Mission Fit (1-5)</label>
                    <select
                      value={prospect.missionFit}
                      onChange={(e) => updatePreviewData(index, 'missionFit', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select rating</option>
                      {ratingOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Audience Overlap (1-5)</label>
                    <select
                      value={prospect.audienceOverlap}
                      onChange={(e) => updatePreviewData(index, 'audienceOverlap', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select rating</option>
                      {ratingOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Activation Potential (1-5)</label>
                    <select
                      value={prospect.activationPotential}
                      onChange={(e) => updatePreviewData(index, 'activationPotential', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select rating</option>
                      {ratingOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Brand Reputation (1-5)</label>
                    <select
                      value={prospect.brandReputation}
                      onChange={(e) => updatePreviewData(index, 'brandReputation', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select rating</option>
                      {ratingOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Scalability (1-5)</label>
                    <select
                      value={prospect.scalability}
                      onChange={(e) => updatePreviewData(index, 'scalability', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select rating</option>
                      {ratingOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Resources Beyond Money (1-5)</label>
                    <select
                      value={prospect.resourcesBeyondMoney}
                      onChange={(e) => updatePreviewData(index, 'resourcesBeyondMoney', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      <option value="">Select rating</option>
                      {ratingOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Weighted Priority Score (Auto-calculated)</label>
                    <div className="w-full px-2 py-1 bg-gray-800/50 border border-gray-600 rounded text-[#d7ff00] text-sm font-semibold">
                      {calculateWeightedScore(prospect).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Partnership Status</label>
                    <select
                      value={prospect.status}
                      onChange={(e) => updatePreviewData(index, 'status', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      {statusOptions.map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Contact Status</label>
                    <select
                      value={prospect.contactStatus}
                      onChange={(e) => updatePreviewData(index, 'contactStatus', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    >
                      {contactStatusOptions.map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {(prospect.notes || prospect.notesJustification) && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">General Notes</label>
                      <textarea
                        value={prospect.notes}
                        onChange={(e) => updatePreviewData(index, 'notes', e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Notes / Justification</label>
                      <textarea
                        value={prospect.notesJustification}
                        onChange={(e) => updatePreviewData(index, 'notesJustification', e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderForm = () => (
    <form onSubmit={handleSaveForm} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            Company Name *
          </label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Enter company name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Primary Contact Person
          </label>
          <input
            type="text"
            value={formData.contactPerson}
            onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Enter primary contact person"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Users className="w-4 h-4 inline mr-2" />
            All Contact Names
          </label>
          <input
            type="text"
            value={formData.contactNames}
            onChange={(e) => setFormData({...formData, contactNames: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Enter all contact names (comma separated)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Enter email"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Phone className="w-4 h-4 inline mr-2" />
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Enter phone number"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Globe className="w-4 h-4 inline mr-2" />
            Website
          </label>
          <input
            type="url"
            value={formData.website}
            onChange={(e) => setFormData({...formData, website: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            LinkedIn
          </label>
          <input
            type="url"
            value={formData.linkedin}
            onChange={(e) => setFormData({...formData, linkedin: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="LinkedIn profile URL"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Industry</label>
          <select
            value={formData.industry}
            onChange={(e) => setFormData({...formData, industry: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select industry</option>
            {getOptionsForField('industry').map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Company Size</label>
          <select
            value={formData.companySize}
            onChange={(e) => setFormData({...formData, companySize: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select company size</option>
            {companySizeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <MapPin className="w-4 h-4 inline mr-2" />
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => setFormData({...formData, location: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="City, State"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Country</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData({...formData, country: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="Enter country"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Partnership Type</label>
          <select
            value={formData.partnershipType}
            onChange={(e) => setFormData({...formData, partnershipType: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select partnership type</option>
            {getOptionsForField('partnershipType').map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Trophy className="w-4 h-4 inline mr-2" />
            Partnership Tier
          </label>
          <select
            value={formData.partnershipTier}
            onChange={(e) => setFormData({...formData, partnershipTier: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select partnership tier</option>
            {partnershipTierOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Star className="w-4 h-4 inline mr-2" />
            Mission Fit (1-5)
          </label>
          <select
            value={formData.missionFit}
            onChange={(e) => setFormData({...formData, missionFit: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select mission fit</option>
            {ratingOptions.map(option => (
              <option key={option} value={option}>{option} - {option === '1' ? 'Poor' : option === '2' ? 'Fair' : option === '3' ? 'Good' : option === '4' ? 'Very Good' : 'Excellent'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Users className="w-4 h-4 inline mr-2" />
            Audience Overlap (1-5)
          </label>
          <select
            value={formData.audienceOverlap}
            onChange={(e) => setFormData({...formData, audienceOverlap: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select audience overlap</option>
            {ratingOptions.map(option => (
              <option key={option} value={option}>{option} - {option === '1' ? 'Poor' : option === '2' ? 'Fair' : option === '3' ? 'Good' : option === '4' ? 'Very Good' : 'Excellent'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Target className="w-4 h-4 inline mr-2" />
            Activation Potential (1-5)
          </label>
          <select
            value={formData.activationPotential}
            onChange={(e) => setFormData({...formData, activationPotential: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select activation potential</option>
            {ratingOptions.map(option => (
              <option key={option} value={option}>{option} - {option === '1' ? 'Poor' : option === '2' ? 'Fair' : option === '3' ? 'Good' : option === '4' ? 'Very Good' : 'Excellent'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Trophy className="w-4 h-4 inline mr-2" />
            Brand Reputation (1-5)
          </label>
          <select
            value={formData.brandReputation}
            onChange={(e) => setFormData({...formData, brandReputation: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select brand reputation</option>
            {ratingOptions.map(option => (
              <option key={option} value={option}>{option} - {option === '1' ? 'Poor' : option === '2' ? 'Fair' : option === '3' ? 'Good' : option === '4' ? 'Very Good' : 'Excellent'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Scalability (1-5)
          </label>
          <select
            value={formData.scalability}
            onChange={(e) => setFormData({...formData, scalability: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select scalability</option>
            {ratingOptions.map(option => (
              <option key={option} value={option}>{option} - {option === '1' ? 'Poor' : option === '2' ? 'Fair' : option === '3' ? 'Good' : option === '4' ? 'Very Good' : 'Excellent'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-2" />
            Resources Beyond Money (1-5)
          </label>
          <select
            value={formData.resourcesBeyondMoney}
            onChange={(e) => setFormData({...formData, resourcesBeyondMoney: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select resources beyond money</option>
            {ratingOptions.map(option => (
              <option key={option} value={option}>{option} - {option === '1' ? 'Poor' : option === '2' ? 'Fair' : option === '3' ? 'Good' : option === '4' ? 'Very Good' : 'Excellent'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Star className="w-4 h-4 inline mr-2" />
            Weighted Priority Score (Auto-calculated)
          </label>
          <div className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-[#d7ff00] font-semibold">
            {calculateWeightedScore(formData).toFixed(2)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Partnership Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({...formData, status: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            {statusOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Contact Status</label>
          <select
            value={formData.contactStatus}
            onChange={(e) => setFormData({...formData, contactStatus: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            {contactStatusOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({...formData, priority: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            {priorityOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Lead Source</label>
          <select
            value={formData.leadSource}
            onChange={(e) => setFormData({...formData, leadSource: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          >
            <option value="">Select lead source</option>
            {leadSourceOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            Last Contact Date
          </label>
          <input
            type="date"
            value={formData.lastContactDate}
            onChange={(e) => setFormData({...formData, lastContactDate: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Calendar className="w-4 h-4 inline mr-2" />
            Next Follow-up Date
          </label>
          <input
            type="date"
            value={formData.nextFollowUpDate}
            onChange={(e) => setFormData({...formData, nextFollowUpDate: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-2" />
            Potential Value
          </label>
          <input
            type="text"
            value={formData.potentialValue}
            onChange={(e) => setFormData({...formData, potentialValue: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="e.g., $50,000"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <FileText className="w-4 h-4 inline mr-2" />
          General Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
          rows={3}
          className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
          placeholder="Enter general notes about this prospect..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          <FileText className="w-4 h-4 inline mr-2" />
          Notes / Justification
        </label>
        <textarea
          value={formData.notesJustification}
          onChange={(e) => setFormData({...formData, notesJustification: e.target.value})}
          rows={3}
          className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
          placeholder="Enter justification for ratings and partnership decisions..."
        />
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-[#d7ff00] text-black font-medium rounded-lg hover:bg-[#c5e600] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
          {loading ? 'Saving...' : 'Save Partner Prospect'}
        </button>
      </div>
    </form>
  );

  const renderTable = () => (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search prospects by company, contact, industry, notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-3 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00] focus:ring-1 focus:ring-[#d7ff00]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white transition-colors"
            title="Clear search"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filters and Sort */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Status</label>
          <select
            multiple
            value={selectedStatusFilters}
            onChange={(e) => setSelectedStatusFilters(Array.from(e.target.selectedOptions, option => option.value))}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
            size={3}
          >
            {statusOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Industry</label>
          <select
            multiple
            value={selectedIndustryFilters}
            onChange={(e) => setSelectedIndustryFilters(Array.from(e.target.selectedOptions, option => option.value))}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
            size={3}
          >
            {getOptionsForField('industry').map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Priority</label>
          <select
            multiple
            value={selectedPriorityFilters}
            onChange={(e) => setSelectedPriorityFilters(Array.from(e.target.selectedOptions, option => option.value))}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
            size={3}
          >
            {priorityOptions.map(option => (
              <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Filter by Partnership Type</label>
          <select
            multiple
            value={selectedPartnershipTypeFilters}
            onChange={(e) => setSelectedPartnershipTypeFilters(Array.from(e.target.selectedOptions, option => option.value))}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
            size={3}
          >
            {getOptionsForField('partnershipType').map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        
        {/* Sort Controls */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sort By</label>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#d7ff00]"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white hover:bg-[#2a2e35] transition-colors"
              title={`Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-gray-400">
          <p>
            Showing {filteredPartners.length} of {partners.length} partners
            {searchQuery && (
              <span className="ml-2 px-2 py-1 bg-[#d7ff00]/20 text-[#d7ff00] rounded text-sm">
                Search: "{searchQuery}"
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Add New Prospect Controls */}
          {isAddingNew && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-200 text-sm font-medium">
                  Adding new prospect
                </span>
              </div>
              <button
                onClick={saveNewProspect}
                disabled={savingNewProspect}
                className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black rounded-lg hover:bg-[#c5e600] transition-colors disabled:opacity-50 font-medium"
              >
                {savingNewProspect ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save New Prospect
              </button>
              <button
                onClick={cancelAddingNew}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}

          {/* Bulk Save Controls */}
          {hasUnsavedChanges && !isAddingNew && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-yellow-200 text-sm font-medium">
                  {Object.keys(pendingChanges).length} unsaved changes
                </span>
              </div>
              <button
                onClick={saveBulkChanges}
                disabled={isBulkSaving}
                className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black rounded-lg hover:bg-[#c5e600] transition-colors disabled:opacity-50 font-medium"
              >
                {isBulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save All Changes
              </button>
              <button
                onClick={discardBulkChanges}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Discard All
              </button>
            </>
          )}

          {editingPartner && !isAddingNew && (
            <>
              <button
                onClick={finishEditing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                Done
              </button>
              <button
                onClick={cancelEditing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}

          {/* Selection Mode Controls */}
          {!isAddingNew && !editingPartner && (
            <>
              {!isSelectionMode ? (
                <button
                  onClick={enterSelectionMode}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <CheckSquare className="w-4 h-4" />
                  Select
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {selectedPartners.size > 0 && (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-500/30 rounded-lg">
                        <span className="text-red-200 text-sm font-medium">
                          {selectedPartners.size} selected
                        </span>
                      </div>
                      <button
                        onClick={deleteSelectedPartners}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {isDeleting ? 'Deleting...' : 'Delete Selected'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={exitSelectionMode}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {/* Add New Button */}
          {!isAddingNew && !editingPartner && !isSelectionMode && (
            <button
              onClick={startAddingNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black rounded-lg hover:bg-[#c5e600] transition-colors font-medium"
            >
              <Users className="w-4 h-4" />
              Add New
            </button>
          )}
          <button
            onClick={resetColumnOrder}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            title="Reset column order to default"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Columns
          </button>
          <button
            onClick={loadPartners}
            className="flex items-center gap-2 px-4 py-2 bg-[#262a30] text-white rounded-lg hover:bg-[#2a2e35] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {!editingPartner && (
        <div className="mb-4 p-3 bg-[#262a30] rounded-lg border border-gray-600">
          <p className="text-sm text-gray-300">
            💡 <strong>Tip:</strong> Long press or drag column headers to reorder columns. Click any cell to edit inline.
          </p>
        </div>
      )}

      {/* Active Prospects Section */}
      {activeProspects.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <div className="w-3 h-3 bg-[#d7ff00] rounded-full animate-pulse"></div>
              Active Prospects
              <span className="bg-[#d7ff00] text-black px-2 py-1 rounded-full text-sm font-medium">
                {activeProspects.length}
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProspects.map(partner => renderActiveProspectCard(partner))}
          </div>
        </div>
      )}

      {loadingPartners ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin h-8 w-8 text-[#d7ff00]" />
        </div>
      ) : inactiveProspects.length > 0 ? (
        <div>
          {/* Inactive Prospects Section Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              Inactive Prospects
              <span className="bg-gray-600 text-white px-2 py-1 rounded-full text-sm font-medium">
                {inactiveProspects.length}
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                {columnOrder.map((columnKey) => {
                  const column = defaultColumns.find(col => col.key === columnKey);
                  if (!column) return null;
                  
                  return (
                    <th
                      key={columnKey}
                      className={`text-left py-3 px-4 text-gray-300 font-medium cursor-move select-none transition-all duration-200 ${
                        draggedColumn === columnKey ? 'opacity-50 bg-[#d7ff00]/10' : ''
                      } ${
                        dragOverColumn === columnKey && draggedColumn !== columnKey ? 'bg-[#d7ff00]/20 border-l-2 border-[#d7ff00]' : ''
                      } ${
                        isDragging ? 'hover:bg-[#d7ff00]/10' : 'hover:bg-[#262a30]'
                      }`}
                      draggable={!editingPartner} // Disable dragging while editing
                      onDragStart={() => !editingPartner && handleColumnDragStart(columnKey)}
                      onDragOver={(e) => !editingPartner && handleColumnDragOver(e, columnKey)}
                      onDrop={(e) => !editingPartner && handleColumnDrop(e, columnKey)}
                      onDragEnd={handleColumnDragEnd}
                      onMouseDown={() => !editingPartner && handleLongPressStart(columnKey)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      onTouchStart={() => !editingPartner && handleLongPressStart(columnKey)}
                      onTouchEnd={handleLongPressEnd}
                      title={editingPartner ? 'Finish editing to reorder columns' : 'Long press or drag to reorder columns'}
                    >
                      <div className="flex items-center gap-2">
                        {columnKey === 'select' && isSelectionMode ? (
                          <input
                            type="checkbox"
                            checked={selectedPartners.size > 0 && selectedPartners.size === filteredPartners.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                selectAllPartners();
                              } else {
                                clearSelection();
                              }
                            }}
                            className="w-4 h-4 text-[#d7ff00] bg-gray-700 border-gray-600 rounded focus:ring-[#d7ff00] focus:ring-2"
                          />
                        ) : columnKey !== 'select' ? (
                          <span>{column.label}</span>
                        ) : null}
                        {isDragging && draggedColumn === columnKey && (
                          <div className="w-2 h-2 bg-[#d7ff00] rounded-full animate-pulse" />
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {/* New Prospect Row */}
              {isAddingNew && (
                <tr className="border-b border-gray-800 bg-green-900/10 ring-1 ring-green-500/30">
                  {columnOrder.map((columnKey) => (
                    <td key={columnKey} className="py-3 px-4">
                      {renderNewProspectCell(columnKey)}
                    </td>
                  ))}
                </tr>
              )}
              
              {/* Existing Prospects */}
              {inactiveProspects.map((partner) => (
                <tr key={partner.id} className={`border-b border-gray-800 hover:bg-[#1a1e24] ${editingPartner === partner.id ? 'bg-[#1a1e24] ring-1 ring-[#d7ff00]' : ''}`}>
                  {columnOrder.map((columnKey) => (
                    <td key={columnKey} className="py-3 px-4">
                      {renderTableCell(partner, columnKey)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          {activeProspects.length > 0 
            ? `No inactive prospects found matching your ${searchQuery ? 'search and ' : ''}filters.`
            : `No partners found matching your ${searchQuery ? 'search and ' : ''}filters.`
          }
          {searchQuery && (
            <div className="mt-2">
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#d7ff00] hover:text-[#c5e600] underline"
              >
                Clear search to see all results
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <AdminRouteGuard>
      <Head>
        <title>Corporate Partners - Pulse Admin</title>
      </Head>

      {/* Detail Modal */}
      {showDetailModal && renderDetailModal()}

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold flex items-center">
              <Building2 className="text-[#d7ff00] mr-3 w-7 h-7" />
              Corporate Partner Prospects
            </h1>
          </div>

          {/* Navigation */}
          <div className="flex space-x-1 mb-8">
            <button
              onClick={() => setCurrentView('form')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'form'
                  ? 'bg-[#d7ff00] text-black'
                  : 'bg-[#262a30] text-gray-300 hover:bg-[#2a2e35]'
              }`}
            >
              Add Partner
            </button>
            <button
              onClick={() => setCurrentView('table')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'table'
                  ? 'bg-[#d7ff00] text-black'
                  : 'bg-[#262a30] text-gray-300 hover:bg-[#2a2e35]'
              }`}
            >
              View Partners
            </button>
            <button
              onClick={() => setCurrentView('bulk')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentView === 'bulk'
                  ? 'bg-[#d7ff00] text-black'
                  : 'bg-[#262a30] text-gray-300 hover:bg-[#2a2e35]'
              }`}
            >
              Bulk Import
            </button>
          </div>

          {/* Content */}
          <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl">
            {currentView === 'form' && renderForm()}
            {currentView === 'table' && renderTable()}
            {currentView === 'bulk' && renderBulkImport()}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastVisible && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium z-50 ${
          toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastMessage}
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default CorporatePartnersPage;
