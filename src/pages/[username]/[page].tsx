import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { creatorPagesService, CreatorLandingPage } from '../../api/firebase/creatorPages/service';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

const CreatorLandingPageView: React.FC = () => {
  const router = useRouter();
  const { username, page } = router.query as { username?: string; page?: string };
  const currentUser = useSelector((state: RootState) => state.user.currentUser);
  const [data, setData] = useState<CreatorLandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [wlName, setWlName] = useState('');
  const [wlEmail, setWlEmail] = useState('');
  const [wlPhone, setWlPhone] = useState('');
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const [wlSuccess, setWlSuccess] = useState<string | null>(null);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editSlug, setEditSlug] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editBgType, setEditBgType] = useState<'color'|'image'>('color');
  const [editBgColor, setEditBgColor] = useState('#0b0b0c');
  const [editBgImage, setEditBgImage] = useState('');
  const [editBgImageFile, setEditBgImageFile] = useState<File | null>(null);
  const [editBgImagePreview, setEditBgImagePreview] = useState<string | null>(null);
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editCtaType, setEditCtaType] = useState<'link'|'waitlist'>('waitlist');
  const [editCtaLabel, setEditCtaLabel] = useState('Join Waitlist');
  const [editCtaHref, setEditCtaHref] = useState('');
  const [editCtaButtonColor, setEditCtaButtonColor] = useState('#E0FE10');
  const [editCtaTextColor, setEditCtaTextColor] = useState('#000000');
  const [editSaving, setEditSaving] = useState(false);

  // Waitlist viewer state
  const [showWaitlistViewer, setShowWaitlistViewer] = useState(false);
  const [waitlistEntries, setWaitlistEntries] = useState<Array<{id: string; name: string; email: string; phone?: string; createdAt: any}>>([]);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);

  const isOwner = currentUser && data && currentUser.id === data.userId;

  // Helper function to darken a hex color for border
  const darkenColor = (hex: string, percent: number = 30): string => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.floor((num >> 16) * (1 - percent / 100)));
    const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent / 100)));
    const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent / 100)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  useEffect(() => {
    if (!router.isReady || !username || !page) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const record = await creatorPagesService.getPageByUsernameAndSlug(username, page);
        if (!active) return;
        if (!record) {
          setError('Page not found');
        } else {
          setData(record);
          
          // Increment view count (only if not the owner viewing their own page)
          const isOwnerViewing = currentUser && currentUser.id === record.userId;
          if (!isOwnerViewing && record.userId) {
            // Fire and forget - don't wait for this to complete
            creatorPagesService.incrementPageView(record.userId, record.slug).catch(err => {
              console.error('[Page View] Failed to increment:', err);
            });
          }
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load page');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router.isReady, username, page, currentUser]);

  const bgStyle = useMemo(() => {
    if (!data) return {};
    if (data.backgroundType === 'image' && data.backgroundImageUrl) {
      return {
        backgroundImage: `url(${data.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } as React.CSSProperties;
    }
    return {
      backgroundColor: data.backgroundColor || '#0b0b0c',
    } as React.CSSProperties;
  }, [data]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !page) return;
    setWlSubmitting(true);
    setWlSuccess(null);
    try {
      const res = await fetch('/.netlify/functions/creator-waitlist-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, page, name: wlName, email: wlEmail, phone: wlPhone }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      setWlSuccess('Thanks! You are on the list.');
      setWlName('');
      setWlEmail('');
      setWlPhone('');
    } catch (err: any) {
      setWlSuccess(err?.message || 'Unable to submit. Try again later.');
    } finally {
      setWlSubmitting(false);
    }
  };

  const handleEditOpen = () => {
    if (!data) return;
    setEditSlug(data.slug || '');
    setEditTitle(data.title || '');
    setEditHeadline(data.headline || '');
    setEditBody(data.body || '');
    setEditBgType(data.backgroundType || 'color');
    setEditBgColor(data.backgroundColor || '#0b0b0c');
    setEditBgImage(data.backgroundImageUrl || '');
    setEditBgImageFile(null);
    setEditBgImagePreview(data.backgroundImageUrl || null); // Show existing image as preview
    setEditCtaType(data.ctaType || 'waitlist');
    setEditCtaLabel(data.ctaLabel || 'Join Waitlist');
    setEditCtaHref(data.ctaHref || '');
    setEditCtaButtonColor(data.ctaButtonColor || '#E0FE10');
    setEditCtaTextColor(data.ctaTextColor || '#000000');
    setEditMode(true);
  };

  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate image type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setEditBgImageFile(file);
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setEditBgImagePreview(previewUrl);
  };

  const handleOpenWaitlist = async () => {
    if (!currentUser?.id || !data) return;
    
    setLoadingWaitlist(true);
    setShowWaitlistViewer(true);
    
    try {
      // Fetch waitlist entries from Firestore
      // Path: creator-pages/{userId}/waitlist/{entryId}
      const waitlistRef = collection(db, 'creator-pages', currentUser.id, 'waitlist');
      const q = query(waitlistRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      const entries = snapshot.docs
        .map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          email: doc.data().email || '',
          pageName: doc.data().pageName || doc.data().page || '',
          createdAt: doc.data().createdAt,
        }))
        // Filter to only show entries for this specific page
        .filter(entry => entry.pageName === data.slug);
      
      setWaitlistEntries(entries);
    } catch (err) {
      console.error('[Waitlist] Failed to load:', err);
      alert('Failed to load waitlist. Please try again.');
    } finally {
      setLoadingWaitlist(false);
    }
  };

  const handleExportWaitlist = () => {
    if (waitlistEntries.length === 0 || !data) return;
    
    // Create CSV content
    const headers = ['Name', 'Email', 'Phone', 'Joined'];
    const rows = waitlistEntries.map(entry => [
      entry.name,
      entry.email,
      entry.phone || '',
      entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleDateString() : 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `waitlist-${(data?.slug ?? 'unknown')}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditSave = async () => {
    if (!currentUser?.id || !data) return;
    if (!editSlug.trim() || !editTitle.trim()) {
      alert('Slug and title are required.');
      return;
    }

    setEditSaving(true);
    try {
      let backgroundImageUrl = editBgImage;

      // Upload image if new file is selected
      if (editBgType === 'image' && editBgImageFile) {
        setEditImageUploading(true);
        const storage = getStorage();
        const fileName = `${Date.now()}_${editBgImageFile.name}`;
        const imageRef = storageRef(storage, `landing-page/${currentUser.id}/${fileName}`);
        
        await uploadBytes(imageRef, editBgImageFile);
        backgroundImageUrl = await getDownloadURL(imageRef);
        setEditImageUploading(false);
      }

      const pageInput = {
        slug: editSlug.trim().toLowerCase().replace(/\s+/g, '-'),
        title: editTitle.trim(),
        headline: editHeadline.trim(),
        body: editBody.trim(),
        backgroundType: editBgType,
        backgroundColor: editBgType === 'color' ? editBgColor : '',
        backgroundImageUrl: editBgType === 'image' ? backgroundImageUrl : '',
        ctaType: editCtaType,
        ctaLabel: editCtaLabel.trim(),
        ctaHref: editCtaType === 'link' ? editCtaHref.trim() : '',
        ctaButtonColor: editCtaButtonColor,
        ctaTextColor: editCtaTextColor,
      };

      await creatorPagesService.savePage(currentUser.id, currentUser.username || '', pageInput);
      
      // If slug changed, redirect to new URL
      if (pageInput.slug !== data.slug) {
        router.push(`/${currentUser.username}/${pageInput.slug}`);
      } else {
        // Reload data
        const updated = await creatorPagesService.getPageByUsernameAndSlug(username || '', page || '');
        if (updated) setData(updated);
        setEditMode(false);
      }
    } catch (err) {
      console.error('[Edit Landing Page]', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setEditSaving(false);
      setEditImageUploading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;
  }
  if (error || !data) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">{error || 'Not found'}</div>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={bgStyle}>
      <Head>
        <title>{data.title || `${data.username} — ${data.slug}`}</title>
        <meta name="description" content={data.headline || 'Creator page'} />
        {/* Social preview meta */}
        <meta property="og:title" content={data.title || `${data.username} — ${data.slug}`} />
        <meta property="og:description" content={data.headline || (data.body || '').slice(0, 160)} />
        <meta property="og:image" content={data.backgroundImageUrl || '/og-default.jpg'} />
        <meta property="og:type" content="website" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={data.title || `${data.username} — ${data.slug}`} />
        <meta name="twitter:description" content={data.headline || (data.body || '').slice(0, 160)} />
        <meta name="twitter:image" content={data.backgroundImageUrl || '/og-default.jpg'} />
        {/* Canonical URL */}
        <link
          rel="canonical"
          href={`${process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://fitwithpulse.ai'}/${username || ''}/${page || ''}`}
        />
      </Head>
      {/* Overlay to ensure readability over any background image/color */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80" aria-hidden />

      {/* Animated gradient orbs for visual interest */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-0 -left-4 w-72 h-72 bg-lime-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-lime-500/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      {/* Owner controls */}
      {isOwner && !editMode && (
        <div className="fixed top-6 right-6 z-40 flex gap-3">
          {/* Views counter */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-lg border border-white/20 shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="font-medium">{data.viewCount || 0}</span>
            <span className="text-sm text-zinc-300">views</span>
          </div>
          
          {/* View Waitlist button */}
          <button
            onClick={handleOpenWaitlist}
            className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-4 py-2 rounded-lg border border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            View Waitlist
          </button>
          
          {/* Edit button */}
          <button
            onClick={handleEditOpen}
            className="bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-4 py-2 rounded-lg border border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            Edit Page
          </button>
        </div>
      )}

      <div className="relative min-h-screen text-white flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-4xl text-center space-y-8 animate-fadeIn">
          {/* Title with gradient */}
          {data.title && (
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-white via-zinc-100 to-zinc-300 bg-clip-text text-transparent animate-gradient">
                {data.title}
              </span>
            </h1>
          )}

          {/* Headline with accent */}
          {data.headline && (
            <p className="text-xl md:text-2xl text-zinc-200/90 font-light max-w-2xl mx-auto leading-relaxed">
              {data.headline}
            </p>
          )}

          {/* Body text */}
          {data.body && (
            <p className="text-base md:text-lg text-zinc-300/80 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
              {data.body}
            </p>
          )}

          {/* CTA Button with enhanced styling */}
          <div className="pt-4">
            {data.ctaType === 'link' ? (
              <a
                href={data.ctaHref || '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold border-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:opacity-90"
                style={{
                  backgroundColor: data.ctaButtonColor || '#E0FE10',
                  color: data.ctaTextColor || '#000000',
                  borderColor: darkenColor(data.ctaButtonColor || '#E0FE10', 30)
                }}
              >
                {data.ctaLabel || 'Learn more'}
              </a>
            ) : (
              <button
                onClick={() => setWaitlistOpen(true)}
                className="inline-flex items-center justify-center rounded-lg px-6 py-3 font-semibold border-2 transition-all duration-300 shadow-lg hover:shadow-xl hover:opacity-90"
                style={{
                  backgroundColor: data.ctaButtonColor || '#E0FE10',
                  color: data.ctaTextColor || '#000000',
                  borderColor: darkenColor(data.ctaButtonColor || '#E0FE10', 30)
                }}
              >
                {data.ctaLabel || 'Join Waitlist'}
              </button>
            )}
          </div>

          {/* Creator attribution */}
          <div className="pt-8">
            <p className="text-sm text-zinc-400/60">
              by <span className="text-zinc-300/80 font-medium">@{data.username}</span>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out;
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 8s ease infinite;
        }
      `}</style>

      {/* Waitlist Viewer Modal */}
      {showWaitlistViewer && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">
                Waitlist for "{data.title || data.slug}"
              </h2>
              <button 
                onClick={() => setShowWaitlistViewer(false)} 
                className="text-zinc-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {loadingWaitlist ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : waitlistEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <svg className="w-16 h-16 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-zinc-400 text-center">No waitlist signups yet</p>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">
                    {waitlistEntries.length} {waitlistEntries.length === 1 ? 'signup' : 'signups'}
                  </div>
                  <button
                    onClick={handleExportWaitlist}
                    className="flex items-center gap-2 bg-[#E0FE10] text-black px-3 py-1.5 rounded-lg hover:bg-[#d0ee00] text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-zinc-800 text-zinc-300 text-sm">
                      <tr>
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">Email</th>
                        <th className="text-left p-3 font-medium">Phone</th>
                        <th className="text-left p-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="text-white">
                      {waitlistEntries.map((entry, idx) => (
                        <tr key={entry.id} className={`border-b border-zinc-800 ${idx % 2 === 0 ? 'bg-zinc-900/50' : 'bg-zinc-800/30'}`}>
                          <td className="p-3">{entry.name}</td>
                          <td className="p-3 text-zinc-300">{entry.email}</td>
                          <td className="p-3 text-zinc-300">{entry.phone || '-'}</td>
                          <td className="p-3 text-sm text-zinc-400">
                            {entry.createdAt?.toDate ? entry.createdAt.toDate().toLocaleDateString() : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="mt-4">
              <button
                onClick={() => setShowWaitlistViewer(false)}
                className="w-full bg-zinc-700 text-white px-4 py-3 rounded-lg hover:bg-zinc-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editMode && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">Edit Landing Page</h2>
              <button onClick={() => setEditMode(false)} className="text-zinc-400 hover:text-white text-2xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Slug */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Page URL Slug</label>
                <div className="text-xs text-zinc-400 mb-1">Your page will be at: /{currentUser?.username}/{editSlug || 'your-page'}</div>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  placeholder="my-landing-page"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Page Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Welcome to My Page"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Headline */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Headline (optional)</label>
                <input
                  type="text"
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  placeholder="Join the movement"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Body Text (optional)</label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Describe what you're offering..."
                  rows={4}
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* Background Type */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Background</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setEditBgType('color')}
                    className={`px-3 py-1 rounded ${editBgType === 'color' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Color
                  </button>
                  <button
                    onClick={() => setEditBgType('image')}
                    className={`px-3 py-1 rounded ${editBgType === 'image' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Image
                  </button>
                </div>
                {editBgType === 'color' && (
                  <input
                    type="color"
                    value={editBgColor}
                    onChange={(e) => setEditBgColor(e.target.value)}
                    className="w-full h-12 rounded-lg cursor-pointer"
                  />
                )}
                {editBgType === 'image' && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditImageSelect}
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-[#E0FE10] file:text-black file:cursor-pointer hover:file:bg-[#d0ee00]"
                    />
                    {editBgImagePreview && (
                      <div className="relative w-full h-32 rounded-lg overflow-hidden border border-zinc-700">
                        <img src={editBgImagePreview} alt="Background preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => {
                            setEditBgImageFile(null);
                            setEditBgImagePreview(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    {editImageUploading && (
                      <p className="text-sm text-zinc-400">Uploading image...</p>
                    )}
                  </div>
                )}
              </div>

              {/* CTA Type */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Button Type</label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setEditCtaType('waitlist')}
                    className={`px-3 py-1 rounded ${editCtaType === 'waitlist' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Waitlist
                  </button>
                  <button
                    onClick={() => setEditCtaType('link')}
                    className={`px-3 py-1 rounded ${editCtaType === 'link' ? 'bg-[#E0FE10] text-black' : 'bg-zinc-700 text-white'}`}
                  >
                    Link
                  </button>
                </div>
              </div>

              {/* CTA Label */}
              <div>
                <label className="block text-sm text-zinc-300 mb-2">Button Text</label>
                <input
                  type="text"
                  value={editCtaLabel}
                  onChange={(e) => setEditCtaLabel(e.target.value)}
                  placeholder="Join Waitlist"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                />
              </div>

              {/* CTA Href (if link) */}
              {editCtaType === 'link' && (
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Button Link</label>
                  <input
                    type="url"
                    value={editCtaHref}
                    onChange={(e) => setEditCtaHref(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg p-3 text-white placeholder-zinc-400"
                  />
                </div>
              )}

              {/* Button Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Button Color</label>
                  <input
                    type="color"
                    value={editCtaButtonColor}
                    onChange={(e) => setEditCtaButtonColor(e.target.value)}
                    className="w-full h-12 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-300 mb-2">Text Color</label>
                  <input
                    type="color"
                    value={editCtaTextColor}
                    onChange={(e) => setEditCtaTextColor(e.target.value)}
                    className="w-full h-12 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 bg-zinc-700 text-white px-4 py-3 rounded-lg hover:bg-zinc-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editSaving}
                  className="flex-1 bg-[#E0FE10] text-black px-4 py-3 rounded-lg hover:bg-[#d0ee00] disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {waitlistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Join the waitlist</h2>
              <button className="text-zinc-400 hover:text-zinc-200" onClick={() => setWaitlistOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleWaitlistSubmit} className="space-y-4">
              <input
                type="text"
                required
                value={wlName}
                onChange={(e) => setWlName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-lime-400"
              />
              <input
                type="email"
                required
                value={wlEmail}
                onChange={(e) => setWlEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-lime-400"
              />
              <input
                type="tel"
                value={wlPhone}
                onChange={(e) => setWlPhone(e.target.value)}
                placeholder="Phone number (optional)"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-lime-400"
              />
              <button
                type="submit"
                disabled={wlSubmitting}
                className="w-full rounded-lg bg-lime-400 text-black px-4 py-3 font-medium hover:bg-lime-300 disabled:opacity-60"
              >
                {wlSubmitting ? 'Submitting…' : 'Join'}
              </button>
            </form>
            {wlSuccess && <p className="mt-3 text-sm text-zinc-300">{wlSuccess}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatorLandingPageView;


