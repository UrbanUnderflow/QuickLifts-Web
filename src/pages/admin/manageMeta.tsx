import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { adminMethods } from '../../api/firebase/admin/methods';
import type { PageMetaData } from '../../api/firebase/admin/types';
import { Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '../../api/firebase/config';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { getManageablePageRegistry, type ManageablePageEntry } from '../../lib/adminPageRegistry';
import { buildOgTagSnippet, normalizePreviewUrl, parseOgFromHtml, type ParsedOgPreview } from '../../lib/ogPreview';

const storage = getStorage(app);

interface ManageMetaPageProps {
  pageRegistry: ManageablePageEntry[];
}

type ValidationCheck = {
  label: string;
  passed: boolean;
  details: string;
};

type ValidationResult = {
  live: ParsedOgPreview;
  checks: ValidationCheck[];
};

const encodePageId = (pageId: string): string => pageId.replace(/\//g, '--');

const inputFields: Array<{
  name: Exclude<keyof PageMetaData, 'pageId' | 'lastUpdated'>;
  label: string;
  type?: string;
  placeholder?: string;
  rows?: number;
  helpText?: string;
}> = [
  { name: 'pageTitle', label: 'Page Title', placeholder: 'e.g., Amazing Product - MyCompany' },
  { name: 'metaDescription', label: 'Meta Description', type: 'textarea', rows: 3, placeholder: 'e.g., Discover our amazing product that solves all your problems.' },
  { name: 'ogTitle', label: 'OpenGraph Title', placeholder: 'e.g., Amazing Product on MyCompany' },
  { name: 'ogDescription', label: 'OpenGraph Description', type: 'textarea', rows: 3, placeholder: 'e.g., Check out this amazing product!' },
  {
    name: 'ogUrl',
    label: 'OpenGraph URL',
    placeholder: 'e.g., https://fitwithpulse.ai/press',
    helpText: 'The canonical URL for this page. For dynamic routes, provide a real sample or canonical URL here.',
  },
  {
    name: 'ogType',
    label: 'OpenGraph Type',
    placeholder: 'e.g., website, article',
    helpText: 'Use "website" for general pages and "article" for article-like pages.',
  },
  {
    name: 'twitterCard',
    label: 'Twitter Card Type',
    placeholder: 'e.g., summary_large_image',
    helpText: 'Use "summary_large_image" for most page previews.',
  },
  { name: 'twitterTitle', label: 'Twitter Title', placeholder: 'e.g., Amazing Product on MyCompany' },
  { name: 'twitterDescription', label: 'Twitter Description', type: 'textarea', rows: 3, placeholder: 'e.g., Check out this amazing product!' },
];

function buildValidationChecks(live: ParsedOgPreview, draft: { title: string; description: string; image: string; url: string }): ValidationCheck[] {
  const liveImage = live.image || live.twitterImage;

  return [
    {
      label: 'Live title present',
      passed: Boolean(live.title.trim()),
      details: live.title.trim() ? live.title : 'No `og:title` found in the fetched HTML.',
    },
    {
      label: 'Live description present',
      passed: Boolean(live.description.trim()),
      details: live.description.trim() ? live.description : 'No `og:description` found in the fetched HTML.',
    },
    {
      label: 'Live image present',
      passed: Boolean(liveImage.trim()),
      details: liveImage.trim() ? liveImage : 'No `og:image` or `twitter:image` found in the fetched HTML.',
    },
    {
      label: 'Live image URL is absolute',
      passed: /^https?:\/\//i.test(liveImage.trim()),
      details: liveImage.trim() || 'Missing image URL.',
    },
    {
      label: 'Live canonical URL present',
      passed: Boolean(live.url.trim()),
      details: live.url.trim() || 'No `og:url` found in the fetched HTML.',
    },
    {
      label: 'Live title matches draft',
      passed: !draft.title.trim() || live.title.trim() === draft.title.trim(),
      details: draft.title.trim()
        ? `Draft: ${draft.title || 'none'} | Live: ${live.title || 'none'}`
        : 'No draft title set, so only presence is enforced.',
    },
    {
      label: 'Live description matches draft',
      passed: !draft.description.trim() || live.description.trim() === draft.description.trim(),
      details: draft.description.trim()
        ? `Draft: ${draft.description || 'none'} | Live: ${live.description || 'none'}`
        : 'No draft description set, so only presence is enforced.',
    },
  ];
}

const ManageMetaPage: React.FC<ManageMetaPageProps> = ({ pageRegistry }) => {
  const [pageId, setPageId] = useState('');
  const [pageIdInputValue, setPageIdInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredEntries, setFilteredEntries] = useState<ManageablePageEntry[]>(pageRegistry);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const [isValidatingPreview, setIsValidatingPreview] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);

  const selectedPageEntry = useMemo(
    () => pageRegistry.find((entry) => entry.pageId === pageId) || null,
    [pageId, pageRegistry]
  );

  const resetMessages = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const resetValidation = useCallback(() => {
    setValidationMessage(null);
    setValidationError(null);
    setValidationResult(null);
  }, []);

  const resetSelectionState = useCallback(() => {
    setFormData({});
    setOgImageFile(null);
    setTwitterImageFile(null);
    setOgImageUrl(null);
    setTwitterImageUrl(null);
    resetMessages();
    resetValidation();
  }, [resetValidation]);

  const filterEntries = useCallback(
    (value: string) => {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        setFilteredEntries(pageRegistry);
        return;
      }

      setFilteredEntries(
        pageRegistry.filter((entry) =>
          entry.pageId.toLowerCase().includes(normalized) ||
          entry.route.toLowerCase().includes(normalized) ||
          entry.sourcePath.toLowerCase().includes(normalized)
        )
      );
    },
    [pageRegistry]
  );

  const commitPageSelection = useCallback(
    (selectedPageId: string) => {
      setPageId(selectedPageId);
      setPageIdInputValue(selectedPageId);
      setIsDropdownOpen(false);
      resetSelectionState();
    },
    [resetSelectionState]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    resetMessages();
    resetValidation();
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const processFile = (file: File | null, type: 'ogImage' | 'twitterImage') => {
    resetMessages();
    resetValidation();

    if (type === 'ogImage') {
      setOgImageFile(file);
      setOgImageUrl(file ? URL.createObjectURL(file) : formData.ogImage || null);
      return;
    }

    setTwitterImageFile(file);
    setTwitterImageUrl(file ? URL.createObjectURL(file) : formData.twitterImage || null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'ogImage' | 'twitterImage') => {
    const file = event.target.files?.[0] || null;
    processFile(file, type);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, type: 'ogImage' | 'twitterImage') => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0] || null;
    processFile(file, type);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const uploadFile = async (file: File, storagePath: string): Promise<string> => {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  };

  const deleteFile = async (url?: string | null) => {
    if (!url) return;
    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (error: any) {
      if (error.code !== 'storage/object-not-found') {
        console.warn('Error deleting file from storage:', error);
      }
    }
  };

  const fetchPageData = useCallback(async () => {
    if (!pageId.trim()) return;

    setIsFetching(true);
    resetMessages();
    resetValidation();

    try {
      const encodedPageId = encodePageId(pageId.trim());
      const data = await adminMethods.getPageMetaData(encodedPageId);

      if (data) {
        setFormData(data);
        setOgImageUrl(data.ogImage || null);
        setTwitterImageUrl(data.twitterImage || null);
        setErrorMessage(null);
      } else {
        setFormData({});
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
  }, [pageId, resetValidation]);

  const handlePageIdInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPageIdInputValue(value);
    filterEntries(value);
    setIsDropdownOpen(true);
  };

  const handleCustomPageIdCommit = () => {
    if (!pageIdInputValue.trim()) return;
    commitPageSelection(pageIdInputValue.trim());
  };

  const handleRemoveImage = (type: 'ogImage' | 'twitterImage') => {
    resetMessages();
    resetValidation();

    if (type === 'ogImage') {
      setOgImageFile(null);
      setOgImageUrl(null);
      setFormData((current) => ({ ...current, ogImage: undefined }));
      return;
    }

    setTwitterImageFile(null);
    setTwitterImageUrl(null);
    setFormData((current) => ({ ...current, twitterImage: undefined }));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (pageId.trim()) {
      void fetchPageData();
    }
  }, [fetchPageData, pageId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pageId.trim()) {
      setErrorMessage('Page ID is required.');
      return;
    }

    setIsLoading(true);
    resetMessages();

    try {
      const encodedPageId = encodePageId(pageId.trim());
      let finalOgImageUrl = formData.ogImage;
      let finalTwitterImageUrl = formData.twitterImage;

      if (ogImageFile) {
        setIsUploadingOg(true);
        if (formData.ogImage && formData.ogImage !== ogImageUrl) {
          await deleteFile(formData.ogImage);
        }
        finalOgImageUrl = await uploadFile(ogImageFile, `metaData/${encodedPageId}/ogImage_${Date.now()}`);
        setIsUploadingOg(false);
      } else if (finalOgImageUrl && finalOgImageUrl !== ogImageUrl) {
        await deleteFile(finalOgImageUrl);
        finalOgImageUrl = undefined;
      }

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
        pageId: pageId.trim(),
        ogImage: finalOgImageUrl || undefined,
        twitterImage: finalTwitterImageUrl || undefined,
        lastUpdated: Timestamp.now(),
      };

      const success = await adminMethods.setPageMetaData({ ...dataToSave, pageId: encodedPageId });

      if (!success) {
        setErrorMessage('Failed to save meta data.');
        return;
      }

      setSuccessMessage('Meta data saved successfully.');
      setFormData(dataToSave);
      setOgImageFile(null);
      setTwitterImageFile(null);
      if (finalOgImageUrl) setOgImageUrl(finalOgImageUrl);
      if (finalTwitterImageUrl) setTwitterImageUrl(finalTwitterImageUrl);
    } catch (error) {
      console.error('Error saving meta data:', error);
      setErrorMessage('Error occurred while saving meta data.');
    } finally {
      setIsLoading(false);
      setIsUploadingOg(false);
      setIsUploadingTwitter(false);
    }
  };

  const draftTitle = (formData.ogTitle || formData.pageTitle || pageId || '').trim();
  const draftDescription = (formData.ogDescription || formData.metaDescription || '').trim();
  const draftImage = (ogImageUrl || formData.ogImage || twitterImageUrl || formData.twitterImage || '').trim();
  const draftPageUrl = normalizePreviewUrl((formData.ogUrl || selectedPageEntry?.suggestedUrl || '').trim());
  const draftTags = buildOgTagSnippet({
    title: draftTitle,
    description: draftDescription,
    image: draftImage,
    url: draftPageUrl,
    ogType: formData.ogType || 'website',
  });
  const previewImageUrl = useMemo(() => {
    if (!draftImage) return '';
    if (draftImage.startsWith('blob:')) return draftImage;
    const separator = draftImage.includes('?') ? '&' : '?';
    return `${draftImage}${separator}v=${previewNonce}`;
  }, [draftImage, previewNonce]);

  const handleValidatePreview = async () => {
    if (!draftPageUrl) {
      setValidationError('Set a valid OpenGraph URL or select a static route before validating.');
      setValidationMessage(null);
      setValidationResult(null);
      return;
    }

    setIsValidatingPreview(true);
    setValidationMessage('Fetching crawler-facing HTML...');
    setValidationError(null);
    setValidationResult(null);

    try {
      const response = await fetch(`/api/og-fetch?url=${encodeURIComponent(draftPageUrl)}`);
      if (!response.ok) {
        throw new Error(`Fetch failed with status ${response.status}`);
      }

      const html = await response.text();
      const live = parseOgFromHtml(html);
      const checks = buildValidationChecks(live, {
        title: draftTitle,
        description: draftDescription,
        image: draftImage,
        url: draftPageUrl,
      });

      setValidationResult({ live, checks });
      const passedChecks = checks.filter((check) => check.passed).length;
      setValidationMessage(`${passedChecks}/${checks.length} validation checks passed.`);
    } catch (error) {
      console.error('[manageMeta] Failed to validate preview:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to validate preview.');
      setValidationMessage(null);
    } finally {
      setIsValidatingPreview(false);
    }
  };

  const canUseCustomId = pageIdInputValue.trim().length > 0;

  return (
    <AdminRouteGuard>
      <Head>
        <title>Manage Page Meta Data | Pulse Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 text-[#d7ff00] flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 mr-2">
              <path d="M19.4,7.34A8.25,8.25,0,0,0,12,4.5A8.25,8.25,0,0,0,4.6,7.34L3,9.41V19.5A1.5,1.5,0,0,0,4.5,21H19.5A1.5,1.5,0,0,0,21,19.5V9.41ZM19.5,19.5H4.5V9.91l1.22-1.22a6.75,6.75,0,0,1,10.56,0L17.78,9.91Zm-1.5-6a1.5,1.5,0,1,1,1.5-1.5A1.5,1.5,0,0,1,18,13.5Z" />
            </svg>
            Manage Page Meta Data
          </h1>

          <div className="mb-6 rounded-xl border border-[#d7ff00]/15 bg-[#161b21] p-4 text-sm text-gray-300">
            <p className="font-medium text-white">Metadata control plane</p>
            <p className="mt-1 text-gray-400">
              This page now reads from a live page registry generated from <code className="text-[#d7ff00]">src/pages</code>. Select a route,
              edit the draft metadata, then validate the live crawler-facing HTML before you ship it.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
            <div className="bg-[#1a1e24] rounded-xl p-6 shadow-xl">
              <div className="mb-6" ref={dropdownRef}>
                <label htmlFor="pageIdInput" className="block text-gray-300 mb-2 text-sm font-medium">
                  Page ID
                </label>
                <div className="relative">
                  <div className="flex items-center">
                    <div className="absolute left-3 text-gray-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      id="pageIdInput"
                      type="text"
                      placeholder="Type or select a page ID..."
                      value={pageIdInputValue}
                      onChange={handlePageIdInputChange}
                      onFocus={() => {
                        filterEntries(pageIdInputValue);
                        setIsDropdownOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleCustomPageIdCommit();
                        }
                      }}
                      className="w-full bg-[#262a30] border border-gray-700 rounded-lg pl-10 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen((current) => !current)}
                      className="absolute right-3 text-gray-400 hover:text-white"
                      aria-label="Toggle page dropdown"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {isDropdownOpen ? (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-lg border border-gray-700 bg-[#262a30] shadow-xl z-20">
                      {canUseCustomId ? (
                        <button
                          type="button"
                          onClick={handleCustomPageIdCommit}
                          className="w-full border-b border-gray-700 px-4 py-3 text-left hover:bg-[#31363c]"
                        >
                          <p className="text-sm font-medium text-white">Use custom page ID: {pageIdInputValue.trim()}</p>
                          <p className="text-xs text-gray-400">Keep freeform support for edge cases and route-specific overrides.</p>
                        </button>
                      ) : null}

                      {filteredEntries.length > 0 ? (
                        filteredEntries.map((entry) => (
                          <button
                            key={entry.sourcePath}
                            type="button"
                            onClick={() => commitPageSelection(entry.pageId)}
                            className="w-full border-b border-gray-800 px-4 py-3 text-left hover:bg-[#31363c] last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">{entry.pageId}</p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                  entry.kind === 'dynamic'
                                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                }`}
                              >
                                {entry.kind}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">{entry.route}</p>
                            <p className="mt-1 text-[11px] text-gray-500">{entry.sourcePath}</p>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500">No matching routes found.</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {pageId ? (
                <>
                  <div className="mb-6 rounded-xl border border-gray-800 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{pageId}</p>
                      {selectedPageEntry ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            selectedPageEntry.kind === 'dynamic'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          }`}
                        >
                          {selectedPageEntry.kind}
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide bg-zinc-700/40 text-zinc-300 border border-zinc-600">
                          custom
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      Route: <span className="text-white">{selectedPageEntry?.route || 'Custom page ID'}</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Source: {selectedPageEntry?.sourcePath || 'No matching route entry in the generated registry.'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Suggested URL: {selectedPageEntry?.suggestedUrl || 'Set an OpenGraph URL manually for dynamic or custom entries.'}
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {inputFields.map((field) => (
                      <div key={field.name}>
                        <label htmlFor={field.name} className="block text-gray-300 mb-2 text-sm font-medium">
                          {field.label}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            id={field.name}
                            name={field.name}
                            value={String(formData[field.name] || '')}
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
                            value={String(formData[field.name] || '')}
                            onChange={handleInputChange}
                            placeholder={field.placeholder}
                            className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                          />
                        )}
                        {field.helpText ? <p className="mt-1 text-xs text-gray-400">{field.helpText}</p> : null}
                      </div>
                    ))}

                    <div>
                      <label className="block text-gray-300 mb-2 text-sm font-medium">OpenGraph Image</label>
                      <div
                        onDrop={(event) => handleDrop(event, 'ogImage')}
                        onDragOver={handleDragOver}
                        className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-[#d7ff00] transition-colors"
                      >
                        <div className="space-y-1 text-center pointer-events-none">
                          {ogImageUrl ? (
                            <div className="relative group mx-auto pointer-events-auto">
                              <img src={ogImageUrl} alt="OG Preview" className="mx-auto h-32 w-auto rounded-md object-contain" />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage('ogImage')}
                                className="absolute top-0 right-0 m-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove OG image"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                          )}
                          <div className="flex text-sm text-gray-500 justify-center pointer-events-auto">
                            <label
                              htmlFor="ogImageFile"
                              className="relative cursor-pointer bg-[#262a30] rounded-md font-medium text-[#d7ff00] hover:text-[#b8cc00] px-2 py-1"
                            >
                              <span>{ogImageFile ? ogImageFile.name : 'Upload a file'}</span>
                              <input id="ogImageFile" name="ogImageFile" type="file" className="sr-only" onChange={(event) => handleFileChange(event, 'ogImage')} accept="image/*" />
                            </label>
                            {!ogImageFile && !ogImageUrl ? <p className="pl-1">or drag and drop</p> : null}
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                          {isUploadingOg ? (
                            <div className="flex items-center justify-center text-sm text-gray-400 mt-2">
                              <Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading...
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-300 mb-2 text-sm font-medium">Twitter Image</label>
                      <div
                        onDrop={(event) => handleDrop(event, 'twitterImage')}
                        onDragOver={handleDragOver}
                        className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md hover:border-[#d7ff00] transition-colors"
                      >
                        <div className="space-y-1 text-center pointer-events-none">
                          {twitterImageUrl ? (
                            <div className="relative group mx-auto pointer-events-auto">
                              <img src={twitterImageUrl} alt="Twitter Preview" className="mx-auto h-32 w-auto rounded-md object-contain" />
                              <button
                                type="button"
                                onClick={() => handleRemoveImage('twitterImage')}
                                className="absolute top-0 right-0 m-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove Twitter image"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                          )}
                          <div className="flex text-sm text-gray-500 justify-center pointer-events-auto">
                            <label
                              htmlFor="twitterImageFile"
                              className="relative cursor-pointer bg-[#262a30] rounded-md font-medium text-[#d7ff00] hover:text-[#b8cc00] px-2 py-1"
                            >
                              <span>{twitterImageFile ? twitterImageFile.name : 'Upload a file'}</span>
                              <input id="twitterImageFile" name="twitterImageFile" type="file" className="sr-only" onChange={(event) => handleFileChange(event, 'twitterImage')} accept="image/*" />
                            </label>
                            {!twitterImageFile && !twitterImageUrl ? <p className="pl-1">or drag and drop</p> : null}
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                          {isUploadingTwitter ? (
                            <div className="flex items-center justify-center text-sm text-gray-400 mt-2">
                              <Loader2 className="animate-spin h-4 w-4 mr-2" /> Uploading...
                            </div>
                          ) : null}
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

                    {successMessage ? (
                      <div className="mt-4 p-3 bg-green-900/30 text-green-400 border border-green-700 rounded-lg flex items-center animate-fadeIn">
                        <CheckCircle size={20} className="mr-2" />
                        {successMessage}
                      </div>
                    ) : null}
                    {errorMessage ? (
                      <div className="mt-4 p-3 bg-red-900/30 text-red-400 border border-red-700 rounded-lg flex items-center animate-fadeIn">
                        <AlertTriangle size={20} className="mr-2" />
                        {errorMessage}
                      </div>
                    ) : null}
                  </form>
                </>
              ) : (
                <div className="text-center text-gray-500 py-10">
                  <Search className="mx-auto h-12 w-12 text-gray-600" />
                  <p className="mt-2 text-lg">Select a generated route or enter a custom page ID to manage metadata.</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-gray-800 bg-[#1a1e24] p-6 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#d7ff00]" />
                      Draft Preview
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">This is the metadata you are currently editing, before any live fetch validation.</p>
                  </div>
                  {draftImage && !draftImage.startsWith('blob:') ? (
                    <button
                      type="button"
                      onClick={() => setPreviewNonce((current) => current + 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:text-white hover:border-gray-500"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refresh Image
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                  {previewImageUrl ? (
                    <img src={previewImageUrl} alt="Draft OG preview" className="w-full h-auto bg-black" />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-sm text-gray-500">
                      No image selected yet.
                    </div>
                  )}

                  <div className="border-t border-white/10 p-4">
                    <p className="truncate text-xs text-gray-500">{draftPageUrl || 'No canonical URL set yet'}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{draftTitle || 'No draft title yet'}</p>
                    <p className="mt-1 text-xs text-gray-400">{draftDescription || 'No draft description yet'}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-zinc-300">Draft Meta Tags</h3>
                  <pre className="mt-2 text-xs text-zinc-400 bg-zinc-950/60 border border-white/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {draftTags.length > 0 ? draftTags.join('\n') : 'No draft tags yet. Fill in the fields above to generate the preview snippet.'}
                  </pre>
                </div>
              </div>

              <div className="rounded-xl border border-gray-800 bg-[#1a1e24] p-6 shadow-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-[#d7ff00]" />
                      Live Validation
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Fetch the live page with the crawler proxy and compare the rendered tags against your draft.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleValidatePreview()}
                    disabled={isValidatingPreview || !pageId}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#d7ff00] px-3 py-2 text-sm font-medium text-black hover:bg-[#b8cc00] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidatingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Validate Live Page
                  </button>
                </div>

                {selectedPageEntry?.kind === 'dynamic' && !formData.ogUrl ? (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                    This is a dynamic route. Set a real OpenGraph URL first so validation has a concrete page to fetch.
                  </div>
                ) : null}

                {validationMessage ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    {validationMessage}
                  </div>
                ) : null}
                {validationError ? (
                  <div className="mt-4 flex items-center gap-2 text-sm text-red-300">
                    <AlertCircle className="w-4 h-4" />
                    {validationError}
                  </div>
                ) : null}

                {validationResult ? (
                  <>
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Live fetched values</p>
                      <p className="mt-2 text-sm text-white font-medium">{validationResult.live.title || 'No live title found'}</p>
                      <p className="mt-1 text-xs text-gray-400">{validationResult.live.description || 'No live description found'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                        {validationResult.live.url ? <span className="rounded-full border border-gray-700 px-2 py-1">{validationResult.live.url}</span> : null}
                        {validationResult.live.image || validationResult.live.twitterImage ? (
                          <a
                            href={validationResult.live.image || validationResult.live.twitterImage}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full border border-gray-700 px-2 py-1 hover:text-white"
                          >
                            Open live image
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {validationResult.checks.map((check) => (
                        <div key={check.label} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="flex items-start gap-2">
                            {check.passed ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                            ) : (
                              <AlertCircle className="mt-0.5 h-4 w-4 text-red-400" />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${check.passed ? 'text-emerald-200' : 'text-red-200'}`}>{check.label}</p>
                              <p className="mt-1 text-xs text-gray-400 break-words">{check.details}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="mt-4 rounded-lg border border-dashed border-gray-700 bg-black/20 p-4 text-sm text-gray-500">
                    No live validation run yet. Save if needed, then fetch the live page through the crawler proxy here.
                  </div>
                )}
              </div>
            </div>
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

export const getServerSideProps: GetServerSideProps<ManageMetaPageProps> = async () => {
  return {
    props: {
      pageRegistry: getManageablePageRegistry(process.env.NEXT_PUBLIC_SITE_URL || 'https://fitwithpulse.ai'),
    },
  };
};

export default ManageMetaPage;
