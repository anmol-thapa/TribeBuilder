# TribeBuilders - Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (or Supabase account)
- AI API keys (Groq, OpenAI, or HuggingFace)

## Initial Setup

### 1. Clone and Install

```bash
# Install all dependencies
npm run install:all
```

### 2. Configure Environment Variables

#### Backend Configuration (.env in root or server/)

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key

# Authentication
JWT_SECRET=your_secure_random_secret_here

# Server
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:8084

# AI Providers (at least one required)
GROQ_API_KEY=your_groq_key          # Recommended - Fast and free
OPENAI_API_KEY=your_openai_key      # Optional - Premium quality
HUGGINGFACE_API_KEY=your_hf_key     # Optional - Fallback

# Optional AI Configuration
AI_RATE_LIMIT_REQUESTS_PER_MINUTE=60
AI_CACHE_TTL_SECONDS=3600
```

#### Frontend Configuration (client/.env)

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Database Setup

Run the SQL migrations in your database (Supabase SQL Editor or psql):

```bash
# Option 1: Using Supabase SQL Editor
# Copy the contents of server/src/db/001_initial_schema.sql
# Paste into Supabase SQL Editor and run

# Option 2: Using psql
psql $DATABASE_URL < server/src/db/001_initial_schema.sql
psql $DATABASE_URL < server/src/db/002_ai_content_enhancements.sql
```

### 4. Get AI API Keys

#### Groq (Recommended - Free)
1. Visit https://console.groq.com
2. Sign up for free account
3. Navigate to API Keys
4. Create new API key
5. Copy to `GROQ_API_KEY` in .env

#### OpenAI (Optional - Paid)
1. Visit https://platform.openai.com
2. Sign up and add billing
3. Navigate to API Keys
4. Create new key
5. Copy to `OPENAI_API_KEY` in .env

#### HuggingFace (Optional - Free)
1. Visit https://huggingface.co
2. Sign up for free
3. Go to Settings → Access Tokens
4. Create new token
5. Copy to `HUGGINGFACE_API_KEY` in .env

## Running the Application

### Development Mode (Both Frontend & Backend)

```bash
npm run dev
```

This will start:
- Backend on http://localhost:3000
- Frontend on http://localhost:8084

### Individual Services

```bash
# Backend only
npm run dev:server

# Frontend only
npm run dev:client
```

## First Use

### 1. Access the Application

Open your browser to: http://localhost:8084

### 2. Register an Account

1. Navigate to http://localhost:8084/login
2. Click "Register" tab
3. Enter email and password
4. Click "Create Account"

### 3. Create Your Artist Persona

1. Navigate to "Persona" from the navigation menu
2. Fill in your artist details:
   - Artist Name
   - Genre
   - Bio (10-500 characters)
3. Click "Save Music Profile"

### 4. Generate AI Content

1. Navigate to "AI Content" from the navigation menu
2. Select content type (e.g., "Social Post")
3. Enter context (e.g., "new single dropping Friday")
4. Choose AI provider (default: Auto)
5. Set variations (1-5)
6. Click "Generate Content"
7. View generated content with quality scores
8. Copy your favorite variation

## API Health Check

Test if the backend is running correctly:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "UMG Social Assistant API",
  "timestamp": "2025-01-20T...",
  "environment": "development"
}
```

## Testing

### Backend Tests

```bash
cd server
npm test
```

Expected: 60+ tests passing

### Frontend Type Check

```bash
cd client
npx tsc --noEmit
```

Expected: No errors

## Common Issues

### Issue: Port 3000 already in use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill
```

### Issue: Database connection error

- Verify `DATABASE_URL` is correct
- Check if database is running
- Ensure database accepts connections from your IP

### Issue: CORS errors

- Ensure backend `.env` has `CORS_ORIGIN=http://localhost:8084`
- Restart backend after changing .env

### Issue: AI generation fails

- Verify at least one AI API key is set
- Check API key is valid
- Try different provider (Groq, OpenAI, HuggingFace)

### Issue: 401 Unauthorized

- Make sure you're logged in
- Check browser localStorage for `auth_token`
- Try logging out and back in

## Project Structure

```
TribeBuilders/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── contexts/    # React contexts (Auth)
│   │   ├── lib/         # API client
│   │   ├── pages/       # Page components
│   │   └── stores/      # Zustand stores
│   └── INTEGRATION.md   # Integration guide
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Auth middleware
│   │   └── db/          # Database schemas
│   └── README.md        # Backend docs
└── package.json         # Root workspace config
```

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend
- `npm run build` - Build both applications
- `npm run install:all` - Install all dependencies
- `npm test` - Run backend tests

### Client
- `npm run dev` - Start dev server (port 8084)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Server
- `npm run dev` - Start dev server with hot reload
- `npm run build` - Compile TypeScript
- `npm start` - Start production server
- `npm test` - Run tests

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:3000/api-docs
- Health Check: http://localhost:3000/health

## Next Steps

1. Customize your artist persona
2. Upload questionnaire or transcript files
3. Generate various types of content
4. Explore media upload functionality
5. Connect social media accounts (coming soon)

## Support

- Frontend Integration: See [client/INTEGRATION.md](client/INTEGRATION.md)
- Backend API: See [server/API.md](server/API.md)
- Database Schema: See [server/src/db/001_initial_schema.sql](server/src/db/001_initial_schema.sql)

## License

ISC - See package.json for details

---

**Built by Team Alpha - NextGenHSV**
