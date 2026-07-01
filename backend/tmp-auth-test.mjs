import fs from 'fs';

async function post(path, body) {
  const res = await fetch(`http://127.0.0.1:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

(async function () {
  console.log('REGISTER');
  const reg = await post('/api/v1/auth/register', {
    email: 'ci-test+user@example.com',
    password: 'Password1!',
    firstName: 'CI',
    lastName: 'Test',
  });
  console.log('status:', reg.status);
  console.log(JSON.stringify(reg.body, null, 2));

  console.log('\nLOGIN');
  const login = await post('/api/v1/auth/login', {
    email: 'ci-test+user@example.com',
    password: 'Password1!',
  });
  console.log('status:', login.status);
  console.log(JSON.stringify(login.body, null, 2));
})();
