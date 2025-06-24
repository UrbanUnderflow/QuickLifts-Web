import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

interface VCProspect {
  id: string;
  person: string;
  companies: string;
  urls: string;
  linkedin: string;
  continent: string;
  country: string;
  location: string;
  addresses: string;
  email: string;
  description: string;
  stage: string;
  founder: string;
  numberOfExits: string;
  status: string;
  source: string;
}

interface AuditIssue {
  field: string;
  currentValue: string;
  suggestedValue: string;
  issue: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

interface AuditResult {
  prospectId: string;
  overallScore: 'ACCURATE' | 'NEEDS_REVIEW' | 'INACCURATE';
  issues: AuditIssue[];
  verifiedData: Partial<VCProspect>;
}

interface AuditVCDataRequest {
  prospects: VCProspect[];
  batchSize?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prospects, batchSize = 3 } = req.body as AuditVCDataRequest;

    if (!prospects || !Array.isArray(prospects) || prospects.length === 0) {
      return res.status(400).json({ error: 'Valid prospects array is required' });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPEN_AI_SECRET_KEY;
    if (!apiKey) {
      console.error('OpenAI API key not found in environment variables');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Initialize audit results
    let auditResults: AuditResult[] = [];

    // Process all prospects in a single call to minimize cost
    console.log(`🔍 Auditing all ${prospects.length} prospects in a single o3 call...`);

    const auditPrompt = `You are an expert VC data auditor using o3's reasoning capabilities. Your task is to audit VC prospect data and provide SPECIFIC CORRECTED VALUES for any inaccuracies found.

PROSPECTS TO AUDIT (${prospects.length} total):
${JSON.stringify(prospects, null, 2)}

🚨 CRITICAL INSTRUCTION: 
You must provide ACTUAL CORRECTED DATA VALUES, not suggestions or recommendations. 

For example:
❌ WRONG: "suggestedValue": "Verify the complete list of founders"
❌ WRONG: "suggestedValue": "Consider checking the office address"
❌ WRONG: "suggestedValue": "Update with current information"

✅ CORRECT: "suggestedValue": "Barry Eggers, Ravi Mhatre, Jeremy Liew, Peter Fenton"
✅ CORRECT: "suggestedValue": "2494 Sand Hill Road, Menlo Park, CA 94025"
✅ CORRECT: "suggestedValue": "info@lsvp.com"

AUDIT PROCESS:
1. **Research Each Firm**: Use your knowledge to find accurate information
2. **Verify Partner Details**: Confirm current partner names and roles
3. **Check Contact Information**: Find correct email patterns and LinkedIn URLs
4. **Validate Addresses**: Provide specific office addresses if known
5. **Confirm Investment Focus**: Specify accurate investment stages
6. **Website Verification**: Ensure URLs are correct and active

RESPONSE REQUIREMENTS:
- Create issues ONLY when you can provide the EXACT CORRECT VALUE
- If you cannot determine the specific correct information, DO NOT create an issue
- suggestedValue MUST contain actionable, specific data that can be directly saved
- Never use phrases like "verify", "consider", "update", or "check"

RESPONSE FORMAT - Return a JSON array:
[
  {
    "prospectId": "prospect_id_here",
    "overallScore": "ACCURATE|NEEDS_REVIEW|INACCURATE",
    "issues": [
      {
        "field": "email|urls|linkedin|companies|person|stage|location|addresses|founder|etc",
        "currentValue": "current value in database",
        "suggestedValue": "SPECIFIC_CORRECTED_VALUE_HERE_ONLY",
        "issue": "What specific data is incorrect",
        "confidence": "HIGH|MEDIUM|LOW",
        "reasoning": "Why this specific corrected value is accurate"
      }
    ],
    "verifiedData": {
      "field_name": "verified_correct_value"
    }
  }
]

SCORING CRITERIA:
- **ACCURATE**: All data verified as correct
- **NEEDS_REVIEW**: Specific corrections needed (with exact values provided)
- **INACCURATE**: Major errors found (with specific correct values provided)

FINAL REMINDER: Only create "issues" when you have the ACTUAL CORRECTED DATA to replace the current value. No suggestions, only specific actionable corrections.

Return ONLY valid JSON, no markdown or explanations.`;

    try {
      // Call OpenAI API with o3 model for all prospects at once
      const response = await openai.chat.completions.create({
        model: 'o3-mini',
        messages: [
          {
            role: "system",
            content: "You are an expert VC data auditor with access to verify information through reasoning and fact-checking. You prioritize accuracy and only suggest changes when confident they improve data quality."
          },
          {
            role: "user",
            content: auditPrompt
          }
        ],
        max_completion_tokens: 16000, // Increased significantly for processing all prospects at once
        // Note: o3 model doesn't support temperature parameter
      });

      const generatedContent = response.choices[0]?.message?.content?.trim();
      if (!generatedContent) {
        throw new Error('o3 model did not return valid content for audit');
      }

      console.log('🧠 Raw o3 Audit Response:', generatedContent.substring(0, 500) + '...');

      // Clean and parse response
      let cleanedResponse = generatedContent
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // Parse JSON response with error handling for truncated responses
      let parsedResults;
      try {
        parsedResults = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error('Failed to parse o3 audit response:', parseError);
        console.log('Response appears to be truncated. Length:', generatedContent.length);
        console.log('Last 200 characters:', generatedContent.slice(-200));
        
        // Try to extract partial results from truncated JSON using sophisticated parsing
        try {
          console.log('🔧 Attempting to recover partial audit results from truncated response...');
          
          // Multiple recovery strategies
          const recoveryStrategies = [
            // Strategy 1: Find last complete object with closing bracket
            () => {
              const lastCompleteObjectIndex = cleanedResponse.lastIndexOf('},');
              if (lastCompleteObjectIndex > 0) {
                return cleanedResponse.substring(0, lastCompleteObjectIndex + 1) + ']';
              }
              return null;
            },
            
            // Strategy 2: Find all complete prospectId entries and reconstruct
            () => {
              const prospectMatches = cleanedResponse.match(/{\s*"prospectId":[^}]+}/g);
              if (prospectMatches && prospectMatches.length > 0) {
                console.log(`Found ${prospectMatches.length} potential complete prospect objects`);
                
                // Validate each match is truly complete
                const completeObjects = prospectMatches.filter(match => {
                  try {
                    const obj = JSON.parse(match);
                    return obj.prospectId && obj.overallScore && obj.hasOwnProperty('issues');
                  } catch {
                    return false;
                  }
                });
                
                if (completeObjects.length > 0) {
                  return '[' + completeObjects.join(',') + ']';
                }
              }
              return null;
            },
            
            // Strategy 3: Use regex to extract complete audit result objects
            () => {
              // Look for complete objects that have all required fields
              const auditResultPattern = /{[^}]*"prospectId"[^}]*"overallScore"[^}]*"issues"[^}]*"verifiedData"[^}]*}/g;
              const matches = cleanedResponse.match(auditResultPattern);
              
              if (matches && matches.length > 0) {
                const validObjects = [];
                for (const match of matches) {
                  try {
                    const obj = JSON.parse(match);
                    if (obj.prospectId && obj.overallScore && Array.isArray(obj.issues)) {
                      validObjects.push(match);
                    }
                  } catch {
                    // Skip invalid objects
                  }
                }
                
                if (validObjects.length > 0) {
                  return '[' + validObjects.join(',') + ']';
                }
              }
              return null;
            },
            
            // Strategy 4: Manual parsing line by line
            () => {
              const lines = cleanedResponse.split('\n');
              const objects = [];
              let currentObject = '';
              let braceCount = 0;
              let inObject = false;
              
              for (const line of lines) {
                for (const char of line) {
                  if (char === '{') {
                    if (!inObject) {
                      inObject = true;
                      currentObject = '';
                    }
                    braceCount++;
                  }
                  
                  if (inObject) {
                    currentObject += char;
                  }
                  
                  if (char === '}') {
                    braceCount--;
                    if (braceCount === 0 && inObject) {
                      // Complete object found
                      try {
                        const obj = JSON.parse(currentObject);
                        if (obj.prospectId && obj.overallScore) {
                          objects.push(currentObject);
                        }
                      } catch {
                        // Skip invalid objects
                      }
                      inObject = false;
                      currentObject = '';
                    }
                  }
                }
              }
              
              return objects.length > 0 ? '[' + objects.join(',') + ']' : null;
            }
          ];
          
          // Try each recovery strategy
          for (let i = 0; i < recoveryStrategies.length; i++) {
            try {
              const recoveredJson = recoveryStrategies[i]();
              if (recoveredJson) {
                console.log(`Strategy ${i + 1} found potential recovery...`);
                const testParse = JSON.parse(recoveredJson);
                if (Array.isArray(testParse) && testParse.length > 0) {
                  parsedResults = testParse;
                  console.log(`✅ Strategy ${i + 1} successfully recovered ${parsedResults.length} complete audit results`);
                  break;
                }
              }
                         } catch (strategyError) {
               console.log(`Strategy ${i + 1} failed:`, strategyError instanceof Error ? strategyError.message : String(strategyError));
               continue;
            }
          }
          
          if (!parsedResults) {
            throw new Error('All recovery strategies failed');
          }
          
        } catch (recoveryError) {
          console.error('Failed to recover partial results:', recoveryError);
          
          // Last resort: return empty array with detailed error info
          console.warn('⚠️ Could not recover any audit results. Returning empty results with error details.');
          parsedResults = [];
          
          // Don't throw error - let user know what happened but continue
          console.log('💡 Suggestions: 1) Increase token limit further, 2) Process prospects in smaller batches, 3) Simplify the audit prompt');
        }
      }

      // Validate results
      if (Array.isArray(parsedResults)) {
        auditResults = parsedResults;
        console.log(`✅ Successfully parsed ${auditResults.length} audit results`);
      } else {
        console.warn('Invalid audit results structure - expected array');
        auditResults = [];
      }

      console.log(`✅ Processed all prospects: ${auditResults.length} audit results`);

    } catch (error) {
      console.error('Error during o3 audit:', error);
      throw error;
    }

    // Calculate audit summary
    const summary = {
      totalProspects: prospects.length,
      audited: auditResults.length,
      accurate: auditResults.filter((r: any) => r.overallScore === 'ACCURATE').length,
      needsReview: auditResults.filter((r: any) => r.overallScore === 'NEEDS_REVIEW').length,
      inaccurate: auditResults.filter((r: any) => r.overallScore === 'INACCURATE').length,
      totalIssues: auditResults.reduce((sum: number, r: any) => sum + (r.issues?.length || 0), 0)
    };

    console.log('📊 Audit Summary:', summary);

    return res.status(200).json({ 
      auditResults,
      summary,
      success: true,
      model: 'o3-mini'
    });

  } catch (error) {
    console.error('Error in VC data audit:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error',
      success: false,
      model: 'o3-mini'
    });
  }
} 