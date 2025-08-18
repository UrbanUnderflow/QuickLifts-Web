import React, { useState, useEffect } from 'react';
import { useUser } from '../hooks/useUser';
import { coachAthleteMessagingService } from '../api/firebase/messaging/coachAthleteService';
import CoachAthleteMessagingModal from '../components/CoachAthleteMessagingModal';

const TestMessagingPage: React.FC = () => {
  const currentUser = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testAthleteId, setTestAthleteId] = useState('');
  const [testAthleteName, setTestAthleteName] = useState('');

  // Mock athlete data for testing
  const mockAthletes = [
    { id: 'athlete1', name: 'John Doe' },
    { id: 'athlete2', name: 'Jane Smith' },
    { id: 'athlete3', name: 'Mike Johnson' }
  ];

  const handleTestMessage = (athleteId: string, athleteName: string) => {
    setTestAthleteId(athleteId);
    setTestAthleteName(athleteName);
    setIsModalOpen(true);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Please log in to test messaging</h1>
          <p className="text-zinc-400">You need to be authenticated to use the messaging system.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-[#E0FE10]">
          Coach-Athlete Messaging Test
        </h1>
        
        <div className="bg-zinc-900 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current User Info</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-zinc-400">ID:</span> {currentUser.id}</p>
            <p><span className="text-zinc-400">Name:</span> {currentUser.displayName || currentUser.username || 'No name'}</p>
            <p><span className="text-zinc-400">Email:</span> {currentUser.email}</p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Test Athletes</h2>
          <p className="text-zinc-400 mb-6">
            Click on an athlete to start a messaging conversation. This will create or open an existing conversation.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockAthletes.map((athlete) => (
              <div
                key={athlete.id}
                className="bg-zinc-800 rounded-lg p-4 hover:bg-zinc-700 transition-colors cursor-pointer"
                onClick={() => handleTestMessage(athlete.id, athlete.name)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#E0FE10] rounded-full flex items-center justify-center">
                    <span className="text-black font-semibold">
                      {athlete.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium">{athlete.name}</h3>
                    <p className="text-sm text-zinc-400">ID: {athlete.id}</p>
                  </div>
                </div>
                <button className="mt-3 w-full bg-[#E0FE10] text-black py-2 px-4 rounded-lg text-sm font-medium hover:bg-lime-400 transition-colors">
                  Start Conversation
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold mb-4">How to Test</h2>
          <div className="space-y-3 text-sm text-zinc-300">
            <p>1. <strong>Web Dashboard:</strong> Click on any athlete above to open the messaging modal</p>
            <p>2. <strong>iOS App:</strong> Use the coach messaging feature in the PulseCheck app</p>
            <p>3. <strong>Real-time:</strong> Messages should appear instantly on both platforms</p>
            <p>4. <strong>Notifications:</strong> Push notifications should be sent to the recipient</p>
          </div>
        </div>

        {/* Messaging Modal */}
        {currentUser && (
          <CoachAthleteMessagingModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            athleteId={testAthleteId}
            athleteName={testAthleteName}
            coachId={currentUser.id}
            coachName={currentUser.displayName || currentUser.username || 'Coach'}
          />
        )}
      </div>
    </div>
  );
};

export default TestMessagingPage;
