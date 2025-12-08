# Backend Server - Quick Start Guide

## ✅ Server Status
**The backend server is now running successfully on port 3000!**

## 🚀 Running the Server

### Development Mode
```bash
cd backend
npm run dev
```

### Production Mode
```bash
cd backend
npm run build
npm start
```

## 📋 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run compiled production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations

## 🔌 API Endpoints

### Base URL
`http://localhost:3000`

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Resumes (`/api/resumes`)
- `GET /api/resumes` - List all user resumes (protected)
- `GET /api/resumes/:id` - Get single resume (protected)
- `POST /api/resumes` - Create new resume (protected)
- `PUT /api/resumes/:id` - Update resume (protected)
- `DELETE /api/resumes/:id` - Delete resume (protected)
- `POST /api/resumes/parse` - Parse PDF resume with AI (protected)

### Portfolios (`/api/portfolios`)
- `GET /api/portfolios` - Get user portfolio settings (protected)
- `PUT /api/portfolios` - Update portfolio settings (protected)
- `GET /api/portfolios/public/:subdomain` - Get public portfolio

### AI Features (`/api/ai`)
- `POST /api/ai/job-match` - AI job matching analysis (protected)
- `POST /api/ai/rewrite` - AI text rewriting (protected)
- `POST /api/ai/cover-letter` - Generate cover letter (protected)
- `POST /api/ai/interview-prep` - Generate interview questions (protected)

### Payment (`/api/payment`)
- `POST /api/payment/create-checkout-session` - Create Stripe checkout (protected)
- `POST /api/payment/webhook` - Stripe webhook handler

### Analytics (`/api/analytics`)
- `GET /api/analytics` - Get user analytics (protected)

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## 🌐 Frontend Configuration

Update your frontend `.env` file:
```
VITE_API_URL=http://localhost:3000
```

## 📝 Environment Variables

Required in `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
PORT=3000
JWT_SECRET=your-secret-key-here
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 🧪 Testing the API

### Example: User Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword",
    "fullName": "John Doe"
  }'
```

### Example: User Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepassword"
  }'
```

## ⚠️ Important Notes

1. **CORS**: The server has CORS enabled for all origins in development
2. **Database**: Ensure PostgreSQL is running and accessible
3. **Prisma**: Run `npx prisma generate` after schema changes
4. **Migrations**: Use `npx prisma migrate dev` for database changes

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify DATABASE_URL is correct
- Ensure all dependencies are installed: `npm install`

### Database connection errors
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Run migrations: `npx prisma migrate dev`

### TypeScript errors
- Install type definitions: `npm install -D @types/express @types/cors @types/jsonwebtoken @types/multer`
- Rebuild: `npm run build`

## 📚 Next Steps

1. **Test all endpoints** using Postman or curl
2. **Configure frontend** to use the new API
3. **Set up production environment** variables
4. **Deploy backend** to your hosting service
5. **Configure Stripe webhooks** for production

## 🎉 Success!

Your custom backend is now running and ready to handle requests from your frontend application!
