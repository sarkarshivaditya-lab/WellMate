#!/bin/bash
# Setup environment variables for WellMate

echo "WellMate Environment Setup"
echo "=========================="
echo ""

# Create .env files if they don't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << 'EOF'
# WellMate Frontend Environment Variables

# Development mode (true = mock adapters, false = real backend)
VITE_DEV_MODE=true

# Backend URL (only used when DEV_MODE=false)
VITE_BACKEND_URL=http://localhost:3001

# Hercules Auth (do not modify)
VITE_HERCULES_OIDC_AUTHORITY=https://hercules.app
VITE_HERCULES_OIDC_CLIENT_ID=your_client_id_here
EOF
    echo "✓ Created .env"
else
    echo "✓ .env already exists"
fi

# Create backend .env if backend directory exists
if [ -d "backend-express-boilerplate" ] && [ ! -f "backend-express-boilerplate/.env" ]; then
    echo "Creating backend-express-boilerplate/.env file..."
    cat > backend-express-boilerplate/.env << 'EOF'
# WellMate Backend Environment Variables

# OpenAI API Key (required for AI features)
OPENAI_API_KEY=sk-proj-your_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS (frontend URL)
FRONTEND_URL=http://localhost:5173

# Stripe (future use - currently stubbed)
# STRIPE_SECRET_KEY=sk_test_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
EOF
    echo "✓ Created backend-express-boilerplate/.env"
else
    echo "✓ Backend .env already exists or backend not present"
fi

echo ""
echo "✅ Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your actual values"
echo "2. If using backend, update backend-express-boilerplate/.env with OpenAI key"
echo "3. Run 'npm install' to install dependencies"
echo "4. Run 'npm run dev' to start development server"
