import React, { useState, useEffect } from 'react';
import { adminMethods } from '../../api/firebase/admin/methods';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

const AddVersionPage = () => {
  const [version, setVersion] = useState('');
  const [changeNotes, setChangeNotes] = useState<string[]>(['']);
  const [isCriticalUpdate, setIsCriticalUpdate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [latestVersion, setLatestVersion] = useState<{
    version: string;
    notes: string[];
    isCriticalUpdate: boolean;
  } | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);

  // Fetch the latest version information
  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        setLoadingLatest(true);
        
        // Try both collections (singular and plural)
        const collectionsToTry = ['version', 'versions'];
        let foundVersion = false;
        
        for (const collectionName of collectionsToTry) {
          if (foundVersion) break;
          
          try {
            const versionsRef = collection(db, collectionName);
            // Don't sort by version field, just get all documents
            const q = query(versionsRef);
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              // Get all versions and sort them properly (since version strings need semantic sorting)
              const versionDocs = querySnapshot.docs.map(doc => ({
                id: doc.id,
                data: doc.data()
              }));
              
              // Sort versions semantically (1.0.10 should come after 1.0.9)
              const sortedVersions = versionDocs.sort((a, b) => {
                const partsA = a.id.split('.').map(Number);
                const partsB = b.id.split('.').map(Number);
                
                for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                  const partA = i < partsA.length ? partsA[i] : 0;
                  const partB = i < partsB.length ? partsB[i] : 0;
                  
                  if (partA !== partB) {
                    return partB - partA; // Descending order
                  }
                }
                
                return 0;
              });
              
              if (sortedVersions.length > 0) {
                const latestDoc = sortedVersions[0];
                const data = latestDoc.data;
                
                // Extract notes from numbered fields
                const notes: string[] = [];
                Object.keys(data).forEach(key => {
                  if (key !== 'isCriticalUpdate' && !isNaN(Number(key))) {
                    notes.push(data[key]);
                  }
                });
                
                setLatestVersion({
                  version: latestDoc.id,
                  notes,
                  isCriticalUpdate: data.isCriticalUpdate || false
                });
                
                foundVersion = true;
                console.log(`Found latest version in '${collectionName}' collection:`, latestDoc.id);
                break;
              }
            }
          } catch (err) {
            console.error(`Error fetching from '${collectionName}' collection:`, err);
          }
        }
        
        if (!foundVersion) {
          console.log('No version found in any collection');
          setLatestVersion(null);
        }
      } catch (err) {
        console.error('Error fetching latest version:', err);
      } finally {
        setLoadingLatest(false);
      }
    };
    
    fetchLatestVersion();
  }, [success]); // Refetch when a new version is successfully added

  const handleNoteChange = (idx: number, value: string) => {
    setChangeNotes(notes => notes.map((note, i) => (i === idx ? value : note)));
  };

  const handleAddNote = () => {
    setChangeNotes(notes => [...notes, '']);
  };

  const handleRemoveNote = (idx: number) => {
    setChangeNotes(notes => notes.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    const notesArray = changeNotes.map(note => note.trim()).filter(note => note.length > 0);
    if (!version || notesArray.length === 0) {
      setError('Version and at least one change note are required.');
      setLoading(false);
      return;
    }
    try {
      await adminMethods.addVersion(version, notesArray, isCriticalUpdate);
      setSuccess('Version added successfully!');
      setVersion('');
      setChangeNotes(['']);
      setIsCriticalUpdate(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add version.');
    }
    setLoading(false);
  };

  const autoIncrementVersion = () => {
    if (!latestVersion) return;
    
    const versionParts = latestVersion.version.split('.');
    if (versionParts.length > 0) {
      // Get the last part of the version number
      const lastPart = versionParts[versionParts.length - 1];
      
      // Preserve leading zeros by tracking the original length
      const originalLength = lastPart.length;
      const hasLeadingZeros = lastPart.startsWith('0') && originalLength > 1;
      
      // Parse to integer and increment
      const lastPartNum = parseInt(lastPart, 10);
      if (!isNaN(lastPartNum)) {
        const incrementedNum = lastPartNum + 1;
        
        // Format with leading zeros if needed
        let newLastPart;
        if (hasLeadingZeros) {
          // Pad with zeros to maintain same length
          newLastPart = incrementedNum.toString().padStart(originalLength, '0');
        } else {
          newLastPart = incrementedNum.toString();
        }
        
        versionParts[versionParts.length - 1] = newLastPart;
        const newVersion = versionParts.join('.');
        
        console.log(`Incrementing version from ${latestVersion.version} to ${newVersion}`);
        setVersion(newVersion);
        
        // Copy notes from previous version
        if (latestVersion.notes.length > 0) {
          setChangeNotes([...latestVersion.notes]);
        }
      }
    }
  };

  return (
    <AdminRouteGuard>
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-lg mx-auto">
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

          {/* Latest Version Tile */}
          <div className="relative bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl overflow-hidden">
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500"></div>
            
            {/* Right gradient border */}
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
              <div>
                <div className="mb-2 flex items-center">
                  <span className="text-xl font-bold text-[#d7ff00]">{latestVersion.version}</span>
                </div>
                <div className="space-y-2">
                  {latestVersion.notes.map((note, idx) => (
                    <div 
                      key={idx} 
                      className="text-sm text-gray-300 pl-3 border-l-2 border-blue-500"
                    >
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
            {/* Top gradient border */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Left gradient border */}
            <div className="absolute top-0 left-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-500 via-purple-500 to-[#d7ff00]"></div>
            
            {/* Card content */}
            <div className="text-sm text-gray-400 mb-4">
              Enter version details and release notes
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-gray-300 mb-2 text-sm font-medium">Version Number</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    placeholder="e.g. 1.0.1"
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
                      {/* Left accent border with gradient */}
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-blue-400 to-teal-400"></div>
                      
                      <input
                        type="text"
                        className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-gray-500 pl-2"
                        value={note}
                        onChange={e => handleNoteChange(idx, e.target.value)}
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
                    {/* Bottom border gradient animation */}
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
              
              <div className="relative flex items-center bg-[#262a30] p-4 rounded-lg overflow-hidden">
                {/* Right gradient border */}
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-orange-500 to-red-500"></div>
                
                <div className="relative flex items-center h-5">
                  <input
                    type="checkbox"
                    id="critical-update"
                    checked={isCriticalUpdate}
                    onChange={e => setIsCriticalUpdate(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-600 text-[#d7ff00] focus:ring-[#d7ff00] bg-[#1a1e24]"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="critical-update" className="font-medium text-gray-300">
                    Is Critical Update?
                  </label>
                  <p className="text-gray-500 text-xs mt-1">Mark this if users should be forced to update</p>
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
                {/* Gradient animation on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-r from-[#40c9ff] to-[#e81cff] transition-opacity"></div>
                
                <span className="relative z-10">
                  {loading ? 'Adding...' : 'Add Version'}
                </span>
                <span className="absolute bottom-0 left-0 w-full h-1 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
              </button>
              
              {success && (
                <div className="flex items-center gap-2 text-green-400 mt-4 p-3 bg-green-900/20 rounded-lg relative overflow-hidden">
                  {/* Success message gradient border */}
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
                  {/* Error message gradient border */}
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