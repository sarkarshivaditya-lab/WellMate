#!/bin/bash
# Switch from real backend to mock adapter

echo "Switching to Mock Adapter"
echo "========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Run ./scripts/setup-env.sh first"
    exit 1
fi

# Update VITE_DEV_MODE to true
if grep -q "VITE_DEV_MODE=false" .env; then
    sed -i.bak 's/VITE_DEV_MODE=false/VITE_DEV_MODE=true/' .env
    echo "✓ Set VITE_DEV_MODE=true"
else
    echo "✓ Already using mock adapter"
fi

echo ""
echo "✅ Adapter switched to MockServerAdapter"
echo ""
echo "This mode uses local mock responses - no backend required!"
echo ""
echo "Restart your frontend dev server for changes to take effect:"
echo "  npm run dev"
