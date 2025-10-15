import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Target, Calendar, Lightbulb, Camera, Users, Gift, TrendingUp, Plus, X, Mail, Download } from 'lucide-react';
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
  
  const [formData, setFormData] = useState<RoundData>({
    step1: { theme: '', goals: '' },
    step2: { duration: '', structure: '' },
    step3: { story: '', motivation: '', emotions: '' },
    step4: { visualTone: '', location: '', visualElements: '' },
    step5: { sharingMoments: '', prompts: '', presence: '' },
    step6: { reward: '', brandConnection: '', nonMonetary: '' },
    step7: { promotion: '', metrics: '' },
    days: [
      { day: 'Day X', focusArea: 'Upper Body', moves: ['Barbell Flat Bench Press', 'Incline Dumbbell Press', '50 Push-Ups', 'Dumbbell Shoulder Press', 'Dumbbell Lateral Raises', 'Plank'] }
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
      days: [...prev.days, { day: `Day ${prev.days.length + 1}`, focusArea: '', moves: ['', '', '', '', '', ''] }]
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
          <section className="mb-12 print:mb-8">
            <h2 className="text-4xl font-bold mb-6 text-white print:text-black print:text-2xl">What is a Round?</h2>
            <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 print:bg-white print:border-gray-300">
              <p className="text-gray-300 leading-relaxed mb-4 text-lg print:text-black">
                A Round is a <strong className="text-white print:text-black">focused fitness experience</strong> designed and led by a creator or coach inside the Pulse app.
              </p>
              <p className="text-gray-300 leading-relaxed mb-4 print:text-black">
                Think of it as your signature challenge — a curated sequence of workouts, habits, and community interactions that take participants through a defined journey toward a specific goal (e.g., <em>30-Day Core Reset</em>, <em>21-Day Mobility Flow</em>, or <em>7-Day Strength Sprint</em>).
              </p>
              <p className="text-gray-300 leading-relaxed mb-6 print:text-black">
                Each Round lives at the intersection of:
              </p>
              <ul className="space-y-4 mb-6">
                <li className="flex items-start gap-4 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50">
                  <Calendar className="w-6 h-6 text-[#E0FE10] mt-1 flex-shrink-0" />
                  <div className="text-gray-300 print:text-black"><strong className="text-white print:text-black">Structure:</strong> Clear timeline (e.g., 7, 14, or 30 days)</div>
                </li>
                <li className="flex items-start gap-4 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50">
                  <Lightbulb className="w-6 h-6 text-[#E0FE10] mt-1 flex-shrink-0" />
                  <div className="text-gray-300 print:text-black"><strong className="text-white print:text-black">Story:</strong> A theme or focus that connects your content and motivates challengers</div>
                </li>
                <li className="flex items-start gap-4 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50">
                  <Users className="w-6 h-6 text-[#E0FE10] mt-1 flex-shrink-0" />
                  <div className="text-gray-300 print:text-black"><strong className="text-white print:text-black">Social Energy:</strong> A built-in community of participants who move together, share progress, and engage directly with you as the coach</div>
                </li>
              </ul>
              <div className="bg-[#E0FE10]/10 border-l-4 border-[#E0FE10] p-4 rounded print:bg-yellow-50">
                <p className="text-gray-200 italic print:text-black">
                  Rounds are how creators transform workouts into experiences — and experiences into income and community growth.
                </p>
              </div>
            </div>
          </section>

          {/* How do Rounds work */}
          <section className="mb-12 print:mb-8">
            <h2 className="text-3xl font-bold mb-6 text-white print:text-black print:text-xl">How do Rounds work?</h2>
            <div className="bg-zinc-900 rounded-xl p-8 border border-zinc-800 print:bg-white print:border-gray-300">
              <div className="space-y-4">
                {[
                  { title: 'You create the Round', desc: 'Choose your theme, duration, and difficulty level. Each Round is made up of "Moves" (individual exercises) and "Stacks" (bundled routines).' },
                  { title: 'You set the goal', desc: 'Define what participants will achieve by the end — e.g., "Stronger core," "Better mobility," or "Consistency reset."' },
                  { title: 'We support you', desc: 'Pulse helps with content structure, visuals, and onboarding. You can film at home or in-studio — your style sets the tone.' },
                  { title: 'You promote and launch', desc: 'Pulse amplifies your launch through in-app features and promotional assets.' },
                  { title: 'Challengers join', desc: 'Participants sign up, track progress, and share updates with the community.' },
                  { title: 'You engage', desc: 'Respond to posts, celebrate wins, and keep your challengers motivated.' },
                  { title: 'You earn', desc: 'Rounds are designed to generate both active revenue (through participation fees, sponsorships, or co-branded partnerships) and passive income (through replays and evergreen content).' }
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b border-zinc-800 last:border-b-0 print:border-gray-200">
                    <div className="w-8 h-8 bg-[#E0FE10] text-black rounded-full flex items-center justify-center font-bold flex-shrink-0 print:w-6 print:h-6 print:text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg mb-1 text-white print:text-black print:text-base">{step.title}</h3>
                      <p className="text-gray-400 print:text-gray-700 print:text-sm">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 bg-[#E0FE10]/10 border-l-4 border-[#E0FE10] rounded print:bg-yellow-50 print:p-3">
                <p className="text-gray-300 print:text-gray-700 italic print:text-sm">
                  <strong className="text-white print:text-black">Rounds are the heartbeat of Pulse</strong> — they turn your expertise into an interactive, community-powered product. A Round is not just a workout plan — it's a branded, social, story-driven experience. When built well, it amplifies your voice, strengthens your community, and grows your revenue, all while helping your audience move, connect, and transform.
                </p>
              </div>
            </div>
          </section>

          {/* Case Study */}
          <section id="case-study" className="mb-12 print:mb-8">
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-xl p-8 print:bg-white print:border-gray-300 print:p-4">
              <div className="flex items-center gap-2 mb-6">
                <Target className="w-6 h-6 text-[#E0FE10]" />
                <h2 className="text-3xl font-bold text-white print:text-black print:text-xl">Case Study: Meet Jaidus</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Video showcase - portrait format */}
                <div className="lg:col-span-1 print:hidden">
                  <div className="rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '9/16' }}>
                    <video 
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                      src="/JaidusNewYear.mov"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>

                {/* Content */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-300 print:text-gray-700"><strong className="text-white print:text-black">Partner:</strong> SoulCycle × Jaidus Mondesir</p>
                    <p className="text-gray-300 print:text-gray-700"><strong className="text-white print:text-black">Round:</strong> 30-Day Ab Challenge</p>
                    <p className="text-gray-300 print:text-gray-700"><strong className="text-white print:text-black">Timeline:</strong> January 2025</p>
                    <p className="text-gray-300 print:text-gray-700"><strong className="text-white print:text-black">Type:</strong> Branded partnership pilot</p>
                    <p className="text-gray-300 print:text-gray-700"><strong className="text-white print:text-black">Format:</strong> 30 days of core-focused workouts filmed in-studio</p>
                  </div>
                  <div className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 print:bg-gray-50 print:border-gray-200 print:p-3">
                    <h4 className="font-semibold mb-3 text-white print:text-black print:text-sm">Round Goals:</h4>
                    <ul className="space-y-2 text-sm text-gray-300 print:text-gray-700 print:text-xs">
                      <li className="flex items-start gap-2">
                        <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                        <span><strong className="text-white print:text-black">Expand Reach:</strong> Engage people outside SoulCycle's existing cycling audience</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                        <span><strong className="text-white print:text-black">Build Personal Brand:</strong> Establish Jaidus as a multidimensional coach beyond the bike</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#E0FE10] flex-shrink-0">✓</span>
                        <span><strong className="text-white print:text-black">Drive Real-World Conversion:</strong> Use the digital challenge to bring new members into the world and rigor of SoulCycle studios</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-[#E0FE10]/10 border-l-4 border-[#E0FE10] p-4 rounded print:bg-yellow-50 print:p-3">
                    <p className="text-gray-300 print:text-gray-700 print:text-sm">
                      SoulCycle instructor Jaidus Mondesir wanted to extend his reach beyond the cycling studio. His goal was to translate the motivation, energy, and storytelling that defined his in-person classes into a digital space that could connect both existing riders and new audiences who hadn't yet set foot in a SoulCycle studio.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* The Breakdown */}
          <section id="breakdown" className="mb-12 print:mb-8">
            <h2 className="text-4xl font-bold mb-8 text-white print:text-black print:text-2xl">The Breakdown: How to Build a Round</h2>
            
            <div className="space-y-8 print:space-y-4">
              {/* Step 1 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Target className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 1: Define the Focus</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Identify a single clear goal (abs, mobility, strength, mindfulness)</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What is the overall theme of this round?</p>
                    <input 
                      type="text" 
                      placeholder="e.g., 30-Day Core Reset" 
                      value={formData.step1.theme}
                      onChange={(e) => updateStepField('step1', 'theme', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What are your 1-2 goals for your clients?</p>
                    <textarea 
                      placeholder="e.g., Build visible core strength, improve posture" 
                      rows={2} 
                      value={formData.step1.goals}
                      onChange={(e) => updateStepField('step1', 'goals', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 2: Design the Structure</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Choose the duration (7, 14, or 30 days) and intensity. Mix "Moves" (workouts) and "Stacks" (combos).</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What is the duration of this round? Why?</p>
                    <textarea 
                      placeholder="e.g., 30 days to build consistent habits and see visible results" 
                      rows={2} 
                      value={formData.step2.duration}
                      onChange={(e) => updateStepField('step2', 'duration', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you structure it to build the intensity over time and throughout the duration?</p>
                    <textarea 
                      placeholder="e.g., Week 1: Foundation, Week 2-3: Progressive overload, Week 4: Peak performance" 
                      rows={2} 
                      value={formData.step2.structure}
                      onChange={(e) => updateStepField('step2', 'structure', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Lightbulb className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 3: Craft the Experience</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Add storytelling and motivation. Include daily themes or mantras.</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What story or message do you want your participants to feel and remember throughout the round?</p>
                    <textarea 
                      placeholder="e.g., Your core is your foundation — build it strong and everything else follows" 
                      rows={2} 
                      value={formData.step3.story}
                      onChange={(e) => updateStepField('step3', 'story', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you weave motivation or mindset into each day in the round and feed (e.g., quotes, reflections, or mantras)?</p>
                    <textarea 
                      placeholder="e.g., Daily check-in questions, motivational quotes, progress reflections" 
                      rows={2} 
                      value={formData.step3.motivation}
                      onChange={(e) => updateStepField('step3', 'motivation', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What emotions or energy do you want your participants to walk away with by the end?</p>
                    <textarea 
                      placeholder="e.g., Empowered, confident, capable of more than they thought" 
                      rows={2} 
                      value={formData.step3.emotions}
                      onChange={(e) => updateStepField('step3', 'emotions', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Camera className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 4: Set the Visual Tone</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Film or capture content that reflects your brand and energy.</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What do you want your content to look and feel like (e.g., high-energy, calm, minimalist, gritty, cinematic)?</p>
                    <textarea 
                      placeholder="e.g., High-energy, raw, authentic gym atmosphere" 
                      rows={2} 
                      value={formData.step4.visualTone}
                      onChange={(e) => updateStepField('step4', 'visualTone', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">Where will you film or shoot your content so it aligns with your personal brand or environment?</p>
                    <textarea 
                      placeholder="e.g., My local gym, outdoor park, home studio" 
                      rows={2} 
                      value={formData.step4.location}
                      onChange={(e) => updateStepField('step4', 'location', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How can your visuals (music, lighting, camera angles, wardrobe) reinforce your message or theme?</p>
                    <textarea 
                      placeholder="e.g., Consistent branded apparel, natural lighting, dynamic angles" 
                      rows={2} 
                      value={formData.step4.visualElements}
                      onChange={(e) => updateStepField('step4', 'visualElements', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Users className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 5: Build Engagement</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Encourage daily check-ins, progress posts, and community shoutouts.</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you create moments for participants to share their wins or challenges?</p>
                    <textarea 
                      placeholder="e.g., Daily photo check-ins, weekly reflection prompts" 
                      rows={2} 
                      value={formData.step5.sharingMoments}
                      onChange={(e) => updateStepField('step5', 'sharingMoments', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What types of prompts, reminders, or touchpoints will help your community stay active and accountable?</p>
                    <textarea 
                      placeholder="e.g., Morning motivational messages, mid-week check-ins, weekend recaps" 
                      rows={2} 
                      value={formData.step5.prompts}
                      onChange={(e) => updateStepField('step5', 'prompts', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you show up in the community (through comments, live check-ins, or video messages)?</p>
                    <textarea 
                      placeholder="e.g., Daily comment engagement, weekly live Q&A, personal video shoutouts" 
                      rows={2} 
                      value={formData.step5.presence}
                      onChange={(e) => updateStepField('step5', 'presence', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Step 6 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <Gift className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 6: Add an Incentive</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Create a reward or experience for completion (e.g., free class, merch, shoutout, bragging rights)</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What's one meaningful reward or recognition that would motivate your participants to finish strong?</p>
                    <textarea 
                      placeholder="e.g., Free 1-on-1 session, exclusive merch, featured spotlight" 
                      rows={2} 
                      value={formData.step6.reward}
                      onChange={(e) => updateStepField('step6', 'reward', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How can the incentive connect back to your brand or business (e.g., free session, event invite, feature)?</p>
                    <textarea 
                      placeholder="e.g., Winners get featured on my IG, invite to exclusive workout event" 
                      rows={2} 
                      value={formData.step6.brandConnection}
                      onChange={(e) => updateStepField('step6', 'brandConnection', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What non-monetary reward could make participants feel seen, celebrated, or part of something bigger?</p>
                    <textarea 
                      placeholder="e.g., Public recognition, Hall of Fame post, community badge" 
                      rows={2} 
                      value={formData.step6.nonMonetary}
                      onChange={(e) => updateStepField('step6', 'nonMonetary', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Step 7 */}
              <div className="bg-zinc-900 border-l-4 border-[#E0FE10] rounded-r-xl p-6 print:bg-white print:border-gray-300 print:pl-4">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="w-6 h-6 text-[#E0FE10]" />
                  <h3 className="text-2xl font-bold text-white print:text-black print:text-lg">Step 7: Launch + Reflect</h3>
                </div>
                <p className="text-gray-400 mb-4 print:text-gray-600 print:text-sm">Announce, promote, and gather data on participation, engagement, and completion.</p>
                <div className="space-y-3 bg-zinc-800/50 p-4 rounded-lg print:bg-gray-50 print:p-3">
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you build anticipation and promote your round before launch (social posts, teaser videos, partner collabs)?</p>
                    <textarea 
                      placeholder="e.g., Countdown posts, behind-the-scenes content, influencer partnerships" 
                      rows={2} 
                      value={formData.step7.promotion}
                      onChange={(e) => updateStepField('step7', 'promotion', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What metrics or signs of success will you look for (sign-ups, engagement rate, community activity, conversions)?</p>
                    <textarea 
                      placeholder="e.g., 100+ sign-ups, 70% completion rate, 5+ posts per day" 
                      rows={2} 
                      value={formData.step7.metrics}
                      onChange={(e) => updateStepField('step7', 'metrics', e.target.value)}
                      className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Build Your Round Table */}
          <section className="mb-12 print:mb-8 print:page-break-before">
            <h2 className="text-4xl font-bold mb-6 text-white print:text-black print:text-2xl">BUILD YOUR ROUND</h2>
            <p className="text-gray-400 mb-6 print:text-gray-600 print:text-sm">Use this planner to map out each day of your Round. Add or remove days as needed.</p>
            
            <div className="space-y-4 print:space-y-2">
              {formData.days.map((day, dayIndex) => (
                <div key={dayIndex} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 print:bg-white print:border-gray-300 print:p-2 print:break-inside-avoid">
                  <div className="flex items-center justify-between mb-3 print:mb-2">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="text"
                        value={day.day}
                        onChange={(e) => updateDay(dayIndex, 'day', e.target.value)}
                        className="font-bold text-lg bg-transparent text-white border-b border-zinc-700 focus:border-[#E0FE10] outline-none px-2 py-1 print:text-black print:border-gray-300 print:text-sm print:py-0"
                        placeholder="Day #"
                      />
                      <input
                        type="text"
                        value={day.focusArea}
                        onChange={(e) => updateDay(dayIndex, 'focusArea', e.target.value)}
                        className="flex-1 bg-transparent text-gray-400 border-b border-zinc-700 focus:border-[#E0FE10] outline-none px-2 py-1 print:text-gray-600 print:border-gray-300 print:text-sm print:py-0"
                        placeholder="Focus Area (e.g., Upper Body)"
                      />
                    </div>
                    {formData.days.length > 1 && (
                      <button
                        onClick={() => removeDay(dayIndex)}
                        className="text-red-400 hover:text-red-300 p-1 print:hidden"
                        title="Remove day"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 print:grid-cols-3 print:gap-1">
                    {day.moves.map((move, moveIndex) => (
                      <div key={moveIndex} className="relative">
                        <label className="text-xs text-gray-500 mb-1 block print:text-[10px]">Move {moveIndex + 1}</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={move}
                            onChange={(e) => updateMove(dayIndex, moveIndex, e.target.value)}
                            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-sm focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-xs print:py-0"
                            placeholder={`Move ${moveIndex + 1}`}
                          />
                          {day.moves.length > 1 && (
                            <button
                              onClick={() => removeMove(dayIndex, moveIndex)}
                              className="text-red-400 hover:text-red-300 p-1 print:hidden flex-shrink-0"
                              title="Remove move"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <button
                    onClick={() => addMove(dayIndex)}
                    className="mt-3 text-sm flex items-center gap-1 text-[#E0FE10] hover:text-[#d0ee00] transition-colors print:hidden"
                  >
                    <Plus className="w-3 h-3" /> Add Move
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addDay}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#E0FE10] text-black rounded-lg hover:bg-[#d0ee00] transition-colors font-medium print:hidden"
            >
              <Plus className="w-4 h-4" /> Add Day
            </button>
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

