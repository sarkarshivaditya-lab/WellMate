/**
 * Health Endpoint Tests
 */

const request = require('supertest');
const express = require('express');
const healthRoutes = require('../routes/health');

describe('Health Endpoint', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use('/health', healthRoutes);
  });

  test('GET /health returns 200 and status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  test('GET /health includes OpenAI status', async () => {
    const response = await request(app).get('/health');

    expect(response.body).toHaveProperty('openai');
    expect(typeof response.body.openai).toBe('boolean');
  });
});
