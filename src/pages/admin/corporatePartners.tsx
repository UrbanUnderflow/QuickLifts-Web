import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, doc, setDoc, getDocs, query, orderBy, updateDoc, addDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Building2, Mail, User, MapPin, Globe, DollarSign, Calendar, Users, Trophy, FileText, Upload, Eye, Loader2, RefreshCw, Edit3, Check, X, AlertTriangle, Phone, Star, Target, Image as ImageIcon, Trash2 } from 'lucide-react';
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
  const defaultColumns = [
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

  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumns.map(col => col.key));

  // Local storage key for pending changes
  const PENDING_CHANGES_KEY = 'corporate-partners-pending-changes';

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
        status: 'new',
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
        status: prospect.status || 'new',
        priority: prospect.priority || 'medium',
        source: bulkInputType === 'image' ? 'bulk_image' : 'bulk_text'
      }));

      setPreviewData(processedData);
      showToast(`Successfully extracted ${processedData.length} partner prospects!`, 'success');
      
    } catch (error) {
      console.error('Error processing bulk data:', error);
      showToast(error instanceof Error ? error.message : 'Error processing bulk data', 'error');
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
      
      // Save all prospects
      const savePromises = previewData.map(async (prospect) => {
        const partnerData = {
          ...prospect,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        return addDoc(partnersRef, partnerData);
      });

      await Promise.all(savePromises);
      
      showToast(`Successfully saved ${previewData.length} partner prospects!`, 'success');
      
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
    setPreviewData(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
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
      const newPendingChanges = {
        ...pendingChanges,
        [editingPartner]: {
          ...pendingChanges[editingPartner],
          [field]: value
        }
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
    setColumnOrder(defaultColumns.map(col => col.key));
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

  // Load pending changes and custom options from localStorage on component mount
  useEffect(() => {
    const storedChanges = loadPendingChangesFromStorage();
    if (Object.keys(storedChanges).length > 0) {
      setPendingChanges(storedChanges);
      setHasUnsavedChanges(true);
      showToast(`Restored ${Object.keys(storedChanges).length} unsaved changes from previous session`, 'info');
    }
    
    // Load custom options
    loadCustomOptions();
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
  const getCurrentValue = (partner: PartnerProspect, field: keyof PartnerFormData) => {
    const pendingValue = pendingChanges[partner.id]?.[field];
    return pendingValue !== undefined ? pendingValue : partner[field];
  };

  // Separate active and inactive prospects using current values (including pending changes)
  const filteredPartners = useMemo(() => getFilteredPartners(), [partners, selectedStatusFilters, selectedIndustryFilters, selectedPriorityFilters, selectedPartnershipTypeFilters]);
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
        return (
          <select
            value={displayValue || ''}
            onChange={(e) => updateEditingValue(field, e.target.value)}
            onBlur={() => finishEditing()}
            className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
            autoFocus
          >
            <option value="">Select {field}</option>
            {options.map(option => (
              <option key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
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
      return (
        <select
          value={displayValue || ''}
          onChange={(e) => updateEditingValue(field, e.target.value)}
          onBlur={() => finishEditing()}
          className="w-full px-2 py-1 bg-[#262a30] border border-[#d7ff00] rounded text-white text-sm focus:outline-none"
          autoFocus
        >
          <option value="">Select rating</option>
          {ratingOptions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
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
      <div key={partner.id} className="bg-[#1a1e24] border border-[#d7ff00] rounded-lg p-4 hover:bg-[#1e2329] transition-colors">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-white text-lg">
              {renderEditableCell(partner, 'companyName', getCurrentValue(partner, 'companyName'), 'text')}
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {renderEditableCell(partner, 'contactPerson', getCurrentValue(partner, 'contactPerson'), 'text')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              currentStatus === 'contacted' ? 'bg-blue-900 text-blue-200' :
              currentStatus === 'interested' ? 'bg-green-900 text-green-200' :
              currentStatus === 'negotiating' ? 'bg-yellow-900 text-yellow-200' :
              currentStatus === 'closed-won' ? 'bg-emerald-900 text-emerald-200' :
              currentStatus === 'closed-lost' ? 'bg-red-900 text-red-200' :
              currentStatus === 'on-hold' ? 'bg-gray-900 text-gray-200' :
              'bg-gray-900 text-gray-200'
            }`}>
              {renderEditableCell(partner, 'status', getCurrentValue(partner, 'status'), 'select', statusOptions)}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Industry</p>
            <p className="text-white text-sm">
              {renderEditableCell(partner, 'industry', getCurrentValue(partner, 'industry'), 'select', industryOptions)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Partnership Type</p>
            <p className="text-white text-sm">
              {renderEditableCell(partner, 'partnershipType', getCurrentValue(partner, 'partnershipType'), 'select', partnershipTypeOptions)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Mission Fit</p>
            <div className="mt-1">
              {renderEditableRating(partner, 'missionFit', getCurrentValue(partner, 'missionFit'), 'text-yellow-400')}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Audience Overlap</p>
            <div className="mt-1">
              {renderEditableRating(partner, 'audienceOverlap', getCurrentValue(partner, 'audienceOverlap'), 'text-blue-400')}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Weighted Score</p>
            <p className="text-white font-medium">
              {renderEditableCell(partner, 'weightedPriorityScore', getCurrentValue(partner, 'weightedPriorityScore'), 'number')}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-700">
          <div className="flex items-center gap-3">
            {getCurrentValue(partner, 'website') && (
              <a
                href={getCurrentValue(partner, 'website')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d7ff00] hover:text-[#c5e600] flex items-center gap-1"
                title="Visit website"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs">Website</span>
              </a>
            )}
            {getCurrentValue(partner, 'linkedin') && (
              <a
                href={getCurrentValue(partner, 'linkedin')}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                title="View LinkedIn"
              >
                <User className="w-4 h-4" />
                <span className="text-xs">LinkedIn</span>
              </a>
            )}
            {getCurrentValue(partner, 'email') && (
              <a
                href={`mailto:${getCurrentValue(partner, 'email')}`}
                className="text-gray-400 hover:text-gray-300 flex items-center gap-1"
                title="Send email"
              >
                <Mail className="w-4 h-4" />
                <span className="text-xs">Email</span>
              </a>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Priority: {renderEditableCell(partner, 'priority', getCurrentValue(partner, 'priority'), 'select', priorityOptions)}
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render table cell content based on column type
  const renderTableCell = (partner: PartnerProspect, columnKey: string) => {
    switch (columnKey) {
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
        return renderEditableCell(partner, 'industry', getCurrentValue(partner, 'industry'), 'select', industryOptions);
      case 'partnershipType':
        return renderEditableCell(partner, 'partnershipType', getCurrentValue(partner, 'partnershipType'), 'select', partnershipTypeOptions);
      case 'partnershipTier':
        return renderEditableCell(partner, 'partnershipTier', getCurrentValue(partner, 'partnershipTier'), 'select', partnershipTierOptions);
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
          <div className="font-medium">
            {renderEditableCell(partner, 'weightedPriorityScore', getCurrentValue(partner, 'weightedPriorityScore'), 'number')}
          </div>
        );
      case 'status':
        return (
          <div className="text-white">
            {renderEditableCell(partner, 'status', getCurrentValue(partner, 'status'), 'select', statusOptions)}
          </div>
        );
      case 'contactStatus':
        return (
          <div className="text-white">
            {renderEditableCell(partner, 'contactStatus', getCurrentValue(partner, 'contactStatus'), 'select', contactStatusOptions)}
          </div>
        );
      case 'priority':
        return (
          <div className="text-white">
            {renderEditableCell(partner, 'priority', getCurrentValue(partner, 'priority'), 'select', priorityOptions)}
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
            <h3 className="text-lg font-semibold text-white">
              Preview Extracted Data ({previewData.length} prospects)
            </h3>
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
              <div key={index} className="bg-[#262a30] rounded-lg p-4 border border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-white">Prospect {index + 1}</h4>
                  <button
                    onClick={() => removePreviewItem(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                      {industryOptions.map(option => (
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
                      {partnershipTypeOptions.map(option => (
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
                    <label className="block text-xs text-gray-400 mb-1">Weighted Priority Score</label>
                    <input
                      type="number"
                      step="0.1"
                      value={prospect.weightedPriorityScore}
                      onChange={(e) => updatePreviewData(index, 'weightedPriorityScore', e.target.value)}
                      className="w-full px-2 py-1 bg-[#1a1e24] border border-gray-600 rounded text-white text-sm"
                    />
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
            {industryOptions.map(option => (
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
            {partnershipTypeOptions.map(option => (
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
            Weighted Priority Score
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.weightedPriorityScore}
            onChange={(e) => setFormData({...formData, weightedPriorityScore: e.target.value})}
            className="w-full px-3 py-2 bg-[#262a30] border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-[#d7ff00]"
            placeholder="e.g., 3.75"
          />
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
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            {industryOptions.map(option => (
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
            {partnershipTypeOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-gray-400">
          Showing {filteredPartners.length} of {partners.length} partners
        </p>
        <div className="flex items-center gap-2">
          {/* Bulk Save Controls */}
          {hasUnsavedChanges && (
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

          {editingPartner && (
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
                        <span>{column.label}</span>
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
            ? "No inactive prospects found matching your filters."
            : "No partners found matching your filters."
          }
        </div>
      )}
    </div>
  );

  return (
    <AdminRouteGuard>
      <Head>
        <title>Corporate Partners - Pulse Admin</title>
      </Head>
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
