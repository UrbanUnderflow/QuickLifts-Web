import React, { useState } from 'react';

interface ChallengeUpdate {
  id: string;
  currentStatus: string;
  newStatus: string;
  startDate: string;
  endDate: string;
}

interface CollectionResult {
  updatesApplied: number;
  proposedUpdates: ChallengeUpdate[];
}

interface UpdateResult {
  success: boolean;
  message: string;
  results: {
    sweatlistCollection: CollectionResult;
    userChallengeCollection: CollectionResult;
    timestamp: string;
    testMode: boolean;
  };
}

// Separate component with proper typing
const UpdateSummary: React.FC<{
  collection: CollectionResult;
  title: string;
}> = ({ collection, title }) => (
  <div className="mb-6">
    <h3 className="text-lg font-bold mb-2">{title}</h3>
    <div className="space-y-2">
      <p>Updates Applied: {collection.updatesApplied}</p>
      <div className="space-y-4">
        {collection.proposedUpdates.map((update, index) => (
          <div key={index} className="bg-zinc-800 p-4 rounded-lg">
            <p className="font-medium">ID: {update.id}</p>
            <p>Status Change: {update.currentStatus} → {update.newStatus}</p>
            <p className="text-sm text-zinc-400">Start: {new Date(update.startDate).toLocaleDateString()}</p>
            <p className="text-sm text-zinc-400">End: {new Date(update.endDate).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ChallengeStatusTestPage: React.FC = () => {
  const [response, setResponse] = useState<UpdateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runChallengeStatusUpdate = async (testMode: boolean = false) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await fetch('/.netlify/functions/update-challenge-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testMode }),
      });

      const contentType = result.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await result.text();
        throw new Error(`Server returned non-JSON response: ${text}`);
      }

      const data: UpdateResult = await result.json();

      if (!result.ok) {
        throw new Error(data.message || `Server error: ${result.status}`);
      }

      setResponse(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      console.error('Error running challenge status update:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <h1 className="text-white text-2xl mb-6">Challenge Status Update Test</h1>
      <div className="w-full max-w-md bg-zinc-900 p-6 rounded-lg flex flex-col gap-4">
        <button
          onClick={() => runChallengeStatusUpdate(true)}
          disabled={isLoading}
          className={`w-full py-2 rounded-lg font-bold ${
            isLoading 
              ? 'bg-gray-500 cursor-not-allowed' 
              : 'bg-yellow-500 text-black hover:bg-yellow-400'
          }`}
        >
          {isLoading && response?.results.testMode ? 'Testing...' : 'Test Run (No Updates)'}
        </button>

        <button
          onClick={() => runChallengeStatusUpdate(false)}
          disabled={isLoading}
          className={`w-full py-2 rounded-lg font-bold ${
            isLoading 
              ? 'bg-gray-500 cursor-not-allowed' 
              : 'bg-[#E0FE10] text-black hover:bg-[#d4f00f]'
          }`}
        >
          {isLoading && !response?.results.testMode ? 'Updating...' : 'Run Real Update'}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-900 text-white w-full max-w-md rounded-lg">
          <h2 className="text-lg font-bold mb-2">Error:</h2>
          <pre className="whitespace-pre-wrap break-words">{error}</pre>
        </div>
      )}

      {response && (
        <div className="mt-6 p-4 bg-green-900 text-white w-full max-w-md rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Results</h2>
            {response.results.testMode && (
              <span className="px-2 py-1 bg-yellow-500 text-black text-sm font-bold rounded">
                Test Mode
              </span>
            )}
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-zinc-300">
              Timestamp: {new Date(response.results.timestamp).toLocaleString()}
            </p>
          </div>

          <UpdateSummary 
            collection={response.results.sweatlistCollection} 
            title="Sweatlist Collection" 
          />
          
          <UpdateSummary 
            collection={response.results.userChallengeCollection} 
            title="User Challenge Collection" 
          />
        </div>
      )}
    </div>
  );
};

export default ChallengeStatusTestPage;