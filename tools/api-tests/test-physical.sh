#!/bin/bash
# Test Physical AI Coach Endpoint

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "Testing Physical AI Coach at $BACKEND_URL"
echo "=========================================="

curl -X POST "$BACKEND_URL/api/ai/physical-coach" \
  -H "Content-Type: application/json" \
  -d '{
    "userProfile": {
      "age": 30,
      "biologicalSex": "male",
      "activityLevel": "moderate",
      "primaryGoal": "lose_weight",
      "height": 180,
      "weight": 85,
      "nutritionTargets": {
        "bmr": 1800,
        "tdee": 2500,
        "targetCalories": 2000,
        "macros": {
          "protein": 150,
          "carbs": 200,
          "fat": 65
        }
      }
    },
    "message": "I want to lose weight but I hate running. What exercises can I do?",
    "context": {
      "recentMeals": [
        {
          "type": "breakfast",
          "totalCalories": 450
        }
      ],
      "recentExercises": []
    }
  }' | python3 -m json.tool

echo ""
echo "Test complete."
