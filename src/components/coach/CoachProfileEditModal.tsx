import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Loader2 } from 'lucide-react';
import { firebaseStorageService, UploadImageType } from '../../api/firebase/storage/service';

export interface CoachProfileFormData {
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
}

interface CoachProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial: CoachProfileFormData;
  /** Persist the edited profile. Resolve when the write completes. */
  onSave: (next: CoachProfileFormData) => Promise<void>;
  /** Demo mode keeps everything local — no Firebase storage uploads or writes. */
  isDemo?: boolean;
}

const initialsOf = (name?: string): string => {
  if (!name) return 'C';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'C';
};

const CoachProfileEditModal: React.FC<CoachProfileEditModalProps> = ({
  isOpen,
  onClose,
  initial,
  onSave,
  isDemo = false,
}) => {
  const [name, setName] = useState(initial.name);
  const [title, setTitle] = useState(initial.title);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Resync the form whenever the modal (re)opens with fresh data.
  useEffect(() => {
    if (isOpen) {
      setName(initial.name);
      setTitle(initial.title);
      setBio(initial.bio);
      setAvatarUrl(initial.avatarUrl);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Revoke any local object URL we created for demo previews.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const onImageChange = async (file: File) => {
    setError(null);
    if (isDemo) {
      // Demo: local preview only, no Firebase storage write.
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setAvatarUrl(url);
      return;
    }
    try {
      setUploading(true);
      const res = await firebaseStorageService.uploadImage(file, UploadImageType.Profile);
      setAvatarUrl(res.downloadURL);
    } catch (err) {
      console.error('[CoachProfileEditModal] image upload failed', err);
      setError('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        title: title.trim(),
        bio: bio.trim(),
        avatarUrl,
      });
      onClose();
    } catch (err) {
      console.error('[CoachProfileEditModal] save failed', err);
      setError('Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={saving ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'tween', duration: 0.18 }}
            className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <div className="text-sm font-bold text-white">Edit Profile</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Coach Profile
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden border border-zinc-700 flex-shrink-0 bg-gradient-to-br from-[#E0FE10]/30 to-green-500/20 flex items-center justify-center">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-[#E0FE10]">{initialsOf(name)}</span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 rounded-lg hover:bg-zinc-700 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    {uploading ? 'Uploading…' : 'Change photo'}
                  </button>
                  <div className="text-[10px] text-zinc-500 mt-1.5">JPG or PNG, square works best.</div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImageChange(f);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E0FE10]/50"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Head Coach"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#E0FE10]/50"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="A short bio your staff and athletes will see."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#E0FE10]/50"
                />
              </div>

              {error && <div className="text-xs text-red-400">{error}</div>}
              {isDemo && (
                <div className="text-[10px] text-amber-300/80">
                  Demo mode — this is a preview only. Saving won’t change anything.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 bg-[#E0FE10] text-black text-sm font-medium px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-[#E0FE10]/20 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CoachProfileEditModal;
