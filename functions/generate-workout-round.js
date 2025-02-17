const OpenAI = require('openai');

// Initialize OpenAI with your API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in Netlify environment variables
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { mustIncludeExercises, userPrompt, preferences, creatorExercises, allAvailableExercises, startDate, endDate } = JSON.parse(event.body);

    const numberOfWorkouts = calculateNumberOfWorkouts(new Date(startDate), new Date(endDate));
    const prompt = `
      You are a JSON-generating fitness AI. Return PURE JSON only.
      PROGRAM REQUIREMENTS:
      - ${numberOfWorkouts} total workouts from ${startDate} to ${endDate}
      - 4-5 exercises per workout (no more than 5)
      - Use only exercises from these lists:
        Must include: ${mustIncludeExercises.join(", ")}
        Prefer creator exercises: ${creatorExercises.map(ex => ex.name).join(", ")}
        Other available: ${allAvailableExercises.map(ex => ex.name).join(", ")}
      USER PREFERENCES:
      ${userPrompt}
      ${preferences.join("\n")}
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
          }
        ]
      }
      RULES:
      - Return ONLY valid JSON
      - No comments or markdown
      - Exactly ${numberOfWorkouts} stacks
      - Only use listed exercises
      - Keep descriptions under 100 characters`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fitness trainer. Provide workout plans in valid JSON format only. No additional text or explanations.'
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      max_tokens: 4000
    });

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error generating workout round:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate workout round' }),
    };
  }
};

function calculateNumberOfWorkouts(startDate, endDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffInMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffInMs / msPerDay) + 1;
}