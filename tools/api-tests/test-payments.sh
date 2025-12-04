#!/bin/bash
# Test Payment Endpoints

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
USER_ID="${USER_ID:-user_test_12345}"

echo "Testing Payment Endpoints at $BACKEND_URL"
echo "=========================================="

# 1. Create checkout session
echo ""
echo "1. Creating checkout session..."
SESSION_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/payments/create-checkout-session" \
  -H "Content-Type: application/json" \
  -d "{
    \"tier\": \"pro\",
    \"userId\": \"$USER_ID\"
  }")

echo "$SESSION_RESPONSE" | python3 -m json.tool

SESSION_ID=$(echo "$SESSION_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('sessionId', 'cs_test_mock'))")

# 2. Verify session
echo ""
echo "2. Verifying session: $SESSION_ID"
curl -s -X POST "$BACKEND_URL/api/payments/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userId\": \"$USER_ID\"
  }" | python3 -m json.tool

# 3. Get subscription
echo ""
echo "3. Fetching subscription for user: $USER_ID"
curl -s -X GET "$BACKEND_URL/api/payments/subscription/$USER_ID" | python3 -m json.tool

echo ""
echo "Test complete."
