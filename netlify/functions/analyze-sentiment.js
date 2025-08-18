const https = require('https');

// Multiple sentiment analysis strategies for robustness
const SENTIMENT_STRATEGIES = {
  HUGGING_FACE: 'huggingface',
  KEYWORD_ANALYSIS: 'keywords',
  HYBRID: 'hybrid'
};

// Hugging Face API configuration
const HF_API_URL = 'https://api-inference.huggingface.co/models/cardiffnlp/twitter-roberta-base-sentiment-latest';
const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { messages, userId, platform = 'web', strategy = SENTIMENT_STRATEGIES.HYBRID } = JSON.parse(event.body);
    
    // Validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Messages array is required and must not be empty' })
      };
    }

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId is required' })
      };
    }

    console.log(`[Sentiment] Analyzing ${messages.length} messages for user ${userId} (${platform}) using ${strategy} strategy`);

    let result;
    
    switch (strategy) {
      case SENTIMENT_STRATEGIES.HUGGING_FACE:
        result = await analyzeWithHuggingFace(messages);
        break;
      case SENTIMENT_STRATEGIES.KEYWORD_ANALYSIS:
        result = await analyzeWithKeywords(messages);
        break;
      case SENTIMENT_STRATEGIES.HYBRID:
      default:
        result = await analyzeWithHybridApproach(messages);
        break;
    }

    // Add metadata
    result.metadata = {
      userId,
      platform,
      strategy: result.strategy || strategy,
      messageCount: messages.length,
      analyzedAt: new Date().toISOString(),
      textLength: messages.join(' ').length
    };

    console.log(`[Sentiment] Analysis complete: ${result.sentimentScore} (${result.confidence || 'N/A'} confidence)`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('[Sentiment] Error:', error);
    console.error('[Sentiment] Stack:', error.stack);
    console.error('[Sentiment] Event body:', event.body);
    
    // Try to provide a fallback result
    let fallbackResult = { sentimentScore: 0, confidence: 0, strategy: 'error_fallback' };
    try {
      const parsedBody = JSON.parse(event.body || '{}');
      if (parsedBody.messages && Array.isArray(parsedBody.messages)) {
        fallbackResult = await analyzeWithKeywords(parsedBody.messages);
        fallbackResult.strategy = 'keywords_error_fallback';
      }
    } catch (fallbackError) {
      console.error('[Sentiment] Fallback also failed:', fallbackError);
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Sentiment analysis failed',
        details: error.message,
        stack: error.stack,
        eventBody: event.body,
        fallback: fallbackResult
      })
    };
  }
};

/**
 * Hybrid approach: Try Hugging Face first, fallback to keywords
 */
async function analyzeWithHybridApproach(messages) {
  try {
    console.log('[Sentiment] Attempting Hugging Face analysis...');
    const hfResult = await analyzeWithHuggingFace(messages);
    
    // If HF confidence is low, blend with keyword analysis
    if (hfResult.confidence < 0.7) {
      console.log('[Sentiment] Low HF confidence, blending with keyword analysis...');
      const keywordResult = await analyzeWithKeywords(messages);
      
      return {
        sentimentScore: (hfResult.sentimentScore * 0.7) + (keywordResult.sentimentScore * 0.3),
        confidence: Math.max(hfResult.confidence, keywordResult.confidence),
        strategy: 'hybrid_blend',
        details: {
          huggingface: hfResult,
          keywords: keywordResult
        }
      };
    }
    
    return { ...hfResult, strategy: 'huggingface_primary' };
  } catch (error) {
    console.log('[Sentiment] Hugging Face failed, falling back to keywords:', error.message);
    const keywordResult = await analyzeWithKeywords(messages);
    return { ...keywordResult, strategy: 'keywords_fallback' };
  }
}

/**
 * Hugging Face sentiment analysis
 */
async function analyzeWithHuggingFace(messages) {
  return new Promise((resolve, reject) => {
    // Combine and limit text length for API
    const combinedText = messages.join(' ').substring(0, 512);
    const postData = JSON.stringify({ inputs: combinedText });
    
    const options = {
      hostname: 'api-inference.huggingface.co',
      path: '/models/cardiffnlp/twitter-roberta-base-sentiment-latest',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // Add API key if available
    if (HF_API_KEY) {
      options.headers['Authorization'] = `Bearer ${HF_API_KEY}`;
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (res.statusCode !== 200) {
            reject(new Error(`HF API error (${res.statusCode}): ${result.error || 'Unknown error'}`));
            return;
          }
          
          const processed = processHuggingFaceResult(result);
          resolve(processed);
        } catch (parseError) {
          reject(new Error(`Failed to parse HF response: ${parseError.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`HF API request failed: ${error.message}`));
    });
    
    // Set timeout
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('HF API request timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * Process Hugging Face API response
 */
function processHuggingFaceResult(hfResult) {
  if (!hfResult || !Array.isArray(hfResult) || hfResult.length === 0) {
    throw new Error('Invalid HF result format');
  }
  
  // HF returns nested array: [[{\"label\": \"NEGATIVE\", \"score\": 0.8}, ...]]
  const sentiments = Array.isArray(hfResult[0]) ? hfResult[0] : hfResult;
  
  if (!Array.isArray(sentiments)) {
    throw new Error('Unexpected HF result structure');
  }
  
  // Find the highest scoring sentiment
  let maxScore = 0;
  let dominantSentiment = 'NEUTRAL';
  
  sentiments.forEach(item => {
    if (item.score > maxScore) {
      maxScore = item.score;
      dominantSentiment = item.label;
    }
  });
  
  // Convert to our -1 to 1 scale
  let sentimentScore;
  switch (dominantSentiment.toUpperCase()) {
    case 'POSITIVE':
      sentimentScore = maxScore; // 0 to 1
      break;
    case 'NEGATIVE':
      sentimentScore = -maxScore; // 0 to -1
      break;
    case 'NEUTRAL':
    default:
      sentimentScore = 0;
      break;
  }
  
  return {
    sentimentScore,
    confidence: maxScore,
    dominantSentiment,
    rawResult: sentiments
  };
}

/**
 * Enhanced keyword-based sentiment analysis
 */
async function analyzeWithKeywords(messages) {
  const positiveWords = [
    // Basic positive
    'good', 'great', 'awesome', 'excellent', 'happy', 'love', 'amazing', 'perfect', 'wonderful', 'fantastic',
    // Emotions & feelings
    'excited', 'motivated', 'proud', 'confident', 'strong', 'energetic', 'optimistic', 'cheerful', 'joyful',
    'grateful', 'blessed', 'content', 'satisfied', 'pleased', 'delighted', 'thrilled', 'ecstatic',
    // Performance & achievement
    'successful', 'accomplished', 'achieved', 'improved', 'progress', 'better', 'best', 'winning', 'victory',
    'breakthrough', 'milestone', 'personal record', 'pr', 'crushed', 'nailed', 'killed it', 'smashed',
    // Physical & mental state
    'powerful', 'fit', 'healthy', 'energized', 'refreshed', 'recovered', 'ready', 'focused',
    'determined', 'committed', 'dedicated', 'disciplined', 'consistent', 'resilient',
    // Social & support
    'supported', 'encouraged', 'inspired', 'uplifted', 'connected', 'understood', 'appreciated',
    // General positive
    'yes', 'absolutely', 'definitely', 'certainly', 'outstanding', 'incredible', 'remarkable', 'impressive'
  ];
  
  const negativeWords = [
    // Basic negative
    'bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'frustrated', 'disappointed', 'horrible', 'worst',
    // Emotions & feelings
    'depressed', 'anxious', 'worried', 'stressed', 'overwhelmed', 'discouraged', 'hopeless', 'defeated',
    'miserable', 'upset', 'annoyed', 'irritated', 'furious', 'devastated', 'heartbroken', 'lonely',
    // Physical & mental state
    'tired', 'exhausted', 'weak', 'sick', 'injured', 'hurt', 'pain', 'painful', 'sore', 'aching',
    'drained', 'burnt out', 'burnout', 'fatigued', 'sluggish', 'unmotivated', 'lazy', 'lethargic',
    // Performance & setbacks
    'failed', 'failure', 'struggling', 'stuck', 'plateau', 'regression', 'setback',
    'underperformed', 'missed', 'skipped', 'quit', 'gave up', 'surrender', 'lost',
    // Mental challenges
    'confused', 'lost', 'uncertain', 'doubtful', 'insecure', 'self-doubt', 'imposter', 'inadequate',
    'worthless', 'useless', 'helpless', 'powerless',
    // Social & isolation
    'alone', 'isolated', 'unsupported', 'misunderstood', 'ignored', 'rejected', 'abandoned',
    // General negative
    'no', 'never', 'impossible', 'can\'t', 'won\'t', 'shouldn\'t', 'disaster', 'nightmare'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  let totalWords = 0;
  let matchedWords = [];
  
  messages.forEach(message => {
    const words = message.toLowerCase().split(/\s+/);
    totalWords += words.length;
    
    words.forEach(word => {
      // Remove punctuation for better matching
      const cleanWord = word.replace(/[^\w]/g, '');
      
      if (positiveWords.includes(cleanWord)) {
        positiveCount++;
        matchedWords.push({ word: cleanWord, type: 'positive' });
      }
      if (negativeWords.includes(cleanWord)) {
        negativeCount++;
        matchedWords.push({ word: cleanWord, type: 'negative' });
      }
    });
  });
  
  if (totalWords === 0) {
    return {
      sentimentScore: 0,
      confidence: 0,
      details: { reason: 'No words to analyze' }
    };
  }
  
  // Calculate sentiment score
  const sentimentRatio = (positiveCount - negativeCount) / totalWords;
  const sentimentScore = Math.max(-1, Math.min(1, sentimentRatio * 10));
  
  // Calculate confidence based on matched words vs total words
  const matchedRatio = (positiveCount + negativeCount) / totalWords;
  const confidence = Math.min(1, matchedRatio * 5); // Scale confidence
  
  return {
    sentimentScore,
    confidence,
    details: {
      positiveCount,
      negativeCount,
      totalWords,
      matchedWords: matchedWords.slice(0, 10), // Limit for response size
      sentimentRatio
    }
  };
}
