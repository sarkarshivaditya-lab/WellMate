const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

// Initialize AJV
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

// Cache for compiled schemas
const schemaCache = {};

/**
 * Load and cache a JSON schema
 * @param {string} schemaName - Name of schema file (without .json extension)
 * @returns {Object} JSON schema object
 */
function loadSchema(schemaName) {
  if (schemaCache[schemaName]) {
    return schemaCache[schemaName];
  }

  const schemaPath = path.join(__dirname, '../schemas', `${schemaName}.schema.json`);
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found: ${schemaName}`);
  }

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaContent);
  
  schemaCache[schemaName] = schema;
  return schema;
}

/**
 * Validate data against a schema
 * @param {Object} data - Data to validate
 * @param {string} schemaName - Name of schema to validate against
 * @returns {boolean} True if valid
 */
function validateSchema(data, schemaName) {
  try {
    const schema = loadSchema(schemaName);
    const validate = ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      console.error(`Schema validation failed for ${schemaName}:`, validate.errors);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Schema validation error for ${schemaName}:`, error.message);
    return false;
  }
}

module.exports = {
  loadSchema,
  validateSchema
};
