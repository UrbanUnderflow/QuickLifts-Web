import React, { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { firebaseStorageService } from '../../api/firebase/storage/service';
import { db } from '../../api/firebase/config';
import { adminMethods } from '../../api/firebase/admin/methods';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
  AppVersionDocument,
  AppVersionMediaItem,
  compareSemanticVersions,
  normalizeAppVersionDocument,
} from '../../utils/appVersioning';

type SelectedVideo = {
  file: File;
  previewUrl: string;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const VERSION_COLLECTIONS = ['version', 'versions'];
const UPDATE_MODAL_CONFIG_PATH = ['company-config', 'app-update-modal'] as const;

const sanitizeStorageSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'release';

const sanitizeFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');

const getLatestVersionFromCollections = async (): Promise<AppVersionDocument | null> => {
  const versionsById = new Map<string, AppVersionDocument>();

  for (const collectionName of VERSION_COLLECTIONS) {
    try {
      const snapshot = await getDocs(collection(db, collectionName));

      snapshot.docs.forEach((versionDoc) => {
        const normalized = normalizeAppVersionDocument(versionDoc.id, versionDoc.data());
        const existing = versionsById.get(normalized.version);

        if (!existing) {
          versionsById.set(normalized.version, normalized);
          return;
        }

        const existingWeight = existing.media.length + existing.changeNotes.length;
        const candidateWeight = normalized.media.length + normalized.changeNotes.length;

        if (candidateWeight >= existingWeight) {
          versionsById.set(normalized.version, normalized);
        }
      });
    } catch (error) {
      console.error(`Error fetching versions from '${collectionName}'`, error);
    }
  }

  const sortedVersions = Array.from(versionsById.values()).sort((lhs, rhs) =>
    compareSemanticVersions(rhs.version, lhs.version)
  );

  return sortedVersions[0] ?? null;
};

const getUpdateModalConfig = async (): Promise<boolean> => {
  const snapshot = await getDoc(doc(db, ...UPDATE_MODAL_CONFIG_PATH));
  if (!snapshot.exists()) {
    return true;
  }

  return snapshot.data().isEnabled ?? true;
};

const AddVersionPage = () => {
  const [version, setVersion] = useState('');
  const [changeNotes, setChangeNotes] = useState<string[]>(['']);
  const [isCriticalUpdate, setIsCriticalUpdate] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [latestVersion, setLatestVersion] = useState<AppVersionDocument | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [isUpdateModalEnabled, setIsUpdateModalEnabled] = useState(true);
  const [isSavingModalConfig, setIsSavingModalConfig] = useState(false);
  const [modalConfigMessage, setModalConfigMessage] = useState('');

  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        setLoadingLatest(true);
        const [latest, modalEnabled] = await Promise.all([
          getLatestVersionFromCollections(),
          getUpdateModalConfig(),
        ]);
        setLatestVersion(latest);
        setIsUpdateModalEnabled(modalEnabled);
      } catch (fetchError) {
        console.error('Error fetching latest version', fetchError);
      } finally {
        setLoadingLatest(false);
      }
    };

    fetchLatestVersion();
  }, [success]);

  const clearSelectedMedia = () => {
    if (selectedVideo) {
      URL.revokeObjectURL(selectedVideo.previewUrl);
    }

    selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setSelectedVideo(null);
    setSelectedImages([]);
  };

  const handleNoteChange = (idx: number, value: string) => {
    setChangeNotes((notes) => notes.map((note, index) => (index === idx ? value : note)));
  };

  const handleAddNote = () => {
    setChangeNotes((notes) => [...notes, '']);
  };

  const handleRemoveNote = (idx: number) => {
    setChangeNotes((notes) => notes.filter((_, index) => index !== idx));
  };

  const handleVideoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (selectedVideo) {
      URL.revokeObjectURL(selectedVideo.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedVideo({ file, previewUrl });
  };

  const handleImageSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    setSelectedImages((currentImages) => [
      ...currentImages,
      ...files.map((file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeSelectedVideo = () => {
    if (selectedVideo) {
      URL.revokeObjectURL(selectedVideo.previewUrl);
    }

    setSelectedVideo(null);
  };

  const removeSelectedImage = (imageId: string) => {
    setSelectedImages((currentImages) => {
      const image = currentImages.find((entry) => entry.id === imageId);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }

      return currentImages.filter((entry) => entry.id !== imageId);
    });
  };

  const uploadReleaseMedia = async (targetVersion: string): Promise<AppVersionMediaItem[]> => {
    const safeVersion = sanitizeStorageSegment(targetVersion);
    const uploadedMedia: AppVersionMediaItem[] = [];

    if (selectedVideo) {
      setLoadingMessage('Uploading update video...');
      const storagePath = `press_assets/app_updates/${safeVersion}/video/${Date.now()}-${sanitizeFileName(selectedVideo.file.name)}`;
      const uploadResult = await firebaseStorageService.uploadFileToStorage(selectedVideo.file, storagePath);

      uploadedMedia.push({
        id: `video-${targetVersion}`,
        type: 'video',
        url: uploadResult.downloadURL,
        storagePath,
        fileName: selectedVideo.file.name,
        mimeType: selectedVideo.file.type,
      });
    }

    for (const [index, image] of selectedImages.entries()) {
      setLoadingMessage(`Uploading image ${index + 1} of ${selectedImages.length}...`);
      const storagePath = `press_assets/app_updates/${safeVersion}/images/${Date.now()}-${index}-${sanitizeFileName(image.file.name)}`;
      const uploadResult = await firebaseStorageService.uploadFileToStorage(image.file, storagePath);

      uploadedMedia.push({
        id: image.id,
        type: 'image',
        url: uploadResult.downloadURL,
        storagePath,
        fileName: image.file.name,
        mimeType: image.file.type,
      });
    }

    return uploadedMedia;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setLoadingMessage('Saving release...');
    setSuccess('');
    setError('');

    const normalizedVersion = version.trim();
    const notesArray = changeNotes.map((note) => note.trim()).filter((note) => note.length > 0);

    if (!normalizedVersion || notesArray.length === 0) {
      setError('Version and at least one change note are required.');
      setLoading(false);
      setLoadingMessage('');
      return;
    }

    try {
      const uploadedMedia = await uploadReleaseMedia(normalizedVersion);
      setLoadingMessage('Writing release notes...');
      await adminMethods.addVersion(normalizedVersion, notesArray, isCriticalUpdate, uploadedMedia);

      setSuccess('Version added successfully!');
      setVersion('');
      setChangeNotes(['']);
      setIsCriticalUpdate(false);
      clearSelectedMedia();
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to add version.');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const autoIncrementVersion = () => {
    if (!latestVersion) return;

    const versionParts = latestVersion.version.split('.');
    if (versionParts.length === 0) return;

    const lastPart = versionParts[versionParts.length - 1];
    const originalLength = lastPart.length;
    const hasLeadingZeros = lastPart.startsWith('0') && originalLength > 1;
    const lastPartNum = parseInt(lastPart, 10);

    if (Number.isNaN(lastPartNum)) return;

    const incrementedNum = lastPartNum + 1;
    versionParts[versionParts.length - 1] = hasLeadingZeros
      ? incrementedNum.toString().padStart(originalLength, '0')
      : incrementedNum.toString();

    setVersion(versionParts.join('.'));

    if (latestVersion.changeNotes.length > 0) {
      setChangeNotes([...latestVersion.changeNotes]);
    }
  };

  const latestVideoCount = latestVersion?.media.filter((item) => item.type === 'video').length ?? 0;
  const latestImageCount = latestVersion?.media.filter((item) => item.type === 'image').length ?? 0;

  const handleUpdateModalToggle = async () => {
    const nextValue = !isUpdateModalEnabled;
    setIsSavingModalConfig(true);
    setModalConfigMessage('');

    try {
      await setDoc(
        doc(db, ...UPDATE_MODAL_CONFIG_PATH),
        {
          isEnabled: nextValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setIsUpdateModalEnabled(nextValue);
      setModalConfigMessage(
        nextValue ? 'Update modal is enabled across the app.' : 'Update modal is disabled across the app.'
      );
    } catch (toggleError) {
      console.error('Error updating app update modal config', toggleError);
      setModalConfigMessage('Could not update the global modal setting. Please try again.');
    } finally {
      setIsSavingModalConfig(false);
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-8 flex items-center">
            <span className="text-[#d7ff00] mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
                <path d="M9.75 6.75h4.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75V7.5a.75.75 0 0 1 .75-.75Z" />
                <path d="M6 8.25h1.5a.75.75 0 0 1 .75.75v9.75a.75.75 0 0 1-.75.75H6a.75.75 0 0 1-.75-.75V9a.75.75 0 0 1 .75-.75Z" />
                <path d="M16.5 8.25H18a.75.75 0 0 1 .75.75v9.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75V9a.75.75 0 0 1 .75-.75Z" />
              </svg>
            </span>
            Add New Version
          </h1>

          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-500 via-red-500 to-pink-500"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 via-red-500 to-pink-500"></div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Global Update Modal Switch</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Use this failsafe to hide the update modal everywhere if a release note or media payload malfunctions.
                </p>
              </div>

              <button
                type="button"
                onClick={handleUpdateModalToggle}
                disabled={isSavingModalConfig}
                className={`min-w-[200px] rounded-lg px-4 py-3 font-semibold transition ${
                  isUpdateModalEnabled
                    ? 'bg-[#d7ff00] text-black hover:bg-[#c3eb00]'
                    : 'bg-red-900/40 text-red-200 border border-red-700 hover:bg-red-900/60'
                } disabled:opacity-50`}
              >
                {isSavingModalConfig
                  ? 'Saving...'
                  : isUpdateModalEnabled
                    ? 'Disable Update Modal'
                    : 'Enable Update Modal'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span
                className={`px-3 py-1 rounded-full border ${
                  isUpdateModalEnabled
                    ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700'
                    : 'bg-red-900/30 text-red-200 border-red-700'
                }`}
              >
                {isUpdateModalEnabled ? 'Currently enabled' : 'Currently disabled'}
              </span>
              {modalConfigMessage && <span className="text-gray-300">{modalConfigMessage}</span>}
            </div>
          </div>

          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500"></div>
            <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-gradient-to-b from-purple-500 via-blue-500 to-teal-500"></div>

            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-semibold text-white">Current Version</h2>
              {latestVersion?.isCriticalUpdate && (
                <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                  Critical
                </span>
              )}
            </div>

            {loadingLatest ? (
              <div className="py-4 flex justify-center">
                <div className="animate-pulse flex space-x-4">
                  <div className="h-3 w-3 bg-[#d7ff00] rounded-full"></div>
                  <div className="h-3 w-3 bg-[#d7ff00] rounded-full"></div>
                  <div className="h-3 w-3 bg-[#d7ff00] rounded-full"></div>
                </div>
              </div>
            ) : latestVersion ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-[#d7ff00]">{latestVersion.version}</span>
                  {(latestVideoCount > 0 || latestImageCount > 0) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {latestVideoCount > 0 && (
                        <span className="px-2 py-1 rounded-full bg-blue-900/30 border border-blue-700 text-blue-200">
                          {latestVideoCount} video
                        </span>
                      )}
                      {latestImageCount > 0 && (
                        <span className="px-2 py-1 rounded-full bg-emerald-900/30 border border-emerald-700 text-emerald-200">
                          {latestImageCount} image{latestImageCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {latestVersion.changeNotes.map((note, idx) => (
                    <div key={idx} className="text-sm text-gray-300 pl-3 border-l-2 border-blue-500">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No versions available</div>
            )}
          </div>

          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>

            <div className="text-sm text-gray-400 mb-4">
              Enter version details, release notes, and optional media for the in-app carousel.
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">Version Number</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder="e.g. 5.02"
                    required
                  />
                  <button
                    type="button"
                    onClick={autoIncrementVersion}
                    disabled={!latestVersion}
                    className="px-4 py-2 bg-[#262a30] hover:bg-[#2a2f36] border border-gray-700 text-gray-300 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center group"
                    title="Auto-increment version from latest"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#d7ff00]" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span className="sr-only group-hover:not-sr-only ml-1 text-xs whitespace-nowrap">Auto-increment</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">Change Notes</label>
                <div className="space-y-3">
                  {changeNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="relative flex items-center gap-2 bg-[#262a30] rounded-lg p-3 transition-all hover:bg-[#2a2f36] overflow-hidden"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-400 to-teal-400"></div>

                      <input
                        type="text"
                        className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 pl-2"
                        value={note}
                        onChange={(event) => handleNoteChange(idx, event.target.value)}
                        placeholder={`Change note #${idx + 1}`}
                        required
                      />
                      {changeNotes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveNote(idx)}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                          aria-label="Remove note"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="flex items-center gap-2 w-full justify-center py-3 rounded-lg border border-gray-700 bg-[#262a30] hover:bg-[#2a2f36] transition group relative overflow-hidden"
                  >
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-teal-500 to-[#d7ff00] transform translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300"></div>
                    <span className="text-[#d7ff00] group-hover:scale-110 transition-transform">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                    <span className="text-gray-300 group-hover:text-white transition-colors">Add Note</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#262a30] rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Update Video</h3>
                      <p className="text-xs text-gray-400">Optional. If present, it will always appear first in the carousel.</p>
                    </div>
                    {selectedVideo && (
                      <button
                        type="button"
                        onClick={removeSelectedVideo}
                        className="text-xs text-red-300 hover:text-red-200"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <label className="block border border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-[#d7ff00] transition">
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideoSelection} />
                    <span className="text-sm text-gray-300">{selectedVideo ? 'Replace video' : 'Upload video'}</span>
                  </label>

                  {selectedVideo && (
                    <div className="mt-4 space-y-2">
                      <video src={selectedVideo.previewUrl} controls className="w-full rounded-lg bg-black max-h-64" />
                      <p className="text-xs text-gray-400 break-all">{selectedVideo.file.name}</p>
                    </div>
                  )}
                </div>

                <div className="bg-[#262a30] rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Carousel Images</h3>
                      <p className="text-xs text-gray-400">Optional. Add one or more screenshots for the update carousel.</p>
                    </div>
                    {selectedImages.length > 0 && (
                      <span className="text-xs text-emerald-300">{selectedImages.length} selected</span>
                    )}
                  </div>

                  <label className="block border border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-[#d7ff00] transition">
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelection} />
                    <span className="text-sm text-gray-300">Upload images</span>
                  </label>

                  {selectedImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {selectedImages.map((image) => (
                        <div key={image.id} className="relative group rounded-lg overflow-hidden border border-gray-700 bg-[#1a1e24]">
                          <img src={image.previewUrl} alt={image.file.name} className="w-full h-28 object-cover" />
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(image.id)}
                            className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-7 h-7 text-sm opacity-0 group-hover:opacity-100 transition"
                            aria-label={`Remove ${image.file.name}`}
                          >
                            ×
                          </button>
                          <div className="p-2 text-[11px] text-gray-400 truncate">{image.file.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative flex items-center bg-[#262a30] p-4 rounded-lg overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 to-red-500"></div>

                <div className="relative flex items-center h-5">
                  <input
                    type="checkbox"
                    id="critical-update"
                    checked={isCriticalUpdate}
                    onChange={(event) => setIsCriticalUpdate(event.target.checked)}
                    className="h-5 w-5 rounded border-gray-600 text-[#d7ff00] focus:ring-[#d7ff00] bg-[#1a1e24]"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="critical-update" className="font-medium text-gray-300">
                    Is Critical Update?
                  </label>
                  <p className="text-gray-500 text-xs mt-1">Mark this if users should be forced to update.</p>
                </div>
                {isCriticalUpdate && (
                  <span className="ml-auto px-2 py-1 bg-red-900/30 text-red-400 rounded-full text-xs font-medium border border-red-900">
                    Critical
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="relative w-full bg-[#d7ff00] text-black px-6 py-4 rounded-lg font-bold text-lg hover:bg-[#c3eb00] transition disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 overflow-hidden group"
                disabled={loading}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-r from-[#40c9ff] to-[#e81cff] transition-opacity"></div>

                <span className="relative z-10">{loading ? loadingMessage || 'Adding...' : 'Add Version'}</span>
                <span className="absolute bottom-0 left-0 w-full h-1 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </button>

              {success && (
                <div className="flex items-center gap-2 text-green-400 mt-4 p-3 bg-green-900/20 rounded-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-green-500 to-emerald-400"></div>

                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{success}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-400 mt-4 p-3 bg-red-900/20 rounded-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-red-500 to-orange-400"></div>

                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default AddVersionPage;
