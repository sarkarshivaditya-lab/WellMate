const OpenAI = require('openai');
const { loadSchema } = require('./schemaValidator');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Timeout constant (30 seconds)
const TIMEOUT_MS = 30000;

/**
 * Call OpenAI chat API with schema validation
 * @param {Object} options
 * @param {string} options.systemPrompt - System message
 * @param {string} options.userMessage - User message
 * @param {string} options.schema - Schema name ('aiPhysical' or 'aiMental')
 * @returns {Promise<Object>} Parsed JSON response
 */
async function chat({ systemPrompt, userMessage, schema }) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Load schema
    const schemaObj = loadSchema(schema);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Call OpenAI with structured output
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: `${schema}_response`,
            strict: true,
            schema: schemaObj
          }
        },
        temperature: 0.7,
        max_tokens: 2000,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    // Parse response
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    console.log(`AI ${schema} call successful - tokens: ${completion.usage?.total_tokens || 'unknown'}`);
    
    return parsed;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('OpenAI request timed out');
    }
    
    console.error(`AI ${schema} error:`, error.message);
    throw error;
  }
}

module.exports = {
  chat
};
