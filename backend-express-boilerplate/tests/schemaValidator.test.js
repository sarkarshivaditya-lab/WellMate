/**
 * Schema Validator Tests
 */

const { validateSchema, loadSchema } = require('../services/schemaValidator');

describe('Schema Validator', () => {
  describe('aiPhysical schema', () => {
    test('validates correct physical AI response', () => {
      const validData = {
        advice_text: 'Test advice',
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
        explainability: 'Test explanation',
      };

      const isValid = validateSchema(validData, 'aiPhysical');
      expect(isValid).toBe(true);
    });

    test('rejects invalid physical AI response (missing required field)', () => {
      const invalidData = {
        advice_text: 'Test advice',
        type: 'diet',
        // Missing nutrition
        plan: [],
        escalation: false,
        confidence: 'high',
        explainability: 'Test explanation',
      };

      const isValid = validateSchema(invalidData, 'aiPhysical');
      expect(isValid).toBe(false);
    });

    test('rejects invalid confidence value', () => {
      const invalidData = {
        advice_text: 'Test advice',
        type: 'diet',
        nutrition: {
          calories: 2000,
          protein_g: 150,
          fat_g: 65,
          carbs_g: 200,
        },
        plan: [],
        escalation: false,
        confidence: 'invalid', // Should be low/medium/high
        explainability: 'Test explanation',
      };

      const isValid = validateSchema(invalidData, 'aiPhysical');
      expect(isValid).toBe(false);
    });
  });

  describe('aiMental schema', () => {
    test('validates correct mental AI response', () => {
      const validData = {
        summary: 'Test summary',
        emotion: 'calm',
        suggestions: ['Suggestion 1', 'Suggestion 2'],
        practice: {
          id: 'box-breathing',
          title: 'Box Breathing',
          steps: ['Step 1', 'Step 2'],
        },
        escalation: false,
        confidence: 'medium',
      };

      const isValid = validateSchema(validData, 'aiMental');
      expect(isValid).toBe(true);
    });

    test('rejects invalid mental AI response (missing required field)', () => {
      const invalidData = {
        summary: 'Test summary',
        emotion: 'calm',
        // Missing suggestions
        practice: {
          id: 'box-breathing',
          title: 'Box Breathing',
          steps: ['Step 1'],
        },
        escalation: false,
        confidence: 'medium',
      };

      const isValid = validateSchema(invalidData, 'aiMental');
      expect(isValid).toBe(false);
    });
  });

  describe('loadSchema', () => {
    test('loads aiPhysical schema successfully', () => {
      const schema = loadSchema('aiPhysical');
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('advice_text');
    });

    test('throws error for non-existent schema', () => {
      expect(() => loadSchema('nonExistent')).toThrow();
    });
  });
});
