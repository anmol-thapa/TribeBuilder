// Test login flow to diagnose 449 error
// Run with: node test-login-flow.js

const API_URL = 'http://localhost:3000/api';

async function testLoginFlow() {
  console.log('🔍 Testing Login Flow\n');

  try {
    // Step 1: Login
    console.log('Step 1: Attempting login...');
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

    console.log(`  Status: ${loginResponse.status} ${loginResponse.statusText}`);

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.log(`  Error: ${JSON.stringify(errorData)}`);
      return;
    }

    const loginData = await loginResponse.json();
    console.log(`  ✅ Login successful`);
    console.log(`  Token: ${loginData.token.substring(0, 30)}...`);

    const token = loginData.token;

    // Step 2: Call /users/me
    console.log('\nStep 2: Calling /users/me...');
    const meResponse = await fetch(`${API_URL}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`  Status: ${meResponse.status} ${meResponse.statusText}`);

    if (!meResponse.ok) {
      console.log(`  ❌ /users/me failed with status ${meResponse.status}`);
      const errorText = await meResponse.text();
      console.log(`  Error body: ${errorText}`);
      return;
    }

    const meData = await meResponse.json();
    console.log(`  ✅ /users/me successful`);
    console.log(`  User: ${meData.user.email}`);
    console.log(`  Artist: ${meData.artist ? meData.artist.artist_name : 'None'}`);

    // Step 3: Call /uploads/persona/files
    console.log('\nStep 3: Calling /uploads/persona/files...');
    const filesResponse = await fetch(`${API_URL}/uploads/persona/files`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`  Status: ${filesResponse.status} ${filesResponse.statusText}`);

    if (!filesResponse.ok) {
      console.log(`  ❌ /uploads/persona/files failed with status ${filesResponse.status}`);
      const errorText = await filesResponse.text();
      console.log(`  Error body: ${errorText}`);
      return;
    }

    const filesData = await filesResponse.json();
    console.log(`  ✅ /uploads/persona/files successful`);
    console.log(`  Files: ${filesData.total}`);

    console.log('\n✅ All steps completed successfully!');
    console.log('\n💡 If frontend shows 449 error, it might be:');
    console.log('   1. A caching issue in the browser');
    console.log('   2. A service worker or proxy intercepting requests');
    console.log('   3. An issue with the fetch implementation in the browser');
    console.log('   4. Try clearing browser cache and localStorage');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLoginFlow();
