const { headers } = require("./config/firebase");
const OpenAI = require("openai");

// Initialize OpenAI (no hard-coded keys)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_IMAGE_HOSTNAMES = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

function isAllowedImageUrl(imageUrl) {
  try {
    const u = new URL(imageUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

function extractJsonObject(text) {
  if (!text) return null;
  let raw = String(text).trim();

  // Strip markdown code fences if present
  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  // If the model wrapped JSON with extra text, try to grab the first {...} block.
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) raw = match[0];

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "OpenAI API key not configured" }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const imageUrl = body?.imageUrl;
    const equipmentType = body?.equipmentType || "workout machine";

    if (!imageUrl || typeof imageUrl !== "string") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "imageUrl is required" }),
      };
    }

    if (!isAllowedImageUrl(imageUrl)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: "imageUrl must be a Firebase Storage URL",
        }),
      };
    }

    const prompt =
      `You are analyzing a photo of a ${equipmentType} display screen from a gym or run tracking device.\n\n` +
      `TASK: Look at the LCD/LED display and extract ALL visible workout metrics.\n\n` +
      `Return ONLY a JSON object (no markdown, no explanation):\n\n` +
      `{\n` +
      `  "duration": <total_seconds_from_time_display>,\n` +
      `  "calories": <calorie_number>,\n` +
      `  "distance": <miles_as_decimal>,\n` +
      `  "floors": <floor_count_for_stairmaster>,\n` +
      `  "steps": <step_count>,\n` +
      `  "strides": <stride_count_for_elliptical>,\n` +
      `  "pace": "<MM:SS_string>",\n` +
      `  "speed": <mph_decimal>,\n` +
      `  "level": <resistance_or_incline_level_number>,\n` +
      `  "heartRate": <bpm_number>,\n` +
      `  "confidence": <0.0_to_1.0>\n` +
      `}\n\n` +
      `CRITICAL RULES:\n` +
      `- For TIME displayed as "30:11" (30 minutes 11 seconds), duration = 1811 seconds\n` +
      `- For TIME displayed as "1:30:00" (1 hour 30 min), duration = 5400 seconds\n` +
      `- Use null for any metric NOT visible on the display\n` +
      `- confidence: 1.0 if clearly readable, 0.5 if partially visible, 0.0 if cannot read\n`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 450,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    const metrics = extractJsonObject(content);

    if (!metrics || typeof metrics !== "object") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Failed to parse metrics from model response",
          raw: content,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, metrics }),
    };
  } catch (error) {
    console.error("[analyze-workout-machine-screen] error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Failed to analyze workout machine screen",
        details: error?.message || String(error),
      }),
    };
  }
};

