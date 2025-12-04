const express = require('express');
const router = express.Router();
const aiClient = require('../services/aiClient');
const { validateSchema } = require('../services/schemaValidator');

// POST /api/ai/mental-coach
router.post('/mental-coach', async (req, res, next) => {
  try {
    const { moodHistory, journalSummary, message } = req.body;

    // Validate required fields
    if (!message) {
      return res.status(400).json({
        error: 'Missing required field: message',
        code: 'BAD_REQUEST'
      });
    }

    // Build system prompt
    const systemPrompt = buildMentalSystemPrompt();

    // Build user message
    const userMessage = buildMentalUserMessage(message, moodHistory, journalSummary);

    // Call OpenAI
    const response = await aiClient.chat({
      systemPrompt,
      userMessage,
      schema: 'aiMental'
    });

    // Validate response against schema
    const isValid = validateSchema(response, 'aiMental');
    if (!isValid) {
      console.warn('AI response did not match schema, using fallback');
      return res.json(getFallbackMentalResponse());
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Helper: build system prompt
function buildMentalSystemPrompt() {
  return `You are a compassionate mental wellbeing coach trained in CBT, mindfulness, and positive psychology.

Guidelines:
1. Provide evidence-based mental health support
2. Be empathetic, validating, and non-judgmental
3. Suggest coping techniques, breathing exercises, or mindfulness practices
4. If user mentions self-harm, suicide, or severe distress, set safetyEscalation to true
5. Always respond in valid JSON matching the schema

IMPORTANT SAFETY RULES:
- If you detect crisis language, set safetyEscalation: true
- Crisis indicators: suicidal ideation, self-harm, severe depression, psychosis
- Your role is supportive, not therapeutic treatment

Respond ONLY with valid JSON. No markdown, no extra text.`;
}

// Helper: build user message
function buildMentalUserMessage(message, moodHistory, journalSummary) {
  let msg = `User question: ${message}`;
  
  if (moodHistory && moodHistory.length > 0) {
    const moods = moodHistory.slice(0, 5).map(m => 
      `${m.mood} (${m.tags?.join(', ') || 'no tags'})`
    ).join(', ');
    msg += `\n\nRecent moods: ${moods}`;
  }
  
  if (journalSummary) {
    msg += `\n\nJournal summary: ${journalSummary}`;
  }
  
  return msg;
}

// Fallback response if AI fails
function getFallbackMentalResponse() {
  return {
    response: "Thank you for sharing. I'm here to support you. Could you tell me more about what you're experiencing?",
    copingTechniques: [
      {
        title: "Deep Breathing",
        description: "Try the 4-7-8 technique: breathe in for 4, hold for 7, exhale for 8.",
        duration: "5 minutes"
      }
    ],
    practiceRecommendations: [],
    moodInsights: "I notice you're reaching out for support, which is a positive step.",
    explanation: "Generic fallback response due to AI unavailability.",
    confidence: 0.3,
    safetyEscalation: false
  };
}

module.exports = router;
