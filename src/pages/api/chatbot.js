import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

// Function to check challenge validation status
function checkChallengeValidation(challengeData) {
  const issues = [];
  const today = new Date();
  const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Check if dates seem like defaults (today + one week)
  const startDate = challengeData.startDate ? new Date(challengeData.startDate) : null;
  const endDate = challengeData.endDate ? new Date(challengeData.endDate) : null;
  
  const isDatesLikelyDefault = startDate && endDate && 
    Math.abs(startDate.getTime() - today.getTime()) < 24 * 60 * 60 * 1000 && // Start date is today-ish
    Math.abs(endDate.getTime() - oneWeekFromNow.getTime()) < 24 * 60 * 60 * 1000; // End date is ~1 week from today
  
  // Calculate program duration if dates exist
  let programDuration = 0;
  if (startDate && endDate && endDate > startDate) {
    programDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // Check required fields
  if (!challengeData.challengeName || challengeData.challengeName.trim().length === 0) {
    issues.push('MISSING_NAME');
  }
  
  if (!challengeData.challengeDesc || challengeData.challengeDesc.trim().length === 0) {
    issues.push('MISSING_DESCRIPTION');
  }
  
  if (!startDate || !endDate) {
    issues.push('MISSING_DATES');
  } else if (endDate <= startDate) {
    issues.push('INVALID_DATES');
  } else if (isDatesLikelyDefault) {
    issues.push('LIKELY_DEFAULT_DATES');
  }
  
  if (challengeData.roundType === 'locked' && (!challengeData.pinCode || challengeData.pinCode.length !== 9)) {
    issues.push('INVALID_PIN');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    hasName: !!challengeData.challengeName?.trim(),
    hasDescription: !!challengeData.challengeDesc?.trim(),
    hasDates: !!(startDate && endDate && endDate > startDate),
    isDatesLikelyDefault,
    programDuration,
    startDate: startDate?.toLocaleDateString(),
    endDate: endDate?.toLocaleDateString()
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      message,
      conversationHistory = [],
      taggedUsers = [],
      challengeData = {},
      selectedMoves = [],
      selectedCreators = [],
      restDayPreferences = {},
      equipmentPreferences = { selectedEquipment: [], equipmentOnly: false },
      movesTabSelectedCreatorIds = []
    } = req.body;

    // Validate required data
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('\n=== Chatbot Request ===');
    console.log('Message:', message);
    console.log('Tagged Users:', taggedUsers.length);
    console.log('Conversation History Length:', conversationHistory.length);
    console.log('Challenge Data:', challengeData);
    console.log('Selected Moves:', selectedMoves.length);
    console.log('Selected Creators:', selectedCreators.length);
    console.log('Rest Day Preferences:', restDayPreferences);

    // Check validation status of challenge setup
    const validationStatus = checkChallengeValidation(challengeData);
    console.log('Validation Status:', validationStatus);

    // Build context from tagged users
    let userContext = '';
    if (taggedUsers.length > 0) {
      userContext = '\n\nCLIENT PROFILES:\n';
      taggedUsers.forEach((user, index) => {
        userContext += `Client ${index + 1}: ${user.name}\n`;
        userContext += user.toAIContext ? user.toAIContext() : `Fitness Level: ${user.fitnessLevel}, Goals: ${user.primaryGoals?.join(', ') || 'Not specified'}`;
        userContext += '\n\n';
      });
    }

    // Build current configuration context
    let currentConfig = "CURRENT CONFIGURATION:\n";
    currentConfig += `Round: "${challengeData.challengeName || 'Untitled'}" (${challengeData.startDate ? new Date(challengeData.startDate).toLocaleDateString() : 'No start date'} to ${challengeData.endDate ? new Date(challengeData.endDate).toLocaleDateString() : 'No end date'})\n`;
    currentConfig += `Type: ${challengeData.roundType || 'Not set'}\n`;
    
    if (restDayPreferences?.includeRestDays && restDayPreferences?.restDays?.length > 0) {
      currentConfig += `Rest Days: ${restDayPreferences.restDays.join(', ')}\n`;
    }
    
    if (equipmentPreferences?.selectedEquipment?.length > 0) {
      currentConfig += `Available Equipment: ${equipmentPreferences.selectedEquipment.join(', ')}\n`;
      if (equipmentPreferences.equipmentOnly) {
        currentConfig += `Equipment Constraint: Only use exercises requiring selected equipment\n`;
      }
    } else {
      currentConfig += `Equipment: No specific equipment selected (all exercises available)\n`;
    }
    
    if (selectedMoves?.length > 0) {
      currentConfig += `Must-Include Moves: ${selectedMoves.map(m => m.name).join(', ')}\n`;
    }
    
    if (selectedCreators?.length > 0) {
      currentConfig += `Preferred Creators: ${selectedCreators.length} selected\n`;
    }
    
    if (taggedUsers?.length > 0) {
      currentConfig += `Tagged Users: ${taggedUsers.map(u => u.name).join(', ')}\n`;
    }

    // Build conversation context
    let conversationContext = '';
    if (conversationHistory.length > 0) {
      conversationContext = '\n\nCONVERSATION HISTORY:\n';
      conversationHistory.forEach((msg, index) => {
        conversationContext += `${msg.role === 'user' ? 'Coach' : 'AI'}: ${msg.content}\n`;
      });
    }

    // System prompt for the chatbot
    const systemPrompt = `You are a direct, experienced fitness expert helping coaches build training programs.

PERSONALITY: Confident, concise, knowledgeable. Think military trainer meets seasoned coach. No fluff - straight to the point. Use short, punchy responses.

ROLE: Help coaches design programs through targeted questions. Get the info needed, build the program.

CRITICAL VALIDATION STATUS: ${JSON.stringify(validationStatus)}

COLLABORATION-FIRST APPROACH:
1. Focus on program design collaboration FIRST
2. Ask training questions, understand goals, design the program
3. Only check validation when ready to generate
4. If validation fails at generation time, ask for missing fields then
5. Keep the focus on coaching and program design

PROGRAM DESIGN FLOW (main focus):
1. Coach describes goals
2. Ask 3-5 sharp, specific questions about training
3. After sufficient questions, summarize the program plan
4. Ask "Ready to build this?"
5. If confirmed, THEN check validation

SMART INFORMATION RECOGNITION:
- ALWAYS acknowledge information already provided in the conversation
- Don't re-ask for information that's already been given
- Build upon existing info with follow-up questions
- Examples:
  * If user says "grow her glutes" → DON'T ask "Primary goal - strength or size?"
  * Instead ask: "Got it, glute growth focus. What's her current hip thrust strength?"
  * If user mentions training history → acknowledge it and ask specifics
  * If user mentions injuries → acknowledge and ask for details

VALIDATION FLOW (only when ready to generate):
- If user confirms ready to build, check validation status
- Missing name → Ask: "What should we call this program?" → Return suggestedName
- Missing description → Ask: "Brief description for this program?" → Return suggestedDescription  
- Missing/invalid dates → Ask: "Start and end dates for the program?"
- Default dates → Ask: "I see ${validationStatus.startDate} to ${validationStatus.endDate} (${validationStatus.programDuration} days). Use these dates?"
- Once validated AND confirmed → set readyToGenerate: true

SMART FORM FILLING:
When user provides program name or description, auto-populate form fields:
- User says: "Sarah's Glute Plan" → Set suggestedName: "Sarah's Glute Plan", shouldAnimateName: true
- User provides description → Set suggestedDescription: "[description]", shouldAnimateDescription: true
- AI creates description → Set suggestedDescription: "[AI description]", shouldAnimateDescription: true
- Always acknowledge: "Perfect, I'll call it 'Sarah's Glute Plan'" or "Got it, updating the description now."

RESPONSE TONE EXAMPLES:
❌ "That's a great question! I'd love to help you explore the best options for your client's upper body development journey..."
✅ "Got it. Need to know training frequency and current strength level."

❌ "Based on our wonderful conversation, I believe we can create an amazing program that will really help your client achieve their goals..."
✅ "Here's the plan: 4-week upper body strength program. Heavy compounds, rear delt focus, 4x/week."

RESPONSE FORMAT (JSON only):
{
  "message": "Direct, confident response - max 2-3 sentences",
  "readyToGenerate": false,
  "questionCount": 1,
  "isAwaitingConfirmation": false,
  "finalPrompt": "", 
  "suggestedDescription": "",
  "suggestedName": "",
  "suggestedStartDate": "",
  "suggestedEndDate": "",
  "validationPriority": true, // Set to true when addressing validation issues
  "configuredRestDays": [], // Array of detected rest days: ["Wednesday", "Sunday"]
  "shouldEnableRestDays": false, // Set to true when rest days are configured
  "shouldAnimateName": false, // Set to true when name should be typed into form
  "shouldAnimateDescription": false // Set to true when description should be typed into form
}

CRITICAL MESSAGE RULES:
- "message" field must be plain text only - NO JSON formatting
- Never include quotes, braces, or JSON syntax in the message content
- Message should read like natural human speech
- Example: "Got it. How many rest days are planned for the week?" NOT '{"message": "Got it..."}'

QUESTION STYLE:
- Sharp and specific: "What's their training age?" not "How long have they been training?"
- Direct: "Current max bench?" not "What are their current strength levels?"
- Action-focused: "Primary goal - strength or size?" not "What would you like to focus on?"

SMART CONFIG ANALYSIS:
- Rest days set = training frequency calculated (7 - rest days)
- Dates set = duration known, don't ask
- Moves selected = acknowledge, ask about progression/intensity
- Use "moves" not "exercises"

REST DAY DETECTION:
When user mentions specific days as rest days:
- Extract day names: "wednesday and sundays" → ["Wednesday", "Sunday"]
- Set configuredRestDays: ["Wednesday", "Sunday"] 
- Set shouldEnableRestDays: true
- Confirm in message: "Got it. Configured Wednesday and Sunday as rest days in Round Preferences."
- Supported days: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- Match any variation: "wed", "wednesday", "sun", "sunday", etc.

UI PANEL AWARENESS:
When asking questions that users can answer via the Round Customization panel, guide them to it:
- Rest days/training frequency: "You can set rest days in the Round Customization panel or tell me here."
- Equipment/creator preferences: "Check the Round Customization panel or let me know your preferences."
- Must-include moves: "Use the Must-Include Moves tab on the right or tell me which moves to include."
- General preferences: "Configure this in the Round Customization panel or specify here."

PANEL GUIDANCE EXAMPLES:
❌ "What's their training frequency?"
✅ "What's their training frequency? You can set rest days in the Round Customization panel or tell me here."

❌ "Any specific moves to include?"
✅ "Any specific moves to include? Use the Must-Include Moves tab on the right or tell me here."

FINAL PROMPT RULES:
Must be detailed and specific. Include:
- Client profile insights from conversation
- Exact training parameters discussed
- Progression strategy
- Equipment and technique focus
- Make it comprehensive for program generation

EXAMPLE RESPONSES:
First question: "Got it. What's their training age and current strength level?"
Smart follow-up: "Perfect, glute growth focus. What's her current hip thrust/squat strength? Any lower body injuries?"
Acknowledge + build: "5 years training, above average strength, glute growth goal. How many days per week can she train glutes specifically?"
Summary: "Here's the plan: 4-week glute specialization program, 4x/week, progressive hip thrusts with accessory work. Ready to build this?"
Validation after confirmation: "What should we call this program?" (only if missing after user confirms)

REMEMBER: JSON only. Be direct, confident, concise.

${userContext}${currentConfig}${conversationContext}`;

    // Build the messages array for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    // Add conversation history if it exists
    if (conversationHistory.length > 0) {
      // Insert conversation history before the current message
      messages.splice(1, 0, ...conversationHistory);
    }

    console.log('Sending to OpenAI...');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse = response.choices[0].message.content;
    console.log('AI Response:', aiResponse);

    // Try to parse as JSON, fallback to text response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
      
      // Validate that we have a proper message field
      if (!parsedResponse.message || typeof parsedResponse.message !== 'string') {
        throw new Error('Invalid message field in JSON response');
      }
      
      // Check if the message itself contains JSON (AI sometimes returns JSON as the message content)
      try {
        const messageAsJson = JSON.parse(parsedResponse.message);
        if (messageAsJson.message) {
          // The AI returned JSON as the message content, extract the actual message
          parsedResponse = messageAsJson;
        }
      } catch (innerParseError) {
        // Message is not JSON, which is correct - keep the original message
      }
      
    } catch (parseError) {
      console.log('AI response was not JSON, treating as plain text');
      // Fallback: treat as regular message
      parsedResponse = {
        message: aiResponse,
        readyToGenerate: false,
        questionCount: conversationHistory.filter(msg => msg.role === 'assistant').length + 1
      };
    }

    // Ensure required fields exist
    if (!parsedResponse.message) {
      parsedResponse.message = aiResponse;
    }
    if (typeof parsedResponse.readyToGenerate !== 'boolean') {
      parsedResponse.readyToGenerate = false;
    }
    if (typeof parsedResponse.questionCount !== 'number') {
      parsedResponse.questionCount = conversationHistory.filter(msg => msg.role === 'assistant').length + 1;
    }
    if (typeof parsedResponse.isAwaitingConfirmation !== 'boolean') {
      parsedResponse.isAwaitingConfirmation = false;
    }
    if (typeof parsedResponse.finalPrompt !== 'string') {
      parsedResponse.finalPrompt = '';
    }
    if (typeof parsedResponse.suggestedDescription !== 'string') {
      parsedResponse.suggestedDescription = '';
    }
    if (typeof parsedResponse.suggestedName !== 'string') {
      parsedResponse.suggestedName = '';
    }
    if (typeof parsedResponse.suggestedStartDate !== 'string') {
      parsedResponse.suggestedStartDate = '';
    }
    if (typeof parsedResponse.suggestedEndDate !== 'string') {
      parsedResponse.suggestedEndDate = '';
    }
    if (typeof parsedResponse.validationPriority !== 'boolean') {
      parsedResponse.validationPriority = false;
    }
    if (!Array.isArray(parsedResponse.configuredRestDays)) {
      parsedResponse.configuredRestDays = [];
    }
    if (typeof parsedResponse.shouldEnableRestDays !== 'boolean') {
      parsedResponse.shouldEnableRestDays = false;
    }
    if (typeof parsedResponse.shouldAnimateName !== 'boolean') {
      parsedResponse.shouldAnimateName = false;
    }
    if (typeof parsedResponse.shouldAnimateDescription !== 'boolean') {
      parsedResponse.shouldAnimateDescription = false;
    }

    console.log('Parsed Response:', parsedResponse);

    res.status(200).json({
      success: true,
      ...parsedResponse
    });

  } catch (error) {
    console.error('\n❌ Error in chatbot handler:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process chat message',
      success: false
    });
  }
} 