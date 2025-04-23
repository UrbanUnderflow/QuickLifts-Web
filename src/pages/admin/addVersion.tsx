import React, { useState } from 'react';
import { adminMethods } from '../../api/firebase/admin/methods';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

const AddVersionPage = () => {
  const [version, setVersion] = useState('');
  const [changeNotes, setChangeNotes] = useState<string[]>(['']);
  const [isCriticalUpdate, setIsCriticalUpdate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

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
                <input
                  type="text"
                  className="w-full bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="e.g. 1.0.1"
                  required
                />
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