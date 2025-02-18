import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Use server-side environment variable
});

async function generateWorkouts(totalNeeded, existingWorkouts = [], retryCount = 0, promptData) {
  const maxRetries = 3;
  
  try {
    console.log(`\n=== Generation Attempt ${retryCount + 1} ===`);
    console.log(`Existing workouts: ${existingWorkouts.length}`);
    const remainingNeeded = totalNeeded - existingWorkouts.length;
    console.log(`Still needed: ${remainingNeeded}`);
    console.log('Making OpenAI API call...');

    const prompt = `
     You are a JSON-generating fitness AI. Return PURE JSON only, with NO markdown formatting or additional text.
     DO NOT wrap the response in \`\`\`json or any other markers.
     
      PROGRAM REQUIREMENTS:
      - EXACTLY ${remainingNeeded} total workouts (including rest days) from ${promptData.startDate} to ${promptData.endDate}
      - Each week MUST include 6 workout days and 1 rest day
      - The program MUST fill the entire date range with no gaps
      - 4-5 exercises per workout (no more than 5)
      - Use only exercises from these lists:
        Must include: ${promptData.mustIncludeExercises.join(", ")}
        Prefer creator exercises: ${promptData.creatorExercises.map(ex => ex.name).join(", ")}
        Other available: ${promptData.allAvailableExercises.map(ex => ex.name).join(", ")}

      CRITICAL REQUIREMENTS:
      - You MUST generate exactly ${remainingNeeded} stacks
      - Each week MUST have exactly 1 rest day
      - Current response has too few workouts - ensure you generate enough to cover the entire period
      
      USER PREFERENCES:
      ${promptData.userPrompt}
      ${promptData.preferences.join("\n")}
      
      RESPONSE FORMAT:
      {
        "stacks": [
          {
            "title": "Workout Title",
            "description": "Brief description",
            "exercises": [
              {
                "name": "Exercise Name",
                "category": {
                  "type": "weight-training",
                  "details": {
                    "sets": 3,
                    "reps": ["8","10"],
                    "weight": 0,
                    "screenTime": 0
                  }
                }
              }
            ]
          },
          {
            "title": "Rest",
            "description": "Take a break and recover.",
            "exercises": []
          }
        ]
      }

       RULES:
      - Return ONLY valid JSON
      - No comments or markdown
      - Exactly ${remainingNeeded} stacks
      - Only use listed exercises
      - Rep ranges should be represented as arrays: ["min_reps","max_reps"]
      - Rep ranges should be appropriate for the workout goal and exercise type:
        * Strength: ["4","6"] or ["6","8"]
        * Hypertrophy: ["8","12"] or ["10","15"]
        * Endurance: ["12","20"] or ["15","25"]
        * Power/Explosive: ["3","5"] or ["4","6"]
        * Adjust these as you think is fitting.
      - Adjust rep ranges based on:
        * Users prompt
      
      CONSTRAINTS:
      - MUST generate exactly ${remainingNeeded} stacks (this is required)
      - Keep descriptions under 100 characters
      - For rest days, use exact format: title: "Rest", description: "Take a break and recover."
      - Rest days should have empty exercises array
      - Return valid JSON only, no additional text or formatting
      - Ensure one rest day per week`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  
      messages: [
        {
          role: 'system',
          content: `You are an elite fitness trainer with extensive knowledge in exercise science, biomechanics, and program periodization. 
          Consider these principles when creating workout plans:
          - Progressive overload and proper exercise sequencing
          - Muscle group synergies and recovery patterns
          - Balance between pushing and pulling movements
          - Appropriate exercise pairings and supersets when relevant
          - Strategic rest day placement for optimal recovery
          - Exercise variety while maintaining movement pattern consistency
          - Proper exercise order (compound movements before isolation)
          - Consideration of biomechanical stress and fatigue management
          - Balanced development of all movement patterns (push, pull, hinge, squat, carry, rotate)

            Provide workout plans in valid JSON format only. No additional text or explanations.`
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      max_tokens: 15000
    });

    let generatedContent = JSON.parse(response.choices[0].message.content);
    console.log(`Received ${generatedContent.stacks.length} new stacks from OpenAI`);
    
    let allWorkouts = [...existingWorkouts, ...generatedContent.stacks];
    console.log(`Total stacks after combining: ${allWorkouts.length}`);
    
    // If we still don't have enough workouts and haven't exceeded max retries
    if (allWorkouts.length < totalNeeded && retryCount < maxRetries) {
      console.log(`\nNeed ${totalNeeded - allWorkouts.length} more stacks. Making another attempt...`);
      
      // Recursive call to generate remaining workouts
      return await generateWorkouts(
        totalNeeded,
        allWorkouts,
        retryCount + 1,
        promptData
      );
    }

    // Trim excess workouts if we generated too many
    if (allWorkouts.length > totalNeeded) {
      console.log(`\nTrimming excess workouts from ${allWorkouts.length} to ${totalNeeded}`);
      allWorkouts = allWorkouts.slice(0, totalNeeded);
    }

    console.log(`\n=== Final Result ===`);
    console.log(`Total stacks generated: ${allWorkouts.length}`);
    console.log(`Target was: ${totalNeeded}`);

    return { stacks: allWorkouts };
  } catch (error) {
    console.error('Generation attempt failed:', error);
    if (retryCount < maxRetries) {
      console.log(`Retry attempt ${retryCount + 1} of ${maxRetries}`);
      return generateWorkouts(totalNeeded, existingWorkouts, retryCount + 1, promptData);
    }
    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { mustIncludeExercises, userPrompt, preferences, creatorExercises, allAvailableExercises, startDate, endDate } = req.body;

    const totalWorkouts = calculateNumberOfWorkouts(startDate, endDate);
    console.log('\n=== Starting Workout Generation ===');
    console.log(`Target total workouts: ${totalWorkouts}`);
    
    // Use the new generator function with prompt data
    const generatedWorkouts = await generateWorkouts(totalWorkouts, [], 0, {
      mustIncludeExercises,
      userPrompt,
      preferences,
      creatorExercises,
      allAvailableExercises,
      startDate,
      endDate
    });
    
    // Final validation
    if (generatedWorkouts.stacks.length !== totalWorkouts) {
      console.warn(`\n⚠️ Warning: Generated ${generatedWorkouts.stacks.length} workouts, expected ${totalWorkouts}`);
    } else {
      console.log(`\n✅ Successfully generated ${totalWorkouts} workouts`);
    }

    res.status(200).json({
      choices: [{
        message: {
          content: JSON.stringify(generatedWorkouts)
        }
      }]
    });
  } catch (error) {
    console.error('\n❌ OpenAI API Error:', error);
    res.status(500).json({ error: 'Failed to generate workout round' });
  }
}

function calculateNumberOfWorkouts(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  
  console.log(`Days difference: ${daysDiff}`);
  console.log(`Total workouts needed (including rest days): ${daysDiff}`);
  
  return daysDiff;
}