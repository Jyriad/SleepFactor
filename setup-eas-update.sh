#!/bin/bash

# EAS Update Setup and Development Workflow Script for SleepFactor
# This script helps set up EAS Update for instant development testing

set -e

echo "🚀 Setting up EAS Update for SleepFactor development..."
echo ""

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ EAS CLI is not installed."
    echo "Please install it first:"
    echo "  npm install -g @expo/eas-cli"
    echo ""
    exit 1
fi

echo "✅ EAS CLI found"
echo ""

# Check if logged in to EAS
if ! eas whoami &> /dev/null; then
    echo "🔐 Logging in to EAS..."
    eas login
else
    echo "✅ Already logged in to EAS"
fi

echo ""
echo "📱 Setting up EAS Update channels..."

# Create/update channels
echo "Creating development channel..."
eas channel:create development --branch development 2>/dev/null || echo "Development channel already exists or creation failed"

echo "Creating production channel..."
eas channel:create production --branch production 2>/dev/null || echo "Production channel already exists or creation failed"

echo ""
echo "✅ EAS Update channels configured!"
echo ""
echo "🎯 Development Workflow with EAS Update:"
echo ""
echo "  INSTANT DEVELOPMENT TESTING (instead of 10+ minute APK rebuilds):"
echo ""
echo "  1. Make code changes to your feature branch"
echo "  2. Test instantly with EAS Update:"
echo "     eas update --branch development"
echo ""
echo "  3. Your 'SleepFactor Dev' app will automatically update over-the-air!"
echo ""
echo "  PRODUCTION RELEASES:"
echo ""
echo "  1. Merge feature branch to main via Pull Request"
echo "  2. GitHub Actions will automatically build production APK"
echo "  3. Download and install the new production APK"
echo ""
echo "🔧 Useful EAS Update commands:"
echo ""
echo "  # Push instant update to development"
echo "  eas update --branch development"
echo ""
echo "  # Check update status"
echo "  eas update:list"
echo ""
echo "  # View available channels"
echo "  eas channel:list"
echo ""
echo "✨ EAS Update setup complete!"
echo ""
echo "💡 Next: Try making a small change and run 'eas update --branch development'"
