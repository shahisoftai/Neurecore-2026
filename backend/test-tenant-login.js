async function testTenantLogin() {
  try {
    console.log('Testing tenant user login...');
    const loginRes = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'demo@neurecore.ai',
        password: 'Tenant@123!'
      })
    });

    const loginData = await loginRes.json();
    if (loginData.status !== 'success') {
      throw new Error('Login failed: ' + JSON.stringify(loginData));
    }

    const token = loginData.data.tokens.accessToken;
    console.log('✅ Login successful, got token');

    console.log('Testing workflows endpoint...');
    const workflowsRes = await fetch('http://localhost:3000/api/v1/workflows?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const workflowsData = await workflowsRes.json();
    console.log('✅ Workflows fetch successful:', JSON.stringify(workflowsData, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTenantLogin();