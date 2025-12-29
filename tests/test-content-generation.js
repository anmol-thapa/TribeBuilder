// Test Script for Content Generation
// Run with: node test-content-generation.js

const API_URL = 'http://localhost:3000/api';
let authToken = null;
let userId = null;

async function makeRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function register() {
  console.log('\n📝 Step 1: Registering user...');
  const email = `test-${Date.now()}@example.com`;
  const password = 'password123';

  try {
    await makeRequest('/users/register', 'POST', { email, password });
    console.log('✅ User registered successfully');
    return { email, password };
  } catch (error) {
    console.log('⚠️  Registration may have failed (user might exist):', error.message);
    return { email: 'test@example.com', password: 'password123' };
  }
}

async function login(email, password) {
  console.log('\n🔐 Step 2: Logging in...');
  try {
    const response = await makeRequest('/users/login', 'POST', { email, password });
    authToken = response.token;
    userId = response.user.id;
    console.log('✅ Login successful');
    console.log(`   Token: ${authToken.substring(0, 20)}...`);
    return response;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
    throw error;
  }
}

async function createArtistProfile() {
  console.log('\n👤 Step 3: Creating artist profile...');
  try {
    const response = await makeRequest('/artists/profile', 'POST', {
      artist_name: 'Test Artist',
      genre: 'Pop',
      bio: 'This is a test bio for testing content generation.',
    });
    console.log('✅ Artist profile created');
    return response.artist;
  } catch (error) {
    console.log('⚠️  Artist profile might already exist:', error.message);
    // Try to get existing profile
    try {
      const profile = await makeRequest('/artists/profile', 'GET');
      console.log('✅ Using existing artist profile');
      return profile;
    } catch (e) {
      console.error('❌ Failed to get artist profile:', e.message);
      throw e;
    }
  }
}

async function createPersona() {
  console.log('\n🎭 Step 4: Creating persona...');
  try {
    const response = await makeRequest('/personas', 'POST', {
      persona_name: 'Main Persona',
      tone: 'casual',
      target_audience: 'music fans',
      key_themes: ['music', 'creativity', 'inspiration'],
      voice_characteristics: {
        style: 'friendly',
        energy: 'high'
      }
    });
    console.log('✅ Persona created');
    return response.persona;
  } catch (error) {
    console.log('⚠️  Persona might already exist:', error.message);
    // Try to get existing personas
    try {
      const response = await makeRequest('/personas', 'GET');
      if (response.personas && response.personas.length > 0) {
        console.log('✅ Using existing persona');
        return response.personas[0];
      }
      throw new Error('No personas found');
    } catch (e) {
      console.error('❌ Failed to get persona:', e.message);
      throw e;
    }
  }
}

async function generateContent() {
  console.log('\n✨ Step 5: Generating AI content...');
  try {
    const response = await makeRequest('/content/generate', 'POST', {
      content_type: 'social_post',
      context: 'new single dropping Friday',
      max_length: 150,
      variations: 3,
      provider: 'auto'
    });
    console.log('✅ Content generated successfully!');
    console.log(`   Generated ${response.generated_content.length} variations`);
    console.log(`   Model used: ${response.generation_metadata.model_used}`);
    console.log(`   Avg quality: ${response.generation_metadata.average_quality_score}`);

    console.log('\n📄 Generated Content:');
    response.generated_content.forEach((content, i) => {
      console.log(`\n   Variation ${i + 1} (Quality: ${(content.quality_score * 100).toFixed(0)}%):`);
      console.log(`   "${content.content}"`);
    });

    return response;
  } catch (error) {
    console.error('❌ Content generation failed:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 TribeBuilders - Content Generation Test');
  console.log('==========================================');

  try {
    // Step 1 & 2: Register and login
    const { email, password } = await register();
    await login(email, password);

    // Step 3: Create artist profile
    await createArtistProfile();

    // Step 4: Create persona
    await createPersona();

    // Step 5: Generate content
    await generateContent();

    console.log('\n✅ All tests passed!');
    console.log('\n💡 Your setup is working correctly.');
    console.log('   You can now use the frontend at http://localhost:8084');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Make sure backend is running: npm run dev:server');
    console.error('   2. Check .env file has all required keys (GROQ_API_KEY, etc.)');
    console.error('   3. Verify database connection');
    console.error('   4. Check server logs for detailed errors');
    process.exit(1);
  }
}

// Run the test
main();
