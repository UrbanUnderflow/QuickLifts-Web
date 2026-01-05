const { admin, db, headers } = require("./config/firebase");
const OpenAI = require("openai");

// Valid body parts that match the iOS BodyPart enum
const VALID_BODY_PARTS = [
  "biceps",
  "triceps",
  "chest",
  "calves",
  "abs",
  "hamstrings",
  "back",
  "glutes",
  "quadriceps",
  "forearms",
  "shoulders",
  "lowerback",
  "lats",
  "traps",
  "rhomboids",
  "deltoids",
  "fullbody",
  // Mobility/Stretch body areas
  "hips",
  "neck",
  "ankles",
  "wrists",
  "core",
  "hipflexors",
  "adductors",
  "spine"
];

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Uses OpenAI to infer the primary body parts targeted by an exercise
 * based on its name and optionally a thumbnail image.
 */
async function inferBodyPartsWithAI(exerciseName, thumbnailUrl = null) {
  console.log(`[inferExerciseBodyParts] Inferring body parts for: "${exerciseName}"`);

  const validBodyPartsList = VALID_BODY_PARTS.join(", ");
  
  const systemPrompt = `You are a fitness expert assistant that analyzes exercise names and determines which body parts they target.

Given an exercise name (and optionally an image), you must return ONLY the primary body parts targeted by that exercise.

VALID BODY PARTS (you MUST only use values from this list):
${validBodyPartsList}

GUIDELINES:
- For mobility/stretch exercises, prefer these body areas: hips, neck, ankles, wrists, hipflexors, adductors, spine, lowerback, core
- For strength exercises, use traditional body parts: biceps, triceps, chest, back, shoulders, etc.
- "90 90" exercises typically target hips
- "Rotations" usually involve spine or the mentioned body area
- "Holds" are often hip/core focused depending on position
- "Circles" exercises target the joint/area mentioned (arm circles = shoulders, hip circles = hips)
- Return 1-3 body parts, prioritizing the PRIMARY target
- If truly full body, return "fullbody"

Respond with ONLY a JSON array of body part strings, nothing else. Example: ["hips", "hipflexors"]`;

  const messages = [
    { role: "system", content: systemPrompt },
  ];

  // If we have a thumbnail, include it in the request
  if (thumbnailUrl && thumbnailUrl.trim()) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `Exercise name: "${exerciseName}"\n\nAnalyze this exercise and return the primary body parts it targets.` },
        { type: "image_url", image_url: { url: thumbnailUrl, detail: "low" } }
      ]
    });
  } else {
    messages.push({
      role: "user",
      content: `Exercise name: "${exerciseName}"\n\nBased on this exercise name, return the primary body parts it targets.`
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: thumbnailUrl ? "gpt-4o" : "gpt-4o-mini", // Use vision model only if we have an image
      messages,
      max_tokens: 100,
      temperature: 0.1, // Low temperature for consistent results
    });

    const content = response.choices[0]?.message?.content?.trim();
    console.log(`[inferExerciseBodyParts] OpenAI response: ${content}`);

    // Parse the JSON array response
    let bodyParts = [];
    try {
      bodyParts = JSON.parse(content);
      if (!Array.isArray(bodyParts)) {
        throw new Error("Response is not an array");
      }
    } catch (parseError) {
      // Try to extract array from response if wrapped in text
      const arrayMatch = content.match(/\[.*\]/s);
      if (arrayMatch) {
        bodyParts = JSON.parse(arrayMatch[0]);
      } else {
        console.error("[inferExerciseBodyParts] Failed to parse response:", content);
        return { success: false, error: "Failed to parse AI response", raw: content };
      }
    }

    // Validate and filter to only valid body parts
    const validatedBodyParts = bodyParts
      .map(part => part.toLowerCase().replace(/\s+/g, "").replace(/-/g, ""))
      .filter(part => VALID_BODY_PARTS.includes(part));

    if (validatedBodyParts.length === 0) {
      console.warn("[inferExerciseBodyParts] No valid body parts found in response");
      return { success: false, error: "AI did not return valid body parts", suggested: bodyParts };
    }

    return { success: true, bodyParts: validatedBodyParts };
  } catch (error) {
    console.error("[inferExerciseBodyParts] OpenAI error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates the exercise document in Firestore with the inferred body parts
 */
async function updateExerciseBodyParts(exerciseId, bodyParts) {
  console.log(`[inferExerciseBodyParts] Updating exercise ${exerciseId} with body parts:`, bodyParts);
  
  const exerciseRef = db.collection("exercises").doc(exerciseId);
  const exerciseDoc = await exerciseRef.get();
  
  if (!exerciseDoc.exists) {
    throw new Error(`Exercise document ${exerciseId} not found`);
  }

  await exerciseRef.update({
    primaryBodyParts: bodyParts,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, message: `Updated exercise with body parts: ${bodyParts.join(", ")}` };
}

exports.handler = async (event, context) => {
  // Handle OPTIONS preflight request for CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: "POST" },
      body: JSON.stringify({ success: false, message: "Method Not Allowed" }),
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { exerciseId, exerciseName, thumbnailUrl, autoUpdate = false } = body;

    if (!exerciseName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: "exerciseName is required" }),
      };
    }

    // Infer body parts using AI
    const inferResult = await inferBodyPartsWithAI(exerciseName, thumbnailUrl);

    if (!inferResult.success) {
      return {
        statusCode: 200, // Return 200 so UI can handle gracefully
        headers,
        body: JSON.stringify({
          success: false,
          message: inferResult.error || "Failed to infer body parts",
          suggested: inferResult.suggested,
          raw: inferResult.raw,
        }),
      };
    }

    // If autoUpdate is true and we have an exerciseId, update the document
    if (autoUpdate && exerciseId) {
      const updateResult = await updateExerciseBodyParts(exerciseId, inferResult.bodyParts);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          bodyParts: inferResult.bodyParts,
          updated: true,
          message: updateResult.message,
        }),
      };
    }

    // Return the inferred body parts without updating
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        bodyParts: inferResult.bodyParts,
        updated: false,
        message: `Suggested body parts: ${inferResult.bodyParts.join(", ")}`,
      }),
    };
  } catch (error) {
    console.error("[inferExerciseBodyParts] Handler error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: error.message || "Internal server error",
      }),
    };
  }
};
