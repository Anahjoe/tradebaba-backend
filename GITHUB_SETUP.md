# 🚀 Push Tradebaba Backend to GitHub

Your local Git repository is already initialized and ready to push! Follow these steps:

---

## Step 1: Create GitHub Repository

1. Go to **https://github.com/new**
2. Fill in details:
   - **Repository name:** `tradebaba-backend`
   - **Description:** Nigerian marketplace with Paystack escrow
   - **Visibility:** Public (or Private if you prefer)
   - **Initialize:** Leave unchecked (we already have code)
3. Click **"Create repository"**

---

## Step 2: Copy Your Repository URL

After creating, GitHub shows you a URL like:
```
https://github.com/Anahjoe/tradebaba-backend.git
```

Copy this URL (we'll use it in the next step)

---

## Step 3: Push to GitHub

Open terminal in the `tradebaba-backend` folder and run:

```bash
# Add GitHub remote
git remote add origin https://github.com/Anahjoe/tradebaba-backend.git

# Rename branch to main (GitHub default)
git branch -M main

# Push code to GitHub
git push -u origin main
```

**Replace the URL with YOUR repository URL from Step 2**

---

## Done! ✅

Your code is now on GitHub! You'll see:
- All 29 files uploaded
- Complete git history
- Ready for Railway deployment

---

## Next: Deploy to Railway

1. Go to **https://railway.app**
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Select `tradebaba-backend`
6. Railway auto-deploys!

---

## Verify It Worked

On GitHub, you should see:
- ✅ 29 files committed
- ✅ Commit message: "Initial commit: Tradebaba.ng..."
- ✅ All folders (controllers, routes, config, etc.)
- ✅ All documentation (SETUP_GUIDE.md, README.md, etc.)

---

## If You Get an Error

**"fatal: could not read Username"**
- GitHub changed their authentication
- Use **Personal Access Token** instead:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token"
3. Name it "tradebaba"
4. Select: `repo`, `read:repo_hook`
5. Click "Generate token"
6. Copy the token

Then use:
```bash
git remote set-url origin https://YOUR_TOKEN@github.com/Anahjoe/tradebaba-backend.git
git push -u origin main
```

---

## Update Code Later

After making changes:

```bash
# Stage changes
git add .

# Commit
git commit -m "Your message here"

# Push to GitHub
git push origin main
```

Railway will auto-deploy on every push!

---

**Congratulations! Your backend is on GitHub and ready to deploy!** 🎉
