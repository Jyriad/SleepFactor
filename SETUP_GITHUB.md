# GitHub Version Control Setup Guide

This guide will help you complete the GitHub CLI installation and repository setup.

## Step 1: Install GitHub CLI

You have a few options for macOS:

### Option A: Using Homebrew (Recommended)
```bash
brew install gh
```

### Option B: Using Official Installer
1. Visit: https://cli.github.com/
2. Download the macOS installer
3. Run the installer package

### Option C: Using the Official Script
Run this command in your terminal (it will prompt for your password):
```bash
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh -y
```

After installation, verify it works:
```bash
gh --version
```

## Step 2: Set Up Git Email (if not already set)

```bash
git config --global user.email "your-email@example.com"
```

## Step 3: Authenticate with GitHub

```bash
gh auth login
```

This will:
1. Prompt you to choose GitHub.com or GitHub Enterprise
2. Ask for your preferred protocol (HTTPS or SSH)
3. Authenticate via web browser or token

## Step 4: Create Repository on GitHub

Once authenticated, run this from your project directory:

```bash
cd /Users/joshr/Documents/SleepFactor
gh repo create SleepFactor --public --source=. --remote=origin --push
```

Or if you want a private repository:
```bash
gh repo create SleepFactor --private --source=. --remote=origin --push
```

## Step 5: Make Initial Commit (if not done)

```bash
cd /Users/joshr/Documents/SleepFactor
git add .
git commit -m "Initial commit: SleepFactor Expo app"
git push -u origin main
```

## Your Workflow Going Forward

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test:**
   - Edit files in Cursor
   - Test with `npm start` or `expo start`

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin feature/your-feature-name
   ```

4. **Merge to main when ready:**
   - Create a Pull Request on GitHub, or
   - Merge locally: `git checkout main && git merge feature/your-feature-name && git push`

## Branch Naming Convention

- `feature/` - New features (e.g., `feature/new-screen`)
- `fix/` - Bug fixes (e.g., `fix/auth-bug`)
- `test/` - Experimental/testing branches

---

**Note:** Your `.env.local` file (with secrets) is already in `.gitignore` and won't be committed. Use `.env.example` as a template for other developers.

