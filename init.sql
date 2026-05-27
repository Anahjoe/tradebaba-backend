-- Run this file to initialize your PostgreSQL database
-- psql -U postgres -d tradebaba_db -a -f init.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  verification_token VARCHAR(255),
  is_email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  is_phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMP,
  phone_verification_code VARCHAR(6),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  total_sales INT DEFAULT 0,
  total_purchases INT DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LISTINGS TABLE
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  condition VARCHAR(50), -- new, like_new, good, fair
  images JSONB, -- Array of image URLs
  location VARCHAR(255),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  status VARCHAR(50) DEFAULT 'active', -- active, sold, removed
  views INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ORDERS TABLE (Escrow)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES users(id),
  seller_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  paystack_reference VARCHAR(255) UNIQUE,
  paystack_authorization_url TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, shipped, delivered, completed, disputed, refunded
  payment_method VARCHAR(50),
  payment_date TIMESTAMP,
  delivery_address TEXT,
  delivery_notes TEXT,
  tracking_number VARCHAR(255),
  estimated_delivery_date DATE,
  actual_delivery_date TIMESTAMP,
  buyer_confirmed_delivery BOOLEAN DEFAULT FALSE,
  confirmed_delivery_at TIMESTAMP,
  auto_release_at TIMESTAMP, -- 7 days after payment
  escrow_released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DISPUTES TABLE
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'open', -- open, under_review, resolved, rejected
  resolution VARCHAR(255), -- refund_buyer, release_to_seller, split
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  evidence_urls JSONB, -- Array of image/video URLs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REVIEWS TABLE
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewed_user_id UUID NOT NULL REFERENCES users(id),
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_buyer_review BOOLEAN, -- TRUE if buyer reviewing seller, FALSE if seller reviewing buyer
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50), -- order_created, payment_received, delivery_confirmed, review_posted, etc
  title VARCHAR(255),
  message TEXT,
  related_order_id UUID REFERENCES orders(id),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PAYSTACK TRANSACTIONS TABLE (for audit trail)
CREATE TABLE IF NOT EXISTS paystack_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  paystack_reference VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(12,2),
  status VARCHAR(50), -- success, failed, pending
  response JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES for performance
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_category_id ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);
CREATE INDEX idx_orders_listing_id ON orders(listing_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_messages_order_id ON messages(order_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_reviews_reviewed_user_id ON reviews(reviewed_user_id);
CREATE INDEX idx_disputes_order_id ON disputes(order_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Insert default categories
INSERT INTO categories (name, slug, description) VALUES
('Electronics', 'electronics', 'Phones, laptops, and gadgets'),
('Fashion', 'fashion', 'Clothing, shoes, and accessories'),
('Home & Living', 'home-living', 'Furniture and household items'),
('Vehicles', 'vehicles', 'Cars, motorcycles, and auto parts'),
('Sports & Outdoors', 'sports', 'Sports equipment and outdoor gear'),
('Books & Media', 'books', 'Books, CDs, DVDs'),
('Services', 'services', 'Professional services'),
('Real Estate', 'real-estate', 'Property listings'),
('Baby & Kids', 'baby-kids', 'Baby and children items'),
('Others', 'others', 'Miscellaneous items')
ON CONFLICT DO NOTHING;

COMMIT;
