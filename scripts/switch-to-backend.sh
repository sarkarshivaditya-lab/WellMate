#!/bin/bash
# Switch from mock adapter to real backend

echo "Switching to Real Backend"
echo "========================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Run ./scripts/setup-env.sh first"
    exit 1
fi

# Update VITE_DEV_MODE to false
if grep -q "VITE_DEV_MODE=true" .env; then
    sed -i.bak 's/VITE_DEV_MODE=true/VITE_DEV_MODE=false/' .env
    echo "✓ Set VITE_DEV_MODE=false"
else
    echo "✓ Already using real backend"
fi

# Check VITE_BACKEND_URL
BACKEND_URL=$(grep "VITE_BACKEND_URL" .env | cut -d '=' -f2)
echo ""
echo "Backend URL: $BACKEND_URL"
echo ""
echo "⚠️  Make sure your backend is running at this URL!"
echo ""
echo "To start backend:"
echo "  cd backend-express-boilerplate"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "✅ Adapter switched to HttpServerAdapter"
echo ""
echo "Restart your frontend dev server for changes to take effect:"
echo "  npm run dev"
