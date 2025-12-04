/**
 * AI Routes Tests (with mocked OpenAI)
 */

const request = require('supertest');
const express = require('express');
const aiPhysicalRoutes = require('../routes/aiPhysical');
const aiMentalRoutes = require('../routes/aiMental');

// Mock the aiClient
jest.mock('../services/aiClient', () => ({
  chat: jest.fn(),
}));

const aiClient = require('../services/aiClient');

describe('AI Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiPhysicalRoutes);
    app.use('/api/ai', aiMentalRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/ai/physical-coach', () => {
    test('returns 400 if missing required fields', async () => {
      const response = await request(app)
        .post('/api/ai/physical-coach')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('returns valid response when AI succeeds', async () => {
      const mockResponse = {
        advice_text: 'Mock advice',
        type: 'diet',
        nutrition: {
          calories: 2000,
          protein_g: 150,
          fat_g: 65,
          carbs_g: 200,
        },
        plan: [],
        escalation: false,
        confidence: 'high',
        explainability: 'Mock explanation',
      };

      aiClient.chat.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/ai/physical-coach')
        .send({
          userProfile: {
            age: 30,
            biologicalSex: 'male',
            activityLevel: 'moderate',
            primaryGoal: 'lose_weight',
            nutritionTargets: {
              bmr: 1800,
              tdee: 2500,
              targetCalories: 2000,
              macros: { protein: 150, carbs: 200, fat: 65 },
            },
          },
          message: 'Test message',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('advice_text');
      expect(aiClient.chat).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/ai/mental-coach', () => {
    test('returns 400 if missing message', async () => {
      const response = await request(app)
        .post('/api/ai/mental-coach')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    test('returns valid response when AI succeeds', async () => {
      const mockResponse = {
        summary: 'Mock summary',
        emotion: 'calm',
        suggestions: ['Suggestion 1'],
        practice: {
          id: 'box-breathing',
          title: 'Box Breathing',
          steps: ['Step 1'],
        },
        escalation: false,
        confidence: 'medium',
      };

      aiClient.chat.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/ai/mental-coach')
        .send({
          message: 'I feel stressed',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(aiClient.chat).toHaveBeenCalledTimes(1);
    });
  });
});
