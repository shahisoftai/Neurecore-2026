(async () => {
  try {
    const r1 = await fetch('http://127.0.0.1:3000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'Admin123!',
      }),
    });
    const login = await r1.json();
    console.log('login:', JSON.stringify(login, null, 2));
    const token = login.data.tokens.accessToken;
    const r2 = await fetch('http://127.0.0.1:3000/api/v1/tenants?search=demo', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const tenants = await r2.json();
    console.log('tenants:', JSON.stringify(tenants, null, 2));
  } catch (e) {
    console.error(e.stack || e.message);
    process.exit(1);
  }
})();
