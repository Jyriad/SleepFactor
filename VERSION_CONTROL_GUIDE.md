
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

