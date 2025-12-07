# Version Control Workflow Guide

## ✅ What's Already Set Up

- ✅ Git repository initialized
- ✅ Initial commit made with all your code
- ✅ `.gitignore` configured (excludes `node_modules`, `.expo`, `.env*.local`, etc.)
- ✅ `.env.example` template created (for sharing environment variable structure)

## 🚀 Next Steps: Complete GitHub Setup

### Step 1: Install GitHub CLI

Choose one method:

**Option A - Homebrew (easiest if you have it):**
```bash
brew install gh
```

**Option B - Official Installer:**
1. Visit https://cli.github.com/
2. Download the macOS installer
3. Run the installer package

**Option C - Manual Download:**
1. Go to https://github.com/cli/cli/releases/latest
2. Download `gh_*_macOS_amd64.tar.gz`
3. Extract and move the `gh` binary to your PATH

### Step 2: Run the Setup Script

Once GitHub CLI is installed, run:
```bash
cd /Users/joshr/Documents/SleepFactor
./setup-github.sh
```

This script will:
- Check if GitHub CLI is installed
- Authenticate you with GitHub (if needed)
- Create your repository on GitHub (public or private)
- Push your code to GitHub

### Alternative: Manual Setup

If you prefer to do it manually:

```bash
# 1. Authenticate with GitHub
gh auth login

# 2. Create repository (public)
gh repo create SleepFactor --public --source=. --remote=origin --push

# Or create private repository
gh repo create SleepFactor --private --source=. --remote=origin --push
```

## 📋 Your Workflow Going Forward

### Creating a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

**Examples:**
- `feature/add-new-screen`
- `feature/improve-auth-flow`
- `fix/login-bug`

### Making Changes
1. Make your changes in Cursor
2. Test with `npm start` or `expo start`
3. When ready, commit:
```bash
git add .
git commit -m "Description of what you changed"
git push origin feature/your-feature-name
```

### Merging to Main (Stable Branch)

**Option 1: Using Pull Requests (Recommended)**
1. Push your branch: `git push origin feature/your-feature-name`
2. Go to your GitHub repository
3. Create a Pull Request
4. Review the changes
5. Merge when satisfied

**Option 2: Merge Locally**
```bash
# Switch to main branch
git checkout main

# Get latest changes
git pull

# Merge your feature
git merge feature/your-feature-name

# Push to GitHub
git push

# Delete local feature branch (optional)
git branch -d feature/your-feature-name
```

## 🔒 Important Reminders

- **Never commit `.env.local`** - It contains your secrets and is already in `.gitignore`
- **Use `.env.example`** - Update it when you add new environment variables
- **Test before merging** - Make sure everything works on your feature branch before merging to `main`
- **Commit often** - Small, frequent commits are better than large ones

## 📁 Branch Naming Convention

- `feature/` - New features (e.g., `feature/new-screen`)
- `fix/` - Bug fixes (e.g., `fix/auth-bug`)
- `test/` - Experimental/testing branches
- `main` - Your stable, production-ready code

## 🆘 Troubleshooting

**If you get "gh: command not found":**
- Make sure GitHub CLI is installed
- Restart your terminal
- Check if it's in your PATH: `echo $PATH`

**If git asks for credentials:**
- Use GitHub CLI: `gh auth login`
- Or set up SSH keys for GitHub

**If you need to update your git identity:**
```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

---

**Your repository is ready!** Just install GitHub CLI and run the setup script to connect it to GitHub.

