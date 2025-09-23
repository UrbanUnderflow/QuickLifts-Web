import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { adminMethods } from '../../api/firebase/admin/methods';
import { PageMetaData } from '../../api/firebase/admin/types';
import { Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '../../api/firebase/config'; // Assuming 'app' is your initialized Firebase app
import { Loader2, UploadCloud, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

const storage = getStorage(app);

const pageFileNames = [
  '100trainers', 'programming', 'starter-pack', 'one-on-one', 'train-your-client', 'about', 'morning-mobility-challenge', 
  'createStack', 'subscription-success', 'subscribe', 'mobility', 'morningMobilityRedirect', 
  'join-challenge', 'index', 'download', 'trim-video', 'create', 'rounds', 
  'privacyPolicy', 'terms', 'stacks', 'moves', 'update-challenge-status', 
  'user-dashboard', 'Support', 'connect', 'notification-test', 'creator', 'press', 'MoveAndFuelATL', 'investor', 'invest',
  'winner--connect-account', 'winner--success', 'winner--error', 'coach', 'coach-onboard'
].sort(); // Sort it once here

// Helper functions to handle forward slashes in page IDs
const encodePageId = (pageId: string): string => {
  return pageId.replace(/\//g, '--');
};

const decodePageId = (encodedPageId: string): string => {
  return encodedPageId.replace(/--/g, '/');
};

const getDisplayName = (pageId: string): string => {
  return decodePageId(pageId);
};

const ManageMetaPage: React.FC = () => {
  const [pageId, setPageId] = useState(''); // This will store the final selected Page ID
  const [pageIdInputValue, setPageIdInputValue] = useState(''); // For the text input
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredPageIds, setFilteredPageIds] = useState<string[]>(pageFileNames);
  
  const dropdownRef = useRef<HTMLDivElement>(null); // For detecting outside clicks

  const [formData, setFormData] = useState<Partial<PageMetaData>>({});
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [twitterImageUrl, setTwitterImageUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isUploadingOg, setIsUploadingOg] = useState(false);
  const [isUploadingTwitter, setIsUploadingTwitter] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    resetMessages();
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ogImage' | 'twitterImage') => {
    resetMessages();
    const file = e.target.files?.[0] || null;
    processFile(file, type);
  };

  const processFile = (file: File | null, type: 'ogImage' | 'twitterImage') => {
    if (type === 'ogImage') {
      setOgImageFile(file);
      if (file) setOgImageUrl(URL.createObjectURL(file));
      else setOgImageUrl(formData.ogImage || null); // Revert to original if file is cleared
    } else {
      setTwitterImageFile(file);
      if (file) setTwitterImageUrl(URL.createObjectURL(file));
      else setTwitterImageUrl(formData.twitterImage || null); // Revert to original if file is cleared
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'ogImage' | 'twitterImage') => {
    e.preventDefault();
    e.stopPropagation();
    resetMessages();
    const file = e.dataTransfer.files?.[0] || null;
    processFile(file, type);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Optional: can help in some complex DOM structures
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const deleteFile = async (url?: string | null) => {
    if (!url) return;
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (error: any) {
      // If the file doesn't exist, Firebase throws an error. We can often ignore this.
      if (error.code !== 'storage/object-not-found') {
        console.warn("Error deleting file from storage:", error);
        // Potentially notify user or log more robustly if deletion is critical
      }
    }
  };

  const fetchPageData = useCallback(async () => {
    const currentId = pageId;
    if (!currentId) return;

    setIsFetching(true);
    resetMessages();
    try {
      // Encode the page ID for Firestore (replace / with --)
      const encodedPageId = encodePageId(currentId.trim());
      const data = await adminMethods.getPageMetaData(encodedPageId);
      if (data) {
        setFormData(data);
        setOgImageUrl(data.ogImage || null);
        setTwitterImageUrl(data.twitterImage || null);
      } else {
        setFormData({}); // Clear form if no data
        setOgImageUrl(null);
        setTwitterImageUrl(null);
        setErrorMessage('No meta data found for this Page ID. You can create new data.');
      }
    } catch (error) {
      console.error('Error fetching meta data:', error);
      setErrorMessage('Failed to fetch meta data.');
      setFormData({});
      setOgImageUrl(null);
      setTwitterImageUrl(null);
    } finally {
      setIsFetching(false);
    }
  }, [pageId]);

  const handlePageIdInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPageIdInputValue(value);
    if (value) {
      setFilteredPageIds(
        pageFileNames.filter(name =>
          name.toLowerCase().includes(value.toLowerCase())
        )
      );
      setIsDropdownOpen(true);
    } else {
      setFilteredPageIds(pageFileNames);
      setIsDropdownOpen(false); // Or true, if you want to show all options when input is cleared but focused
    }
    // Do not set pageId here, only on selection from dropdown
  };

  const handlePageIdSelect = (selectedPageId: string) => {
    setPageId(selectedPageId);
    setPageIdInputValue(selectedPageId);
    setIsDropdownOpen(false);
    resetMessages();
    // Set the page ID first, then fetch data will be triggered by useEffect
    setFormData({}); // Clear previous form data immediately
    setOgImageFile(null);
    setTwitterImageFile(null);
    setOgImageUrl(null);
    setTwitterImageUrl(null);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch data when pageId changes
  useEffect(() => {
    if (pageId.trim()) {
      fetchPageData();
    }
  }, [pageId, fetchPageData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageId.trim()) {
      setErrorMessage('Page ID is required.');
      return;
    }
    setIsLoading(true);
    resetMessages();

    try {
      // Use encoded page ID for Firestore operations
      const encodedPageId = encodePageId(pageId.trim());
      
      let finalOgImageUrl = formData.ogImage;
      let finalTwitterImageUrl = formData.twitterImage;

      // Handle OG Image Upload
      if (ogImageFile) {
        setIsUploadingOg(true);
        // Delete old image if it exists and a new one is being uploaded
        if (formData.ogImage && formData.ogImage !== ogImageUrl) {
            await deleteFile(formData.ogImage);
        }
        finalOgImageUrl = await uploadFile(ogImageFile, `metaData/${encodedPageId}/ogImage_${Date.now()}`);
        setIsUploadingOg(false);
      } else if (finalOgImageUrl && finalOgImageUrl !== ogImageUrl) { 
        // This means the user removed the image without uploading a new one
        await deleteFile(finalOgImageUrl);
        finalOgImageUrl = undefined;
      }


      // Handle Twitter Image Upload
      if (twitterImageFile) {
        setIsUploadingTwitter(true);
         if (formData.twitterImage && formData.twitterImage !== twitterImageUrl) {
            await deleteFile(formData.twitterImage);
        }
        finalTwitterImageUrl = await uploadFile(twitterImageFile, `metaData/${encodedPageId}/twitterImage_${Date.now()}`);
        setIsUploadingTwitter(false);
      } else if (finalTwitterImageUrl && finalTwitterImageUrl !== twitterImageUrl) {
        await deleteFile(finalTwitterImageUrl);
        finalTwitterImageUrl = undefined;
      }

      const dataToSave: PageMetaData = {
        ...formData,
        pageId: pageId.trim(), // Store the decoded page ID in the metadata
        ogImage: finalOgImageUrl || undefined, // Store undefined if null
        twitterImage: finalTwitterImageUrl || undefined, // Store undefined if null
        lastUpdated: Timestamp.now(),
      };

      // Use encoded page ID for the Firestore document ID
      const success = await adminMethods.setPageMetaData({ ...dataToSave, pageId: encodedPageId });
      if (success) {
        setSuccessMessage('Meta data saved successfully!');
        setFormData(dataToSave); // Update local state with saved data (including new URLs)
        setOgImageFile(null); // Clear file input
        setTwitterImageFile(null); // Clear file input
        // Keep current ogImageUrl and twitterImageUrl for display
      } else {
        setErrorMessage('Failed to save meta data.');
      }
    } catch (error) {
      console.error('Error saving meta data:', error);
      setErrorMessage('Error occurred while saving meta data.');
    } finally {
      setIsLoading(false);
      setIsUploadingOg(false);
      setIsUploadingTwitter(false);
    }
  };
  
  const handleRemoveImage = async (type: 'ogImage' | 'twitterImage') => {
    resetMessages();
    const currentUrl = type === 'ogImage' ? ogImageUrl : twitterImageUrl;
    
    if (type === 'ogImage') {
        setOgImageFile(null);
        setOgImageUrl(null); // Clear preview immediately
        // Mark for deletion on save by setting formData field to null if it's not already
        setFormData(prev => ({...prev, ogImage: undefined}));

    } else {
        setTwitterImageFile(null);
        setTwitterImageUrl(null); // Clear preview immediately
        setFormData(prev => ({...prev, twitterImage: undefined}));
    }
    // The actual deletion from storage will happen on submit if the URL was previously stored
  };

  const inputFields: Array<{ 
    name: Exclude<keyof PageMetaData, 'pageId' | 'lastUpdated'>; 
    label: string; 
    type?: string; 
    placeholder?: string; 
    rows?: number;
    helpText?: string; // Add helpText property to configuration
  }> = [
    { name: 'pageTitle', label: 'Page Title', placeholder: 'e.g., Amazing Product - MyCompany' },
    { name: 'metaDescription', label: 'Meta Description', type: 'textarea', rows: 3, placeholder: 'e.g., Discover our amazing product that solves all your problems.' },
    { name: 'ogTitle', label: 'OpenGraph Title', placeholder: 'e.g., Amazing Product on MyCompany' },
    { name: 'ogDescription', label: 'OpenGraph Description', type: 'textarea', rows: 3, placeholder: 'e.g., Check out this amazing product!' },
    { 
      name: 'ogUrl', 
      label: 'OpenGraph URL', 
      placeholder: 'e.g., https://fitwithpulse.ai/press',
      helpText: 'The canonical URL for this page (usually your domain plus the page path)'
    },
    { 
      name: 'ogType', 
      label: 'OpenGraph Type', 
      placeholder: 'e.g., website, article',
      helpText: 'The type of content: "website" for general pages, "article" for blog posts, etc.'
    },
    { 
      name: 'twitterCard', 
      label: 'Twitter Card Type', 
      placeholder: 'e.g., summary, summary_large_image',
      helpText: 'Use "summary_large_image" for cards with large images, or "summary" for smaller images'
    },
    { name: 'twitterTitle', label: 'Twitter Title', placeholder: 'e.g., Amazing Product on MyCompany' },
    { name: 'twitterDescription', label: 'Twitter Description', type: 'textarea', rows: 3, placeholder: 'e.g., Check out this amazing product!' },
  ];

  return (
    <AdminRouteGuard>
      <Head>
        <title>Manage Page Meta Data | Pulse Admin</title>
      </Head>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 text-[#d7ff00] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 mr-2">
              <path d="M19.4,7.34A8.25,8.25,0,0,0,12,4.5A8.25,8.25,0,0,0,4.6,7.34L3,9.41V19.5A1.5,1.5,0,0,0,4.5,21H19.5A1.5,1.5,0,0,0,21,19.5V9.41ZM19.5,19.5H4.5V9.91l1.22-1.22a6.75,6.75,0,0,1,10.56,0L17.78,9.91Zm-1.5-6a1.5,1.5,0,1,1,1.5-1.5A1.5,1.5,0,0,1,18,13.5Z"/>            </svg>
            Manage Page Meta Data
          </h1>

          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <div className="mb-6" ref={dropdownRef}>
              <label htmlFor="pageIdInput" className="block text-gray-300 mb-2 text-sm font-medium">Page ID</label>
              <div className="relative flex items-center">
                <input
                  id="pageIdInput"
                  type="text"
                  placeholder="Type or select a page ID..."
                  value={pageIdInputValue}
                  onChange={handlePageIdInputChange}
                  onFocus={() => {
                    setFilteredPageIds(pageIdInputValue ? pageFileNames.filter(name => name.toLowerCase().includes(pageIdInputValue.toLowerCase())) : pageFileNames);
                    setIsDropdownOpen(true);
                  }}
                  className="flex-grow bg-[#262a30] border border-gray-700 rounded-l-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                />
                <button 
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="bg-[#262a30] border-t border-b border-r border-gray-700 px-3 py-3 text-gray-400 hover:text-white rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#d7ff00]"
                  aria-label="Toggle dropdown"
                >
                  <svg className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#262a30] border border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    <ul>
                      {filteredPageIds.length > 0 ? (
                        filteredPageIds.map(name => (
                          <li
                            key={name}
                            onClick={() => handlePageIdSelect(getDisplayName(name))}
                            className="px-4 py-2 text-white hover:bg-[#31363c] cursor-pointer"
                          >
                            {getDisplayName(name)}
                          </li>
                        ))
                      ) : (
                        <li className="px-4 py-2 text-gray-500">No matches found</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {pageId && (
              <form onSubmit={handleSubmit} className="space-y-6">
                {inputFields.map(field => (
                  <div key={field.name}>
                    <label htmlFor={field.name} className="block text-gray-300 mb-2 text-sm font-medium">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={field.name}
                        name={field.name}
                        value={formData[field.name as keyof Omit<PageMetaData, 'pageId' | 'lastUpdated'>] as string || ''}
                        onChange={handleInputChange}
                        rows={field.rows || 3}
                        placeholder={field.placeholder}
                        className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                      />
                    ) : (
                      <input
                        id={field.name}
                        name={field.name}
                        type={field.type || 'text'}
                        value={formData[field.name as keyof Omit<PageMetaData, 'pageId' | 'lastUpdated'>] as string || ''}
                        onChange={handleInputChange}
                        placeholder={field.placeholder}
                        className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                      />
                    )}
                    {field.helpText && (
                      <p className="mt-1 text-xs text-gray-400">{field.helpText}</p>
                    )}
                  </div>
                ))}

                {/* OG Image Upload */}
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">OpenGraph Image</label>
                  <div 
                    onDrop={(e) => handleDrop(e, 'ogImage')}
                    onDragOver={handleDragOver}
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-[#d7ff00] transition-colors"
                  >
                    <div className="space-y-1 text-center pointer-events-none"> {/* Added pointer-events-none to children to ensure drop on parent */}
                      {ogImageUrl ? (
                        <div className="relative group mx-auto pointer-events-auto"> {/* Allow pointer events for remove button */}
                          <img src={ogImageUrl} alt="OG Preview" className="mx-auto h-32 w-auto rounded-md object-contain"/>
                          <button 
                              type="button" 
                              onClick={() => handleRemoveImage('ogImage')}
                              className="absolute top-0 right-0 m-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove OG image"
                          >
                              <Trash2 size={16}/>
                          </button>
                        </div>
                      ) : <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />}
                      <div className="flex text-sm text-gray-500 justify-center pointer-events-auto"> {/* Allow pointer events for label click */}
                        <label htmlFor="ogImageFile" className="relative cursor-pointer bg-[#262a30] rounded-md font-medium text-[#d7ff00] hover:text-[#b8cc00] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-[#d7ff00] px-2 py-1">
                          <span>{ogImageFile ? ogImageFile.name : 'Upload a file'}</span>
                          <input id="ogImageFile" name="ogImageFile" type="file" className="sr-only" onChange={(e) => handleFileChange(e, 'ogImage')} accept="image/*" />
                        </label>
                        {!ogImageFile && !ogImageUrl && <p className="pl-1">or drag and drop</p>}
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      {isUploadingOg && <div className="flex items-center justify-center text-sm text-gray-400 mt-2"><Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading...</div>}
                    </div>
                  </div>
                </div>

                {/* Twitter Image Upload */}
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Twitter Image</label>
                  <div 
                    onDrop={(e) => handleDrop(e, 'twitterImage')}
                    onDragOver={handleDragOver}
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-[#d7ff00] transition-colors"
                  >
                    <div className="space-y-1 text-center pointer-events-none"> {/* Added pointer-events-none */}
                       {twitterImageUrl ? (
                        <div className="relative group mx-auto pointer-events-auto"> {/* Allow pointer events for remove button */}
                          <img src={twitterImageUrl} alt="Twitter Preview" className="mx-auto h-32 w-auto rounded-md object-contain"/>
                          <button 
                              type="button" 
                              onClick={() => handleRemoveImage('twitterImage')}
                              className="absolute top-0 right-0 m-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove Twitter image"
                          >
                              <Trash2 size={16}/>
                          </button>
                        </div>
                      ) : <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />}
                      <div className="flex text-sm text-gray-500 justify-center pointer-events-auto"> {/* Allow pointer events for label click */}
                        <label htmlFor="twitterImageFile" className="relative cursor-pointer bg-[#262a30] rounded-md font-medium text-[#d7ff00] hover:text-[#b8cc00] focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-[#d7ff00] px-2 py-1">
                          <span>{twitterImageFile ? twitterImageFile.name : 'Upload a file'}</span>
                          <input id="twitterImageFile" name="twitterImageFile" type="file" className="sr-only" onChange={(e) => handleFileChange(e, 'twitterImage')} accept="image/*" />
                        </label>
                        {!twitterImageFile && !twitterImageUrl && <p className="pl-1">or drag and drop</p>}
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                      {isUploadingTwitter && <div className="flex items-center justify-center text-sm text-gray-400 mt-2"><Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading...</div>}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isFetching || !pageId.trim()}
                  className="w-full flex justify-center items-center px-4 py-3 rounded-lg font-medium bg-[#d7ff00] text-black hover:bg-[#b8cc00] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : null}
                  Save Meta Data
                </button>

                {successMessage && (
                  <div className="mt-4 p-3 bg-green-900/30 text-green-400 border border-green-700 rounded-lg flex items-center animate-fadeIn">
                    <CheckCircle size={20} className="mr-2" />
                    {successMessage}
                  </div>
                )}
                {errorMessage && (
                  <div className="mt-4 p-3 bg-red-900/30 text-red-400 border border-red-700 rounded-lg flex items-center animate-fadeIn">
                    <AlertTriangle size={20} className="mr-2" />
                    {errorMessage}
                  </div>
                )}
              </form>
            )}
            {!pageId && (
                <div className="text-center text-gray-500 py-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <p className="mt-2 text-lg">Please select a Page ID to manage its meta data.</p>
                </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AdminRouteGuard>
  );
};

export default ManageMetaPage; 