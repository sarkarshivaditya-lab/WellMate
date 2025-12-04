const express = require('express');
const router = express.Router();
const aiClient = require('../services/aiClient');
const { validateSchema } = require('../services/schemaValidator');

// POST /api/ai/physical-coach
router.post('/physical-coach', async (req, res, next) => {
  try {
    const { userProfile, message, context } = req.body;

    // Validate required fields
    if (!userProfile || !message) {
      return res.status(400).json({
        error: 'Missing required fields: userProfile and message',
        code: 'BAD_REQUEST'
      });
    }

    // Build system prompt
    const systemPrompt = buildPhysicalSystemPrompt(userProfile);

    // Build user message
    const userMessage = buildPhysicalUserMessage(userProfile, message, context);

    // Call OpenAI
    const response = await aiClient.chat({
      systemPrompt,
      userMessage,
      schema: 'aiPhysical'
    });

    // Validate response against schema
    const isValid = validateSchema(response, 'aiPhysical');
    if (!isValid) {
      console.warn('AI response did not match schema, using fallback');
      return res.json(getFallbackPhysicalResponse());
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Helper: build system prompt
function buildPhysicalSystemPrompt(profile) {
  const { bmr, tdee, targetCalories, macros } = profile.nutritionTargets || {};
  
  return `You are a certified physical wellbeing coach specializing in nutrition and exercise.

User Context:
- Age: ${profile.age}, Sex: ${profile.biologicalSex}, Activity: ${profile.activityLevel}
- Goal: ${profile.primaryGoal}
- BMR: ${bmr} kcal/day, TDEE: ${tdee} kcal/day
- Target: ${targetCalories} kcal/day
- Macros: Protein ${macros?.protein || 0}g, Carbs ${macros?.carbs || 0}g, Fat ${macros?.fat || 0}g

Guidelines:
1. Provide evidence-based nutrition and exercise advice
2. Tailor recommendations to user's goals and activity level
3. Be supportive, motivating, and non-judgmental
4. If asked about medical conditions, recommend consulting a healthcare provider
5. Always respond in valid JSON matching the schema

Respond ONLY with valid JSON. No markdown, no extra text.`;
}

// Helper: build user message
function buildPhysicalUserMessage(profile, message, context) {
  let msg = `User question: ${message}`;
  
  if (context?.recentMeals?.length > 0) {
    const meals = context.recentMeals.slice(0, 3).map(m => 
      `${m.type}: ${m.totalCalories} kcal`
    ).join(', ');
    msg += `\n\nRecent meals: ${meals}`;
  }
  
  if (context?.recentExercises?.length > 0) {
    const exercises = context.recentExercises.slice(0, 3).map(e =>
      `${e.type}: ${e.caloriesBurned} kcal burned`
    ).join(', ');
    msg += `\n\nRecent exercises: ${exercises}`;
  }
  
  return msg;
}

// Fallback response if AI fails
function getFallbackPhysicalResponse() {
  return {
    response: "I'm here to help with your physical wellbeing! To give you the best advice, could you provide more details about your question?",
    nutritionTargets: {
      targetCalories: 2000,
      targetProteinG: 150,
      targetCarbsG: 200,
      targetFatG: 65
    },
    mealPlan: [],
    exerciseSuggestions: [],
    explanation: "Generic fallback response due to AI unavailability.",
    confidence: 0.3,
    safetyEscalation: false
  };
}

module.exports = router;
