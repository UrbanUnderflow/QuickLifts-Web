import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { Octokit } from '@octokit/rest';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { admin, db, headers } from './config/firebase';
import { KpiSnapshot } from './models/kpiSnapshot';
import { PressRelease, PressReleaseStatus, PressReleaseGenerationResult } from './models/pressRelease';
import { FunctionMetadata } from './models/functionMetadata';
import { generateKpiSnapshot } from './generateKpiSnapshot';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

// Initialize Octokit (GitHub API client)
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

// GitHub repository information
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'tremainegrant';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'QuickLifts-Web';
const CONTENT_PATH = 'content/press/releases';
const BASE_BRANCH = 'main';

// Generate a press release title based on KPI data
function generateTitle(kpiData: KpiSnapshot): string {
  // Extract the most significant metric for the title
  const metrics = [
    kpiData.activeUsers > 10000 ? `Pulse Reaches ${Math.floor(kpiData.activeUsers / 1000)}K Active Users` : null,
    kpiData.payingCreators > 1000 ? `Pulse Hits ${Math.floor(kpiData.payingCreators / 100) * 100} Paying Creators` : null,
    kpiData.ARR && kpiData.ARR > 200000 ? `Pulse Achieves $${Math.floor(kpiData.ARR / 100000) * 100}K ARR` : null,
  ].filter(Boolean);

  // If there's a notable event, prioritize that
  if (kpiData.notableEvents && kpiData.notableEvents.length > 0) {
    const significant = kpiData.notableEvents[0];
    if (significant.includes('Challenge')) {
      return `Pulse Launches ${significant.split(' with ')[0]}`;
    }
    if (significant.includes('Partnership')) {
      return `Pulse Announces Strategic Partnership with ${significant.split(' with ')[1]}`;
    }
    return `Pulse Announces ${significant}`;
  }

  // Otherwise use the most significant metric
  return metrics[0] || `Pulse Monthly Update: ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`;
}

// Create frontmatter for the MDX file
function createFrontmatter(title: string, summary: string, date: string): string {
  return `---
title: "${title}"
date: "${date}"
image: "/press/releases/${slugify(title, { lower: true })}.jpg"
summary: "${summary}"
tags: ["update", "metrics", "growth"]
---

<PressBody>`;
}

// Generate a GitHub-safe branch name
function generateBranchName(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toISOString().slice(11, 16).replace(':', '');
  return `press/auto-${dateStr}-${timeStr}`;
}

/**
 * Core function to generate press release
 * This is extracted as a separate function so it can be called
 * both by the scheduled handler and manual trigger
 */
export async function generatePressRelease(): Promise<PressReleaseGenerationResult> {
  console.log('Starting press release generation');
  
  try {
    // Update function metadata to show in_progress
    await updateFunctionMetadata('in_progress');
    
    // 1. Generate a new KPI snapshot if needed
    console.log('Checking for recent KPI snapshot');
    let kpiSnapshot: KpiSnapshot | null = null;
    
    // Try to get the most recent KPI snapshot from the last 24 hours
    const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    const recentSnapshots = await db
      .collection('kpiSnapshots')
      .where('capturedAt', '>', oneDayAgo)
      .orderBy('capturedAt', 'desc')
      .limit(1)
      .get();
    
    if (!recentSnapshots.empty) {
      kpiSnapshot = recentSnapshots.docs[0].data() as KpiSnapshot;
      console.log(`Found recent KPI snapshot from ${new Date(kpiSnapshot.capturedAt * 1000).toISOString()}`);
    } else {
      // Generate a new snapshot if none exists
      console.log('No recent KPI snapshot found, generating a new one');
      const result = await generateKpiSnapshot();
      if (!result.success || !result.data) {
        throw new Error('Failed to generate KPI snapshot: ' + (result.error || 'Unknown error'));
      }
      kpiSnapshot = result.data;
    }

    // 2. Generate the press release title and prepare data for OpenAI
    const releaseTitle = generateTitle(kpiSnapshot);
    console.log('Generated title:', releaseTitle);

    // 3. Call OpenAI to generate the press release content
    console.log('Calling OpenAI to generate press release content');
    const prompt = `
You are Pulse's communications AI. Draft a concise press release (400-500 words, journalistic tone) about the 
most significant milestone or achievement that occurred recently. Use the data below as your primary source.

Today's date: ${new Date().toISOString().split('T')[0]}
KPI Data:
- Total Users: ${kpiSnapshot.totalUsers.toLocaleString()}
- Active Users: ${kpiSnapshot.activeUsers.toLocaleString()}
- Total Workouts: ${kpiSnapshot.workoutCount.toLocaleString()}
- Challenge Participants: ${kpiSnapshot.challengeParticipants.toLocaleString()}
- Total Creators: ${kpiSnapshot.totalCreators.toLocaleString()}
- Paying Creators: ${kpiSnapshot.payingCreators.toLocaleString()} 
${kpiSnapshot.ARR ? `- Annual Recurring Revenue: $${kpiSnapshot.ARR.toLocaleString()}` : ''}
- Notable Events: ${kpiSnapshot.notableEvents?.length > 0 ? kpiSnapshot.notableEvents.join('; ') : 'None'}
${kpiSnapshot.weeklyGrowth ? `- Weekly Growth: Users ${kpiSnapshot.weeklyGrowth.users}%, Workouts ${kpiSnapshot.weeklyGrowth.workouts}%, Creators ${kpiSnapshot.weeklyGrowth.creators}%` : ''}

Title: ${releaseTitle}

Guidelines:
- Begin with a concise lead paragraph summarizing the key announcement
- Include a quote from Tremaine Grant, Founder & CEO of Pulse 
- Reference specific metrics when relevant
- Mention any notable events in the body
- End with a brief "About Pulse" paragraph
- Match the style of professional press releases
- Format in Markdown
- Total length: 400-500 words
`;

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional PR writer who drafts clean, well-structured press releases in Markdown format. Your writing is concise, factual, and follows standard PR conventions.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const pressReleaseContent = aiResponse.choices[0].message.content?.trim();
    if (!pressReleaseContent) {
      throw new Error('Failed to generate press release content from OpenAI');
    }

    console.log('Press release content generated successfully');
    
    // Generate a summary (first 150 characters of the first paragraph)
    const summary = pressReleaseContent.split('\n\n')[0].slice(0, 150).trim() + '...';
    
    // 4. Create MDX file content
    const today = new Date().toISOString().split('T')[0];
    const frontmatter = createFrontmatter(releaseTitle, summary, today);
    const mdxContent = `${frontmatter}

${pressReleaseContent}

</PressBody>`;

    // 5. Create a new branch on GitHub
    const branchName = generateBranchName();
    console.log(`Creating new branch: ${branchName}`);

    // Get the latest commit SHA of the base branch
    const { data: refData } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BASE_BRANCH}`,
    });
    const latestCommitSha = refData.object.sha;

    // Create a new branch
    await octokit.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: latestCommitSha,
    });

    console.log('Branch created successfully');

    // 6. Prepare file path and content for GitHub
    const slug = slugify(releaseTitle, { lower: true });
    const filePath = `${CONTENT_PATH}/${today}-${slug}.mdx`;
    console.log(`Creating file at: ${filePath}`);

    // 7. Commit the file to the new branch
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `Add press release: ${releaseTitle}`,
      content: Buffer.from(mdxContent).toString('base64'),
      branch: branchName,
    });

    console.log('File committed successfully');

    // 8. Create a pull request
    const { data: pullRequest } = await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `📣 New Press Release: ${releaseTitle}`,
      head: branchName,
      base: BASE_BRANCH,
      body: `
## Automated Press Release

This PR was automatically generated by the press release automation system.

### Overview
- **Title**: ${releaseTitle}
- **Date**: ${today}
- **File**: ${filePath}

### Preview
${summary}

### Next Steps
1. Review the content for accuracy
2. Adjust metrics if needed
3. Add an appropriate header image at \`public/press/releases/${slug}.jpg\`
4. Merge when ready to publish

_Generated from KPI data in Firebase_
`,
    });

    console.log(`Pull request created successfully: ${pullRequest.html_url}`);

    // 9. Save the press release to Firestore
    const pressReleaseId = uuidv4();
    const timestamp = Math.floor(Date.now() / 1000);
    
    const pressRelease: PressRelease = {
      id: pressReleaseId,
      title: releaseTitle,
      summary,
      content: pressReleaseContent,
      generatedAt: timestamp,
      status: 'draft',
      kpiSnapshotId: kpiSnapshot.id,
      githubPrUrl: pullRequest.html_url,
      mdxPath: filePath,
      tags: ['update', 'metrics', 'growth'],
    };
    
    await db.collection('pressReleases').doc(pressReleaseId).set(pressRelease);
    console.log(`Press release saved to Firestore with ID: ${pressReleaseId}`);
    
    // 10. Update function metadata
    await updateFunctionMetadata('success', undefined, pressReleaseId);
    
    return {
      success: true,
      message: 'Press release draft created successfully',
      data: {
        pressReleaseId,
        title: releaseTitle,
        pullRequestUrl: pullRequest.html_url,
        branchName,
      },
    };
  } catch (error) {
    console.error('Error generating press release:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update function metadata to show error
    await updateFunctionMetadata('error', errorMessage);
    
    return {
      success: false,
      message: 'Failed to generate press release',
      error: errorMessage,
    };
  }
}

/**
 * Update function metadata after execution
 */
async function updateFunctionMetadata(
  status: 'success' | 'error' | 'in_progress', 
  error?: string, 
  resultId?: string
): Promise<void> {
  try {
    const metadataRef = db.collection('functionMetadata').doc('draftPress');
    const metadataDoc = await metadataRef.get();
    
    const timestamp = Math.floor(Date.now() / 1000);
    let metadata: FunctionMetadata;
    
    if (metadataDoc.exists) {
      const existingData = metadataDoc.data() as FunctionMetadata;
      metadata = {
        ...existingData,
        lastRunAt: timestamp,
        lastRunStatus: status,
        lastRunError: error,
        runCount: (existingData.runCount || 0) + (status === 'in_progress' ? 0 : 1),
      };
      
      // Only update the resultId if we have a new one and we're in success status
      if (resultId && status === 'success') {
        metadata.lastResultId = resultId;
      }
    } else {
      metadata = {
        id: 'draftPress',
        lastRunAt: timestamp,
        lastRunStatus: status,
        lastRunError: error,
        lastResultId: resultId,
        runCount: status === 'in_progress' ? 0 : 1,
        schedule: '@weekly',
      };
    }
    
    await metadataRef.set(metadata);
    console.log(`Function metadata updated: status=${status}`);
  } catch (error) {
    console.error('Error updating function metadata:', error);
  }
}

// Main handler function
export const handler: Handler = async (event) => {
  console.log('Starting press release draft function');

  // Check if this is a scheduled event
  const isScheduled = event.headers?.['x-netlify-event-source'] === 'scheduled';
  if (isScheduled) {
    console.log('Running as scheduled function');
  } else {
    console.log('Running from manual trigger');
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const result = await generatePressRelease();

    if (result.success) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result),
      };
    } else {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify(result),
      };
    }
  } catch (error) {
    console.error('Handler error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}; 