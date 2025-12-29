# TribeBuilders Full-Stack Application

A comprehensive full-stack application with React frontend and Express.js backend for UMG Artist Social Media Assistant.

## Project Structure

```
TribeBuilders/
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Express.js backend (TypeScript)
├── guides/          # Markdown files contaning development guides
├── tests/           # Tests
├── package.json     # Root package configuration
└── README.md        # This file
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Install all dependencies (Ensure you do this seperately in both the client and server folder):
```bash
npm install
```

### Development

1. Start both frontend and backend in development mode:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:8080
- Backend on http://localhost:3000

2. Start individually:
```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

### Production Build

1. Build both applications:
```bash
npm run build
```

2. Start production server:
```bash
npm start
```

## Frontend (Client)

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: Radix UI + Tailwind CSS
- **State Management**: Zustand
- **API Client**: Custom API client in `src/lib/api.ts`

### Frontend Features
- Modern React with TypeScript
- Responsive design with Tailwind CSS
- Component library with Radix UI
- API integration with the backend
- Development proxy configured for seamless backend communication

## Backend (Server)

- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Supabase
- **Authentication**: JWT
- **API Documentation**: Swagger
- **Security**: Helmet, CORS, Rate limiting

### API Endpoints
- `/api/users` - User management
- `/api/artists` - Artist profiles
- `/api/personas` - AI personas
- `/api/content` - Content management
- `/api/uploads` - File uploads
- `/health` - Health check

## Environment Variables

### Backend (.env in server/)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=your_database_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=http://localhost:8080
```

### Frontend (.env in client/)
```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend
- `npm run build` - Build both applications
- `npm run start` - Start production server
- `npm run install:all` - Install all dependencies
- `npm run test` - Run backend tests
- `npm run lint` - Lint both applications

### Development Workflow

1. **API Development**: Backend runs on port 3000
2. **Frontend Development**: Frontend runs on port 8080 with proxy to backend
3. **Database**: Configure your database connection in server/.env
4. **Testing**: Backend includes Jest test setup

## Architecture Notes

- Frontend communicates with backend through API proxy in development
- CORS configured to allow frontend origin
- JWT authentication ready for implementation
- Database migrations available in backend
- Swagger documentation available at `/api-docs` when server is running

## Deployment

1. Build applications: `npm run build`
2. Deploy backend to your preferred platform (Heroku, AWS, etc.)
3. Deploy frontend build to static hosting (Vercel, Netlify, etc.)
4. Update environment variables for production URLs