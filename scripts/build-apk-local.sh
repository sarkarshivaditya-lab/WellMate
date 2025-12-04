#!/bin/bash
# Local Android APK Build Script
# 
# Prerequisites:
# - Node.js 18+
# - Android SDK installed
# - ANDROID_HOME environment variable set
# - Gradle configured

set -e

echo "🚀 WellMate Local APK Build"
echo "============================"

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

if [ -z "$ANDROID_HOME" ]; then
    echo "❌ ANDROID_HOME not set. Please configure Android SDK"
    exit 1
fi

echo "✓ Node.js: $(node --version)"
echo "✓ ANDROID_HOME: $ANDROID_HOME"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Step 2: Build web app
echo "🔨 Building web app..."
npm run build:web

# Step 3: Copy to Capacitor
echo "📋 Copying to Capacitor Android..."
npx cap copy android

# Step 4: Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync android

# Step 5: Build APK
echo "🏗️  Building debug APK..."
cd android
chmod +x gradlew
./gradlew assembleDebug
cd ..

# Output location
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

if [ -f "$APK_PATH" ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📱 APK location: $APK_PATH"
    echo ""
    echo "File size: $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "Install on device:"
    echo "  adb install $APK_PATH"
else
    echo "❌ Build failed - APK not found"
    exit 1
fi
