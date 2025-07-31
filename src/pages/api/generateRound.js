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
    console.log(`\n=== Generating ${numberOfStacks} Unique Stacks (Attempt ${retryCount + 1}) ===`);
    // Note: remainingNeeded logic might not be applicable if we always generate a fixed number here
    console.log('Making OpenAI API call for unique stacks...');

    // --- Modified Prompt for Unique Stacks --- 
    const prompt = `
     You are a JSON-generating fitness AI. Return PURE JSON only, with NO markdown formatting or additional text.
     DO NOT wrap the response in \`\`\`json or any other markers.

      PROGRAM REQUIREMENTS:
      - Generate EXACTLY ${numberOfStacks} unique workout stacks. DO NOT include rest days in your response.
      - CRITICAL REQUIREMENT: Each workout MUST contain exactly 4 or 5 exercises. Workouts with 1, 2, or 3 exercises are COMPLETELY UNACCEPTABLE and will be rejected.
      - VALIDATION: Before submitting your response, count the exercises in each workout to ensure compliance.
      - Use only exercises from these lists:
        Must include: ${promptData.mustIncludeExercises.join(", ") || 'None specified'}
        Available exercises: ${promptData.availableExercises.join(", ")}
      - Base the workout design on the user's preferences below.

      USER PREFERENCES:
      ${promptData.userPrompt}
      ${promptData.preferences.join("\n")}
      - Note: The user has specified these days as rest days: ${promptData.selectedRestDays.join(', ') || 'None specified'}. You should NOT generate stacks for these days.
      
      ${promptData.existingStacks && promptData.existingStacks.length > 0 ? 
        `EXISTING STACKS TO CONSIDER/MODIFY:
        ${promptData.existingStacks.map((stack, i) => `${i+1}. "${stack.title}" - ${stack.exercises?.length || 0} exercises: ${stack.exercises?.map(ex => ex.name).join(', ') || 'No exercises listed'}`).join('\n        ')}
        
        ${promptData.modifyExisting ? 
          'MODIFICATION MODE: Improve and modify the existing stacks above while maintaining their general structure and intent. You can change exercises, but keep similar themes and progression.' : 
          'REFERENCE MODE: Use the existing stacks above as reference for style and difficulty, but create completely new and different workouts.'
        }` : ''
      }

      RESPONSE FORMAT (JSON only):
      {
        "thinking": "Brief explanation of your programming approach and reasoning for these ${numberOfStacks} unique workouts (1-2 sentences)",
        "stacks": [
          // Exactly ${numberOfStacks} workout stack objects here
          {
            "title": "Unique Workout Title 1",
            "description": "Brief description",
            "exercises": [
              {
                "name": "Exercise Name",
                "category": {
                  "id": "weight-training",
                  "reps": ["12", "10", "8"],
                  "sets": 3,
                  "weight": 0.0,
                  "screenTime": 0.0,
                  "selectedVideo": {}
                }
              }
            ]
          }
          // ... more unique stacks ...
        ]
      }

       RULES:
      - Return ONLY valid JSON.
      - No comments or markdown.
      - Exactly ${numberOfStacks} workout stacks.
      - DO NOT include any objects with "title": "Rest".
      - Only use listed exercises.
      - CRITICAL: Each workout stack MUST contain at least 4 exercises. Stacks with 1, 2, or 3 exercises are UNACCEPTABLE.
      - REQUIRED: Each exercise MUST have a "category" object with "id", "reps" array, "sets", "weight", "screenTime", and "selectedVideo" fields.
      - REQUIRED: Include a "thinking" field explaining your workout design approach.
    `;
    // --- End Modified Prompt --- 

    const response = await openai.chat.completions.create({
      model: 'o3-mini',
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

EXERCISE FORMAT EXAMPLE:
{
  "name": "Push-ups",
  "category": {
    "id": "weight-training",
    "reps": ["12", "10", "8"],
    "sets": 3,
    "weight": 0.0,
    "screenTime": 0.0,
    "selectedVideo": {}
  }
}

IMPORTANT: Every exercise MUST have this exact structure with category.reps as an ARRAY of strings.

Equipment Preferences:
- Selected Equipment: ${promptData.equipmentPreferences?.selectedEquipment?.join(", ") || "None specified"}
- Equipment Only: ${promptData.equipmentPreferences?.equipmentOnly ? 'Yes' : 'No'}

Tagged Users: ${promptData.taggedUsers?.map(u => u.name || u).join(", ") || "None"}

Conversation History: ${promptData.conversationHistory?.join("\n") || "None"}
`
        },
        { role: 'user', content: prompt }
      ],
      // o3-mini can handle larger responses for multiple stacks
      max_completion_tokens: 10000 // Sufficient for generating multiple unique stacks with enhanced details
    });

    // Log the raw response for debugging
    console.log("📝 [UNIQUE STACKS] Raw OpenAI response:", response.choices[0].message.content);

    let generatedContent;
    try {
        generatedContent = JSON.parse(response.choices[0].message.content);
        if (!generatedContent || !Array.isArray(generatedContent.stacks)) {
            throw new Error('Invalid JSON structure received from OpenAI.');
        }
        // Extract thinking field if present
        if (typeof generatedContent.thinking !== 'string') {
            generatedContent.thinking = '';
        }
    } catch (parseError) {
        console.error("Failed to parse OpenAI response for unique stacks:", parseError);
        console.log("❌ [PARSE ERROR] Raw OpenAI response content:", response.choices[0].message.content);
        throw new Error('AI returned invalid JSON format.');
    }

    console.log(`Received ${generatedContent.stacks.length} unique stacks from OpenAI.`);
    console.log("AI Thinking:", generatedContent.thinking);
    console.log("Sample unique stack title:", generatedContent.stacks[0]?.title);

    // Debug: Log exercise details for each stack
    generatedContent.stacks.forEach((stack, index) => {
      console.log(`🏋️ Stack ${index + 1}: "${stack.title}" - ${stack.exercises?.length || 0} exercises`);
      if (stack.exercises && stack.exercises.length > 0) {
        console.log(`  Exercises: ${stack.exercises.map(ex => ex.name).join(', ')}`);
        console.log(`  First exercise structure:`, JSON.stringify(stack.exercises[0], null, 2));
      }
    });

    // Validate exercise count in generated stacks
    const validStacks = generatedContent.stacks.filter(stack => {
      const exerciseCount = stack.exercises ? stack.exercises.length : 0;
      if (exerciseCount < 4 && stack.title !== "Rest") {
        console.warn(`Filtering out stack "${stack.title}" with only ${exerciseCount} exercises`);
        return false;
      }
      return true;
    });

    if (validStacks.length < generatedContent.stacks.length) {
      console.warn(`Filtered out ${generatedContent.stacks.length - validStacks.length} stacks with insufficient exercises`);
    }

    // Debug: Log what survived validation
    console.log(`✅ ${validStacks.length} stacks passed validation:`);
    validStacks.forEach((stack, index) => {
      console.log(`  ${index + 1}. "${stack.title}" - ${stack.exercises?.length || 0} exercises`);
    });

    let combinedStacks = [...existingWorkouts, ...validStacks];

    // Validate if we got the required number, retry if necessary and possible
    if (combinedStacks.length < numberOfStacks && retryCount < maxRetries) {
      console.log(`Need ${numberOfStacks - combinedStacks.length} more unique stacks. Retrying...`);
      // If we filtered out too many stacks, mention this in the retry to get better results
      if (validStacks.length < generatedContent.stacks.length) {
        console.log(`Previous attempt had ${generatedContent.stacks.length - validStacks.length} stacks filtered for insufficient exercises. Retrying with stricter requirements.`);
      }
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
    console.log(`Unique stacks generated: ${combinedStacks.length}`);
    console.log(`Target was: ${numberOfStacks}`);

    return { 
      stacks: combinedStacks,
      thinking: generatedContent.thinking || ''
    }; // Return the unique stacks with thinking

  } catch (error) {
    console.error('generateUniqueWorkoutStacks failed:', error);
    if (retryCount < maxRetries) {
      console.log(`Retry attempt ${retryCount + 1} of ${maxRetries} for unique stacks`);
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
    console.log(`\n=== Generating Complete Full Schedule (Attempt ${retryCount + 1}) ===`);
    console.log(`Total days needed: ${totalNeeded}`);
    console.log(`Selected rest days: ${promptData.selectedRestDays.join(', ') || 'None'}`);
    console.log('Making OpenAI API call for COMPLETE schedule (all days)...');

    // Calculate specific rest day pattern based on user preferences
    const restDayIndices = promptData.selectedRestDays.map(day => {
      const dayMapping = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
      };
      return dayMapping[day];
    }).filter(index => index !== undefined);
    
    const startDate = new Date(promptData.startDate);
    
    // Build detailed day-by-day schedule
    let scheduleBreakdown = '';
    for (let i = 0; i < totalNeeded; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dayOfWeek = currentDate.getDay();
      const isRestDay = restDayIndices.includes(dayOfWeek);
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
      
      scheduleBreakdown += `Day \${i + 1} (\${dayName}): \${isRestDay ? 'REST DAY' : 'WORKOUT DAY'}\n`;
    }

    // --- Enhanced Prompt for Complete Full Schedule --- 
    const prompt = `
     You are a JSON-generating fitness AI. Return PURE JSON only, with NO markdown formatting or additional text.
     DO NOT wrap the response in \`\`\`json or any other markers.
     
      CRITICAL MISSION: Generate a COMPLETE \${totalNeeded}-day fitness program covering EVERY SINGLE DAY from \${promptData.startDate} to \${promptData.endDate}.
      
      SCHEDULE BREAKDOWN (YOU MUST FOLLOW THIS EXACTLY):
      \${scheduleBreakdown}
      
      PROGRAM REQUIREMENTS:
      - Generate EXACTLY \${totalNeeded} stacks - one for each day above
      - For WORKOUT DAYS: Create intense, varied workouts with 4-5 exercises each
      - For REST DAYS: Create {"title": "Rest", "description": "Recovery day", "exercises": []}
      - CRITICAL REQUIREMENT: Each workout MUST contain exactly 4 or 5 exercises. Workouts with 1, 2, or 3 exercises are COMPLETELY UNACCEPTABLE and will be rejected.
      - VALIDATION: Before submitting your response, count the exercises in each workout to ensure compliance.
      - Use only exercises from these lists:
        Must include: \${promptData.mustIncludeExercises.join(", ") || 'None specified'}
        Available exercises: \${promptData.availableExercises.join(", ")}

      USER PREFERENCES:
      \${promptData.userPrompt}
      \${promptData.preferences.join("\n")}
      
      WEEKLY STRUCTURE GUIDELINES:
      - Create progressive overload across weeks
      - Vary muscle groups and exercise selection
      - Include compound and isolation movements
      - Ensure balanced programming
      
      ${promptData.existingStacks && promptData.existingStacks.length > 0 ? 
        `EXISTING STACKS TO CONSIDER/MODIFY:
        ${promptData.existingStacks.map((stack, i) => `${i+1}. "${stack.title}" - ${stack.exercises?.length || 0} exercises: ${stack.exercises?.map(ex => ex.name).join(', ') || 'No exercises listed'}`).join('\n        ')}
        
        ${promptData.modifyExisting ? 
          'MODIFICATION MODE: Improve and modify the existing stacks above while maintaining their general structure and intent. You can change exercises, but keep similar themes and progression.' : 
          'REFERENCE MODE: Use the existing stacks above as reference for style and difficulty, but create completely new and different workouts.'
        }` : ''
      }
      
      RESPONSE FORMAT (generate ALL \${totalNeeded} stacks for complete program):
      {
        "stacks": [
          {
            "title": "Day 1: Upper Body Power",
            "description": "Compound movements for strength",
            "exercises": [
              {
                "name": "Exercise Name",
                "category": {
                  "id": "weight-training",
                  "reps": ["12", "10", "8"],
                  "sets": 3,
                  "weight": 0.0,
                  "screenTime": 0.0,
                  "selectedVideo": {}
                }
              }
            ]
          },
          {"title": "Rest", "description": "Recovery day", "exercises": []},
          // Continue for all \${totalNeeded} days...
        ]
      }

       MANDATORY RULES:
      - Return ONLY valid JSON.
      - Generate EXACTLY \${totalNeeded} stacks (one per day).
      - Follow the schedule breakdown exactly for rest vs workout days.
      - Only use listed exercises.
      - CRITICAL: Each workout stack MUST contain at least 4 exercises. Stacks with 1, 2, or 3 exercises are UNACCEPTABLE.
      - REQUIRED: Each exercise MUST have a "category" object with "id", "reps" array, "sets", "weight", "screenTime", and "selectedVideo" fields.
      - Include day numbers in workout titles (e.g., "Day 1: Upper Body", "Day 5: Legs", etc.)
    `;
    // --- End Full Schedule Prompt --- 

    const response = await openai.chat.completions.create({
              model: 'o3-mini',  
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

RESPONSE FORMAT (JSON only):
{
  "thinking": "Brief explanation of your programming approach and reasoning (1-2 sentences)",
  "stacks": [/* workout array */]
}

EXERCISE FORMAT EXAMPLE:
{
  "name": "Push-ups",
  "category": {
    "id": "weight-training",
    "reps": ["12", "10", "8"],
    "sets": 3,
    "weight": 0.0,
    "screenTime": 0.0,
    "selectedVideo": {}
  }
}

IMPORTANT: Every exercise MUST have this exact structure with category.reps as an ARRAY of strings.

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
      max_completion_tokens: 20000 // o3-mini can handle larger responses for complete 45-day schedules
    });

    // Log the raw response for debugging
    console.log("📝 [FULL SCHEDULE] Raw OpenAI response:", response.choices[0].message.content);

    let generatedContent;
     try {
        generatedContent = JSON.parse(response.choices[0].message.content);
        if (!generatedContent || !Array.isArray(generatedContent.stacks)) {
            throw new Error('Invalid JSON structure received from OpenAI.');
        }
        // Extract thinking field if present
        if (typeof generatedContent.thinking !== 'string') {
            generatedContent.thinking = '';
        }
    } catch (parseError) {
        console.error("Failed to parse OpenAI response for full schedule:", parseError);
        console.log("❌ [PARSE ERROR] Raw OpenAI response content:", response.choices[0].message.content);
        throw new Error('AI returned invalid JSON format.');
    }

    console.log(`Received ${generatedContent.stacks.length} stacks from OpenAI for complete schedule.`);
    console.log("AI Thinking:", generatedContent.thinking);
    
    // Validate exercise count in generated stacks
    let validStacks = generatedContent.stacks.filter(stack => {
      const exerciseCount = stack.exercises ? stack.exercises.length : 0;
      if (exerciseCount < 4 && stack.title !== "Rest") {
        console.warn(`Filtering out stack "${stack.title}" with only ${exerciseCount} exercises`);
        return false;
      }
      return true;
    });

    if (validStacks.length < generatedContent.stacks.length) {
      console.warn(`Filtered out ${generatedContent.stacks.length - validStacks.length} stacks with insufficient exercises`);
    }
    
    // Check if we have the right number of stacks for the complete schedule
    if (validStacks.length < totalNeeded && retryCount < maxRetries) {
      console.log(`Generated ${validStacks.length} stacks but need ${totalNeeded}. Retrying...`);
      return await generateFullSchedule(
        totalNeeded,
        [], // Don't accumulate - regenerate complete schedule
        retryCount + 1,
        promptData
      );
    }

    // Trim excess workouts if we generated too many (but this shouldn't happen with the new prompt)
    if (validStacks.length > totalNeeded) {
      console.warn(`Generated more stacks than total needed (${validStacks.length} vs ${totalNeeded}). Trimming.`);
      validStacks = validStacks.slice(0, totalNeeded);
    }

    console.log(`\n=== Complete Full Schedule Result ===`);
    console.log(`Total stacks generated: ${validStacks.length}`);
    console.log(`Target was: ${totalNeeded}`);
    console.log(`Rest days included: ${validStacks.filter(s => s.title === "Rest").length}`);
    console.log(`Workout days included: ${validStacks.filter(s => s.title !== "Rest").length}`);

    return { 
      stacks: validStacks,
      thinking: generatedContent.thinking || ''
    };

  } catch (error) {
    console.error('generateFullSchedule attempt failed:', error);
    if (retryCount < maxRetries) {
      console.log(`Retry attempt ${retryCount + 1} of ${maxRetries} for full schedule`);
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
      conversationHistory = [],
      existingStacks = [], // New parameter for existing stacks
      modifyExisting = false // Flag to indicate whether to modify existing or add new
    } = req.body;

    // Validate essential data
    if (!startDate || !endDate || !availableExercises) {
        return res.status(400).json({ error: 'Missing required fields: startDate, endDate, availableExercises' });
    }

    // Debug date inputs before calculation
    console.log('\n=== Starting AI Round Generation ===');
    console.log(`📅 Date inputs:`);
    console.log(`  - Start Date (raw): ${startDate} (type: ${typeof startDate})`);
    console.log(`  - End Date (raw): ${endDate} (type: ${typeof endDate})`);
    
    // Show corrected parsing for Unix timestamps
    const parsedStartDate = typeof startDate === 'number' && startDate < 10000000000 
      ? new Date(startDate * 1000) : new Date(startDate);
    const parsedEndDate = typeof endDate === 'number' && endDate < 10000000000 
      ? new Date(endDate * 1000) : new Date(endDate);
      
    console.log(`  - Start Date (corrected): ${parsedStartDate}`);
    console.log(`  - End Date (corrected): ${parsedEndDate}`);
    
    const totalDays = calculateTotalDays(startDate, endDate);
    console.log(`Received Request: Unique Stacks = ${numberOfUniqueStacks ?? 'Not specified (Full Schedule)'}, Rest Days = [${(selectedRestDays || []).join(', ')}]`);
    console.log(`Challenge Duration: ${totalDays} days`);
    console.log(`Debug - numberOfUniqueStacks type: ${typeof numberOfUniqueStacks}, value: ${numberOfUniqueStacks}`);

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
        conversationHistory: conversationHistory || [],
        existingStacks: existingStacks || [], // Pass existing stacks for modification
        modifyExisting: modifyExisting || false // Pass modification flag
    };

    if (typeof numberOfUniqueStacks === 'number' && numberOfUniqueStacks > 0) {
        // --- AUTOFILL LOGIC (KEEP THIS - generates limited unique stacks and repeats them) --- 
        console.log(`Generating ${numberOfUniqueStacks} unique stacks for autofill pattern.`);
        
        // 1. Generate only the required number of unique workout stacks (without rest days)
        const uniqueResult = await generateUniqueWorkoutStacks(numberOfUniqueStacks, [], 0, promptData);
        const uniqueStacks = uniqueResult.stacks;

        if (!uniqueStacks || uniqueStacks.length === 0) {
            throw new Error('Failed to generate any unique workout stacks from AI.');
        }
        if (uniqueStacks.length < numberOfUniqueStacks) {
            console.warn(`AI generated fewer unique stacks (${uniqueStacks.length}) than requested (${numberOfUniqueStacks}). Proceeding with available.`);
        }

        console.log(`Generated ${uniqueStacks.length} unique stacks. Now applying autofill pattern...`);

        // Debug: Log the unique stacks before autofill
        console.log(`🔄 Before autofill - unique stacks:`);
        uniqueStacks.forEach((stack, index) => {
          console.log(`  ${index + 1}. "${stack.title}" - ${stack.exercises?.length || 0} exercises`);
        });

        // 2. Implement autofill logic
        const allWorkouts = [];
        const restDayIndices = (selectedRestDays || []).map(dayName => dayNameToIndex[dayName]).filter(index => index !== undefined);
        const start = new Date(startDate);
        let nonRestDayCounter = 0;

        console.log(`🗓️ Autofill Debug: Total days = ${totalDays}, Rest day indices = [${restDayIndices.join(', ')}]`);
        
        for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + dayIndex);
            const currentDayOfWeekIndex = currentDate.getDay(); // 0 for Sunday, 1 for Monday, etc.
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDayOfWeekIndex];
            
            console.log(`  Day ${dayIndex + 1}: ${dayName} (index ${currentDayOfWeekIndex}) - Rest day? ${restDayIndices.includes(currentDayOfWeekIndex)}`);

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
        finalWorkoutPlan = { 
          stacks: allWorkouts, // The scheduled days (may include rest days)
          uniqueStacks: uniqueStacks, // The generated unique workout stacks
          thinking: uniqueResult.thinking || ''
        };
        console.log(`Autofill complete. Total stacks in plan: ${finalWorkoutPlan.stacks.length}`);
        
        // Debug: Log the final workout plan
        console.log(`📋 After autofill - final stacks:`);
        finalWorkoutPlan.stacks.forEach((stack, index) => {
          console.log(`  Day ${index + 1}: "${stack.title}" - ${stack.exercises?.length || 0} exercises`);
          if (stack.exercises && stack.exercises.length > 0) {
            console.log(`    Exercises: ${stack.exercises.map(ex => ex.name).join(', ')}`);
          }
        });
        
        console.log("AI Thinking (Autofill):", uniqueResult.thinking);

    } else {
        // --- FULL SCHEDULE LOGIC (REMOVED - this was generating unique stack per day) ---
        // This was the problematic feature that generated a unique workout for every single day
        console.log(`Full schedule generation disabled. Generating default autofill with 7 unique stacks instead.`);
        
        // Default to 7 unique stacks (one for each day of the week) when numberOfUniqueStacks is not specified
        const defaultUniqueStacks = 7;
        console.log(`Defaulting to ${defaultUniqueStacks} unique stacks for weekly pattern.`);
        
        const uniqueResult = await generateUniqueWorkoutStacks(defaultUniqueStacks, [], 0, promptData);
        const uniqueStacks = uniqueResult.stacks;

        if (!uniqueStacks || uniqueStacks.length === 0) {
            throw new Error('Failed to generate any unique workout stacks from AI.');
        }

        console.log(`Generated ${uniqueStacks.length} unique stacks for default weekly pattern.`);

        // Apply autofill logic with default stacks
        const allWorkouts = [];
        const restDayIndices = (selectedRestDays || []).map(dayName => dayNameToIndex[dayName]).filter(index => index !== undefined);
        const start = new Date(startDate);
        let nonRestDayCounter = 0;

        for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + dayIndex);
            const currentDayOfWeekIndex = currentDate.getDay();

            if (restDayIndices.includes(currentDayOfWeekIndex)) {
                allWorkouts.push({
                    title: "Rest",
                    description: "Take a break and recover.",
                    exercises: []
                });
            } else {
                if (uniqueStacks.length > 0) {
                    const stackToAdd = uniqueStacks[nonRestDayCounter % uniqueStacks.length];
                    allWorkouts.push({ ...stackToAdd }); 
                    nonRestDayCounter++;
                } else {
                    console.warn("No unique stacks available to fill non-rest day, adding placeholder rest day.")
                    allWorkouts.push({
                        title: "Rest",
                        description: "Take a break and recover.",
                        exercises: []
                    });
                }
            }
        }
        
        finalWorkoutPlan = { 
          stacks: allWorkouts, // The scheduled days (may include rest days)
          uniqueStacks: uniqueStacks, // The generated unique workout stacks
          thinking: uniqueResult.thinking || ''
        };
        console.log(`Default autofill complete. Total stacks in plan: ${finalWorkoutPlan.stacks.length}`);
    }

    // Ensure the final plan isn't empty
     if (!finalWorkoutPlan || !finalWorkoutPlan.stacks || finalWorkoutPlan.stacks.length === 0) {
        console.error("Final workout plan generation resulted in empty stacks.");
        throw new Error("Failed to generate a valid workout plan.");
    }

    // Debug: Log what we're sending to the frontend
    console.log(`📤 Sending to frontend:`);
    console.log(`  - Scheduled stacks: ${finalWorkoutPlan.stacks.length}`);
    console.log(`  - Scheduled types: ${finalWorkoutPlan.stacks.map(s => s.title === 'Rest' ? 'Rest' : 'Workout').join(', ')}`);
    console.log(`  - Unique stacks: ${finalWorkoutPlan.uniqueStacks?.length || 0}`);
    console.log(`  - Unique stack titles: ${finalWorkoutPlan.uniqueStacks?.map(s => s.title).join(', ') || 'None'}`);
    console.log(`  - Thinking present: ${!!finalWorkoutPlan.thinking}`);
    
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
  // Handle Unix timestamps (seconds since epoch) vs Date objects/strings
  let start, end;
  
  if (typeof startDate === 'number' && startDate < 10000000000) {
    // Unix timestamp in seconds - convert to milliseconds
    start = new Date(startDate * 1000);
  } else {
    // Date string or already in milliseconds
    start = new Date(startDate);
  }
  
  if (typeof endDate === 'number' && endDate < 10000000000) {
    // Unix timestamp in seconds - convert to milliseconds  
    end = new Date(endDate * 1000);
  } else {
    // Date string or already in milliseconds
    end = new Date(endDate);
  }
  
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
  
  console.log(`Calculating days: Start=${start.toISOString().split('T')[0]}, End=${end.toISOString().split('T')[0]}, Difference=${daysDiff}`);
  
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