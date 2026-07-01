async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`http://127.0.0.1:3000${path}`, {
    method: 'POST',
    headers,
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
(async () => {
  try {
    console.log('Login admin');
    const admin = await post('/api/v1/auth/login', {
      email: 'admin@example.com',
      password: 'Admin123!',
    });
    const adminToken = admin.body?.data?.tokens?.accessToken;
    console.log('admin login', admin.status);

    console.log('Login demo tenant');
    const demo = await post('/api/v1/auth/login', {
      email: 'demo@neurecore.ai',
      password: 'Tenant@123!',
    });
    const demoToken = demo.body?.data?.tokens?.accessToken;
    console.log('demo login', demo.status);

    console.log('Get tenants (admin)');
    const tenants = await get('/api/v1/tenants?search=demo', adminToken);
    console.log('tenants status', tenants.status);
    const tenant = tenants.body?.data?.items?.[0];
    console.log('tenant id', tenant?.id, 'slug', tenant?.slug);

    console.log('\nAdmin: departments with tenantId');
    const deps = await get(
      `/api/v1/departments?tenantId=${tenant?.id}`,
      adminToken,
    );
    console.log('deps', deps.status, JSON.stringify(deps.body, null, 2));

    console.log('\nDemo user: agent-templates (tenant scope)');
    const atTenant = await get(
      '/api/v1/agent-templates?page=1&limit=20',
      demoToken,
    );
    console.log(
      'agent-templates tenant',
      atTenant.status,
      JSON.stringify(
        atTenant.body?.data?.items?.length ?? atTenant.body,
        null,
        2,
      ),
    );

    console.log('\nAdmin: platform templates');
    const atPlatform = await get(
      '/api/v1/agent-templates/platform?page=1&limit=20',
      adminToken,
    );
    console.log(
      'platform templates',
      atPlatform.status,
      JSON.stringify(
        atPlatform.body?.data?.items?.length ?? atPlatform.body,
        null,
        2,
      ),
    );

    console.log('\nDone');
  } catch (e) {
    console.error(e.stack || e.message);
    process.exit(1);
  }
})();
