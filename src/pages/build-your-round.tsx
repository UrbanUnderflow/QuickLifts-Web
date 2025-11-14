import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Target, Calendar, Lightbulb, Camera, Users, Gift, TrendingUp, Plus, X, Mail, Download, ChevronDown, Zap } from 'lucide-react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, app } from '../api/firebase/config';

interface RoundData {
  step1: {
    theme: string;
    goals: string;
  };
  step2: {
    duration: string;
    structure: string;
  };
  step3: {
    story: string;
    motivation: string;
    emotions: string;
  };
  step4: {
    visualTone: string;
    location: string;
    visualElements: string;
  };
  step5: {
    sharingMoments: string;
    prompts: string;
    presence: string;
  };
  step6: {
    reward: string;
    brandConnection: string;
    nonMonetary: string;
  };
  step7: {
    promotion: string;
    metrics: string;
  };
  days: Array<{ day: string; focusArea: string; moves: string[] }>;
}

const STORAGE_KEY = 'pulse_round_builder_data';

const BuildYourRound: React.FC = () => {
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(new Set([2,3,4,5,6,7]));
  
  const [formData, setFormData] = useState<RoundData>({
    step1: { theme: '', goals: '' },
    step2: { duration: '', structure: '' },
    step3: { story: '', motivation: '', emotions: '' },
    step4: { visualTone: '', location: '', visualElements: '' },
    step5: { sharingMoments: '', prompts: '', presence: '' },
    step6: { reward: '', brandConnection: '', nonMonetary: '' },
    step7: { promotion: '', metrics: '' },
    days: [
      { day: 'Stack 1', focusArea: 'Upper Body', moves: ['Barbell Flat Bench Press', 'Incline Dumbbell Press', '50 Push-Ups', 'Dumbbell Shoulder Press', 'Dumbbell Lateral Raises', 'Plank'] }
    ]
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedData = JSON.parse(saved);
        setFormData(parsedData);
        console.log('[BuildRound] Loaded saved data from localStorage:', parsedData);
      }
    } catch (error) {
      console.error('[BuildRound] Error loading from localStorage:', error);
    } finally {
      // Mark initial load as complete
      setIsInitialLoad(false);
    }
  }, []);

  // Save to localStorage whenever formData changes (skip initial render)
  useEffect(() => {
    if (isInitialLoad) return; // Skip saving on initial load
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      console.log('[BuildRound] Saved data to localStorage');
    } catch (error) {
      console.error('[BuildRound] Error saving to localStorage:', error);
    }
  }, [formData, isInitialLoad]);

  const updateStepField = (step: keyof Omit<RoundData, 'days'>, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [step]: {
        ...prev[step],
        [field]: value
      }
    }));
  };

  const addDay = () => {
    setFormData(prev => ({
      ...prev,
      days: [...prev.days, { day: `Stack ${prev.days.length + 1}`, focusArea: '', moves: ['', '', '', '', '', ''] }]
    }));
  };

  const updateDay = (index: number, field: 'day' | 'focusArea', value: string) => {
    setFormData(prev => {
      const updated = [...prev.days];
      updated[index][field] = value;
      return { ...prev, days: updated };
    });
  };

  const updateMove = (dayIndex: number, moveIndex: number, value: string) => {
    setFormData(prev => {
      const updated = [...prev.days];
      updated[dayIndex].moves[moveIndex] = value;
      return { ...prev, days: updated };
    });
  };

  const addMove = (dayIndex: number) => {
    setFormData(prev => {
      const updated = [...prev.days];
      updated[dayIndex].moves.push('');
      return { ...prev, days: updated };
    });
  };

  const removeMove = (dayIndex: number, moveIndex: number) => {
    setFormData(prev => {
      const updated = [...prev.days];
      if (updated[dayIndex].moves.length > 1) {
        updated[dayIndex].moves.splice(moveIndex, 1);
      }
      return { ...prev, days: updated };
    });
  };

  const removeDay = (index: number) => {
    setFormData(prev => {
      if (prev.days.length > 1) {
        return { ...prev, days: prev.days.filter((_, i) => i !== index) };
      }
      return prev;
    });
  };

  const toggleDay = (dayIndex: number) => {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayIndex)) next.delete(dayIndex);
      else next.add(dayIndex);
      return next;
    });
  };

  const toggleStep = (stepIndex: number) => {
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) next.delete(stepIndex);
      else next.add(stepIndex);
      return next;
    });
  };

  const handleExportClick = () => {
    setShowEmailModal(true);
    setExportError(null);
    setExportSuccess(false);
  };

  const handleExportSubmit = async () => {
    if (!email || !email.includes('@')) {
      setExportError('Please enter a valid email address');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const storage = getStorage(app);
      const timestamp = Date.now();
      const fileName = `round-plan-${email.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.json`;
      
      // Upload JSON to Firebase Storage
      const storageRef = ref(storage, `round-exports/${fileName}`);
      const jsonBlob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
      await uploadBytes(storageRef, jsonBlob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Create Firestore record
      const exportsRef = collection(db, 'round-exports');
      await addDoc(exportsRef, {
        email: email.toLowerCase(),
        fileName,
        downloadURL,
        exportedAt: serverTimestamp(),
        roundData: {
          theme: formData.step1.theme,
          hasContent: !!(formData.step1.theme || formData.step1.goals),
          dayCount: formData.days.length
        }
      });

      // Also download locally for user
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-round-plan.json';
      a.click();
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => {
        setShowEmailModal(false);
        setEmail('');
        setExportSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('[BuildRound] Error exporting data:', error);
      setExportError('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Build Your Round | Pulse Creator Guide</title>
      </Head>
      
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Hero with background video */}
        <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden border-b border-zinc-800 print:hidden">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            src="/MoveHero.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
          <div className="relative h-full max-w-5xl mx-auto px-6 flex flex-col justify-center">
            <img src="/pulseIcon.png" alt="Pulse" className="w-12 h-12 mb-4" />
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">Turn Your Workouts<br/>Into Experiences</h1>
            <p className="text-zinc-300 mt-4 max-w-2xl text-lg">Create your first Pulse Round — a guided, social fitness experience that grows your income and community.</p>
            <div className="mt-6 flex items-center gap-4">
              <a href="#breakdown" className="bg-[#E0FE10] text-black font-semibold px-5 py-3 rounded-xl hover:bg-lime-400 transition">Start Building</a>
              <a href="#case-study" className="text-white/90 underline underline-offset-4 hover:text-white">See Examples</a>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-12 print:py-6 print:bg-white print:text-black">
          {/* What is a Round */}
          <section id="what-is-round" className="mb-12 print:mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left media */}
              <div className="flex justify-center lg:justify-start">
                <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black max-w-xs w-full">
                <img
                  src="/Winner1.png"
                  alt="Creator filming a workout"
                  className="w-full h-full object-cover"
                />
                </div>
              </div>
              {/* Right content */}
              <div>
                <h2 className="text-5xl font-extrabold mb-4 text-white print:text-black print:text-2xl">What is a Round?</h2>
                <p className="text-gray-300 leading-relaxed mb-6 text-lg print:text-black">
                  A Round in Pulse is a time-bound group fitness challenge where creators and members train together toward a shared goal.
                </p>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-[#E0FE10]" />
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 print:text-black">Structure</h4>
                      <p className="text-gray-300 text-sm print:text-black">A Round runs for a set duration (for example, 7 or 30 days). Each Round is built from "Moves" and "Stacks" — short video exercises and pre-built workouts — created by the community.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-[#E0FE10]" />
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 print:text-black">Participation</h4>
                      <p className="text-gray-300 text-sm print:text-black">Users join a creator's Round to complete daily workouts, track progress, and interact with other participants through posts, check-ins, and leaderboard stats.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0">
                      <Target className="w-4 h-4 text-[#E0FE10]" />
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 print:text-black">Purpose</h4>
                      <p className="text-gray-300 text-sm print:text-black">It transforms individual training into a collective experience — blending accountability, competition, and community.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-[#E0FE10]" />
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 print:text-black">Creator Role</h4>
                      <p className="text-gray-300 text-sm print:text-black">Coaches or fitness creators host Rounds around specific goals (e.g., "Core Reset," "Glute Growth," "Mobility Month"). They can monetize participation and grow their audience through engagement.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-[#E0FE10]" />
                    </span>
                    <div>
                      <h4 className="text-white font-semibold mb-1 print:text-black">AI Layer</h4>
                      <p className="text-gray-300 text-sm print:text-black">Pulse's AI helps tailor difficulty and recovery pacing to each participant's level, so every member feels challenged but capable.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-xl p-4">
                  <p className="text-[#e6ffc2]/90 italic">
                    In short, a Round is Pulse's version of a social fitness event — combining the structure of a challenge, the energy of a class, and the discoverability of a social platform.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* How to Upload a Move */}
          <section className="mb-12 print:mb-8">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-6 md:p-8 overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-[#E0FE10]" />
              </div>
                <div>
                  <h2 className="text-3xl font-bold text-white print:text-black print:text-xl">How to Upload a Move</h2>
                  <p className="text-zinc-400 text-sm mt-1">Learn how to add exercises to your Pulse library</p>
                    </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Video Tutorial */}
                <div className="rounded-xl overflow-hidden border border-zinc-600 bg-black">
                  <iframe
                    className="w-full aspect-[9/16]"
                    src="https://www.youtube.com/embed/FDqvrReKjyo"
                    title="How to Upload a Move"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Instructions */}
                <div className="space-y-4">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">1</div>
                    <div>
                        <h4 className="text-white font-semibold mb-1">Open the Pulse App</h4>
                        <p className="text-zinc-400 text-sm">Navigate to the "Create" tab in your Pulse mobile app</p>
                    </div>
                  </div>
              </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">2</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Record or Upload</h4>
                        <p className="text-zinc-400 text-sm">Either record a new move or select an existing video from your library</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">3</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Add Details</h4>
                        <p className="text-zinc-400 text-sm">Name your move, add a description, and tag relevant muscle groups</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">4</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1">Publish</h4>
                        <p className="text-zinc-400 text-sm">Save your move to your library — it's now ready to add to any Round</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-lg p-3 mt-4">
                    <p className="text-[#e6ffc2]/90 text-sm">
                      <strong>Pro Tip:</strong> Keep videos short (15-60 seconds) and focus on proper form. Your moves become the building blocks of your Rounds!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How to Create a Round */}
          <section className="mb-12 print:mb-8">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl p-6 md:p-8 overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#E0FE10]/20 border border-[#E0FE10]/30 flex items-center justify-center">
                  <Target className="w-6 h-6 text-[#E0FE10]" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white print:text-black print:text-xl">How to Create a Round</h2>
                  <p className="text-zinc-400 text-sm mt-1">Watch this quick tutorial to build your first Round</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Video Tutorial */}
                <div className="rounded-xl overflow-hidden border border-zinc-600 bg-black">
                  <iframe
                    className="w-full aspect-[9/16]"
                    src="https://www.youtube.com/embed/MZ_CSr0Cyzs"
                    title="How to Create a Round"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Key Steps */}
                <div className="space-y-3">
                  <p className="text-zinc-300 leading-relaxed mb-4">
                    Creating a Round in Pulse is simple and powered by AI. Follow these steps:
                  </p>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">1</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Open Create Round</h4>
                        <p className="text-zinc-400 text-xs">Tap the plus button in the bottom navigation, then tap "Create a Round"</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">2</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Choose Template or Custom</h4>
                        <p className="text-zinc-400 text-xs">Use a pre-created template or build a custom Round from scratch</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">3</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Add Title & Description</h4>
                        <p className="text-zinc-400 text-xs">Write a title and description that other Pulse members will see</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">4</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Give AI Instructions</h4>
                        <p className="text-zinc-400 text-xs">Tell Neura (our AI) how to build your program. The more specific, the better</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">5</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Select Unique Stacks</h4>
                        <p className="text-zinc-400 text-xs">Choose how many unique routines (e.g., 2-3 unique workouts that repeat through the week)</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">6</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Set Body Part Splits</h4>
                        <p className="text-zinc-400 text-xs">Lock in muscle groups per stack (e.g., Stack 1: chest/biceps/triceps, Stack 2: back/shoulders)</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">7</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Pre-Select Your Moves</h4>
                        <p className="text-zinc-400 text-xs">Choose specific exercises. Neura will fill in gaps if needed</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">8</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Add Optional Features</h4>
                        <p className="text-zinc-400 text-xs">Enable step tracking, meal plans, macro tracking, or weigh-ins for progress monitoring</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#E0FE10] text-black font-bold flex items-center justify-center text-sm flex-shrink-0">9</div>
                      <div>
                        <h4 className="text-white font-semibold mb-1 text-sm">Set Dates & Rest Days</h4>
                        <p className="text-zinc-400 text-xs">Choose start/end dates and rest days. Your Round is created in seconds!</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-lg p-3 mt-4">
                    <p className="text-[#e6ffc2]/90 text-sm">
                      <strong>Pro Tip:</strong> You can swap moves, update details, and make edits after creation. This gives you a perfect starting point to get your Round locked, loaded, and ready to launch!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Case Study */}
          <section id="case-study" className="mb-12 print:mb-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 print:bg-white print:border-gray-300 print:p-4">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <Target className="w-6 h-6 text-[#E0FE10]" />
                  <h2 className="text-4xl font-bold text-white print:text-black print:text-2xl">Creator Spotlight: Jaidus × SoulCycle</h2>
                </div>
                <p className="text-zinc-400 mt-2">From studio energy to digital movement — how one coach turned sweat into story.</p>
              </div>

              {/* Hero video */}
              <div className="rounded-2xl overflow-hidden border border-zinc-700 mb-6 print:border-gray-300">
                <video
                  className="w-full h-full object-cover aspect-video"
                  controls
                  playsInline
                  src="/JaidusNewYear.mov"
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Highlight cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <span className="text-xl">🔥</span>
                    <span>Built 30-Day Ab Challenge</span>
                  </div>
                  <p className="text-zinc-400 text-sm mt-1">From studio to screen.</p>
                </div>
                <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <span className="text-xl">💪</span>
                    <span>Trained 50 people simultaneously</span>
                  </div>
                  <p className="text-zinc-400 text-sm mt-1">Live, high-energy group experience.</p>
                </div>
                <div className="bg-zinc-800/70 border border-zinc-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <span className="text-xl">💰</span>
                    <span>Partnered with SoulCycle</span>
                  </div>
                  <p className="text-zinc-400 text-sm mt-1">First Pulse-branded Round.</p>
                </div>
              </div>

              {/* Quote */}
              <div className="bg-[#E0FE10]/10 border border-[#E0FE10]/30 rounded-xl p-4 mb-6">
                <p className="text-[#e6ffc2]/90">“Pulse helped me turn my workouts into something people feel part of.”</p>
                <p className="text-[#e6ffc2]/80 italic text-sm mt-2">— Jaidus Mondesir, Creator & Coach</p>
              </div>

              {/* CTA */}
              <div className="text-center">
                <a href="#breakdown" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#E0FE10] text-black font-bold hover:bg-[#d0ee00] transition-colors">
                  Build Yours
                </a>
              </div>
            </div>
          </section>

          {/* The Breakdown */}
          <section id="breakdown" className="mb-12 print:mb-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">The Breakdown: How to Build a Round</h2>
                <p className="text-zinc-400 text-sm">Complete each step to design your signature Round experience</p>
              </div>

              <div className="space-y-3">
                {(() => {
                  const stepNum = 1;
                  const isCollapsed = collapsedSteps.has(stepNum);
                  return (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                      <button onClick={() => toggleStep(stepNum)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Target className="w-5 h-5 text-[#E0FE10]" />
                          <h3 className="text-lg font-bold text-white">Step 1: Define the Focus</h3>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-[#E0FE10] transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                      </button>
                      {!isCollapsed && (
                        <div className="px-4 pb-4 pt-2">
                          <p className="text-zinc-400 mb-4 text-sm">Identify a single clear goal (abs, mobility, strength, mindfulness)</p>
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium mb-2 text-gray-200 text-sm">What is the overall theme of this round?</p>
                              <input type="text" placeholder="e.g., 30-Day Core Reset" value={formData.step1.theme} onChange={(e) => updateStepField('step1', 'theme', e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                            </div>
                            <div>
                              <p className="font-medium mb-2 text-gray-200 text-sm">What are your 1-2 goals for your clients?</p>
                              <textarea placeholder="e.g., Build visible core strength, improve posture" rows={2} value={formData.step1.goals} onChange={(e) => updateStepField('step1', 'goals', e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const stepNum = 2;
                  const isCollapsed = collapsedSteps.has(stepNum);
                  return (
                    <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                      <button onClick={() => toggleStep(stepNum)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-[#E0FE10]" />
                          <h3 className="text-lg font-bold text-white">Step 2: Design the Structure</h3>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-[#E0FE10] transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                      </button>
                      {!isCollapsed && (
                        <div className="px-4 pb-4 pt-2">
                          <p className="text-zinc-400 mb-4 text-sm">Choose the duration (7, 14, or 30 days) and intensity. Mix "Moves" and "Stacks".</p>
                          <div className="space-y-3">
                            <div>
                              <p className="font-medium mb-2 text-gray-200 text-sm">What is the duration of this round? Why?</p>
                              <textarea rows={2} placeholder="e.g., 30 days to build consistent habits and see visible results" value={formData.step2.duration} onChange={(e) => updateStepField('step2', 'duration', e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                            </div>
                            <div>
                              <p className="font-medium mb-2 text-gray-200 text-sm">How will you structure it to build intensity over time?</p>
                              <textarea rows={2} placeholder="e.g., Week 1: Foundation, Week 2-3: Progressive overload, Week 4: Peak" value={formData.step2.structure} onChange={(e) => updateStepField('step2', 'structure', e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const blocks = [
                    { n: 3, icon: <Lightbulb className="w-5 h-5 text-[#E0FE10]" />, title: 'Step 3: Craft the Experience', content: (
                      <>
                        <p className="text-zinc-400 mb-4 text-sm">Add storytelling and motivation. Include daily themes or mantras.</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">What story or message should they remember?</p>
                            <textarea rows={2} placeholder="e.g., Your core is your foundation — build it strong" value={formData.step3.story} onChange={(e)=>updateStepField('step3','story',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Motivation/mindset touchpoints</p>
                            <textarea rows={2} placeholder="e.g., Daily check-ins, motivational quotes" value={formData.step3.motivation} onChange={(e)=>updateStepField('step3','motivation',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Desired emotions by the end</p>
                            <textarea rows={2} placeholder="e.g., Empowered, confident" value={formData.step3.emotions} onChange={(e)=>updateStepField('step3','emotions',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                        </div>
                      </>
                    )},
                    { n: 4, icon: <Camera className="w-5 h-5 text-[#E0FE10]" />, title: 'Step 4: Set the Visual Tone', content: (
                      <>
                        <p className="text-zinc-400 mb-4 text-sm">Film or capture content that reflects your brand and energy.</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Look & feel</p>
                            <textarea rows={2} placeholder="e.g., High-energy, raw, authentic" value={formData.step4.visualTone} onChange={(e)=>updateStepField('step4','visualTone',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Locations</p>
                            <textarea rows={2} placeholder="e.g., Local gym, outdoor park" value={formData.step4.location} onChange={(e)=>updateStepField('step4','location',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Visual elements</p>
                            <textarea rows={2} placeholder="e.g., Branded apparel, natural lighting" value={formData.step4.visualElements} onChange={(e)=>updateStepField('step4','visualElements',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                        </div>
                      </>
                    )},
                    { n: 5, icon: <Users className="w-5 h-5 text-[#E0FE10]" />, title: 'Step 5: Build Engagement', content: (
                      <>
                        <p className="text-zinc-400 mb-4 text-sm">Encourage daily check-ins, progress posts, and community shoutouts.</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Moments to share wins/challenges</p>
                            <textarea rows={2} placeholder="e.g., Daily photo check-ins" value={formData.step5.sharingMoments} onChange={(e)=>updateStepField('step5','sharingMoments',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Prompts/reminders</p>
                            <textarea rows={2} placeholder="e.g., Morning messages, mid-week check-ins" value={formData.step5.prompts} onChange={(e)=>updateStepField('step5','prompts',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">How you will show up</p>
                            <textarea rows={2} placeholder="e.g., Weekly live Q&A, video shoutouts" value={formData.step5.presence} onChange={(e)=>updateStepField('step5','presence',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                        </div>
                      </>
                    )},
                    { n: 6, icon: <Gift className="w-5 h-5 text-[#E0FE10]" />, title: 'Step 6: Add an Incentive', content: (
                      <>
                        <p className="text-zinc-400 mb-4 text-sm">Create a reward or experience for completion.</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Meaningful reward</p>
                            <textarea rows={2} placeholder="e.g., Free 1-on-1 session" value={formData.step6.reward} onChange={(e)=>updateStepField('step6','reward',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Connect to brand/business</p>
                            <textarea rows={2} placeholder="e.g., Winners featured on my IG" value={formData.step6.brandConnection} onChange={(e)=>updateStepField('step6','brandConnection',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Non-monetary recognition</p>
                            <textarea rows={2} placeholder="e.g., Community badge" value={formData.step6.nonMonetary} onChange={(e)=>updateStepField('step6','nonMonetary',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                        </div>
                      </>
                    )},
                    { n: 7, icon: <TrendingUp className="w-5 h-5 text-[#E0FE10]" />, title: 'Step 7: Launch + Reflect', content: (
                      <>
                        <p className="text-zinc-400 mb-4 text-sm">Announce, promote, and gather data on participation, engagement, and completion.</p>
                        <div className="space-y-3">
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Promotion plan</p>
                            <textarea rows={2} placeholder="e.g., Countdown posts, BTS content" value={formData.step7.promotion} onChange={(e)=>updateStepField('step7','promotion',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                          <div>
                            <p className="font-medium mb-2 text-gray-200 text-sm">Success metrics</p>
                            <textarea rows={2} placeholder="e.g., Sign-ups, engagement rate" value={formData.step7.metrics} onChange={(e)=>updateStepField('step7','metrics',e.target.value)} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none" />
                          </div>
                        </div>
                      </>
                    )},
                  ];
                  return blocks.map(({ n, icon, title, content }) => {
                    const isCollapsedBlock = collapsedSteps.has(n);
                    return (
                      <div key={n} className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                        <button onClick={() => toggleStep(n)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {icon}
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                          </div>
                          <ChevronDown className={`w-5 h-5 text-[#E0FE10] transition-transform ${isCollapsedBlock ? '' : 'rotate-180'}`} />
                        </button>
                        {!isCollapsedBlock && (
                          <div className="px-4 pb-4 pt-2">
                            {content}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </section>

          {/* Stack Planner */}
          <section className="mb-12 print:mb-8 print:page-break-before">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-white mb-2">Stack Planner</h2>
                <p className="text-zinc-400 text-sm">Build your unique workout stacks. Each stack is a routine that can repeat throughout your Round.</p>
              </div>
              
              <div className="space-y-3">
                {formData.days.map((day, dayIndex) => {
                  const isCollapsed = collapsedDays.has(dayIndex);
                  return (
                    <div key={dayIndex} className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleDay(dayIndex)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <input
                            type="text"
                            value={day.day}
                            onChange={(e) => {e.stopPropagation(); updateDay(dayIndex, 'day', e.target.value);}}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-lg bg-transparent text-white outline-none w-28"
                            placeholder="Stack #"
                          />
                          <input
                            type="text"
                            value={day.focusArea}
                            onChange={(e) => {e.stopPropagation(); updateDay(dayIndex, 'focusArea', e.target.value);}}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-transparent text-zinc-400 outline-none"
                            placeholder="Focus Area (e.g., Upper Body)"
                          />
                        </div>
                        <ChevronDown className={`w-5 h-5 text-[#E0FE10] transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                      </button>
                      
                      {!isCollapsed && (
                        <div className="px-4 pb-4 pt-2 space-y-2">
                          {day.moves.map((move, moveIndex) => (
                            <div key={moveIndex} className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 w-16">Move {moveIndex + 1}</label>
                              <input
                                type="text"
                                value={move}
                                onChange={(e) => updateMove(dayIndex, moveIndex, e.target.value)}
                                className="flex-1 bg-zinc-700 border border-zinc-600 text-white rounded-lg px-3 py-2 text-sm focus:border-[#E0FE10] outline-none"
                                placeholder={`Move ${moveIndex + 1}`}
                              />
                              {day.moves.length > 1 && (
                                <button
                                  onClick={() => removeMove(dayIndex, moveIndex)}
                                  className="text-red-400 hover:text-red-300 p-1"
                                  title="Remove move"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => addMove(dayIndex)}
                            className="mt-2 text-sm flex items-center gap-1 text-[#E0FE10] hover:text-[#d0ee00] transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add Move
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addDay}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#E0FE10] text-black rounded-xl hover:bg-[#d0ee00] transition-colors font-semibold"
              >
                <Plus className="w-4 h-4" /> Add Stack
              </button>
            </div>
          </section>

          {/* Export Action */}
          <div className="mt-12 print:hidden">
            <button
              onClick={handleExportClick}
              className="w-full bg-[#E0FE10] text-black px-6 py-4 rounded-lg hover:bg-[#d0ee00] transition-colors font-bold text-lg flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export Round Plan
            </button>
            <p className="text-zinc-500 text-sm text-center mt-3">
              Download your complete round plan as JSON • All answers saved automatically
            </p>
          </div>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#E0FE10] rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Export Round Plan</h3>
                  <p className="text-zinc-400 text-sm">Enter your email to save and download</p>
                </div>
              </div>

              {!exportSuccess ? (
                <>
                  <div className="mb-6">
                    <label htmlFor="export-email" className="block text-sm font-medium text-zinc-300 mb-2">
                      Email Address
                    </label>
                    <input
                      id="export-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleExportSubmit();
                        }
                      }}
                      placeholder="your@email.com"
                      className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#E0FE10]"
                      disabled={isExporting}
                    />
                    <p className="text-zinc-500 text-xs mt-2">
                      We'll save your export to our database so you can access it anytime
                    </p>
                  </div>

                  {exportError && (
                    <div className="mb-4 p-3 bg-red-900/30 text-red-400 border border-red-700 rounded-lg text-sm">
                      {exportError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowEmailModal(false);
                        setEmail('');
                        setExportError(null);
                      }}
                      disabled={isExporting}
                      className="flex-1 bg-zinc-800 text-white px-4 py-3 rounded-lg hover:bg-zinc-700 border border-zinc-700 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExportSubmit}
                      disabled={isExporting || !email}
                      className="flex-1 bg-[#E0FE10] text-black px-4 py-3 rounded-lg hover:bg-[#d0ee00] transition-colors font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isExporting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Export
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">Export Complete!</h4>
                  <p className="text-zinc-400 text-sm">
                    Your round plan has been saved and downloaded
                  </p>
                </div>
              )}
            </div>
          </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .print\\:hidden {
              display: none !important;
            }
            .print\\:page-break-before {
              page-break-before: always;
            }
            .print\\:break-inside-avoid {
              break-inside: avoid;
            }
            @page {
              margin: 1cm;
            }
          }
      `}</style>
    </>
  );
};

export default BuildYourRound;

