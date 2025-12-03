# Authentication & Role-Based Access Control

This document describes the authentication system implemented in this Next.js photo management application.

## Overview

The application uses **NextAuth.js v5** for authentication with three user roles:
- **USER**: Can view and search photos
- **PHOTOGRAPHER**: Can upload, manage, and delete their own photos
- **ADMIN**: Full access to all features, including user management

## Features Implemented

### 1. Database Schema
- **User Model**: Stores user credentials, role, and profile information
- **Session Model**: Manages user sessions securely
- **Photo Model**: Updated with `uploadedById` to track photo ownership
- **Role Enum**: USER, PHOTOGRAPHER, ADMIN

### 2. Authentication Pages
- `/auth/login` - User login
- `/auth/signup` - User registration (default role: USER)

### 3. Protected Routes (via Middleware)
- `/dashboard` - Photographer and Admin only
- `/admin` - Admin only
- `/search` - Authenticated users only
- `/` - Public (view-only for non-authenticated users)

### 4. API Protection
All API routes require authentication:
- `/api/search` - Search for similar photos (authenticated users)
- `/api/image/[photoId]` - View photos (authenticated users)

### 5. Role-Based Features

#### Regular Users (USER)
- View photo gallery (home page)
- Search for similar photos
- Cannot upload or delete photos

#### Photographers (PHOTOGRAPHER)
- All USER permissions
- Upload photos (single or bulk)
- View personal dashboard at `/dashboard`
- Delete their own photos
- Cannot manage other users

#### Admins (ADMIN)
- All PHOTOGRAPHER permissions
- Access admin dashboard at `/admin`
- Manage user roles (promote/demote users)
- Delete any user (except themselves)
- Delete any photo

### 6. UI Components
- **Navbar**: Dynamic navigation based on user role
- **Dashboard**: Personal photo management for photographers
- **Admin Panel**: User management interface
- **Role-based buttons**: Upload/delete buttons only visible to authorized users

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/myphotos"

# AWS S3
AWS_S3_BUCKET="your-bucket-name"
AWS_REGION="your-region"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

# NextAuth
AUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"  # Change to production URL in prod
```

### 2. Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

Copy the output to your `.env` file as `AUTH_SECRET`.

### 3. Database Migration

Make sure your PostgreSQL database is running, then:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Optional: Seed an admin user
npx prisma studio  # Create a user manually and set role to ADMIN
```

### 4. Start the Application

```bash
npm run dev
```

## Creating the First Admin User

Since the first user created via signup will be a regular USER, you need to manually promote them to ADMIN:

**Option 1: Using Prisma Studio**
```bash
npx prisma studio
```
Navigate to the Users table and change the role to `ADMIN`.

**Option 2: Using SQL**
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'your-email@example.com';
```

**Option 3: Using a seed script**
Create `prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('Admin user created:', admin);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Then run:
```bash
npx tsx prisma/seed.ts
```

## User Flow

### For New Users
1. Visit `/auth/signup` to create an account (role: USER)
2. Log in at `/auth/login`
3. Browse photos on home page
4. Use `/search` to find similar photos

### For Photographers
Admin must promote users to PHOTOGRAPHER:
1. Admin logs into `/admin`
2. Changes user role to PHOTOGRAPHER
3. Photographer can now access `/dashboard`
4. Upload photos via Dashboard or home page
5. Manage their uploaded photos

### For Admins
1. Admin has full access to all features
2. Manage users at `/admin`
3. Promote users to PHOTOGRAPHER
4. Delete any user or photo

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Sessions**: Secure session management via NextAuth
- **CSRF Protection**: Built into NextAuth
- **Route Protection**: Server-side middleware
- **API Authorization**: All API routes check authentication
- **Ownership Verification**: Users can only delete their own photos (except admins)

## API Authorization Logic

### Photo Upload
```typescript
- Requires: PHOTOGRAPHER or ADMIN role
- Action: Creates photo with uploadedById = current user
```

### Photo Delete
```typescript
- Requires: Authenticated user
- Authorization:
  - Photo owner (uploadedById matches user ID), OR
  - ADMIN role
```

### User Management
```typescript
- Requires: ADMIN role only
- Cannot delete/demote self
```

## File Structure

```
src/
├── actions/
│   ├── auth.ts          # Login, signup, logout actions
│   ├── users.ts         # User management actions (admin)
│   └── photos.ts        # Photo operations (updated with auth)
├── app/
│   ├── auth/
│   │   ├── login/       # Login page
│   │   └── signup/      # Signup page
│   ├── dashboard/       # Photographer dashboard
│   ├── admin/           # Admin panel
│   └── api/
│       ├── auth/        # NextAuth API routes
│       ├── search/      # Protected search endpoint
│       └── image/       # Protected image proxy
├── components/
│   ├── Navbar.tsx              # Role-based navigation
│   ├── DashboardGallery.tsx    # Photographer photo management
│   ├── AdminUsersTable.tsx     # Admin user management
│   └── ModernPhotoGallery.tsx  # Updated with role checks
├── lib/
│   └── prisma.ts
├── auth.ts              # NextAuth configuration
└── middleware.ts        # Route protection
```

## Troubleshooting

### "Unauthorized" errors
- Ensure you're logged in
- Check your role matches the required permission
- Verify AUTH_SECRET is set correctly

### Database connection errors
- Ensure PostgreSQL is running
- Verify DATABASE_URL in `.env`
- Run migrations: `npx prisma migrate dev`

### Images not loading
- Ensure AWS credentials are correct
- Check that API route authentication passes
- Verify user is logged in (images require auth)

## Future Enhancements

- Email verification
- Password reset functionality
- OAuth providers (Google, GitHub)
- Two-factor authentication
- Activity logs
- Photo sharing with specific users
- Public/private photo visibility settings
