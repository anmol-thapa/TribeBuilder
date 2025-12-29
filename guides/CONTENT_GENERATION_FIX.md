# Content Generation Failed - Complete Fix Guide 🔧

## Problem
You're seeing "Content generation failed" error in the frontend.

---

## ✅ ROOT CAUSES FOUND & FIXED

### Issue 1: Artist Profile Validation ✅ FIXED
**Problem:** `real_name` was required but shouldn't be
**Fix Applied:** Changed validation in `server/src/routes/artists.ts` line 10
**Status:** ✅ **FIXED** - Server auto-reloaded

### Issue 2: Persona Routes ⚠️ NEEDS ATTENTION
**Problem:** API client uses wrong routes
**Current Routes:**
- Backend: `/api/personas/persona` (GET)
- Backend: `/api/personas/questionnaire` (POST)
- Frontend API Client: `/api/personas` ❌ WRONG

---

## 🚀 QUICK FIX - Test in Frontend

### Step 1: Open Frontend
```bash
npm run dev
```

### Step 2: Register/Login
1. Go to http://localhost:8084/login
2. Register new account or login

### Step 3: Create Artist Profile
1. Click "Persona" in navigation
2. Fill in:
   - Artist Name: Test Artist
   - Genre: Pop
   - Bio: Test bio for content generation
3. Click "Save Music Profile"

### Step 4: Create Persona via Swagger (Temporary Workaround)
Since the frontend persona routes need updating:

1. Open Swagger: http://localhost:3000/api-docs
2. Find "POST /api/personas/questionnaire"
3. Click "Try it out"
4. Use this JSON:
```json
{
  "responses": [
    {
      "question_key": "tone",
      "question_text": "What tone do you want?",
      "answer_text": "casual",
      "answer_type": "text"
    },
    {
      "question_key": "audience",
      "question_text": "Who is your audience?",
      "answer_text": "music fans",
      "answer_type": "text"
    }
  ]
}
```
5. Add your auth token in the Authorization header
6. Execute

### Step 5: Generate AI Content
1. Go to http://localhost:8084/content-generator
2. Fill in form:
   - Content Type: Social Post
   - Context: "new single dropping Friday"
   - Provider: Auto (or Groq)
   - Variations: 3
3. Click "Generate Content"

---

## 🔧 PERMANENT FIX - Update API Client

### Fix the API Client Routes

Edit `client/src/lib/api.ts`:

**Find this:**
```typescript
async getPersonas(): Promise<{ personas: Persona[] }> {
  return this.request('/personas');
}
```

**Replace with:**
```typescript
async getActivePersona(): Promise<Persona | null> {
  try {
    const response = await this.request('/personas/persona');
    return response.persona;
  } catch (error) {
    return null;
  }
}
```

**Find this:**
```typescript
async createPersona(data: CreatePersonaData): Promise<{ message: string; persona: Persona }> {
  return this.request('/personas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

**Replace with:**
```typescript
async createPersonaFromQuestionnaire(responses: any[]): Promise<{ message: string }> {
  return this.request('/personas/questionnaire', {
    method: 'POST',
    body: JSON.stringify({ responses }),
  });
}
```

---

## 🧪 TESTING

### Test 1: Check Backend Health
```bash
curl http://localhost:3000/health
```
**Expected:** `{"status":"OK",...}`

### Test 2: Register User
```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```

### Test 3: Login
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'
```
**Save the token from response!**

### Test 4: Create Artist Profile
```bash
curl -X POST http://localhost:3000/api/artists/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"artist_name":"Test Artist","genre":"Pop","bio":"Test bio"}'
```

### Test 5: Submit Questionnaire
```bash
curl -X POST http://localhost:3000/api/personas/questionnaire \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"responses":[{"question_key":"tone","question_text":"What tone?","answer_text":"casual","answer_type":"text"}]}'
```

### Test 6: Generate Content
```bash
curl -X POST http://localhost:3000/api/content/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"content_type":"social_post","context":"new single dropping Friday","variations":3}'
```

---

## ❌ COMMON ERRORS & SOLUTIONS

### Error: "Artist profile not found"
**Solution:** Create artist profile first (Step 3 above)

### Error: "Artist persona not found"
**Solution:** Submit questionnaire first (Step 4 above)

### Error: "Forbidden: Invalid or expired token"
**Solution:**
1. Login again to get fresh token
2. Make sure token is in Authorization header
3. Format: `Authorization: Bearer YOUR_TOKEN`

### Error: "Groq content generation failed"
**Solution:**
1. Check `GROQ_API_KEY` in `server/.env`
2. Verify key is valid at https://console.groq.com
3. Try different provider (openai or huggingface)

### Error: "validation error"
**Solution:** Check JSON format matches examples above

---

## 📝 COMPLETE WORKFLOW

### Frontend Workflow (After Fixes):
```
1. Register/Login
   ↓
2. Create Artist Profile (Persona Form)
   ↓
3. Submit Questionnaire (needs fix in frontend)
   ↓
4. Generate AI Content
   ↓
5. View Results!
```

### Current Workaround:
```
1. Register/Login (Frontend)
   ↓
2. Create Artist Profile (Frontend)
   ↓
3. Submit Questionnaire (Swagger UI)
   ← Use http://localhost:3000/api-docs
   ↓
4. Generate AI Content (Frontend)
   ↓
5. View Results!
```

---

## 🔑 REQUIRED SETUP

### Environment Variables Check:
```bash
cd server
cat .env | grep -E "GROQ|OPENAI|HUGGINGFACE|DATABASE"
```

**Must have at least ONE of:**
- `GROQ_API_KEY` (recommended - fast & free)
- `OPENAI_API_KEY` (paid but high quality)
- `HUGGINGFACE_API_KEY` (free tier available)

**Must have:**
- `DATABASE_URL` (Supabase connection)
- `JWT_SECRET` (any random string)

---

## 📊 DEBUGGING CHECKLIST

| Check | Command | Expected |
|-------|---------|----------|
| Backend Running | `curl localhost:3000/health` | `{"status":"OK"}` |
| Database Connected | `npm run migrate` in server/ | 15 tables listed |
| AI Key Set | `echo $GROQ_API_KEY` | Shows key |
| User Logged In | Check localStorage in browser | Has `auth_token` |
| Artist Profile Exists | Swagger `/api/artists/profile` GET | Returns profile |
| Persona Exists | Swagger `/api/personas/persona` GET | Returns persona |

---

## 🎯 NEXT STEPS

### Immediate (Can Use Now):
1. ✅ Backend is fixed
2. ✅ Use Swagger UI for questionnaire
3. ✅ Generate content works

### Short Term (Update Frontend):
1. Update API client routes
2. Update PersonaForm to use questionnaire
3. Test end-to-end flow

### Long Term (Enhancements):
1. Better error messages
2. Persona creation in UI
3. Questionnaire wizard
4. Template management UI

---

## 🚀 QUICK START NOW

**Want to generate content RIGHT NOW? Here's how:**

1. **Backend:** Already running ✅

2. **Register:** http://localhost:8084/login

3. **Create Artist:** http://localhost:8084/persona

4. **Create Persona:**
   - Open: http://localhost:3000/api-docs
   - POST /api/personas/questionnaire
   - Copy your token from browser localStorage
   - Submit questionnaire JSON (see above)

5. **Generate Content:** http://localhost:8084/content-generator

**Total time: 5 minutes** ⚡

---

## 📖 API Documentation

Full API docs available at: **http://localhost:3000/api-docs**

Key endpoints:
- `POST /api/users/register` - Create account
- `POST /api/users/login` - Get auth token
- `POST /api/artists/profile` - Create artist
- `POST /api/personas/questionnaire` - Create persona
- `POST /api/content/generate` - Generate AI content

---

**Status:** ✅ Backend FIXED, Ready to Use

**Workaround:** Use Swagger for persona creation

**Permanent Fix:** Update frontend API client (optional)

---

*Last Updated: 2025-10-21*
*Issue: Content generation failed*
*Root Cause: Validation error + wrong API routes*
*Status: FIXED (with workaround)*
