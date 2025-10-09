import React, { useState } from 'react';
import Head from 'next/head';
import { Target, Calendar, Lightbulb, Camera, Users, Gift, TrendingUp, Plus, X } from 'lucide-react';

const BuildYourRound: React.FC = () => {
  const [days, setDays] = useState([
    { day: 'Day X', focusArea: 'Upper Body', moves: ['Barbell Flat Bench Press', 'Incline Dumbbell Press', '50 Push-Ups', 'Dumbbell Shoulder Press', 'Dumbbell Lateral Raises', 'Plank'] }
  ]);

  const addDay = () => {
    setDays([...days, { day: `Day ${days.length + 1}`, focusArea: '', moves: ['', '', '', '', '', ''] }]);
  };

  const updateDay = (index: number, field: 'day' | 'focusArea', value: string) => {
    const updated = [...days];
    updated[index][field] = value;
    setDays(updated);
  };

  const updateMove = (dayIndex: number, moveIndex: number, value: string) => {
    const updated = [...days];
    updated[dayIndex].moves[moveIndex] = value;
    setDays(updated);
  };

  const addMove = (dayIndex: number) => {
    const updated = [...days];
    updated[dayIndex].moves.push('');
    setDays(updated);
  };

  const removeMove = (dayIndex: number, moveIndex: number) => {
    const updated = [...days];
    if (updated[dayIndex].moves.length > 1) {
      updated[dayIndex].moves.splice(moveIndex, 1);
      setDays(updated);
    }
  };

  const removeDay = (index: number) => {
    if (days.length > 1) {
      setDays(days.filter((_, i) => i !== index));
    }
  };

  return (
    <>
      <Head>
        <title>Build Your Round | Pulse Creator Guide</title>
      </Head>
      
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Header with Logo */}
        <div className="bg-gradient-to-r from-zinc-900 to-black border-b border-zinc-800 py-8 print:py-4">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center gap-4 mb-2">
              <img 
                src="/pulseIcon.png" 
                alt="Pulse Logo" 
                className="w-16 h-16 rounded-xl"
              />
              <div>
                <h1 className="text-4xl font-bold text-white">Pulse Creator Guide</h1>
                <p className="text-zinc-400 text-sm mt-1">How to Design and Launch a Successful Round</p>
              </div>
            </div>
          </div>
        </div>

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
          <section className="mb-12 print:mb-8">
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
          <section className="mb-12 print:mb-8">
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
                    <input type="text" placeholder="e.g., 30-Day Core Reset" className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What are your 1-2 goals for your clients?</p>
                    <textarea placeholder="e.g., Build visible core strength, improve posture" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
                    <textarea placeholder="e.g., 30 days to build consistent habits and see visible results" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you structure it to build the intensity over time and throughout the duration?</p>
                    <textarea placeholder="e.g., Week 1: Foundation, Week 2-3: Progressive overload, Week 4: Peak performance" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
                    <textarea placeholder="e.g., Your core is your foundation — build it strong and everything else follows" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you weave motivation or mindset into each day in the round and feed (e.g., quotes, reflections, or mantras)?</p>
                    <textarea placeholder="e.g., Daily check-in questions, motivational quotes, progress reflections" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What emotions or energy do you want your participants to walk away with by the end?</p>
                    <textarea placeholder="e.g., Empowered, confident, capable of more than they thought" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
                    <textarea placeholder="e.g., High-energy, raw, authentic gym atmosphere" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">Where will you film or shoot your content so it aligns with your personal brand or environment?</p>
                    <textarea placeholder="e.g., My local gym, outdoor park, home studio" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How can your visuals (music, lighting, camera angles, wardrobe) reinforce your message or theme?</p>
                    <textarea placeholder="e.g., Consistent branded apparel, natural lighting, dynamic angles" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
                    <textarea placeholder="e.g., Daily photo check-ins, weekly reflection prompts" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What types of prompts, reminders, or touchpoints will help your community stay active and accountable?</p>
                    <textarea placeholder="e.g., Morning motivational messages, mid-week check-ins, weekend recaps" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How will you show up in the community (through comments, live check-ins, or video messages)?</p>
                    <textarea placeholder="e.g., Daily comment engagement, weekly live Q&A, personal video shoutouts" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
                    <textarea placeholder="e.g., Free 1-on-1 session, exclusive merch, featured spotlight" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">How can the incentive connect back to your brand or business (e.g., free session, event invite, feature)?</p>
                    <textarea placeholder="e.g., Winners get featured on my IG, invite to exclusive workout event" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What non-monetary reward could make participants feel seen, celebrated, or part of something bigger?</p>
                    <textarea placeholder="e.g., Public recognition, Hall of Fame post, community badge" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
                    <textarea placeholder="e.g., Countdown posts, behind-the-scenes content, influencer partnerships" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
                  </div>
                  <div>
                    <p className="font-medium mb-2 text-gray-200 print:text-black print:text-sm">What metrics or signs of success will you look for (sign-ups, engagement rate, community activity, conversions)?</p>
                    <textarea placeholder="e.g., 100+ sign-ups, 70% completion rate, 5+ posts per day" rows={2} className="w-full bg-zinc-700 border border-zinc-600 text-white rounded-md px-3 py-2 focus:border-[#E0FE10] outline-none print:bg-white print:border-gray-300 print:text-black print:text-sm" />
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
              {days.map((day, dayIndex) => (
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
                    {days.length > 1 && (
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

          {/* Print/Export Actions */}
          <div className="flex gap-4 mt-12 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex-1 bg-zinc-800 text-white px-6 py-3 rounded-lg hover:bg-zinc-700 border border-zinc-700 transition-colors font-medium"
            >
              Print / Save as PDF
            </button>
            <button
              onClick={() => {
                const data = { days };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'my-round-plan.json';
                a.click();
              }}
              className="flex-1 bg-zinc-800 text-white px-6 py-3 rounded-lg hover:bg-zinc-700 border border-zinc-700 transition-colors font-medium"
            >
              Export Data
            </button>
          </div>
        </div>

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
      </div>
    </>
  );
};

export default BuildYourRound;

