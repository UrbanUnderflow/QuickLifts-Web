import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface NotificationLog {
  id: string;
  fcmToken: string;
  title: string;
  body: string;
  notificationType: string;
  functionName: string;
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
  timestamp: Timestamp;
  timestampEpoch: number;
  multicast?: boolean;
  totalTokens?: number;
  successCount?: number;
  failureCount?: number;
  individualResults?: Array<{
    tokenPreview: string;
    success: boolean;
    messageId?: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

const NotificationLogs: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const logsRef = collection(db, 'notification-logs');
      const q = query(logsRef, orderBy('timestampEpoch', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NotificationLog[];
      
      setLogs(logsData);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Timestamp | number) => {
    if (typeof timestamp === 'number') {
      return new Date(timestamp * 1000).toLocaleString();
    }
    return timestamp?.toDate().toLocaleString() || 'N/A';
  };

  const getStatusBadge = (log: NotificationLog) => {
    if (log.multicast) {
      const successRate = log.totalTokens ? (log.successCount || 0) / log.totalTokens : 0;
      if (successRate === 1) {
        return <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">All Sent</span>;
      } else if (successRate > 0.5) {
        return <span className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">Partial</span>;
      } else {
        return <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Failed</span>;
      }
    }
    
    return log.success ? (
      <span className="bg-green-500 text-white px-2 py-1 rounded text-xs">Sent</span>
    ) : (
      <span className="bg-red-500 text-white px-2 py-1 rounded text-xs">Failed</span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111417] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#d7ff00] mb-4"></div>
          <p>Loading notification logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111417] text-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-[#d7ff00]">Notification Logs</h1>
          <button
            onClick={fetchLogs}
            className="bg-[#d7ff00] text-black px-4 py-2 rounded-md hover:bg-opacity-80 transition duration-200"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logs List */}
          <div className="lg:col-span-2 bg-[#1a1e24] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Notifications</h2>
            
            {logs.length === 0 ? (
              <p className="text-gray-400">No notification logs found.</p>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg cursor-pointer transition duration-200 ${
                      selectedLog?.id === log.id
                        ? 'bg-[#2a2e34] border border-[#d7ff00]'
                        : 'bg-[#262a30] hover:bg-[#2a2e34]'
                    }`}
                    onClick={() => setSelectedLog(log)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-medium text-[#d7ff00] truncate">{log.title}</h3>
                        <p className="text-sm text-gray-300 break-words overflow-hidden" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical' as const,
                          maxHeight: '2.5rem'
                        }}>{log.body}</p>
                      </div>
                      {getStatusBadge(log)}
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{log.notificationType}</span>
                      <span>{formatTimestamp(log.timestampEpoch)}</span>
                    </div>
                    
                    {log.multicast && (
                      <div className="mt-2 text-xs text-gray-300">
                        {log.successCount}/{log.totalTokens} sent successfully
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log Details */}
          <div className="bg-[#1a1e24] rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4">Log Details</h2>
            
            {selectedLog ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Title</h4>
                  <p className="text-sm break-words">{selectedLog.title}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Body</h4>
                  <p className="text-sm break-words whitespace-pre-wrap">{selectedLog.body}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Type</h4>
                  <p className="text-sm">{selectedLog.notificationType}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Function</h4>
                  <p className="text-sm">{selectedLog.functionName}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Status</h4>
                  {getStatusBadge(selectedLog)}
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Timestamp</h4>
                  <p className="text-sm">{formatTimestamp(selectedLog.timestampEpoch)}</p>
                </div>
                
                {selectedLog.multicast ? (
                  <div>
                    <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Multicast Stats</h4>
                    <div className="text-sm space-y-1">
                      <p>Total Tokens: {selectedLog.totalTokens}</p>
                      <p>Success: {selectedLog.successCount}</p>
                      <p>Failed: {selectedLog.failureCount}</p>
                    </div>
                    
                    {/* Individual Recipients Details */}
                    {selectedLog.individualResults && selectedLog.individualResults.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-[#d7ff00] mb-2">Individual Recipients</h4>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {selectedLog.individualResults.map((result, index) => (
                            <div 
                              key={index}
                              className={`p-3 rounded-lg text-xs ${
                                result.success 
                                  ? 'bg-green-900/30 border border-green-700' 
                                  : 'bg-red-900/30 border border-red-700'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-mono text-gray-300">
                                  {result.tokenPreview}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  result.success 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-red-500 text-white'
                                }`}>
                                  {result.success ? 'Sent' : 'Failed'}
                                </span>
                              </div>
                              
                              {result.success && result.messageId && (
                                <div className="text-gray-400 break-words">
                                  <span className="font-medium">Message ID:</span> {result.messageId}
                                </div>
                              )}
                              
                              {!result.success && result.error && (
                                <div className="text-red-300">
                                  <div><span className="font-medium">Error:</span> {result.error.code}</div>
                                  <div className="text-red-400 mt-1 break-words">{result.error.message}</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-medium text-[#d7ff00] mb-1">FCM Token (truncated)</h4>
                      <p className="text-sm font-mono break-all">{selectedLog.fcmToken}</p>
                    </div>
                    
                    {selectedLog.messageId && (
                      <div>
                        <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Message ID</h4>
                        <p className="text-sm font-mono break-all">{selectedLog.messageId}</p>
                      </div>
                    )}
                  </>
                )}
                
                {selectedLog.error && (
                  <div>
                    <h4 className="text-sm font-medium text-red-400 mb-1">Error</h4>
                    <div className="bg-red-900/20 p-3 rounded text-sm">
                      <p><strong>Code:</strong> {selectedLog.error.code}</p>
                      <p className="break-words"><strong>Message:</strong> {selectedLog.error.message}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <h4 className="text-sm font-medium text-[#d7ff00] mb-1">Data Payload</h4>
                  <pre className="text-xs bg-[#262a30] p-3 rounded overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {JSON.stringify((selectedLog as any).dataPayload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">Select a log entry to view details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationLogs;