import type { Course } from './types';

// Parent education courses. Voice: plain, warm, "your child" (never "kid"/"your athlete"),
// growth-framed, no clinical jargon — consistent with the parent readiness assessment.

const recognizingTheSigns: Course = {
  id: 'parent-recognizing-the-signs',
  audience: 'parent',
  format: 'self-paced',
  title: 'Recognizing the Signs Before a Crisis',
  tagline: 'Learn to read the quiet changes early — and know exactly what to do at each step.',
  price: '$79',
  durationLabel: '~50 min · self-paced + scenario lab',
  forWhom:
    'For any sports parent who wants to spot trouble early and feel confident about when to support, when to get help, and what to do in an emergency.',
  domains: ['Spotting the warning signs', 'Knowing when to get help', 'Coming back after a setback'],
  modules: [
    {
      id: 'm1-what-changed',
      title: 'Module 1 — What changed?',
      summary: 'Tell a normal rough patch apart from a pattern that needs your attention.',
      lessons: [
        {
          id: 'm1-l1',
          title: 'Signs matter more than moments',
          duration: '6 min',
          bigIdea: 'One hard night is normal. A change that repeats for a couple of weeks is the signal.',
          body: [
            'Every athlete has bad days — a brutal loss, a fight with a friend, a sleepless night before a test. On its own, none of that means something is wrong. What matters is the pattern: the same change showing up again and again, for two weeks or more, across different days and situations.',
            'Athletes are especially good at hiding struggle. They are trained to push through, to not show weakness, to be "fine." So the signs are often quiet — a little less eating, a little more time alone, a little flatter than usual. Your advantage as a parent is that you know their normal better than anyone.',
          ],
          keyPoints: [
            'A moment is one-off. A pattern repeats and lasts.',
            'Two weeks of the same change is a useful line for "pay attention."',
            'You are the expert on your child\'s baseline — trust that.',
          ],
          tryThis:
            'Picture your child on a normal good week: how they eat, sleep, talk, and hang out. That mental baseline is what you are comparing against.',
        },
        {
          id: 'm1-l2',
          title: 'Eating and sleep',
          duration: '7 min',
          bigIdea: 'Food and sleep are the first things to shift when something is off.',
          body: [
            'Watch for eating that changes direction and stays changed: skipping meals after games, eating much less or much more than usual, disappearing right after dinner, or new rigid rules about food. After-game appetite that vanishes for weeks — especially tied to "I played badly" — is worth your attention.',
            'Sleep tells a similar story. Trouble falling asleep, waking through the night, or sleeping far more than usual and still seeming exhausted are all worth noting. Sleep and mood feed each other, so a sleep change rarely travels alone.',
          ],
          keyPoints: [
            'Direction matters less than persistence — up or down, does it last?',
            'Eating tied to performance ("food feels pointless after mistakes") is a flag.',
            'Big sleep changes plus low mood is a combination to take seriously.',
          ],
        },
        {
          id: 'm1-l3',
          title: 'Mood and pulling away',
          duration: '6 min',
          bigIdea: 'Losing interest and pulling back from people are some of the clearest early signs.',
          body: [
            'Notice irritability that is new, a flatness where there used to be energy, or losing interest in things they used to love — including the sport itself. Pulling away is especially telling: skipping time with teammates, going quiet in the group chat, spending far more time alone in their room.',
            'These changes can look like "just being a teenager," and sometimes they are. The questions to ask yourself: Is this new? Is it lasting? Is it spreading into more parts of their life? The more "yes" answers, the more it deserves a closer look.',
          ],
          keyPoints: [
            'New + lasting + spreading = pay closer attention.',
            'Losing interest in the sport they loved is a real signal, not just attitude.',
            'Withdrawal from friends and teammates often shows up before they say anything.',
          ],
        },
        {
          id: 'm1-l4',
          title: 'Identity and self-talk',
          duration: '6 min',
          bigIdea: 'When their words tie their worth to performance, the stakes get higher.',
          body: [
            'Listen for how they talk about themselves. "I let everyone down," "I\'m nothing if I\'m not starting," "What\'s the point" — language that ties who they are to how they performed is more than frustration. It means a rough stretch in sport can feel like a verdict on their whole self.',
            'This is the kind of self-talk that can slide toward hopelessness. You do not need to diagnose anything. You just need to hear it, take it seriously, and stay close — and if the language turns toward not wanting to be here, treat that as a safety matter (covered in Module 3).',
          ],
          keyPoints: [
            'Worth-tied-to-results language is a flag, not normal venting.',
            'You do not have to fix it — hearing it and staying close matters most.',
            'Hopeless or "don\'t want to be here" language → go to the emergency steps.',
          ],
          sayThis: [
            {
              avoid: '"Don\'t talk like that, you\'re a great player."',
              say: '"It sounds like this has been carrying a lot of who you are lately. I\'m here for that part, not just the sport."',
              why: 'Reassuring the athlete skips the person. Naming the deeper fear keeps them talking.',
            },
          ],
        },
      ],
    },
    {
      id: 'm2-the-line',
      title: 'Module 2 — Watch, support, or get help?',
      summary: 'Know which lane a situation belongs in and who to call first.',
      lessons: [
        {
          id: 'm2-l1',
          title: 'The three lanes',
          duration: '6 min',
          bigIdea: 'Most situations fall into one of three lanes: support at home, loop in a professional, or act now.',
          body: [
            'Lane one is everyday support: a normal rough patch you can be present for at home. Lane two is when a pattern has set in and it is bigger than a parent should carry alone — time to bring in a professional. Lane three is an emergency, where safety is at risk and you act immediately.',
            'The mistake to avoid is staying in lane one too long because acting feels like overreacting. With your child\'s mental health, getting help early is never the overreaction — it is the skill.',
          ],
          keyPoints: [
            'Lane 1: support at home. Lane 2: loop in a pro. Lane 3: act now.',
            'When in doubt, move up a lane, not down.',
            'Getting help early is a strength, not a panic.',
          ],
        },
        {
          id: 'm2-l2',
          title: 'When watch-and-wait becomes get-help',
          duration: '7 min',
          bigIdea: 'Duration, intensity, and whether daily life is affected tell you it is time to act.',
          body: [
            'Three questions move you from lane one to lane two. Duration: has it lasted two weeks or more? Intensity: is it getting worse, not better? Function: is it affecting eating, sleeping, school, or friendships? If you are answering yes, it is time to bring in a professional — you do not need to wait for it to get worse.',
            'And one override: any talk of not wanting to be here, hurting themselves, or feeling like a burden moves straight to lane three, no matter how long it has or hasn\'t been going on.',
          ],
          keyPoints: [
            'Two-plus weeks, getting worse, or affecting daily life → get help.',
            'You do not need permission or certainty to involve a professional.',
            'Any safety language overrides everything and goes to emergency steps.',
          ],
        },
        {
          id: 'm2-l3',
          title: 'Who to call first',
          duration: '6 min',
          bigIdea: 'You have more people in your corner than you think — line them up before you need them.',
          body: [
            'Good first calls: your child\'s doctor or pediatrician (they can screen and refer), the school counselor (often the fastest route to support during the day), the athletic trainer if your child has one, and a therapist or counselor who works with teens or athletes. You do not have to pick perfectly — any of these can help you find the next step.',
            'When you reach out, keep it simple and specific: what you\'ve noticed, how long, and that you\'d like guidance. You are not asking them to fix everything in one call — you are opening a door.',
          ],
          keyPoints: [
            'Doctor, school counselor, athletic trainer, or a teen/athlete therapist are all valid first calls.',
            'Describe what you saw, how long, and ask for the next step.',
            'You are opening a door, not solving it all at once.',
          ],
          tryThis:
            'Write down three names and numbers today — doctor, school counselor, and one more — so the list exists before you ever need it.',
        },
      ],
    },
    {
      id: 'm3-emergency',
      title: 'Module 3 — The emergency playbook',
      summary: 'Know what an emergency looks like and exactly what to do — before you need it.',
      lessons: [
        {
          id: 'm3-l1',
          title: 'What an emergency looks like',
          duration: '6 min',
          bigIdea: 'Direct statements, a plan, or sudden changes around safety mean act now.',
          body: [
            'Treat these as emergencies: any direct statement about wanting to die or not be here, talk of a plan or method, giving away meaningful possessions, saying goodbye, or a sudden calm after a deep low. Self-harm, or a message like "I don\'t want to be here anymore" followed by going silent, also belongs here.',
            'You will not always be sure. That is okay. With safety, you act on the possibility — you do not wait for proof.',
          ],
          keyPoints: [
            'Any talk of dying, a plan, or goodbyes = emergency.',
            'A sudden calm after a low can be a warning, not relief.',
            'When unsure, act as if it is real.',
          ],
        },
        {
          id: 'm3-l2',
          title: 'What to do in the moment',
          duration: '7 min',
          bigIdea: 'Stay with them, ask directly, reduce access to means, and get help now.',
          body: [
            'Do not leave them alone. Stay calm and stay present. Ask directly — "Are you thinking about hurting yourself?" Asking does not plant the idea; it tells them it is safe to be honest. Reduce access to anything dangerous in the home. Then get help immediately.',
            'In the U.S., you can call or text 988 (the Suicide & Crisis Lifeline) any time, call 911, or go to the nearest emergency room. Keep these where you can find them fast. If your child has a therapist or doctor, loop them in too — but do not let that delay emergency help.',
          ],
          keyPoints: [
            'Do not leave them alone; stay calm and present.',
            'Ask directly — it helps, it does not harm.',
            'Reduce access to means, then call/text 988, call 911, or go to the ER.',
          ],
        },
        {
          id: 'm3-l3',
          title: 'What to say (and not say)',
          duration: '5 min',
          bigIdea: 'In a crisis, presence and honesty matter more than the perfect words.',
          body: [
            'You do not need a script. You need to be calm, direct, and on their side. Avoid arguing them out of the feeling, minimizing it, or making it about your fear. Lead with being there.',
          ],
          sayThis: [
            {
              avoid: '"You have so much to live for — don\'t think like that."',
              say: '"I\'m really glad you told me. You\'re not alone in this, and we\'re going to get help together right now."',
              why: 'Arguing with the feeling shuts it down. Being on their side and acting keeps them with you.',
            },
            {
              avoid: '"Are you trying to scare me?"',
              say: '"Are you thinking about hurting yourself? You can be honest with me."',
              why: 'A direct, calm question makes it safe to tell the truth.',
            },
          ],
        },
      ],
    },
    {
      id: 'm4-coming-back',
      title: 'Module 4 — Coming back',
      summary: 'Support a real recovery without turning the return into a test.',
      lessons: [
        {
          id: 'm4-l1',
          title: 'After the scare',
          duration: '6 min',
          bigIdea: 'Recovery is not a straight line, and home is the safe base it happens from.',
          body: [
            'After a hard stretch or a scare, there will be good days and hard days. That is normal, not a relapse. Your job is not to monitor every mood — it is to keep home a place where they do not have to perform, follow the plan from any professional involved, and stay quietly connected.',
            'Keep some normal going: meals together, the ordinary rhythms, the inside jokes. Normalcy is reassuring. It tells them that they are still themselves and still belong, no matter what they are working through.',
          ],
          keyPoints: [
            'Ups and downs are part of recovery, not failure.',
            'Follow the professional\'s plan; you are the support, not the clinician.',
            'Protect normal — it is more healing than constant check-ins.',
          ],
        },
        {
          id: 'm4-l2',
          title: 'Return without making it a test',
          duration: '6 min',
          bigIdea: 'Ease back into sport and life without hovering or turning every day into a check-up.',
          body: [
            'When they return to training or competition, let it be gradual and low-pressure. Watch without hovering. Constant "How are you feeling?" check-ins can make them feel like a patient instead of a person. Be available, stay observant, and let them lead more of it back.',
            'Keep the lane lessons in mind: you are still watching for patterns, you still have your contact list, and you still act fast if safety language returns. But day to day, the goal is to help them feel normal, capable, and supported.',
          ],
          keyPoints: [
            'Gradual and low-pressure beats fast and proving.',
            'Watch without hovering — availability over interrogation.',
            'Stay ready to act, but lead with normal.',
          ],
          sayThis: [
            {
              avoid: '"How are you feeling? Are you sure you\'re okay? Be honest."',
              say: '"Good to see you back out there. I\'m around whenever you want to talk — or not."',
              why: 'Repeated check-ins feel like surveillance. An open door without pressure invites them in.',
            },
          ],
        },
      ],
    },
  ],
  scenarioLab: [
    {
      id: 'lab-1',
      prompt:
        'Your child has skipped dinner after games for two weeks and says food "feels pointless after mistakes." What\'s the right move?',
      options: [
        { label: 'Give it more time — it\'s probably a slump', feedback: 'Two weeks of eating change tied to performance is a pattern, not a slump. This is lane two.' },
        { label: 'Just keep encouraging them at dinner', feedback: 'Support is good, but a two-week pattern needs more than encouragement.' },
        { label: 'Ease the pressure and bring in a professional', feedback: 'Right call. Lighten the load and loop in your doctor, counselor, or AT.', best: true },
      ],
    },
    {
      id: 'lab-2',
      prompt: 'Your child gets in the car after practice, silent and tense. What\'s the best first move?',
      options: [
        { label: '"What happened? What did the coach say?"', feedback: 'Jumping to questions and blame can close the door before it opens.' },
        { label: '"I can tell today took a lot out of you."', feedback: 'Naming what you see without demanding answers keeps the door open.', best: true },
        { label: 'Say nothing and let them stew', feedback: 'Silence can read as distance. A low-pressure observation works better.' },
      ],
    },
    {
      id: 'lab-3',
      prompt: 'Your child texts "I don\'t want to be here anymore," then stops answering. What do you do?',
      options: [
        { label: 'Give them space and check in tomorrow', feedback: 'This is a safety emergency — space and waiting are the wrong response.' },
        { label: 'Reach them now, don\'t leave them alone, and get help (988/911/ER)', feedback: 'Yes. Make contact, stay with them, and use emergency help immediately.', best: true },
        { label: 'Send an encouraging text and wait', feedback: 'Caring, but it does not match the seriousness. This needs immediate action.' },
      ],
    },
    {
      id: 'lab-4',
      prompt: 'A professional has cleared your child after a scare. They want to prove everything is back to normal fast. What should home focus on first?',
      options: [
        { label: 'Get them back to full training right away', feedback: 'Snapping back to full pressure can undo progress. Ease in.' },
        { label: 'A slow, low-pressure return while following the plan', feedback: 'Right. Gradual return, follow the professional\'s guidance, watch without hovering.', best: true },
        { label: 'Check in on their feelings several times a day', feedback: 'Constant check-ins feel like surveillance. Stay available, not hovering.' },
      ],
    },
  ],
};

const parentFoundations: Course = {
  id: 'parent-foundations',
  audience: 'parent',
  format: 'live',
  title: 'Parent Foundations: The Athlete Brain Under Pressure',
  tagline: 'Two live sessions to help you support your child through pressure — without turning home into another place they have to perform.',
  price: '$199',
  durationLabel: '2 live sessions + take-home guide',
  forWhom:
    'For parents who want the core foundation: how pressure affects your child, how to talk so they open up, and how to stay in your lane as the supporter.',
  domains: ['How stress affects the body', 'Talking so they open up', 'Knowing your role', 'Building mental skills'],
  sessions: [
    {
      id: 's1',
      title: 'Session 1 — The Athlete Brain Under Pressure',
      duration: '75 min, live',
      objectives: [
        'Understand what stress and pressure actually do to performance and mood.',
        'See why a bad game is not a bad kid — and how to separate worth from results.',
        'Learn the difference between a normal rough patch and a pattern worth watching.',
      ],
      agenda: [
        { segment: 'Opening (10 min)', detail: 'Why the people around the athlete shape so much — and where parents fit.' },
        { segment: 'The brain under pressure (25 min)', detail: 'How sleep, nerves, travel, and criticism change what your child can do on the day.' },
        { segment: 'Worth vs. the scoreboard (25 min)', detail: 'Spotting performance-tied identity, and responses that protect the person, not just the athlete.' },
        { segment: 'Q&A + reflection (15 min)', detail: 'Bring a real moment from your season; leave with a first move.' },
      ],
    },
    {
      id: 's2',
      title: 'Session 2 — Showing Up Right',
      duration: '75 min, live',
      objectives: [
        'Use first sentences and habits that keep your child talking.',
        'Stay the supporter — not the second coach or the agent.',
        'Take real pressure off at home so it stays a safe place.',
      ],
      agenda: [
        { segment: 'Conversations that stay open (25 min)', detail: 'What to say and what to avoid after wins, losses, and silent car rides.' },
        { segment: 'Your lane (20 min)', detail: 'Coach vs. parent vs. trainer — what is yours to carry and what is not.' },
        { segment: 'The home-pressure audit (20 min)', detail: 'Find the small habits that quietly add pressure, and swap them.' },
        { segment: 'Make-a-plan + close (10 min)', detail: 'Each parent leaves with one say-this change and one home change.' },
      ],
    },
  ],
  takeHomeGuide: [
    {
      title: 'What to say / what to avoid',
      intro: 'Keep this on the fridge. The goal is to keep the door open, not to fix.',
      items: [
        'Avoid "You need to toughen up." Say "I can tell today took a lot out of you."',
        'Avoid "What did the coach say this time?" Say "I\'m glad you\'re here — no game talk tonight unless you want it."',
        'Avoid "At least you tried." Say "That one really stung. I\'m proud of how you compete."',
        'Avoid leading with advice. Ask "Do you want me to just listen, or help think it through?"',
      ],
    },
    {
      title: 'The home-pressure audit',
      intro: 'Ask yourself honestly — each "yes" is a small change to make.',
      items: [
        'Is the first question after a game about performance?',
        'Does my body language change based on whether they won?',
        'Do car rides become film review?',
        'Does my child hear more about results than about who they are?',
        'Is there any place at home that is fully a no-performance zone?',
      ],
    },
    {
      title: 'Your role vs. the coach\'s',
      intro: 'Staying in your lane protects your relationship and their growth.',
      items: [
        'Yours: unconditional support, a safe home, noticing changes, getting help.',
        'The coach\'s: playing time, tactics, team standards, in-sport feedback.',
        'When you disagree with the coach: coach your child on how to talk to them — don\'t take it over.',
        'Bigger than a parent can carry? Move it to the right professional (see the self-paced course).',
      ],
    },
  ],
};

export const parentCourses: Course[] = [parentFoundations, recognizingTheSigns];
