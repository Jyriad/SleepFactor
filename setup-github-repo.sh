#!/bin/bash

# GitHub Repository Configuration Script for SleepFactor
# This script sets up branch protection and other repository settings

set -e

echo "🔧 Configuring GitHub repository settings for SleepFactor..."
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it first:"
    echo "  brew install gh  # macOS"
    echo "  # Or visit: https://cli.github.com/"
    echo ""
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔐 Please authenticate with GitHub first:"
    gh auth login
fi

echo "✅ GitHub CLI ready"
echo ""

# Get current repository
REPO_NAME=$(gh repo view --json name -q .name 2>/dev/null || echo "")

if [ -z "$REPO_NAME" ]; then
    echo "❌ Could not determine repository name."
    echo "Make sure you're in a GitHub repository and have access to it."
    echo ""
    exit 1
fi

echo "📦 Configuring repository: $REPO_NAME"
echo ""

# Enable branch protection for main branch
echo "🔒 Setting up branch protection for main branch..."
echo "This prevents direct pushes to main and requires pull requests."

# Note: Branch protection setup requires repository admin access
# We'll provide instructions for manual setup since CLI might not have full permissions

cat << 'EOF'
🛡️  BRANCH PROTECTION SETUP REQUIRED:

Since branch protection requires admin access, please do this manually:

1. Go to your GitHub repository: https://github.com/YOUR_USERNAME/SleepFactor
2. Click "Settings" tab
3. Click "Branches" in the left sidebar
4. Click "Add branch protection rule"
5. Configure for branch "main":
   ✅ Require pull request reviews before merging
   ✅ Require status checks to pass before merging
   ✅ Include administrators
   ✅ Restrict pushes that create matching branches
   ✅ Require branches to be up to date before merging

This ensures all changes go through pull requests and CI checks pass.

EOF

echo ""
echo "🤖 GITHUB SECRETS SETUP REQUIRED:"
echo ""
echo "You need to add these secrets to your GitHub repository:"
echo ""
echo "1. EXPO_TOKEN:"
echo "   - Go to https://expo.dev/settings/access-tokens"
echo "   - Create a new access token"
echo "   - Add it as EXPO_TOKEN secret in GitHub"
echo ""
echo "2. The workflow will automatically create releases and build APKs"
echo ""

echo "📋 MANUAL SETUP CHECKLIST:"
echo ""
echo "□ Set up branch protection rules (see above)"
echo "□ Add EXPO_TOKEN secret to GitHub repository"
echo "□ Test the workflow by pushing to main or creating a PR"
echo ""

echo "✨ Repository configuration script complete!"
echo ""
echo "💡 Next steps:"
echo "   1. Complete the manual setup steps above"
echo "   2. Try creating a feature branch and opening a pull request"
echo "   3. The automated build system will handle production releases"
