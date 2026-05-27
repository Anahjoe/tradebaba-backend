# Tradebaba.ng Backend - Complete Setup Guide

Your 1-month roadmap to launch! 🚀

## Phase 0: Prerequisites (Today - 2 hours)

### 1.1 Create Paystack Account

**Time:** 15 mins

1. Go to https://paystack.com
2. Sign up (choose "Nigeria")
3. Complete email verification
4. Complete KYC verification (business details)
5. Go to Settings → API Keys
6. Copy **Public Key** and **Secret Key**
7. Switch to **Test Mode** for development

**Save:** Your Paystack keys in a secure place

### 1.2 Create Cloudinary Account

**Time:** 10 mins

1. Go to https://cloudinary.com
2. Sign up (free account works)
3. Go to Dashboard
4. Copy **Cloud Name**, **API Key**, **API Secret**

**Save:** Your Cloudinary credentials

### 1.3 Gmail App Password

**Time:** 10 mins

1. Enable 2-Factor Authentication on Gmail
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Generate App Password
5. Copy the 16-character password

**Save:** Your Gmail app password

### 1.4 Generate JWT Secret

**Time:** 5 mins

```bash
# On Mac/Linux
openssl rand -base64 32

# Or use this online tool: https://www.uuidgenerator.net/
```

Copy the output - this is your JWT_SECRET

---

## Phase 1: Local Development (Week 1)

### 2.1 Install Prerequisites

```bash
# Check if you have Node.js (v14+)
node --version

# Check if you have npm
npm --version

# If not, download from https://nodejs.org (LTS version)

# Install PostgreSQL
# Mac: brew install postgresql
# Windows: https://www.postgresql.org/download/windows/
# Linux: sudo apt-get install postgresql

# Verify PostgreSQL
psql --version
```

### 2.2 Create Database

```bash
# Start PostgreSQL
# Mac/Linux
pg_ctl -D /usr/local/var/postgres start

# Create database
createdb tradebaba_db

# Verify
psql tradebaba_db -c "SELECT 1"
```

### 2.3 Clone & Setup Project

```bash
# Navigate to your projects folder
cd ~/projects

# Clone the backend
git clone https://github.com/Anahjoe/tradebaba-backend.git
cd tradebaba-backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

### 2.4 Configure .env

Edit `.env` with your actual values:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=tradebaba_db

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT (use the value you generated earlier)
JWT_SECRET=your_generated_jwt_secret

# Paystack (from step 1.1)
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxx

# Cloudinary (from step 1.2)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email (from step 1.3)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password_16_chars

# Admin (you'll set this later with your user ID)
ADMIN_USERS=your_user_id_here
```

### 2.5 Initialize Database

```bash
# Run migrations
psql -U postgres -d tradebaba_db -a -f init.sql

# Verify tables created
psql tradebaba_db -c "\dt"
```

### 2.6 Start Server

```bash
# Development mode (with auto-restart)
npm run dev

# Expected output:
# 🚀 Tradebaba.ng API running on port 5000
# Environment: development
# ✅ Database connected: 2024-01-XX...
```

✅ **Success!** Your backend is running locally at `http://localhost:5000`

### 2.7 Test the API

**Health Check:**
```bash
curl http://localhost:5000/health
# Response: {"status":"OK","message":"Tradebaba.ng API is running"}
```

**Register User:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "phone": "+2348012345678",
    "password": "Password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Get Categories:**
```bash
curl http://localhost:5000/api/listings/categories
```

---

## Phase 2: Deploy to Railway (Week 2)

### 3.1 Create GitHub Repository

```bash
# In your project folder
git init
git add .
git commit -m "Initial commit: Tradebaba backend"

# Create repo on GitHub (https://github.com/new)
# Then push
git remote add origin https://github.com/Anahjoe/tradebaba-backend.git
git branch -M main
git push -u origin main
```

### 3.2 Deploy to Railway

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Authorize and select `tradebaba-backend` repo
6. Railway auto-detects Node.js ✅
7. Click "Deploy"

### 3.3 Add PostgreSQL

1. In Railway dashboard, click "+ Create"
2. Search for "PostgreSQL"
3. Click "PostgreSQL"
4. Railway creates DB automatically
5. Copy the DATABASE_URL

### 3.4 Set Environment Variables

In Railway project settings:

```
DB_HOST=[from DATABASE_URL]
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=[from DATABASE_URL]
DB_NAME=railway

PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com

JWT_SECRET=your_jwt_secret
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
EMAIL_USER=support@tradebaba.ng
EMAIL_PASSWORD=xxx

ADMIN_USERS=your_admin_user_id
```

### 3.5 Initialize Railway Database

```bash
# SSH into Railway container OR
# Run migrations through Railway CLI

# Download Railway CLI
npm i -g @railway/cli

# Login
railway login

# Connect to project
railway link

# Run migrations
railway run "psql -U postgres -d railroad -a -f init.sql"
```

### 3.6 Deploy

Push changes and Railway auto-deploys:

```bash
git push origin main
```

✅ Your API is live! Check Railway dashboard for public URL

---

## Phase 3: Create Admin Account (Week 2)

### 4.1 Register as Admin

1. Call `/api/auth/register` with your email/phone
2. Verify email
3. Get your user ID from the response

### 4.2 Set Admin Role

Update `.env` on Railway:
```
ADMIN_USERS=your_user_id_here
```

Push to deploy.

---

## Phase 4: Frontend Integration (Week 3-4)

Create a React/Next.js frontend that calls these endpoints:

### Example: Login

```javascript
// Frontend code
const response = await fetch('https://api.tradebaba.ng/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});

const data = await response.json();
localStorage.setItem('token', data.token); // Save token for future requests
```

### Example: Create Listing

```javascript
// Make authenticated request
const response = await fetch('https://api.tradebaba.ng/api/listings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}` // Include token
  },
  body: JSON.stringify({
    title: 'iPhone 13',
    description: 'Good condition',
    categoryId: 'electronics-category-id',
    price: 150000,
    condition: 'good',
    location: 'Lagos, Nigeria',
    images: [base64_image_data]
  })
});
```

---

## Troubleshooting

### PostgreSQL Connection Failed

```bash
# Check if PostgreSQL is running
# Mac
brew services list

# Windows - check Services app

# Restart PostgreSQL
brew services restart postgresql
```

### Database Already Exists

```bash
# Drop and recreate
dropdb tradebaba_db
createdb tradebaba_db
psql -U postgres -d tradebaba_db -a -f init.sql
```

### Port 5000 Already in Use

```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or change PORT in .env to 5001
```

### Email Not Sending

- Check EMAIL_USER and EMAIL_PASSWORD in .env
- Make sure Gmail App Password is correct (16 chars)
- Check if Gmail 2FA is enabled

### Paystack Integration Not Working

- Ensure you're in TEST mode for development
- Use test card: 4111111111111111
- Check PAYSTACK_SECRET_KEY in .env

---

## Next Steps After Launch

1. **Setup SSL Certificate** for Railway (auto-provided)
2. **Add Rate Limiting** to prevent abuse
3. **Setup Monitoring** (Railway provides it)
4. **Add Email Templates** for better notifications
5. **Implement SMS Verification** via Termii
6. **Setup Automated Backups** for PostgreSQL
7. **Configure CDN** for image delivery

---

## Checklist to Launch

- [ ] Paystack account created
- [ ] Cloudinary account created
- [ ] Gmail app password generated
- [ ] Local database working
- [ ] Local API running (npm run dev)
- [ ] Backend deployed to Railway
- [ ] Admin account created
- [ ] Environment variables set in Railway
- [ ] Frontend calling API endpoints
- [ ] Payment flow tested
- [ ] Messaging working
- [ ] Dispute system working

---

## Support Contacts

- **Paystack Support:** https://paystack.com/support
- **Railway Support:** https://railway.app/support
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **Your Email:** support@tradebaba.ng

---

**Estimated Timeline:**
- Day 1-2: Setup & configuration
- Day 3-5: Local testing
- Day 6-7: Deploy to Railway
- Week 2-4: Frontend & integration

**Total Time to MVP:** 1 month ✅

Good luck! 🚀
