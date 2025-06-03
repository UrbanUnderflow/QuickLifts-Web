import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY, // Updated to use new Netlify env var
});

// Mapping from day names (expected from frontend) to Date.getDay() indices (0=Sunday)
const dayNameToIndex = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6,
};

// Generates the specific number of UNIQUE workout stacks using OpenAI
async function generateUniqueWorkoutStacks(numberOfStacks, existingWorkouts = [], retryCount = 0, promptData) {
  const maxRetries = 3;
  try {
    console.log(`\n=== Generating \${numberOfStacks} Unique Stacks (Attempt \${retryCount + 1}) ===`);
    // Note: remainingNeeded logic might not be applicable if we always generate a fixed number here
    console.log('Making OpenAI API call for unique stacks...');

    // --- Modified Prompt for Unique Stacks --- 
    const prompt = `
     You are a JSON-generating fitness AI. Return PURE JSON only, with NO markdown formatting or additional text.
     DO NOT wrap the response in \`\`\`json or any other markers.

      PROGRAM REQUIREMENTS:
      - Generate EXACTLY \${numberOfStacks} unique workout stacks. DO NOT include rest days in your response.
      - Each workout should have 4-5 exercises.
      - Use only exercises from these lists:
        Must include: \${promptData.mustIncludeExercises.join(", ") || 'None specified'}
        Available exercises: \${promptData.availableExercises.join(", ")}
      - Base the workout design on the user's preferences below.

      USER PREFERENCES:
      \${promptData.userPrompt}
      \${promptData.preferences.join("\n")}
      - Note: The user has specified these days as rest days: \${promptData.selectedRestDays.join(', ') || 'None specified'}. You should NOT generate stacks for these days.

      RESPONSE FORMAT:
      {
        "stacks": [
          // Exactly \${numberOfStacks} workout stack objects here
          {
            "title": "Unique Workout Title 1",
            "description": "Brief description",
            "exercises": [
              {
                "name": "Exercise Name",
                "category": { /* ... details ... */ }
              }
            ]
          }
          // ... more unique stacks ...
        ]
      }

       RULES:
      - Return ONLY valid JSON.
      - No comments or markdown.
      - Exactly \${numberOfStacks} workout stacks.
      - DO NOT include any objects with "title": "Rest".
      - Only use listed exercises.
      - Generate appropriate reps/sets based on prompt.
    `;
    // --- End Modified Prompt --- 

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `### Pulse Object Model & Gameplay Concepts (for internal use)

**Move**
• Atomic exercise unit: name, video demo, coaching cues, muscle tags, difficulty, equipment, default rep/time target.
• Creators upload and own Moves; each Move can be reused infinitely.

**Stack**
• An ordered list (playlist) of Moves.
• Used for on-demand programs *or* as the template the bot drops into a live Round.
• Must include total duration, intensity rating, and optional rest blocks.

**Round**
• A live or asynchronous *container* for one or more Stacks.
• Primary use-case: real-time, multiplayer session with shared leaderboard.
    – Leaderboard updates only when a participant finishes a Move/Workout, not every second.
• Secondary use-case: 1-on-1 programming (single participant) — same data structure, no leaderboard visible to others.
• Features inside a Round:
    – Lobby & invite link / QR code
    – Group chat (persists during & after)
    – Check-in screen after each workout where users can add photo + caption + location for bonus points
    – Points engine (see below)
• *No power-ups yet* — exclude that mechanic until v2.

**Scoring – Pulse Points**
| Action | Points | Notes |
|--------|--------|-------|
| Base completion | 100 | Each workout finished inside the Round |
| First completion bonus | 50 | One-time per challenge |
| Streak bonus | 25 × consecutive-days | e.g., 3-day streak = 75 |
| Check-in (photo + caption) | 25 | Logged on summary screen |
| Invitation bonus | 25 | Friend joins via your link & completes first workout |
| Social share bonus | 5 | We repost your IG story that tags @fitwithpulse |

**Bot responsibilities for generateRound intent**
1. Surface candidate Moves → assemble Stack(s) respecting coach filters (level, equipment, length).
2. Package Stack(s) into a Round object with metadata: title, description, duration, scoring enabled = true.
3. Return JSON that the app can POST to /rounds endpoint.

You are an elite fitness trainer designing workout programs. Generate only the requested number of unique workout routines (stacks) as valid JSON. Do not include rest days.

Equipment Preferences:
- Selected Equipment: ${promptData.equipmentPreferences?.selectedEquipment?.join(", ") || "None specified"}
- Equipment Only: ${promptData.equipmentPreferences?.equipmentOnly ? 'Yes' : 'No'}

Tagged Users: ${promptData.taggedUsers?.map(u => u.name || u).join(", ") || "None"}

Conversation History: ${promptData.conversationHistory?.join("\n") || "None"}
`
        },
        { role: 'user', content: prompt }
      ],
      // Consider adjusting max_tokens if needed for fewer stacks
      max_tokens: 4096 // Adjusted token limit might be sufficient
    });

    let generatedContent;
    try {
        generatedContent = JSON.parse(response.choices[0].message.content);
        if (!generatedContent || !Array.isArray(generatedContent.stacks)) {
            throw new Error('Invalid JSON structure received from OpenAI.');
        }
    } catch (parseError) {
        console.error("Failed to parse OpenAI response for unique stacks:", parseError);
        console.log("Raw OpenAI response content:", response.choices[0].message.content);
        throw new Error('AI returned invalid JSON format.');
    }

    console.log(`Received \${generatedContent.stacks.length} unique stacks from OpenAI.`);
    console.log("Sample unique stack title:", generatedContent.stacks[0]?.title);

    let combinedStacks = [...existingWorkouts, ...generatedContent.stacks];

    // Validate if we got the required number, retry if necessary and possible
    if (combinedStacks.length < numberOfStacks && retryCount < maxRetries) {
      console.log(`Need \${numberOfStacks - combinedStacks.length} more unique stacks. Retrying...`);
      return await generateUniqueWorkoutStacks(
        numberOfStacks, // Still aiming for the original target
        combinedStacks, // Pass the ones we have so far
        retryCount + 1,
        promptData
      );
    }

    // If we somehow generated more than requested (shouldn't happen with strict prompt)
    if (combinedStacks.length > numberOfStacks) {
        console.warn(`Generated more unique stacks (\${combinedStacks.length}) than requested (\${numberOfStacks}). Trimming.`);
        combinedStacks = combinedStacks.slice(0, numberOfStacks);
    }

    console.log(`\n=== Final Unique Stacks Result ===`);
    console.log(`Unique stacks generated: \${combinedStacks.length}`);
    console.log(`Target was: \${numberOfStacks}`);

    return { stacks: combinedStacks }; // Return the unique stacks

  } catch (error) {
    console.error('generateUniqueWorkoutStacks failed:', error);
    if (retryCount < maxRetries) {
      console.log(`Retry attempt \${retryCount + 1} of \${maxRetries} for unique stacks`);
      // Pass the original numberOfStacks target
      return generateUniqueWorkoutStacks(numberOfStacks, existingWorkouts, retryCount + 1, promptData);
    }
    // If retries exhausted, re-throw the error to be caught by the handler
    throw error;
  }
}

// Generates the full schedule for the entire duration
async function generateFullSchedule(totalNeeded, existingWorkouts = [], retryCount = 0, promptData) {
  const maxRetries = 3;
  try {
    console.log(`\n=== Generating Full Schedule (Attempt \${retryCount + 1}) ===`);
    const remainingNeeded = totalNeeded - existingWorkouts.length;
    if (remainingNeeded <= 0) {
        return { stacks: existingWorkouts.slice(0, totalNeeded) }; // Already have enough
    }
    console.log(`Existing workouts: \${existingWorkouts.length}, Still needed: \${remainingNeeded}`);
    console.log('Making OpenAI API call for full schedule...');

    // --- Prompt for Full Schedule (similar to original) --- 
    const prompt = `
     You are a JSON-generating fitness AI. Return PURE JSON only, with NO markdown formatting or additional text.
     DO NOT wrap the response in \`\`\`json or any other markers.
     
      PROGRAM REQUIREMENTS:
      - Generate EXACTLY \${remainingNeeded} more stacks to complete a program from \${promptData.startDate} to \${promptData.endDate} (Total needed: \${totalNeeded}).
      - Include strategically placed rest days (typically 1-2 per week, based on user preferences).
      - Ensure the final combined program fills the entire date range.
      - 4-5 exercises per workout stack (no more than 5).
      - Use only exercises from these lists:
        Must include: \${promptData.mustIncludeExercises.join(", ") || 'None specified'}
        Available exercises: \${promptData.availableExercises.join(", ")}

      USER PREFERENCES:
      \${promptData.userPrompt}
      \${promptData.preferences.join("\n")}
      
      RESPONSE FORMAT (generate ONLY the remaining \${remainingNeeded} stacks):
      {
        "stacks": [
          // ... remaining workout stack objects ...
          // ... including rest day objects like: {"title": "Rest", "description": "...", "exercises": []}
        ]
      }

       RULES:
      - Return ONLY valid JSON.
      - Exactly \${remainingNeeded} stacks in the response.
      - Include rest days where appropriate.
      - Only use listed exercises.
      - Generate appropriate reps/sets based on prompt.
    `;
    // --- End Full Schedule Prompt --- 

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  
      messages: [
        {
          role: 'system',
          content: `### Pulse Object Model & Gameplay Concepts (for internal use)

**Move**
• Atomic exercise unit: name, video demo, coaching cues, muscle tags, difficulty, equipment, default rep/time target.
• Creators upload and own Moves; each Move can be reused infinitely.

**Stack**
• An ordered list (playlist) of Moves.
• Used for on-demand programs *or* as the template the bot drops into a live Round.
• Must include total duration, intensity rating, and optional rest blocks.

**Round**
• A live or asynchronous *container* for one or more Stacks.
• Primary use-case: real-time, multiplayer session with shared leaderboard.
    – Leaderboard updates only when a participant finishes a Move/Workout, not every second.
• Secondary use-case: 1-on-1 programming (single participant) — same data structure, no leaderboard visible to others.
• Features inside a Round:
    – Lobby & invite link / QR code
    – Group chat (persists during & after)
    – Check-in screen after each workout where users can add photo + caption + location for bonus points
    – Points engine (see below)
• *No power-ups yet* — exclude that mechanic until v2.

**Scoring – Pulse Points**
| Action | Points | Notes |
|--------|--------|-------|
| Base completion | 100 | Each workout finished inside the Round |
| First completion bonus | 50 | One-time per challenge |
| Streak bonus | 25 × consecutive-days | e.g., 3-day streak = 75 |
| Check-in (photo + caption) | 25 | Logged on summary screen |
| Invitation bonus | 25 | Friend joins via your link & completes first workout |
| Social share bonus | 5 | We repost your IG story that tags @fitwithpulse |

**Bot responsibilities for generateRound intent**
1. Surface candidate Moves → assemble Stack(s) respecting coach filters (level, equipment, length).
2. Package Stack(s) into a Round object with metadata: title, description, duration, scoring enabled = true.
3. Return JSON that the app can POST to /rounds endpoint.

You are an elite fitness trainer designing workout programs. Generate valid JSON representing workout and rest day stacks to complete a schedule.

Equipment Preferences:
- Selected Equipment: ${promptData.equipmentPreferences?.selectedEquipment?.join(", ") || "None specified"}
- Equipment Only: ${promptData.equipmentPreferences?.equipmentOnly ? 'Yes' : 'No'}

Tagged Users: ${promptData.taggedUsers?.map(u => u.name || u).join(", ") || "None"}

Conversation History: ${promptData.conversationHistory?.join("\n") || "None"}
`
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      max_tokens: 15000 // Keep larger limit for potentially long schedules
    });

    let generatedContent;
     try {
        generatedContent = JSON.parse(response.choices[0].message.content);
        if (!generatedContent || !Array.isArray(generatedContent.stacks)) {
            throw new Error('Invalid JSON structure received from OpenAI.');
        }
    } catch (parseError) {
        console.error("Failed to parse OpenAI response for full schedule:", parseError);
        console.log("Raw OpenAI response content:", response.choices[0].message.content);
        throw new Error('AI returned invalid JSON format.');
    }

    console.log(`Received \${generatedContent.stacks.length} new stacks from OpenAI for full schedule.`);
    
    let allWorkouts = [...existingWorkouts, ...generatedContent.stacks];
    console.log(`Total stacks after combining: \${allWorkouts.length}`);
    
    // If we still don't have enough workouts and haven't exceeded max retries
    if (allWorkouts.length < totalNeeded && retryCount < maxRetries) {
      console.log(`Need \${totalNeeded - allWorkouts.length} more stacks. Making another attempt for full schedule...`);
      return await generateFullSchedule(
        totalNeeded,
        allWorkouts, // Pass combined list
        retryCount + 1,
        promptData
      );
    }

    // Trim excess workouts if we generated too many
    if (allWorkouts.length > totalNeeded) {
      console.warn(`Generated more stacks than total needed (\${allWorkouts.length} vs \${totalNeeded}). Trimming.`);
      allWorkouts = allWorkouts.slice(0, totalNeeded);
    }

    console.log(`\n=== Final Full Schedule Result ===`);
    console.log(`Total stacks generated: \${allWorkouts.length}`);
    console.log(`Target was: \${totalNeeded}`);

    return { stacks: allWorkouts };

  } catch (error) {
    console.error('generateFullSchedule attempt failed:', error);
    if (retryCount < maxRetries) {
      console.log(`Retry attempt \${retryCount + 1} of \${maxRetries} for full schedule`);
      return generateFullSchedule(totalNeeded, existingWorkouts, retryCount + 1, promptData);
    }
    // If retries exhausted, re-throw
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      mustIncludeExercises = [], 
      userPrompt, 
      preferences = [], 
      availableExercises = [], 
      startDate, 
      endDate, 
      numberOfUniqueStacks, 
      selectedRestDays = [],
      equipmentPreferences = { selectedEquipment: [], equipmentOnly: false },
      taggedUsers = [],
      conversationHistory = []
    } = req.body;

    // Validate essential data
    if (!startDate || !endDate || !availableExercises) {
        return res.status(400).json({ error: 'Missing required fields: startDate, endDate, availableExercises' });
    }

    const totalDays = calculateTotalDays(startDate, endDate);
    console.log('\n=== Starting AI Round Generation ===');
    console.log(`Received Request: Unique Stacks = \${numberOfUniqueStacks ?? 'Not specified (Full Schedule)'}, Rest Days = [\${(selectedRestDays || []).join(', ')}]`);
    console.log(`Challenge Duration: \${totalDays} days`);

    let finalWorkoutPlan;

    // Prepare prompt data once
    const promptData = {
        mustIncludeExercises: mustIncludeExercises || [],
        userPrompt: userPrompt || '',
        preferences: preferences || [],
        availableExercises: availableExercises, // Already just names
        startDate: startDate,
        endDate: endDate,
        selectedRestDays: selectedRestDays || [], // Pass selected rest days for context
        equipmentPreferences: equipmentPreferences || { selectedEquipment: [], equipmentOnly: false },
        taggedUsers: taggedUsers || [],
        conversationHistory: conversationHistory || []
    };

    if (typeof numberOfUniqueStacks === 'number' && numberOfUniqueStacks > 0) {
        // --- AUTOFILL LOGIC --- 
        console.log(`Generating \${numberOfUniqueStacks} unique stacks for autofill pattern.`);
        
        // 1. Generate only the required number of unique workout stacks (without rest days)
        const uniqueResult = await generateUniqueWorkoutStacks(numberOfUniqueStacks, [], 0, promptData);
        const uniqueStacks = uniqueResult.stacks;

        if (!uniqueStacks || uniqueStacks.length === 0) {
            throw new Error('Failed to generate any unique workout stacks from AI.');
        }
        if (uniqueStacks.length < numberOfUniqueStacks) {
            console.warn(`AI generated fewer unique stacks (\${uniqueStacks.length}) than requested (\${numberOfUniqueStacks}). Proceeding with available.`);
        }

        console.log(`Generated \${uniqueStacks.length} unique stacks. Now applying autofill pattern...`);

        // 2. Implement autofill logic
        const allWorkouts = [];
        const restDayIndices = (selectedRestDays || []).map(dayName => dayNameToIndex[dayName]).filter(index => index !== undefined);
        const start = new Date(startDate);
        let nonRestDayCounter = 0;

        for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + dayIndex);
            const currentDayOfWeekIndex = currentDate.getDay(); // 0 for Sunday, 1 for Monday, etc.

            if (restDayIndices.includes(currentDayOfWeekIndex)) {
                // Add a rest day
                allWorkouts.push({
                    title: "Rest",
                    description: "Take a break and recover.",
                    exercises: []
                });
            } else {
                // Add the next workout from the unique pattern
                if (uniqueStacks.length > 0) {
                    const stackToAdd = uniqueStacks[nonRestDayCounter % uniqueStacks.length];
                    // IMPORTANT: Add a copy, potentially modify title if needed later (e.g., Week 1 Day 1)
                    allWorkouts.push({ ...stackToAdd }); 
                    nonRestDayCounter++;
                } else {
                    // Fallback if somehow no unique stacks were generated
                    console.warn("No unique stacks available to fill non-rest day, adding placeholder rest day.")
                    allWorkouts.push({
                        title: "Rest", // Fallback to rest if generation failed badly
                        description: "Take a break and recover.",
                        exercises: []
                    });
                }
            }
        }
        finalWorkoutPlan = { stacks: allWorkouts };
        console.log(`Autofill complete. Total stacks in plan: \${finalWorkoutPlan.stacks.length}`);

    } else {
        // --- FULL SCHEDULE LOGIC (Unique stack per day or default) ---
        console.log(`Generating full schedule for \${totalDays} days.`);
        finalWorkoutPlan = await generateFullSchedule(totalDays, [], 0, promptData);
    }

    // Ensure the final plan isn't empty
     if (!finalWorkoutPlan || !finalWorkoutPlan.stacks || finalWorkoutPlan.stacks.length === 0) {
        console.error("Final workout plan generation resulted in empty stacks.");
        throw new Error("Failed to generate a valid workout plan.");
    }

    // Return the result (either autofilled or full schedule)
    res.status(200).json({
      choices: [{ // Match OpenAI's typical response structure for consistency on frontend
        message: {
          content: JSON.stringify(finalWorkoutPlan) // Send the final plan { stacks: [...] }
        }
      }]
    });

  } catch (error) {
    const err = error;
    console.error('\n❌ Error in API handler:', err);
    res.status(500).json({ error: err.message || 'Failed to generate workout round' });
  }
}

// Calculates total days inclusive of start and end date
function calculateTotalDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Set hours to 0 to avoid DST issues affecting day count
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  // Check for invalid dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid start or end date provided.");
  }
  if (end < start) {
      throw new Error("End date cannot be before start date.");
  }

  const timeDiff = end.getTime() - start.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
  
  console.log(`Calculating days: Start=\${start.toISOString().split('T')[0]}, End=\${end.toISOString().split('T')[0]}, Difference=\${daysDiff}`);
  
  return daysDiff;
}

// --- Remove unused functions ---
/*
async function generateOneWeekPattern(...) {
  // ... (Removed)
}

function generateExercisesForDay(...) {
  // ... (Removed)
}
*/