import { db } from './config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import slugify from 'slugify';

// Import OpenAI
import OpenAI from 'openai';

// Import shared KPI generation logic
import { runKpiGeneration } from './generateKpiSnapshot'; 

// Import types (adjust paths as needed)
// Ensure KpiSnapshot type matches the one used/returned by runKpiGeneration if needed here
interface KpiData { // Define a simple interface for the data used here
    date: Timestamp;
    totalUsers: number;
    newUsersToday: number;
    totalWorkoutsCompleted: number;
    workoutsCompletedToday: number;
    averageWorkoutDuration: number;
}
import { PressRelease } from './models/pressRelease'; // Assuming this exists and matches Firestore structure
import { FunctionMetadata } from './models/functionMetadata';

// Import utilities
import { updateFunctionMetadata } from './utils/metadataUtils';
// Remove GitHub import for now as it's commented out
// import { saveDraftToGithub } from './utils/githubUtils'; 

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY, 
});

// Constants
const PRESS_RELEASES_COLLECTION = 'pressReleases';
const FUNCTION_NAME = 'draftPress';

// --- Main Handler Logic ---

const handler = async (event: any, context: any) => {
  console.log(`${FUNCTION_NAME} function started at: ${new Date().toISOString()}`);

  try {
    // 1. Generate Latest KPI Snapshot using the shared function
    console.log("Generating latest KPI data...");
    const kpiResult = await runKpiGeneration(); 

    if (!kpiResult.success || !kpiResult.kpiData) {
      // Throw error if KPI generation failed, ensuring kpiData is not null below
      throw new Error(`Failed to generate KPI data: ${kpiResult.error || 'Unknown KPI generation error'}`);
    }
    // Assert kpiResult.kpiData is not null/undefined due to the check above
    const latestKpiData = kpiResult.kpiData as KpiData; 
    const snapshotId = kpiResult.snapshotId;
    // We can safely access snapshotId now as well, or throw if it's missing when success is true
    if (!snapshotId) {
        throw new Error('KPI generation succeeded but snapshotId is missing.');
    }
    console.log(`Successfully obtained KPI data for snapshot ID: ${snapshotId}`);
    
    // 2. Fetch Boilerplate/Company Info (Example)
    const boilerplate = "Pulse continues its rapid growth, demonstrating strong community engagement and user activity."; 

    // 3. Prepare Prompt for OpenAI
    const prompt = createPrompt(latestKpiData, boilerplate);
    console.log("Sending prompt to OpenAI...");

    // 4. Call OpenAI to generate draft
    const aiResponse = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini', 
      messages: [
        { role: "system", content: "You are a helpful assistant tasked with writing engaging press releases for Pulse Fitness Collective. Focus on key metrics and achievements. Output markdown." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1500, 
      temperature: 0.6, 
    });

    const generatedContent = aiResponse.choices[0]?.message?.content?.trim();
    if (!generatedContent) {
      throw new Error("OpenAI did not return valid content.");
    }
    console.log("Received draft content from OpenAI.");

    // 5. Extract Title
    const titleMatch = generatedContent.match(/^#\s*(.*)/);
    const baseTitle = titleMatch ? titleMatch[1] : `Pulse Weekly Update - ${snapshotId}`;
    // Slugify the title for potential use in filenames or URLs
    const titleSlug = slugify(baseTitle, { lower: true, strict: true });

    // 6. Prepare Press Release Draft Object
    const now = Timestamp.now();
    // Use the PressRelease interface, ensure fields match
    const draftData: Omit<PressRelease, 'id'> = {
      title: baseTitle,
      content: generatedContent,
      summary: generatedContent.substring(0, 200) + '...',
      status: 'draft', // Ensure status matches PressRelease type
      generatedAt: now.toMillis(), // Use generatedAt and convert to number
      snapshotDate: latestKpiData.date.toMillis(), // Convert snapshotDate to number
      kpiSnapshotId: snapshotId,
      metrics: latestKpiData, // Ensure metrics type matches PressRelease if needed
      tags: ['weekly-update', 'automated']
      // Other fields like publishedAt, githubPrUrl, mdxPath will be undefined/null initially
    };

    // 7. Save Draft to Firestore
    const draftRef = await db.collection(PRESS_RELEASES_COLLECTION).add(draftData);
    const draftId = draftRef.id;
    console.log(`Draft press release saved to Firestore with ID: ${draftId}`);

    // 8. Save Draft to GitHub (Optional - Kept commented)
    // try { ... } catch { ... }

    // 9. Update Function Metadata using the imported utility
    await updateFunctionMetadata(FUNCTION_NAME, 'success', undefined, draftId);
    console.log(`${FUNCTION_NAME} executed successfully.`);

    return; 

  } catch (error) {
    console.error(`Error executing ${FUNCTION_NAME}:`, error);
    // Update metadata using the imported utility
    await updateFunctionMetadata(FUNCTION_NAME, 'error', error instanceof Error ? error.message : String(error));
    throw error; 
  }
};

// --- Helper Functions ---

// Ensure KpiData type matches expected structure
function createPrompt(kpiData: KpiData, boilerplate: string): string {
  const kpiString = `
Key Metrics for ${kpiData.date.toDate().toLocaleDateString()}:
- Total Users: ${kpiData.totalUsers}
- New Users Today: ${kpiData.newUsersToday}
- Total Workouts Completed: ${kpiData.totalWorkoutsCompleted}
- Workouts Completed Today: ${kpiData.workoutsCompletedToday}
- Average Workout Duration: ${kpiData.averageWorkoutDuration.toFixed(1)} minutes
`; 

  return `
Write a press release draft for Pulse, a fitness technology company. 

Company Boilerplate:
${boilerplate}

${kpiString}
Highlight the key achievements and growth based on these metrics. Maintain a positive and engaging tone suitable for a press release. Ensure the output is formatted using Markdown, starting with a Level 1 heading (#) for the title.
`;
}

// --- Export Handler ---
export { handler };