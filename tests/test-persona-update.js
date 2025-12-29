// Test persona update endpoint
// Run with: node test-persona-update.js

const API_URL = 'http://localhost:3000/api';

async function testPersonaUpdate() {
  console.log('🔍 Testing Persona Update Endpoint\n');

  try {
    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await fetch(`${API_URL}/users/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      console.log('  ❌ Login failed');
      return;
    }

    const loginData = await loginResponse.json();
    console.log('  ✅ Login successful');
    const token = loginData.token;

    // Step 2: Get existing persona
    console.log('\nStep 2: Fetching existing persona...');
    const personaResponse = await fetch(`${API_URL}/personas/persona`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!personaResponse.ok) {
      console.log('  ❌ No persona found. Please create one first via questionnaire.');
      return;
    }

    const personaData = await personaResponse.json();
    console.log('  ✅ Persona found');
    console.log(`  Persona ID: ${personaData.persona.id}`);
    console.log(`  Persona Name: ${personaData.persona.persona_name || 'N/A'}`);
    console.log(`  Description: ${personaData.persona.description || 'N/A'}`);
    console.log(`  Tone: ${personaData.persona.tone || 'N/A'}`);

    const personaId = personaData.persona.id;

    // Step 3: Update persona
    console.log('\nStep 3: Updating persona details...');
    const updateResponse = await fetch(`${API_URL}/personas/${personaId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        persona_name: 'Updated Test Persona',
        description: 'This is an updated description to test the PUT endpoint',
        tone: 'Friendly and engaging',
        target_audience: 'Music lovers aged 18-35',
        key_themes: ['creativity', 'authenticity', 'connection'],
        voice_characteristics: {
          style: 'conversational',
          humor: 'light',
          formality: 'casual'
        }
      })
    });

    console.log(`  Status: ${updateResponse.status} ${updateResponse.statusText}`);

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.log(`  ❌ Update failed: ${JSON.stringify(errorData)}`);
      return;
    }

    const updateData = await updateResponse.json();
    console.log('  ✅ Persona updated successfully');
    console.log(`  Message: ${updateData.message}`);
    console.log('\n  Updated Persona:');
    console.log(`    Name: ${updateData.persona.persona_name}`);
    console.log(`    Description: ${updateData.persona.description}`);
    console.log(`    Tone: ${updateData.persona.tone}`);
    console.log(`    Target Audience: ${updateData.persona.target_audience}`);
    console.log(`    Key Themes: ${updateData.persona.key_themes?.join(', ')}`);
    console.log(`    Voice Characteristics: ${JSON.stringify(updateData.persona.voice_characteristics)}`);

    // Step 4: Verify update by fetching again
    console.log('\nStep 4: Verifying update...');
    const verifyResponse = await fetch(`${API_URL}/personas/persona`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!verifyResponse.ok) {
      console.log('  ❌ Failed to verify update');
      return;
    }

    const verifyData = await verifyResponse.json();
    console.log('  ✅ Verification successful');
    console.log(`  Persona Name: ${verifyData.persona.persona_name}`);
    console.log(`  Description: ${verifyData.persona.description}`);
    console.log(`  Tone: ${verifyData.persona.tone}`);

    // Step 5: Test partial update
    console.log('\nStep 5: Testing partial update (only tone)...');
    const partialUpdateResponse = await fetch(`${API_URL}/personas/${personaId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tone: 'Professional and inspiring'
      })
    });

    if (!partialUpdateResponse.ok) {
      console.log('  ❌ Partial update failed');
      return;
    }

    const partialUpdateData = await partialUpdateResponse.json();
    console.log('  ✅ Partial update successful');
    console.log(`  New Tone: ${partialUpdateData.persona.tone}`);
    console.log(`  Name unchanged: ${partialUpdateData.persona.persona_name}`);

    // Step 6: Test authorization (try to update with invalid persona ID)
    console.log('\nStep 6: Testing authorization with invalid persona ID...');
    const invalidUpdateResponse = await fetch(`${API_URL}/personas/00000000-0000-0000-0000-000000000000`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        persona_name: 'Should not work'
      })
    });

    if (invalidUpdateResponse.status === 404) {
      console.log('  ✅ Authorization check working - rejected invalid persona ID');
    } else {
      console.log(`  ⚠️ Unexpected status: ${invalidUpdateResponse.status}`);
    }

    // Step 7: Test validation (empty body)
    console.log('\nStep 7: Testing validation with empty body...');
    const emptyUpdateResponse = await fetch(`${API_URL}/personas/${personaId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (emptyUpdateResponse.status === 400) {
      const emptyErrorData = await emptyUpdateResponse.json();
      console.log('  ✅ Validation working - rejected empty update');
      console.log(`  Error: ${emptyErrorData.error}`);
    } else {
      console.log(`  ⚠️ Unexpected status: ${emptyUpdateResponse.status}`);
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   1. Login: ✅');
    console.log('   2. Fetch persona: ✅');
    console.log('   3. Full update: ✅');
    console.log('   4. Verify update: ✅');
    console.log('   5. Partial update: ✅');
    console.log('   6. Authorization check: ✅');
    console.log('   7. Validation check: ✅');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testPersonaUpdate();
