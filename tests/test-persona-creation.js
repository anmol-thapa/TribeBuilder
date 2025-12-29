// Test Script for Complete Persona Creation Flow
// Run with: node test-persona-creation.js

const API_URL = 'http://localhost:3000/api';
let authToken = null;

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
  console.log('\n📝 Step 1: Registering new user...');
  const email = `test-${Date.now()}@example.com`;
  const password = 'password123';

  try {
    await makeRequest('/users/register', 'POST', { email, password });
    console.log('✅ User registered successfully');
    return { email, password };
  } catch (error) {
    console.log('⚠️  Registration failed:', error.message);
    throw error;
  }
}

async function login(email, password) {
  console.log('\n🔐 Step 2: Logging in...');
  try {
    const response = await makeRequest('/users/login', 'POST', { email, password });
    authToken = response.token;
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
      bio: 'This is a test bio for testing the complete persona creation flow.',
    });
    console.log('✅ Artist profile created');
    if (response.artist) {
      console.log(`   Artist ID: ${response.artist.id || 'N/A'}`);
      console.log(`   Artist Name: ${response.artist.artist_name || 'N/A'}`);
      return response.artist;
    } else {
      console.log(`   Response:`, JSON.stringify(response, null, 2));
      return response;
    }
  } catch (error) {
    console.error('❌ Failed to create artist profile:', error.message);
    throw error;
  }
}

async function createPersonaViaQuestionnaire() {
  console.log('\n🎭 Step 4: Creating persona via questionnaire...');
  try {
    const responses = [
      {
        question_key: 'musical_style',
        question_text: 'How would you describe your musical style and genre?',
        answer_text: 'Pop. This is a test bio for testing the complete persona creation flow.',
        answer_type: 'text'
      },
      {
        question_key: 'target_audience',
        question_text: 'Who is your ideal listener or fan?',
        answer_text: 'Music enthusiasts who appreciate my genre',
        answer_type: 'text'
      },
      {
        question_key: 'inspiration',
        question_text: 'What or who inspires your music and creativity?',
        answer_text: 'Various artists and life experiences',
        answer_type: 'text'
      },
      {
        question_key: 'personality_tone',
        question_text: 'How would you describe your personality in social media posts?',
        answer_text: 'authentic and engaging',
        answer_type: 'text'
      },
      {
        question_key: 'key_messages',
        question_text: 'What key messages or themes do you want to communicate to your fans?',
        answer_text: 'This is a test bio for testing the complete persona creation flow.',
        answer_type: 'text'
      }
    ];

    const response = await makeRequest('/personas/questionnaire', 'POST', { responses });
    console.log('✅ Persona created via questionnaire');
    console.log(`   Persona ID: ${response.persona_id}`);
    console.log(`   Responses saved: ${response.responses_count}`);
    return response;
  } catch (error) {
    console.error('❌ Failed to create persona:', error.message);
    throw error;
  }
}

async function checkPersona() {
  console.log('\n🔍 Step 5: Verifying persona exists...');
  try {
    const response = await makeRequest('/personas/persona', 'GET');
    console.log('✅ Persona retrieved successfully');
    console.log(`   Persona Name: ${response.persona.persona_name}`);
    console.log(`   Tone: ${response.persona.tone || 'Not set'}`);
    console.log(`   Target Audience: ${response.persona.target_audience || 'Not set'}`);
    console.log(`   Questionnaire Responses: ${response.questionnaire_responses?.length || 0}`);
    return response.persona;
  } catch (error) {
    console.error('❌ Failed to get persona:', error.message);
    throw error;
  }
}

async function generateContent() {
  console.log('\n✨ Step 6: Generating AI content...');
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
  console.log('🚀 TribeBuilders - Complete Persona Creation Flow Test');
  console.log('======================================================');

  try {
    // Step 1 & 2: Register and login
    const { email, password } = await register();
    await login(email, password);

    // Step 3: Create artist profile
    await createArtistProfile();

    // Step 4: Create persona via questionnaire
    await createPersonaViaQuestionnaire();

    // Step 5: Verify persona exists
    await checkPersona();

    // Step 6: Generate content
    await generateContent();

    console.log('\n✅ All tests passed!');
    console.log('\n💡 Complete flow working:');
    console.log('   1. ✅ User registration');
    console.log('   2. ✅ User login');
    console.log('   3. ✅ Artist profile creation');
    console.log('   4. ✅ Persona creation via questionnaire');
    console.log('   5. ✅ Persona retrieval');
    console.log('   6. ✅ AI content generation');
    console.log('\n🎉 Your application is fully functional!');

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
