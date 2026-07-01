async function post(path, body) {
  const res = await fetch(`http://127.0.0.1:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`http://127.0.0.1:3000${path}`, { headers });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

(async function main() {
  try {
    console.log('Logging in tenant demo@neurecore.ai');
    const tenantLogin = await post('/api/v1/auth/login', {
      email: 'demo@neurecore.ai',
      password: 'Tenant@123!',
    });
    console.log('tenant login ->', tenantLogin.status);

    console.log('Logging in admin@example.com');
    const adminLogin = await post('/api/v1/auth/login', {
      email: 'admin@example.com',
      password: 'Admin123!',
    });
    console.log('admin login ->', adminLogin.status);

    const tenantToken = tenantLogin.body?.data?.tokens?.accessToken;
    const adminToken = adminLogin.body?.data?.tokens?.accessToken;

    console.log('\nTenant: fetch workflows (page=1)');
    const tw = await get('/api/v1/workflows?page=1&limit=10', tenantToken);
    console.log('status:', tw.status);
    console.log(JSON.stringify(tw.body, null, 2));

    console.log('\nAdmin: fetch departments');
    const ad = await get('/api/v1/departments', adminToken);
    console.log('status:', ad.status);
    console.log(JSON.stringify(ad.body, null, 2));

    console.log('\nAdmin: fetch agent-templates');
    const at = await get('/api/v1/agent-templates', adminToken);
    console.log('status:', at.status);
    console.log(
      Array.isArray(at.body?.data?.data)
        ? `templates:${at.body.data.data.length}`
        : JSON.stringify(at.body, null, 2),
    );

    console.log('\nPublic: fetch models available');
    const mv = await get('/api/v1/models/available', null);
    console.log('status:', mv.status);
    console.log(JSON.stringify(mv.body, null, 2));

    console.log('\nSmoke tests complete');
  } catch (e) {
    console.error('Error running smoke tests:', e.stack || e.message);
    process.exit(1);
  }
})();
