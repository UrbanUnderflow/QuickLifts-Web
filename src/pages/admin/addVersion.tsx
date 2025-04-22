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
      <div className="max-w-xl mx-auto mt-10 p-8 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-xl border border-gray-700">
        <h1 className="text-3xl font-extrabold mb-8 text-gray-100 flex items-center gap-2">
          <span className="inline-block bg-gray-800 text-blue-400 px-3 py-1 rounded-full text-lg border border-gray-700">Add New Version</span>
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block font-semibold mb-2 text-blue-400">Version Number</label>
            <input
              type="text"
              className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-white placeholder-gray-500"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 1.0.1"
              required
            />
          </div>
          <div>
            <label className="block font-semibold mb-2 text-blue-400">Change Notes</label>
            <div className="space-y-3">
              {changeNotes.map((note, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-md transition-all group">
                  <input
                    type="text"
                    className="flex-1 border-none focus:ring-0 bg-transparent text-gray-200 placeholder-gray-500"
                    value={note}
                    onChange={e => handleNoteChange(idx, e.target.value)}
                    placeholder={`Change note #${idx + 1}`}
                    required
                  />
                  {changeNotes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(idx)}
                      className="text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded"
                      aria-label="Remove note"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddNote}
                className="flex items-center gap-2 mt-2 px-4 py-2 bg-gray-800 text-blue-400 rounded-lg hover:bg-gray-700 border border-gray-700 transition font-medium shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Note
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="critical-update"
              checked={isCriticalUpdate}
              onChange={e => setIsCriticalUpdate(e.target.checked)}
              className="mr-2 accent-blue-500 w-5 h-5 bg-gray-800 border-gray-600"
            />
            <label htmlFor="critical-update" className="font-semibold text-blue-400 flex items-center gap-1">
              Is Critical Update?
              {isCriticalUpdate && <span className="ml-2 px-2 py-0.5 bg-red-900 text-red-300 rounded-full text-xs font-bold border border-red-700">Critical</span>}
            </label>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-lg"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Version'}
          </button>
          {success && <div className="text-green-400 mt-2 text-center font-semibold">{success}</div>}
          {error && <div className="text-red-400 mt-2 text-center font-semibold">{error}</div>}
        </form>
      </div>
    </AdminRouteGuard>
  );
};

export default AddVersionPage; 