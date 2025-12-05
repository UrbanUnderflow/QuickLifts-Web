import React, { useState, useMemo } from 'react';
import SignatureCapture from './SignatureCapture';

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: any;
  checkedIn: boolean;
  checkedInAt?: any;
}

interface AttendanceCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  waitlistEntries: WaitlistEntry[];
  loading: boolean;
  onCheckIn: (entry: WaitlistEntry, signatureDataUrl: string) => Promise<void>;
  eventTitle?: string;
  waiverContent?: string;
}

const DEFAULT_WAIVER_CONTENT = `RELEASE OF LIABILITY AND WAIVER

By signing below, I acknowledge and agree to the following:

1. VOLUNTARY PARTICIPATION
I am voluntarily participating in this fitness/wellness event and assume all responsibility for my own health and safety during the activity.

2. ASSUMPTION OF RISK
I understand that physical activity involves inherent risks, including but not limited to: physical injury, muscle strain, cardiovascular stress, and other health-related complications. I voluntarily assume all such risks.

3. RELEASE OF LIABILITY
I hereby release, waive, and discharge the event host, property owner, sponsors, and any affiliated individuals or organizations from any and all liability, claims, demands, or causes of action arising out of or relating to my participation in this event.

4. MEDICAL CLEARANCE
I confirm that I am in good physical health and have no medical conditions that would prevent my participation. If I have any health concerns, I have consulted with a medical professional prior to participating.

5. PERSONAL PROPERTY
I understand the host is not responsible for any personal property that is lost, stolen, or damaged during the event.

6. MEDIA RELEASE
I grant permission for photographs and/or video recordings taken during the event to be used for promotional purposes.

7. ALCOHOL ACKNOWLEDGMENT (if applicable)
If alcohol is served, I will drink responsibly and arrange safe transportation if needed. The host is not liable for any incidents occurring after I leave the premises.

8. EMERGENCY CONTACT
I authorize the event organizers to seek emergency medical treatment on my behalf if necessary.

I HAVE READ THIS WAIVER, FULLY UNDERSTAND ITS TERMS, AND SIGN IT FREELY AND VOLUNTARILY.`;

const AttendanceCheckInModal: React.FC<AttendanceCheckInModalProps> = ({
  isOpen,
  onClose,
  waitlistEntries,
  loading,
  onCheckIn,
  eventTitle = 'Event',
  waiverContent = DEFAULT_WAIVER_CONTENT,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successName, setSuccessName] = useState('');

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return waitlistEntries;
    
    const query = searchQuery.toLowerCase();
    return waitlistEntries.filter(entry => 
      entry.name.toLowerCase().includes(query) ||
      entry.email.toLowerCase().includes(query) ||
      (entry.phone && entry.phone.includes(query))
    );
  }, [waitlistEntries, searchQuery]);

  // Separate checked-in and not checked-in
  const { notCheckedIn, checkedIn } = useMemo(() => {
    return {
      notCheckedIn: filteredEntries.filter(e => !e.checkedIn),
      checkedIn: filteredEntries.filter(e => e.checkedIn),
    };
  }, [filteredEntries]);

  const handleSelectEntry = (entry: WaitlistEntry) => {
    if (entry.checkedIn) return; // Can't re-check in
    setSelectedEntry(entry);
    setSignatureDataUrl(null);
    setWaiverAccepted(false);
  };

  const handleCheckIn = async () => {
    if (!selectedEntry || !signatureDataUrl || !waiverAccepted) return;

    setCheckingIn(true);
    try {
      await onCheckIn(selectedEntry, signatureDataUrl);
      setSuccessName(selectedEntry.name);
      setShowSuccess(true);
      
      // Reset form after short delay
      setTimeout(() => {
        setSelectedEntry(null);
        setSignatureDataUrl(null);
        setWaiverAccepted(false);
        setShowSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('[CheckIn] Failed:', err);
      alert('Failed to check in. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleBack = () => {
    setSelectedEntry(null);
    setSignatureDataUrl(null);
    setWaiverAccepted(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 rounded-xl max-w-4xl w-full h-[90vh] flex flex-col border border-zinc-700">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            {selectedEntry && !showSuccess && (
              <button
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">
                {showSuccess ? 'Check-In Complete!' : selectedEntry ? 'Sign Waiver' : 'Attendance Check-In'}
              </h2>
              {!selectedEntry && !showSuccess && (
                <p className="text-sm text-zinc-400 mt-1">
                  {notCheckedIn.length} awaiting check-in • {checkedIn.length} checked in
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {showSuccess ? (
            /* Success Screen */
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 animate-bounce">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-white mb-2">{successName}</h3>
              <p className="text-xl text-emerald-400">Successfully Checked In!</p>
            </div>
          ) : selectedEntry ? (
            /* Waiver & Signature Screen */
            <div className="flex flex-col h-full">
              {/* Selected Person Info */}
              <div className="bg-zinc-800 p-4 border-b border-zinc-700">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-lg">
                      {selectedEntry.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-white">{selectedEntry.name}</h3>
                    <p className="text-sm text-zinc-400">{selectedEntry.email}</p>
                  </div>
                </div>
              </div>

              {/* Waiver Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-zinc-300 mb-3">
                    Please read and sign the waiver for {eventTitle}
                  </h4>
                  <div className="bg-zinc-800 rounded-lg p-4 max-h-64 overflow-y-auto border border-zinc-700">
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {waiverContent}
                    </pre>
                  </div>
                </div>

                {/* Accept Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div 
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                      waiverAccepted 
                        ? 'bg-[#E0FE10] border-[#E0FE10]' 
                        : 'border-zinc-500 group-hover:border-zinc-400'
                    }`}
                    onClick={() => setWaiverAccepted(!waiverAccepted)}
                  >
                    {waiverAccepted && (
                      <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-zinc-300">
                    I have read and agree to the terms of the waiver above. I understand this is a legally binding agreement.
                  </span>
                </label>

                {/* Signature Capture */}
                <SignatureCapture
                  onSignatureChange={setSignatureDataUrl}
                  disabled={!waiverAccepted}
                />
              </div>

              {/* Check-In Button */}
              <div className="p-6 border-t border-zinc-700">
                <button
                  onClick={handleCheckIn}
                  disabled={!waiverAccepted || !signatureDataUrl || checkingIn}
                  className="w-full bg-emerald-500 text-white py-4 rounded-lg font-semibold text-lg hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
                >
                  {checkingIn ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Complete Check-In
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Waitlist View */
            <div className="flex flex-col h-full min-h-0">
              {/* Search */}
              <div className="p-4 border-b border-zinc-700">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full bg-zinc-800 border border-zinc-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-400 focus:border-[#E0FE10] focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-[#E0FE10] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <svg className="w-16 h-16 text-zinc-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-zinc-400">
                      {searchQuery ? 'No matches found' : 'No waitlist entries yet'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Not Checked In Section */}
                    {notCheckedIn.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-zinc-400 mb-2 px-2">
                          Awaiting Check-In ({notCheckedIn.length})
                        </h3>
                        {notCheckedIn.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => handleSelectEntry(entry)}
                            className="w-full text-left p-4 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-[#E0FE10]/50 hover:bg-zinc-750 transition-colors mb-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center">
                                  <span className="text-zinc-300 font-medium">
                                    {entry.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-white font-medium">{entry.name}</p>
                                  <p className="text-sm text-zinc-400">{entry.email}</p>
                                </div>
                              </div>
                              <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Checked In Section */}
                    {checkedIn.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-2 px-2">
                          Checked In ({checkedIn.length})
                        </h3>
                        {checkedIn.map((entry) => (
                          <div
                            key={entry.id}
                            className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 mb-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-white font-medium">{entry.name}</p>
                                  <p className="text-sm text-zinc-400">{entry.email}</p>
                                </div>
                              </div>
                              <span className="text-xs text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                                Checked In
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceCheckInModal;

