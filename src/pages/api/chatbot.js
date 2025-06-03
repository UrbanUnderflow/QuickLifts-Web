import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPEN_AI_SECRET_KEY,
});

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

CRITICAL: Review CURRENT CONFIGURATION below. Don't ask about configured info. Focus on what's missing.

FLOW:
1. Coach describes goals
2. Ask 3 sharp, specific questions 
3. After 3+ questions, summarize the program plan
4. Ask "Ready to build this?"
5. If confirmed, generate refined prompt and set readyToGenerate: true

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
  "suggestedDescription": ""
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
Follow-up: "Perfect. Primary goal - pure strength or size? And any injury history?"
Summary: "Here's the plan: 4-week upper body program, 4x/week, compound-focused with rear delt emphasis. Progressive overload weekly. Ready to build this?"

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
      model: 'gpt-4o',
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