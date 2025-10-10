import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { Loader2, Download, Search, Calendar, FileJson, Mail, ExternalLink } from 'lucide-react';

interface RoundExport {
  id: string;
  email: string;
  fileName: string;
  downloadURL: string;
  exportedAt: Date;
  roundData?: {
    theme?: string;
    hasContent?: boolean;
    dayCount?: number;
  };
}

const RoundExportsPage: React.FC = () => {
  const [exports, setExports] = useState<RoundExport[]>([]);
  const [filteredExports, setFilteredExports] = useState<RoundExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedExport, setSelectedExport] = useState<RoundExport | null>(null);

  useEffect(() => {
    fetchExports();
  }, []);

  useEffect(() => {
    if (searchEmail.trim()) {
      const filtered = exports.filter(exp => 
        exp.email.toLowerCase().includes(searchEmail.toLowerCase())
      );
      setFilteredExports(filtered);
    } else {
      setFilteredExports(exports);
    }
  }, [searchEmail, exports]);

  const fetchExports = async () => {
    try {
      setLoading(true);
      const exportsRef = collection(db, 'round-exports');
      const q = query(exportsRef, orderBy('exportedAt', 'desc'));
      const snapshot = await getDocs(q);

      const exportsList: RoundExport[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        exportsList.push({
          id: doc.id,
          email: data.email || '',
          fileName: data.fileName || '',
          downloadURL: data.downloadURL || '',
          exportedAt: data.exportedAt?.toDate() || new Date(),
          roundData: data.roundData || {}
        });
      });

      setExports(exportsList);
      setFilteredExports(exportsList);
    } catch (error) {
      console.error('[RoundExports] Error fetching exports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (downloadURL: string, fileName: string) => {
    window.open(downloadURL, '_blank');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Round Exports | Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-[#d7ff00] rounded-full flex items-center justify-center">
                <FileJson className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-3xl font-bold text-[#d7ff00]">Round Exports</h1>
            </div>
            <p className="text-gray-400">View and download creator round plans exported from the Build Your Round page</p>
          </div>

          {/* Search Bar */}
          <div className="bg-[#1a1e24] rounded-xl p-6 mb-6 shadow-xl">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="flex-1 bg-[#262a30] border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#d7ff00] transition text-white placeholder-gray-500"
              />
              {searchEmail && (
                <button
                  onClick={() => setSearchEmail('')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="mt-3 text-sm text-gray-400">
              Found {filteredExports.length} export{filteredExports.length !== 1 ? 's' : ''}
              {searchEmail && ` matching "${searchEmail}"`}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#d7ff00]" />
            </div>
          )}

          {/* Exports Table */}
          {!loading && filteredExports.length > 0 && (
            <div className="bg-[#1a1e24] rounded-xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#262a30] border-b border-gray-700">
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Round Theme</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Days</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Exported</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExports.map((exp) => (
                      <tr 
                        key={exp.id}
                        className="border-b border-gray-800 hover:bg-[#1f2329] transition-colors cursor-pointer"
                        onClick={() => setSelectedExport(exp)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-white font-medium">{exp.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300">
                            {exp.roundData?.theme || '(No theme provided)'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-400">
                            {exp.roundData?.dayCount || 0} days
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Calendar className="w-4 h-4" />
                            {formatDate(exp.exportedAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(exp.downloadURL, exp.fileName);
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#d7ff00] text-black rounded-lg hover:bg-[#b8cc00] transition-colors text-sm font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredExports.length === 0 && (
            <div className="bg-[#1a1e24] rounded-xl p-12 text-center shadow-xl">
              <FileJson className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchEmail ? 'No Exports Found' : 'No Exports Yet'}
              </h3>
              <p className="text-gray-400">
                {searchEmail 
                  ? `No round exports found for "${searchEmail}"`
                  : 'Round exports from the Build Your Round page will appear here'}
              </p>
            </div>
          )}

          {/* Detail Modal */}
          {selectedExport && (
            <div 
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedExport(null)}
            >
              <div 
                className="bg-[#1a1e24] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-[#1a1e24] border-b border-gray-700 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#d7ff00] rounded-full flex items-center justify-center">
                        <FileJson className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">Export Details</h2>
                        <p className="text-gray-400 text-sm">{selectedExport.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedExport(null)}
                      className="text-gray-400 hover:text-white transition-colors text-2xl"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Export Info */}
                  <div className="bg-[#262a30] rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Export Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Email:</span>
                        <span className="text-white font-medium">{selectedExport.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">File Name:</span>
                        <span className="text-white font-mono text-xs">{selectedExport.fileName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Exported:</span>
                        <span className="text-white">{formatDate(selectedExport.exportedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Round Summary */}
                  {selectedExport.roundData && (
                    <div className="bg-[#262a30] rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Round Summary</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Theme:</span>
                          <span className="text-white">{selectedExport.roundData.theme || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Day Count:</span>
                          <span className="text-white">{selectedExport.roundData.dayCount || 0} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Has Content:</span>
                          <span className={`font-medium ${selectedExport.roundData.hasContent ? 'text-green-400' : 'text-gray-500'}`}>
                            {selectedExport.roundData.hasContent ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDownload(selectedExport.downloadURL, selectedExport.fileName)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#d7ff00] text-black rounded-lg hover:bg-[#b8cc00] transition-colors font-semibold"
                    >
                      <Download className="w-5 h-5" />
                      Download JSON
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedExport.downloadURL);
                        // Could add a toast notification here
                      }}
                      className="px-4 py-3 bg-[#262a30] text-white rounded-lg hover:bg-[#31363c] transition-colors border border-gray-700"
                      title="Copy download URL"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default RoundExportsPage;

