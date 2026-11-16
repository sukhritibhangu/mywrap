const test = require('node:test');
delete process.env.GOOGLE_CLIENT_ID;
const assert = require('node:assert/strict');
const express = require('express');
const User = require('../src/models/User');
const authRoutes = require('../src/routes/authRoutes');

test('OTP send is rate-limited by both IP and hashed email account key', async () => {
  const originalFindOne = User.findOne;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    LOCAL_OTP_ENABLED: process.env.LOCAL_OTP_ENABLED,
  };
  process.env.NODE_ENV = 'development';
  process.env.LOCAL_OTP_ENABLED = 'true';
  User.findOne = () => Promise.resolve(null);
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(authRoutes);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const { port } = server.address();
    const send = (ip) => fetch(`http://127.0.0.1:${port}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ email: 'student@example.com' }),
    });

    const responses = [];
    for (let index = 1; index <= 6; index += 1) {
      responses.push(await send(`198.51.100.${index}`));
    }
    assert.deepEqual(responses.map((item) => item.status), [200, 200, 200, 200, 200, 429]);
    const rateMessage = await responses[5].json();
    assert.match(rateMessage.message, /Too many code requests/);
  } finally {
    User.findOne = originalFindOne;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise((resolve) => server.close(resolve));
  }
});
