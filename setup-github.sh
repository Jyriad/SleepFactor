#!/bin/bash

# GitHub Repository Setup Script for SleepFactor
# Run this after installing GitHub CLI

set -e

echo "🚀 Setting up GitHub repository for SleepFactor..."
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it first:"
    echo "  Option 1: brew install gh"
    echo "  Option 2: Visit https://cli.github.com/"
    echo ""
    exit 1
fi

echo "✅ GitHub CLI found"
echo ""

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔐 Authenticating with GitHub..."
    gh auth login
else
    echo "✅ Already authenticated with GitHub"
fi

echo ""

# Get repository visibility preference
read -p "Create public or private repository? (public/private) [default: public]: " visibility
visibility=${visibility:-public}

if [ "$visibility" != "private" ] && [ "$visibility" != "public" ]; then
    visibility="public"
fi

echo ""
echo "📦 Creating $visibility repository on GitHub..."

# Create repository and push
if gh repo create SleepFactor --$visibility --source=. --remote=origin --push 2>/dev/null; then
    echo ""
    echo "✅ Repository created and code pushed successfully!"
    echo ""
    echo "🌐 Your repository is available at:"
    gh repo view --web 2>/dev/null || echo "   https://github.com/$(gh api user --jq .login)/SleepFactor"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Create feature branches: git checkout -b feature/your-feature-name"
    echo "   2. Make changes and commit: git add . && git commit -m 'your message'"
    echo "   3. Push to branch: git push origin feature/your-feature-name"
    echo "   4. Create Pull Request on GitHub or merge locally when ready"
else
    echo ""
    echo "⚠️  Repository might already exist or there was an issue."
    echo "   Trying to add remote and push manually..."
    
    # Try to add remote if it doesn't exist
    if ! git remote get-url origin &> /dev/null; then
        gh repo create SleepFactor --$visibility --source=. --remote=origin 2>/dev/null || true
    fi
    
    # Push to main branch
    git branch -M main 2>/dev/null || true
    git push -u origin main || echo "   Please check your repository settings and try: git push -u origin main"
fi

echo ""
echo "✨ Setup complete!"

