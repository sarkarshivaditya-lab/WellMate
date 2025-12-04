#!/bin/bash
# Test Mental AI Coach Endpoint

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "Testing Mental AI Coach at $BACKEND_URL"
echo "========================================"

curl -X POST "$BACKEND_URL/api/ai/mental-coach" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I am feeling really stressed about work and cannot sleep",
    "moodHistory": [
      {
        "mood": "anxious",
        "tags": ["work", "sleep"],
        "timestamp": "2025-12-04T10:00:00Z"
      },
      {
        "mood": "stressed",
        "tags": ["work"],
        "timestamp": "2025-12-03T14:00:00Z"
      }
    ],
    "journalSummary": "User has been experiencing work-related stress for the past week. Mentions difficulty sleeping and feeling overwhelmed."
  }' | python3 -m json.tool

echo ""
echo "Test complete."
