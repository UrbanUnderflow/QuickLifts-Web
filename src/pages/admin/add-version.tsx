import React, { useState } from 'react';
import { adminMethods } from '../../api/firebase/admin/methods';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';

const AddVersionPage = () => {
  const [version, setVersion] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [isCriticalUpdate, setIsCriticalUpdate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');
    const notesArray = changeNotes
      .split('\n')
      .map(note => note.trim())
      .filter(note => note.length > 0);
    if (!version || notesArray.length === 0) {
      setError('Version and at least one change note are required.');
      setLoading(false);
      return;
    }
    try {
      await adminMethods.addVersion(version, notesArray, isCriticalUpdate);
      setSuccess('Version added successfully!');
      setVersion('');
      setChangeNotes('');
      setIsCriticalUpdate(false);
    } catch (err: any) {
      setError(err.message || 'Failed to add version.');
    }
    setLoading(false);
  };

  return (
    <AdminRouteGuard>
      <div className="max-w-xl mx-auto mt-10 p-6 bg-white rounded shadow">
        <h1 className="text-2xl font-bold mb-6">Add New Version</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Version Number</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 1.0.1"
              required
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Change Notes (one per line)</label>
            <textarea
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-300"
              value={changeNotes}
              onChange={e => setChangeNotes(e.target.value)}
              rows={6}
              placeholder={"1. Fixed bugs\n2. Improved UI"}
              required
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="critical-update"
              checked={isCriticalUpdate}
              onChange={e => setIsCriticalUpdate(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="critical-update" className="font-medium">Is Critical Update?</label>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Version'}
          </button>
          {success && <div className="text-green-600 mt-2">{success}</div>}
          {error && <div className="text-red-600 mt-2">{error}</div>}
        </form>
      </div>
    </AdminRouteGuard>
  );
};

export default AddVersionPage; 