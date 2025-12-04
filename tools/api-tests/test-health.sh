#!/bin/bash
# Test Health Check Endpoint

BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"

echo "Testing Health Check at $BACKEND_URL"
echo "====================================="

curl -s "$BACKEND_URL/health" | python3 -m json.tool

echo ""
echo "Test complete."
