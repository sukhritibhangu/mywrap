const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { createGmailSmtpEmailService } = require('../src/services/gmailSmtpEmailService');

test('Gmail SMTP sends a branded OTP through Gmail using an App Password', async () => {
  let transportConfig;
  let mail;
  const service = createGmailSmtpEmailService({
    getEnv: () => ({ SMTP_USER: 'wrapchik.sender@gmail.com', SMTP_APP_PASSWORD: 'app-password-1234' }),
    nodemailerClient: {
      createTransport(config) {
        transportConfig = config;
        return { sendMail: async payload => { mail = payload; return { messageId: 'gmail-message-id' }; } };
      },
    },
  });
  const result = await service.sendOtpEmail({ to: 'student@thapar.edu', code: '123456', purpose: 'SIGNUP' });

  assert.equal(transportConfig.service, 'gmail');
  assert.equal(transportConfig.auth.user, 'wrapchik.sender@gmail.com');
  assert.equal(transportConfig.auth.pass, 'app-password-1234');
  assert.equal(mail.from, 'Wrapchik <wrapchik.sender@gmail.com>');
  assert.equal(mail.to, 'student@thapar.edu');
  assert.match(mail.text, /123456/);
  assert.match(mail.text, /10 minutes/);
  assert.deepEqual(result, { id: 'gmail-message-id' });
});

test('Gmail SMTP credentials take precedence over a Resend test sender for student signup', async () => {
  const { createEmailOtpService } = require('../src/services/emailOtpService');
  const originalCreateTransport = nodemailer.createTransport;
  let transportConfig;
  let sentMessage;
  nodemailer.createTransport = config => {
    transportConfig = config;
    return { sendMail: async message => { sentMessage = message; return { messageId: 'smtp-signup-id' }; } };
  };
  const Challenge = {
    async init() {},
    async findOneAndUpdate() { return { _id: 'challenge-1' }; },
    async updateOne() { return { matchedCount: 1 }; },
  };
  try {
    const service = createEmailOtpService({
      Challenge,
      getEnv: () => ({
        NODE_ENV: 'production', LOCAL_OTP_ENABLED: 'false',
        SMTP_USER: 'wrapchik.sender@gmail.com', SMTP_APP_PASSWORD: 'gmail-app-password',
        RESEND_API_KEY: 'legacy-resend-key', EMAIL_FROM: 'Wrapchik <onboarding@resend.dev>',
        JWT_SECRET: 'a-long-test-secret-that-is-more-than-32-characters',
      }),
      randomInt: () => 654321,
      randomUUID: () => 'signup-nonce',
    });
    const result = await service.requestCode({
      email: 'student@thapar.edu', purpose: 'SIGNUP',
      pendingRegistration: { name: 'Student', phone: '+911234567890', passwordHash: 'bcrypt-hash' },
    });
    assert.equal(result.provider, 'gmail');
    assert.equal(transportConfig.service, 'gmail');
    assert.equal(sentMessage.to, 'student@thapar.edu');
  } finally {
    nodemailer.createTransport = originalCreateTransport;
  }
});
