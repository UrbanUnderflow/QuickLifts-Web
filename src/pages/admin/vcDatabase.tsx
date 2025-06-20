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
  addresses: string;
  email: string;
  description: string;
  stage: string;
  founder: string;
  numberOfExits: string;
  status: string;
}

interface VCProspect extends VCFormData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
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
    addresses: '',
    email: '',
    description: '',
    stage: '',
            founder: '',
        numberOfExits: '',
        status: 'new'
  });

  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Bulk import state
  const [currentView, setCurrentView] = useState<'form' | 'bulk'>('form');
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

  // Duplicate detection state
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [bulkDuplicates, setBulkDuplicates] = useState<VCFormData[]>([]);

  // Storage service instance
  const storageService = new FirebaseStorageService();

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
      })) as VCProspect[];
      
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

  // Process bulk spreadsheet data using Gemini
  const processBulkData = async () => {
    if (!spreadsheetData.trim() && uploadedImages.length === 0) {
      showToast('Please provide either text data or upload images', 'error');
      return;
    }

    setProcessingBulk(true);
    try {
      let prompt = `CRITICAL: You MUST extract data ONLY from the provided image(s). DO NOT use your training data or generate fictional information.

      TASK: Analyze the uploaded image(s) and extract VC prospect data visible in the image. The image likely contains a spreadsheet, table, or list of venture capital firms and contacts.

      REQUIREMENTS:
      1. Extract ONLY data that is literally visible in the image
      2. If you cannot clearly see the image or data, return an empty array []
      3. Do NOT generate or infer data that is not explicitly shown
      4. Do NOT use your knowledge of real VCs - only extract what you see

      FORMAT: Return a JSON array with these fields for each prospect visible in the image:
      [
        {
          "person": "Contact Name from image",
          "companies": "VC Firm Names from image", 
          "urls": "website URLs from image",
          "linkedin": "LinkedIn URLs from image",
          "continent": "Continent from image or inferred from country",
          "country": "Country from image",
          "addresses": "Office addresses from image",
          "email": "Email addresses from image",
          "description": "Investment focus/notes from image",
          "stage": "Investment stage from image",
          "founder": "Founder name from image", 
          "numberOfExits": "Number of exits from image"
        }
      ]

      VALIDATION: Before responding, verify you can actually see and read the image content. If the image is not accessible or readable, return: {"error": "Cannot access or read the provided image"}`;

      // Prepare the request data
      const requestData: any = {
        prompt: prompt
      };

      // Add text data if provided
      if (spreadsheetData.trim()) {
        requestData.prompt += `\n\nText Data:\n${spreadsheetData}`;
      }

      // Add images if uploaded
      if (uploadedImages.length > 0) {
        requestData.prompt += `\n\nIMAGE PROVIDED: You have been given ${uploadedImages.length} image(s) to analyze. Extract data ONLY from these images.`;
        
        // Upload images to Firebase Storage and get URLs
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
        
        // Test if image URLs are accessible
        for (const url of imageUrls) {
          try {
            const response = await fetch(url, { method: 'HEAD' });
            console.log(`✅ Image URL accessible: ${url} (Status: ${response.status})`);
          } catch (error) {
            console.error(`❌ Image URL not accessible: ${url}`, error);
          }
        }
        
        requestData.imageUrls = imageUrls;
      }

      // Log the request data being sent to AI
      console.log('📤 Request Data Sent to AI:', requestData);
      console.log('📤 Request Data (stringified):', JSON.stringify(requestData, null, 2));
      
      // Send prompt to Gemini via Firebase function
      const generateRef = await addDoc(collection(db, 'generate'), requestData);

      // Wait for response with retry logic
      let attempts = 30;
      let response = '';
      while (attempts > 0 && !response) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const snapshot = await getDoc(generateRef);
        const data = snapshot.data();
        if (data?.output) {
          response = data.output;
          break;
        }
        attempts--;
      }

      if (!response) {
        throw new Error('No response from AI service');
      }
      
      // Log the raw AI response for debugging
      console.log('🤖 Raw AI Response:', response);
      console.log('🤖 Raw AI Response (stringified):', JSON.stringify(response, null, 2));
      
      // Clean and parse response
      let cleanedResponse = response
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      
      console.log('🧹 Cleaned Response:', cleanedResponse);
      
      const parsedData = JSON.parse(cleanedResponse);
      console.log('📊 Parsed Data:', parsedData);
      
      // Check if AI returned an error or couldn't access the image
      if (parsedData && parsedData.error) {
        throw new Error(`AI Service Error: ${parsedData.error}`);
      }
      
      // Check if response looks like hallucinated data (famous VCs)
      const famousVCs = ['roelof botha', 'mary meeker', 'bill gurley', 'peter fenton', 'marc andreessen', 'john doerr'];
      if (Array.isArray(parsedData) && parsedData.length > 0) {
        const suspiciousCount = parsedData.filter(item => {
          const person = (item.person || '').toLowerCase();
          return famousVCs.some(famous => person.includes(famous));
        }).length;
        
        if (suspiciousCount > 0) {
          console.warn('⚠️ WARNING: AI appears to have hallucinated famous VC data instead of extracting from image');
          showToast('Warning: AI may have generated fictional data instead of reading the image. Please verify the results.', 'error');
        }
      }
      
      if (Array.isArray(parsedData)) {
        const processedData = parsedData.map(item => ({
          ...item,
          status: 'new' // Default status
        }));
        
        console.log('⚙️ Processed Data (with default status):', processedData);

        // Filter out duplicates and track them
        const uniqueData: VCFormData[] = [];
        const duplicateData: VCFormData[] = [];

        processedData.forEach(prospect => {
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
      } else {
        throw new Error('Response is not an array');
      }
    } catch (error) {
      console.error('Error processing bulk data:', error);
      showToast('Failed to process data. Please check format and try again.', 'error');
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

  // Load data on component mount
  useEffect(() => {
    fetchVCProspects();
  }, []);

  // Cleanup image URLs on component unmount
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

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
        addresses: '',
        email: '',
        description: '',
        stage: '',
        founder: '',
        numberOfExits: '',
        status: 'new'
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
              
              {/* Spreadsheet Input */}
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
                  placeholder="Paste your spreadsheet data here (CSV format or tab-separated values)..."
                />
                <p className="mt-2 text-xs text-gray-400">
                  Paste data from Excel, Google Sheets, or CSV. Include headers: Person, Companies, URLs, LinkedIn, etc.
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center my-6">
                <div className="flex-1 h-px bg-gray-600"></div>
                <span className="px-4 text-gray-400 text-sm">OR</span>
                <div className="flex-1 h-px bg-gray-600"></div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">
                  Upload Screenshots/Images
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="imageUpload"
                  />
                  <label htmlFor="imageUpload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-300 mb-1">Click to upload images or drag and drop</p>
                    <p className="text-xs text-gray-400">PNG, JPG, JPEG up to 10MB each</p>
                  </label>
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
                
                <p className="mt-2 text-xs text-gray-400">
                  Upload screenshots of VC databases, spreadsheets, or any documents containing prospect information.
                </p>
              </div>

              {/* Process Button */}
              <div className="flex justify-between items-center">
                <div className="flex gap-3">
                  <button
                    onClick={processBulkData}
                    disabled={processingBulk || (!spreadsheetData.trim() && uploadedImages.length === 0)}
                    className="flex items-center px-6 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processingBulk ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4 mr-2" />
                        Process & Preview
                      </>
                    )}
                  </button>
                  
                  {/* Clear All Button */}
                  {(spreadsheetData.trim() || uploadedImages.length > 0) && (
                    <button
                      onClick={() => {
                        setSpreadsheetData('');
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
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-gray-400">Person:</span>
                              <div className="text-white font-medium">{prospect.person}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Companies:</span>
                              <div className="text-white">{prospect.companies}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Email:</span>
                              <div className="text-white">{prospect.email}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Stage:</span>
                              <div className="text-white">{prospect.stage}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Country:</span>
                              <div className="text-white">{prospect.country}</div>
                            </div>
                            <div>
                              <span className="text-gray-400">Status:</span>
                              <div className="text-[#d7ff00]">{prospect.status}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing VC Prospects Table */}
        <div className="relative bg-[#1a1e24] rounded-xl p-6 shadow-xl overflow-hidden">
          {/* Top gradient border */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
          
          {/* Left gradient border */}
          <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-medium text-white">VC Prospects ({vcProspects.length})</h2>
            </div>

            {loadingProspects ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-8 w-8 text-[#d7ff00]" />
              </div>
            ) : vcProspects.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Person</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Companies</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Stage</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Country</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vcProspects.map((prospect) => (
                      <tr key={prospect.id} className="border-b border-gray-800 hover:bg-[#262a30] transition-colors">
                        <td className="py-3 px-4 text-white font-medium">{prospect.person}</td>
                        <td className="py-3 px-4 text-gray-300 max-w-xs truncate">{prospect.companies}</td>
                        <td className="py-3 px-4 text-gray-300">{prospect.email}</td>
                        <td className="py-3 px-4 text-gray-300">{prospect.stage}</td>
                        <td className="py-3 px-4 text-gray-300">{prospect.country}</td>
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
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {prospect.createdAt.toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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