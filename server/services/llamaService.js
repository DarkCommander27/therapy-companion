const axios = require('axios');
const logger = require('../utils/logger');

/**
 * LlamaService - Handles all communication with local Llama 3.1 model via Ollama
 * Supports both streaming and non-streaming responses
 * Manages model health, prompt building, and response validation
 */
class LlamaService {
  constructor() {
    this.apiUrl = process.env.LLAMA_API_URL || 'http://localhost:11434';
    this.model = process.env.LLAMA_MODEL || 'llama2:7b';
    this.timeout = parseInt(process.env.LLAMA_TIMEOUT || '30000');
    this.temperature = parseFloat(process.env.LLAMA_TEMPERATURE || '0.7');
    this.maxTokens = parseInt(process.env.LLAMA_MAX_TOKENS || '500');
    this.contextWindow = parseInt(process.env.LLAMA_CONTEXT_WINDOW || '2048');
    this.streamEnabled = process.env.LLAMA_STREAM === 'true';

    this.isHealthy = false;
    this.lastHealthCheck = null;
    this.responseTimeMs = 0;

    // Initialize health check
    this.healthCheck();
  }

  /**
   * Verify Llama model is running and responsive
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.apiUrl}/api/tags`, {
        timeout: 5000,
      });

      this.responseTimeMs = Date.now() - startTime;
      this.isHealthy = response.status === 200 && response.data.models?.length > 0;
      this.lastHealthCheck = new Date();

      if (this.isHealthy) {
        logger.info(`✓ Llama model healthy - ${this.model} available`);
      } else {
        logger.warn('Llama model health check failed - no models available');
      }

      return this.isHealthy;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      logger.error(`Llama health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if model is available
   */
  isModelAvailable() {
    // Recheck health every 60 seconds
    if (!this.lastHealthCheck || Date.now() - this.lastHealthCheck > 60000) {
      this.healthCheck();
    }
    return this.isHealthy;
  }

  /**
   * Build system prompt for companion behavior
   */
  buildSystemPrompt() {
    return `You are CareBridge Companion, a compassionate and supportive AI chatbot designed specifically to help young people in foster care, group homes, and residential treatment programs.

## Your Purpose
Provide emotional support, validation, and encouragement to youth in out-of-home care. Listen without judgment and help them process their feelings and experiences.

## Core Values
- **Unconditional positive regard**: Accept youth as they are, without judgment
- **Empathy**: Deeply understand and validate their feelings
- **Respect**: Honor their autonomy, identity, and cultural background
- **Safety**: Prioritize their wellbeing above all else
- **Authenticity**: Be genuine, warm, and real in your responses

## Communication Guidelines
1. **Be concise**: Keep responses 2-3 sentences max
2. **Validate feelings**: Always acknowledge what they're experiencing
3. **Use their language**: Match their emotional tone and vocabulary
4. **Ask thoughtful questions**: Help them reflect and explore
5. **Offer hope**: Balance acknowledgment with gentle encouragement

## What You SHOULD Do
- Listen actively and show you understand
- Ask clarifying questions about their feelings
- Normalize their experiences (many youth feel similar ways)
- Suggest healthy coping strategies (talking to staff, journaling, exercise)
- Celebrate small wins and progress
- Encourage connection with trusted adults

## What You Should NEVER Do
- Diagnose mental health conditions
- Prescribe medications or treatments
- Provide therapy (that's for licensed clinicians)
- Make promises about outcomes
- Dismiss or minimize their concerns
- Share personal problems (keep boundaries)
- Engage in romantic or inappropriate conversation

## Critical Safety Guide
If youth mentions any of these, ALWAYS respond with care AND encourage them to speak with a staff member:

**CRITICAL (immediate):**
- Thoughts of hurting themselves or suicide
- Plans to run away
- Being hurt by others (abuse, violence)
- Trafficking or sexual exploitation concerns
- Substance use/overdose risks
- Medical emergencies

**HIGH PRIORITY:**
- Extreme hopelessness or despair
- Severe isolation or loneliness
- Feeling unsafe at facility
- Serious family trauma memories
- Crisis flashbacks or dissociation

**MEDIUM PRIORITY:**
- School/educational struggles
- Peer conflicts or bullying
- Food insecurity concerns
- Identity/cultural disconnection
- Homesickness or grief

## Response Format
Always structure your response as:
1. **Validation**: Acknowledge their feelings
2. **Exploration**: Ask a gentle question or offer perspective
3. **Support**: Suggest something helpful

Example:
"That sounds really tough, and your feelings make total sense. [Question] Remember, you're not alone in feeling this way - lots of people experience [experience]. Talking to [staff member] might help too."

## Important Reminders
- You have limitations - be honest about them
- You're a tool to helps, not a replacement for human connection
- Their relationship with staff matters most
- Youth deserve dignity, respect, and hope
- Every conversation matters - they're being heard

Remember: Your job isn't to fix everything. It's to listen, validate, and help them connect with the support they need.`;
  }

  /**
   * Build context from conversation history
   */
  buildContextFromHistory(history) {
    if (!history || history.length === 0) {
      return '';
    }

    return history
      .map((msg) => {
        const role = msg.role === 'user' ? 'Youth' : 'Companion';
        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Generate response with streaming support
   * Returns either streamed chunks or full response
   */
  async generateResponse(userMessage, contextHistory = [], onChunk = null) {
    try {
      logger.info(`Generating response for user message: "${userMessage.substring(0, 50)}..."`);

      // Validate input
      if (!userMessage || userMessage.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      if (userMessage.length > 2000) {
        throw new Error('Message too long (max 2000 characters)');
      }

      // Build full prompt
      const systemPrompt = this.buildSystemPrompt();
      const contextStr = this.buildContextFromHistory(contextHistory);

      let fullPrompt = systemPrompt;
      if (contextStr) {
        fullPrompt += `\n\n## Previous Conversation\n${contextStr}`;
      }
      fullPrompt += `\n\nYouth: ${userMessage}\n\nCompanion:`;

      const startTime = Date.now();

      // Check if we should use streaming
      if (this.streamEnabled && onChunk) {
        return await this.generateWithStreaming(fullPrompt, onChunk, startTime);
      } else {
        return await this.generateWithoutStreaming(fullPrompt, startTime);
      }
    } catch (error) {
      logger.error(`Error generating response: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate response with streaming
   * Yields chunks as they arrive from Llama
   */
  async generateWithStreaming(prompt, onChunk, startTime) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: true,
          temperature: this.temperature,
          num_predict: this.maxTokens,
          num_ctx: this.contextWindow,
        },
        {
          timeout: this.timeout,
          responseType: 'stream',
        }
      );

      let fullResponse = '';
      let tokenCount = 0;

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          try {
            // Parse streaming JSON chunks
            const lines = chunk.toString().split('\n').filter((line) => line.trim());

            lines.forEach((line) => {
              try {
                const json = JSON.parse(line);
                if (json.response) {
                  fullResponse += json.response;
                  tokenCount += 1;

                  // Call callback with chunk
                  if (onChunk) {
                    onChunk({
                      chunk: json.response,
                      fullResponse: fullResponse,
                      isDone: json.done || false,
                      tokenCount: tokenCount,
                    });
                  }
                }

                if (json.done) {
                  const processingTime = Date.now() - startTime;
                  logger.info(
                    `Streaming response complete - ${tokenCount} tokens in ${processingTime}ms`
                  );

                  resolve({
                    response: fullResponse.trim(),
                    tokenCount,
                    processingTimeMs: processingTime,
                    isStreamed: true,
                  });
                }
              } catch (parseError) {
                // Skip unparseable lines
              }
            });
          } catch (error) {
            reject(error);
          }
        });

        response.data.on('error', (error) => {
          logger.error(`Stream error: ${error.message}`);
          reject(error);
        });
      });
    } catch (error) {
      logger.error(`Streaming generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate response without streaming
   * Waits for complete response
   */
  async generateWithoutStreaming(prompt, startTime) {
    try {
      const response = await axios.post(
        `${this.apiUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          temperature: this.temperature,
          num_predict: this.maxTokens,
          num_ctx: this.contextWindow,
        },
        {
          timeout: this.timeout,
        }
      );

      const processingTime = Date.now() - startTime;
      const tokenCount = response.data.eval_count || 0;

      logger.info(
        `Response generated - ${tokenCount} tokens in ${processingTime}ms`
      );

      return {
        response: response.data.response.trim(),
        tokenCount,
        processingTimeMs: processingTime,
        isStreamed: false,
      };
    } catch (error) {
      logger.error(`Non-streaming generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate response is safe and properly formatted
   */
  validateResponse(response) {
    if (!response || typeof response !== 'string') {
      return { isValid: false, error: 'Response is not a string' };
    }

    if (response.length === 0) {
      return { isValid: false, error: 'Empty response' };
    }

    if (response.length > 2000) {
      return { isValid: false, error: 'Response exceeds max length' };
    }

    // Check for obvious model failures or repetition
    if (response.includes('```') || response.includes('ERROR')) {
      return { isValid: false, error: 'Response contains code or errors' };
    }

    // Check for problematic patterns
    const repetitionPattern = /(.{20,})\1{2,}/;
    if (repetitionPattern.test(response)) {
      return { isValid: false, error: 'Response contains excessive repetition' };
    }

    return { isValid: true };
  }

  /**
   * Extract youth's mood from message
   * Uses heuristics and keywords to detect emotional state
   */
  extractMood(message) {
    const messageLower = message.toLowerCase();

    // Mood keywords mapping
    const moodKeywords = {
      happy: ['happy', 'great', 'wonderful', 'amazing', 'excited', 'love', 'awesome'],
      sad: ['sad', 'depressed', 'crying', 'tears', 'down', 'awful', 'terrible', 'miss'],
      angry: ['angry', 'furious', 'hate', 'mad', 'frustrated', 'rage', 'irritated'],
      anxious: ['anxious', 'worried', 'nervous', 'scared', 'afraid', 'panic', 'stress'],
      hopeful: ['hopeful', 'better', 'improving', 'proud', 'strength', 'trying'],
      desperate: ['suicide', 'kill', 'dead', 'hopeless', 'giving up', 'can\'t'],
    };

    let detectedMoods = {};

    Object.entries(moodKeywords).forEach(([mood, keywords]) => {
      const matchCount = keywords.filter((kw) => messageLower.includes(kw)).length;
      if (matchCount > 0) {
        detectedMoods[mood] = matchCount;
      }
    });

    // Find dominant mood
    if (Object.keys(detectedMoods).length === 0) {
      return { mood: 'neutral', score: 0.5 };
    }

    const topMood = Object.entries(detectedMoods).sort((a, b) => b[1] - a[1])[0];
    const score = Math.min(topMood[1] / 3, 1.0); // Normalize to 0-1

    return {
      mood: topMood[0],
      score: score,
    };
  }

  /**
   * Detect safety flags in message
   * Critical for identifying at-risk youth
   */
  detectSafetyFlags(message) {
    const messageLower = message.toLowerCase();

    const flagPatterns = {
      'self-harm-mention': ['hurt myself', 'cut', 'harm', 'self harm', 'sl', 'self-injure'],
      'suicide-ideation': ['kill myself', 'suicide', 'die', 'end it', 'not worth', 'better off dead'],
      'abuse-mention': ['hit', 'beat', 'abuse', 'rape', 'assault', 'punched', 'abused'],
      'exploitation-concern': ['touched me', 'sexual', 'inappropriate', 'grooming', 'trafficked'],
      'substance-use': ['high', 'drunk', 'drugs', 'smoking', 'drinking', 'weed', 'pills'],
      'violence-mention': ['fight', 'violence', 'violent', 'hit someone', 'punched'],
      'trafficking-indicator': ['can\'t leave', 'forced', 'controlled', 'debt', 'trapped'],
      'extreme-distress': ['can\'t take it', 'lose it', 'breaking down', 'falling apart'],
    };

    const detectedFlags = [];
    let maxSeverity = 'low';

    Object.entries(flagPatterns).forEach(([flag, patterns]) => {
      const isDetected = patterns.some((pattern) => messageLower.includes(pattern));

      if (isDetected) {
        detectedFlags.push(flag);

        // Determine severity
        if (
          ['self-harm-mention', 'suicide-ideation', 'trafficking-indicator'].includes(flag)
        ) {
          maxSeverity = 'critical';
        } else if (['abuse-mention', 'exploitation-concern', 'extreme-distress'].includes(flag)) {
          maxSeverity = maxSeverity === 'critical' ? 'critical' : 'high';
        } else {
          maxSeverity = maxSeverity === 'critical' ? 'critical' : 'high';
        }
      }
    });

    return {
      detected: detectedFlags.length > 0,
      flags: detectedFlags,
      severity: detectedFlags.length > 0 ? maxSeverity : 'low',
    };
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      model: this.model,
      apiUrl: this.apiUrl,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      contextWindow: this.contextWindow,
      streamEnabled: this.streamEnabled,
      isHealthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      lastResponseTimeMs: this.responseTimeMs,
    };
  }
}

/**
 * Singleton instance
 */
const llamaService = new LlamaService();

module.exports = llamaService;
