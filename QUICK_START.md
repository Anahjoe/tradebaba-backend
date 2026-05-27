# Tradebaba.ng Backend - Quick Start

## What You Just Got 🎉

A **production-ready Node.js backend** with:

✅ **30+ REST API endpoints**
✅ **Complete payment escrow system** (Paystack)
✅ **User verification & ratings**
✅ **Buyer-seller messaging**
✅ **Dispute resolution**
✅ **Admin dashboard APIs**
✅ **PostgreSQL database schema**
✅ **Email verification**
✅ **Image uploads** (Cloudinary)

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (React/Next.js)               │
│  ├─ Auth pages                          │
│  ├─ Listing pages                       │
│  ├─ Checkout/Payment                    │
│  ├─ Messaging                           │
│  └─ Admin dashboard                     │
└────────────────────────────────────────┘
                    │
                    │ HTTP/HTTPS
                    ▼
┌─────────────────────────────────────────┐
│  Backend (Node.js/Express)              │
│  ├─ Auth (JWT)                          │
│  ├─ Listings CRUD                       │
│  ├─ Paystack Integration                │
│  ├─ Messaging                           │
│  ├─ Reviews/Ratings                     │
│  ├─ Disputes                            │
│  └─ Admin APIs                          │
└────────────────────────────────────────┘
         │          │          │
         ▼          ▼          ▼
    ┌────────┐ ┌──────────┐ ┌───────────┐
    │   DB   │ │ Paystack │ │ Cloudinary│
    │(PostgreSQL)│          │(Images)   │
    └────────┘ └──────────┘ └───────────┘
```

---

## File Structure

```
tradebaba-backend/
├── server.js                    # Main entry point
├── package.json                 # Dependencies
├── init.sql                     # Database schema
│
├── config/
│   └── database.js             # PostgreSQL connection
│
├── controllers/
│   ├── authController.js       # Login, register, verification
│   ├── listingsController.js   # Product CRUD
│   ├── paystackController.js   # Payment & escrow
│   ├── messagesController.js   # Messaging
│   ├── reviewsController.js    # Ratings
│   ├── usersController.js      # Profiles
│   ├── ordersController.js     # Orders & disputes
│   └── adminController.js      # Admin functions
│
├── routes/
│   ├── auth.js
│   ├── listings.js
│   ├── paystack.js
│   ├── messages.js
│   ├── reviews.js
│   ├── users.js
│   ├── orders.js
│   └── admin.js
│
├── middleware/
│   └── validation.js           # Auth & input validation
│
├── utils/
│   └── jwt.js                  # JWT utilities
│
├── .env.example               # Environment template
├── README.md                  # Full documentation
├── SETUP_GUIDE.md            # Step-by-step setup
└── POSTMAN_COLLECTION.json   # API testing
```

---

## Quick Commands

### Development
```bash
# Install dependencies
npm install

# Start server (auto-reload)
npm run dev

# Visit http://localhost:5000
```

### Database
```bash
# Initialize database
psql -U postgres -d tradebaba_db -a -f init.sql

# Connect to database
psql -U postgres -d tradebaba_db
```

### Deployment
```bash
# Push to GitHub
git add .
git commit -m "message"
git push origin main

# Railway auto-deploys
```

---

## API Endpoints Quick Reference

### Authentication
```
POST   /api/auth/register                    Register user
POST   /api/auth/login                       Login
POST   /api/auth/verify-email                Verify email
```

### Listings
```
GET    /api/listings                         Get all listings
GET    /api/listings/:id                     Get single listing
POST   /api/listings                         Create listing (auth)
PUT    /api/listings/:id                     Update listing (auth)
DELETE /api/listings/:id                     Delete listing (auth)
GET    /api/listings/categories              Get categories
```

### Payments (Escrow)
```
POST   /api/paystack/initialize              Start payment
POST   /api/paystack/verify                  Verify payment
POST   /api/paystack/order/:id/confirm-delivery   Release payment
GET    /api/paystack/user/orders             Get user orders
```

### Messages
```
POST   /api/messages                         Send message (auth)
GET    /api/messages                         Get conversations (auth)
GET    /api/messages/order/:id               Get conversation (auth)
```

### Reviews
```
POST   /api/reviews                          Create review (auth)
GET    /api/reviews/user/:id                 Get user reviews
DELETE /api/reviews/:id                      Delete review (auth)
```

### Users
```
GET    /api/users/me                         Current user (auth)
GET    /api/users/profile/:id                User profile
PUT    /api/users/profile                    Update profile (auth)
```

### Admin
```
GET    /api/admin/dashboard/stats            Dashboard stats (admin)
GET    /api/admin/disputes/pending           Open disputes (admin)
POST   /api/admin/disputes/:id/resolve       Resolve dispute (admin)
POST   /api/admin/users/:id/verify           Verify user (admin)
```

---

## Payment Flow

1. **Buyer initiates payment**
   ```
   POST /api/paystack/initialize
   ↓ Returns: Paystack authorization URL
   ```

2. **Buyer redirected to Paystack**
   ```
   User enters card details on Paystack.com
   ```

3. **Paystack redirects back**
   ```
   POST /api/paystack/verify
   ↓ Order status: "paid"
   ↓ Escrow fund held
   ```

4. **Seller ships item**
   ```
   PUT /api/orders/:id/shipping
   ↓ Order status: "shipped"
   ```

5. **Buyer confirms delivery**
   ```
   POST /api/paystack/order/:id/confirm-delivery
   ↓ Order status: "completed"
   ↓ Escrow released to seller
   ```

---

## Environment Variables Needed

```env
# Database
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=xxx
DB_NAME=tradebaba_db

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000

# JWT
JWT_SECRET=your_secret_key

# Paystack
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_SECRET_KEY=sk_test_xxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# Email
EMAIL_USER=support@tradebaba.ng
EMAIL_PASSWORD=app_password

# Admin
ADMIN_USERS=your_user_id
```

---

## Testing API Locally

### 1. Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "phone": "+2348012345678",
    "password": "Test123456",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123456"
  }'
# Save the token from response
```

### 3. Create Listing
```bash
curl -X POST http://localhost:5000/api/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "title": "iPhone 13",
    "description": "Good condition",
    "categoryId": "category-uuid",
    "price": 150000,
    "condition": "good"
  }'
```

---

## 30-Day Launch Timeline

**Week 1:** Setup & local testing
- [ ] Install dependencies
- [ ] Configure .env
- [ ] Initialize database
- [ ] Start server locally
- [ ] Test API endpoints

**Week 2:** Deploy to Railway
- [ ] Create GitHub repo
- [ ] Push code to GitHub
- [ ] Deploy to Railway
- [ ] Setup PostgreSQL on Railway
- [ ] Configure environment variables
- [ ] Test in production

**Week 3-4:** Build Frontend
- [ ] Create Next.js/React project
- [ ] Implement authentication pages
- [ ] Implement listing pages
- [ ] Implement payment flow
- [ ] Implement messaging
- [ ] Test full marketplace

**Week 4:** Launch
- [ ] Final testing
- [ ] Setup SSL
- [ ] Configure domain
- [ ] Go live!

---

## Key Technologies

| Component | Tech | Why |
|-----------|------|-----|
| Runtime | Node.js | Fast, JavaScript |
| Framework | Express | Minimal, flexible |
| Database | PostgreSQL | Reliable, powerful |
| Payment | Paystack | Nigeria-focused |
| Storage | Cloudinary | Easy image uploads |
| Auth | JWT | Stateless, scalable |
| Hosting | Railway | Simple deployment |

---

## What's Included

✅ Complete API code (30+ endpoints)
✅ Database schema (7 tables, indexes)
✅ Authentication system (JWT, email verification)
✅ Payment integration (Paystack escrow)
✅ Image upload (Cloudinary)
✅ Messaging system
✅ Reviews & ratings
✅ Dispute resolution
✅ Admin dashboard APIs
✅ Production-ready error handling
✅ Environment configuration
✅ Docker support
✅ Complete documentation

---

## What's NOT Included (Frontend)

❌ React/Next.js code (you build this)
❌ Admin dashboard UI (use admin endpoints)
❌ Mobile app (can use same API)

---

## Support & Next Steps

1. **Read SETUP_GUIDE.md** - Step-by-step setup
2. **Read README.md** - Full API documentation
3. **Import POSTMAN_COLLECTION.json** - Test API
4. **Start frontend development** - Call these APIs
5. **Deploy to Railway** - Go live in 1 month

---

## Estimated Costs (First Year)

| Service | Cost | Notes |
|---------|------|-------|
| Railway | $5-20/month | Depends on usage |
| Cloudinary | Free (50GB) | Images storage |
| Paystack | 1.5% + ₦100 | Per transaction |
| Domain | ₦3,000 | Per year |
| Email | Free (Gmail) | Support emails |
| **Total** | **~₦15-20k/month** | Scalable |

---

## FAQ

**Q: Can I change the database to MongoDB?**
A: Yes, but you'll need to rewrite all database queries.

**Q: Can I use a different payment provider?**
A: Yes, just replace Paystack integration with Flutterwave/Stripe API.

**Q: How do I add SMS verification?**
A: Integrate Termii/Twilio in authController.js

**Q: Can I scale this to millions of users?**
A: Yes, add Redis caching, Elasticsearch, and load balancers.

---

## Let's Build! 🚀

Your backend is ready. Now:

1. Follow SETUP_GUIDE.md to get running locally
2. Build your frontend (React/Next.js)
3. Deploy to Railway
4. Launch Tradebaba.ng!

Questions? Check SETUP_GUIDE.md and README.md

Good luck! 💪
