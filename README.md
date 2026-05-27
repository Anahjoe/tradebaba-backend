# Tradebaba.ng - Backend API

A complete Node.js + Express backend for a Nigerian marketplace with integrated Paystack escrow payments.

## Features

✅ **User Management**
- Email/Phone verification
- User profiles with ratings
- Authentication with JWT

✅ **Marketplace**
- Product listings with images
- Search & filtering by category
- View counts

✅ **Escrow & Payments**
- Paystack integration
- Automatic payment holding (escrow)
- Manual & time-based release
- Dispute resolution

✅ **Communication**
- Buyer-seller messaging
- In-app notifications

✅ **Reviews & Ratings**
- Post-purchase reviews
- User reputation system

✅ **Admin Dashboard**
- User verification
- Dispute resolution
- Listing moderation
- Platform statistics

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Payment:** Paystack
- **Storage:** Cloudinary
- **Auth:** JWT
- **Email:** Nodemailer

## Quick Start

### 1. Prerequisites

```bash
# Install Node.js (v14+)
# Install PostgreSQL (v12+)
# Create a PostgreSQL database
createdb tradebaba_db
```

### 2. Clone & Setup

```bash
# Clone repository
git clone https://github.com/Anahjoe/tradebaba-backend.git
cd tradebaba-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Initialize database
psql -U postgres -d tradebaba_db -a -f init.sql
```

### 3. Configure .env

Edit `.env` with your credentials:

```bash
# Database
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=tradebaba_db

# Paystack (get from https://paystack.com)
PAYSTACK_PUBLIC_KEY=pk_test_xxx
PAYSTACK_SECRET_KEY=sk_test_xxx

# Cloudinary (get from https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

# JWT Secret (generate a random string)
JWT_SECRET=your_secret_key_here

# Email (Gmail + App Password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### 4. Run Locally

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000`

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Routes

```
POST /auth/register
POST /auth/login
POST /auth/verify-email
POST /auth/send-phone-verification
POST /auth/verify-phone
POST /auth/request-password-reset
POST /auth/reset-password
```

### Listings Routes

```
GET  /listings                    # Get all listings
GET  /listings/:id                # Get single listing
GET  /listings/categories         # Get categories
POST /listings                    # Create listing (auth required)
PUT  /listings/:id                # Update listing (auth required)
DELETE /listings/:id              # Delete listing (auth required)
GET  /listings/user/:userId       # Get user listings
```

### Payment/Escrow Routes

```
POST /paystack/initialize         # Start payment
POST /paystack/verify             # Verify payment
POST /paystack/webhook            # Paystack webhook
GET  /paystack/order/:orderId     # Get order
POST /paystack/order/:orderId/confirm-delivery
GET  /paystack/user/orders
```

### Reviews Routes

```
GET  /reviews/user/:userId        # Get user reviews
GET  /reviews/order/:orderId      # Get order review
POST /reviews                     # Create review (auth required)
DELETE /reviews/:reviewId         # Delete review (auth required)
```

### Messages Routes

```
POST /messages                    # Send message (auth required)
GET  /messages/order/:orderId     # Get conversation (auth required)
GET  /messages                    # Get all conversations (auth required)
DELETE /messages/:messageId       # Delete message (auth required)
```

### Users Routes

```
GET  /users/profile/:userId       # Get user profile
GET  /users/stats/:userId         # Get user stats
GET  /users/search                # Search users
GET  /users/me                    # Get current user (auth required)
PUT  /users/profile               # Update profile (auth required)
POST /users/change-password       # Change password (auth required)
GET  /users/notifications         # Get notifications (auth required)
```

### Orders Routes

```
POST /orders/:orderId/dispute     # Create dispute (auth required)
GET  /orders/:orderId/timeline    # Get order timeline (auth required)
GET  /orders/:orderId/disputes    # Get disputes (auth required)
PUT  /orders/:orderId/shipping    # Update shipping (auth required)
```

### Admin Routes (Admin only)

```
GET  /admin/dashboard/stats
GET  /admin/disputes/pending
POST /admin/disputes/:disputeId/resolve
POST /admin/users/:userId/verify
POST /admin/users/:userId/ban
GET  /admin/users
POST /admin/listings/:listingId/remove
```

## Payment Flow

1. **Buyer initiates checkout**
   ```
   POST /paystack/initialize
   ```

2. **Paystack payment page opens**
   - User enters card details
   - Payment processed

3. **Verify payment**
   ```
   POST /paystack/verify
   ```
   - Order created with status "paid"
   - Seller notified
   - Escrow fund held

4. **Seller ships item**
   ```
   PUT /orders/:orderId/shipping
   ```

5. **Buyer confirms delivery**
   ```
   POST /paystack/order/:orderId/confirm-delivery
   ```
   - Order status: "completed"
   - Escrow released to seller
   - Payment transferred to seller account

## Dispute Flow

1. **Buyer or Seller creates dispute**
   ```
   POST /orders/:orderId/dispute
   ```

2. **Admin reviews evidence**
   ```
   GET /admin/disputes/pending
   ```

3. **Admin resolves dispute**
   ```
   POST /admin/disputes/:disputeId/resolve
   ```
   - Options: refund_buyer, release_to_seller, split
   - Payment processed accordingly

## Deployment to Railway

### 1. Create Railway Account
- Go to https://railway.app
- Sign up with GitHub

### 2. Connect GitHub Repository

```bash
# Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Anahjoe/tradebaba-backend.git
git push -u origin main
```

### 3. Create Railway Project

1. Click "New Project"
2. Select "Deploy from GitHub"
3. Authorize and select repository
4. Railway auto-detects Node.js

### 4. Add PostgreSQL Database

1. Click "+ Create" in Railway
2. Select "PostgreSQL"
3. Railway creates database automatically
4. Copy connection string

### 5. Configure Environment Variables

In Railway dashboard:
- Add all variables from `.env.example`
- Set `NODE_ENV=production`
- Railway provides DATABASE_URL

### 6. Deploy

- Push to main branch
- Railway auto-deploys
- View live at provided domain

## Database Schema

### Users Table
- id (UUID)
- email, phone (unique)
- password_hash
- first_name, last_name
- avatar_url, bio
- is_verified, is_email_verified, is_phone_verified
- rating, review_count, total_sales, total_purchases
- is_banned

### Listings Table
- id (UUID)
- user_id (seller)
- title, description
- category_id
- price, currency
- condition, images (JSONB array)
- location, latitude, longitude
- status (active, sold, removed)
- views, created_at

### Orders Table (Escrow)
- id (UUID)
- listing_id, buyer_id, seller_id
- amount, currency
- paystack_reference, status
- payment_date, delivery_date
- buyer_confirmed_delivery
- auto_release_at (7 days), escrow_released_at

### Other Tables
- categories
- reviews
- messages
- disputes
- notifications
- paystack_transactions

## Error Handling

All endpoints return JSON:

```json
{
  "error": "Error message"
}
```

Status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Server Error

## Security

- Passwords hashed with bcrypt
- JWT tokens for auth
- HTTPS in production
- Input validation
- CORS enabled
- Rate limiting (recommended for production)
- Helmet for security headers

## Next Steps

1. **Frontend:** Build React/Next.js UI
2. **Admin Dashboard:** Web interface for moderation
3. **Mobile App:** React Native version
4. **SMS Integration:** Termii/Twilio for verifications
5. **Analytics:** Track marketplace metrics
6. **Search Optimization:** Elasticsearch
7. **Caching:** Redis for performance

## Support

For issues or questions:
- GitHub: https://github.com/Anahjoe/tradebaba-backend
- Email: support@tradebaba.ng

## License

MIT License - See LICENSE file
