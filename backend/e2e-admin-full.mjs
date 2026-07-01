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
    console.log('Admin login');
    const admin = await post('/api/v1/auth/login', {
      email: 'admin@example.com',
      password: 'Admin123!',
    });
    if (admin.status !== 200) {
      console.error('admin login failed', admin);
      process.exit(1);
    }
    const token = admin.body.data.tokens.accessToken;
    console.log('Fetching tenants (search demo)');
    const tenants = await get('/api/v1/tenants?search=demo', token);
    console.log('tenants status', tenants.status);
    const tenant =
      tenants.body?.data?.data?.find((t) => t.slug === 'demo-tenant') ||
      tenants.body?.data?.data?.[0];
    if (!tenant) {
      console.error('tenant not found', tenants.body);
      process.exit(1);
    }
    console.log('using tenant id', tenant.id, 'slug', tenant.slug);

    console.log('Admin fetch departments with tenantId');
    const deps = await get(`/api/v1/departments?tenantId=${tenant.id}`, token);
    console.log('departments', deps.status, JSON.stringify(deps.body, null, 2));

    console.log('Admin fetch agent-templates with tenantId');
    const at = await get(
      `/api/v1/agent-templates?page=1&limit=20&type=CHAT`,
      token,
    );
    console.log(
      'agent-templates (tenant) status',
      at.status,
      JSON.stringify(
        at.body?.data?.data?.length
          ? `templates:${at.body.data.data.length}`
          : at.body,
        null,
        2,
      ),
    );

    console.log('Admin fetch platform templates (platform route)');
    const platform = await get(
      '/api/v1/agent-templates/platform?page=1&limit=20',
      token,
    );
    console.log(
      'platform templates',
      platform.status,
      JSON.stringify(
        platform.body?.data?.data?.length
          ? `templates:${platform.body.data.data.length}`
          : platform.body,
        null,
        2,
      ),
    );
  } catch (e) {
    console.error('err', e.stack || e.message);
    process.exit(1);
  }
})();
