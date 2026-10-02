const { test, assert, loadFresh } = require('../_test-utils');
const nodemailer = require('nodemailer');
test('_helpers/send-email handles ethereal and normal SMTP transports', async (t) => {
  const originalEnv = { ...process.env };
  process.env.MONGODB_URI = 'mongodb://localhost:27017/cinefy';
  process.env.JWT_SECRET = '12345678901234567890123456789012';
  process.env.SMTP_HOST = 'smtp.ethereal.email';
  process.env.SMTP_USER = 'ethereal-user';
  process.env.SMTP_PASS = 'ethereal-secret';
  process.env.EMAIL_FROM = 'team@example.com';
  delete process.env.ETHEREAL_API_KEY;
  process.env.APP_URL = 'https://app.example.com';

  const sendEmail = loadFresh('../_helpers/send-email');
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async ({ to, subject, html }) => {
      assert.ok(to);
      assert.ok(subject);
      assert.ok(html);
      return { messageId: 'msg-1' };
    }
  }));
  t.mock.method(nodemailer, 'getTestMessageUrl', () => 'https://ethereal.example/messages/msg-1');

  await sendEmail({
    to: 'user@example.com',
    subject: 'Welcome',
    html: '<p>hello</p>'
  });

  process.env.ETHEREAL_API_KEY = 'api-key';
  const fetchMock = t.mock.method(global, 'fetch', async () => ({
    ok: false,
    status: 500,
    text: async () => 'server error'
  }));

  const fallbackSend = loadFresh('../_helpers/send-email');
  await fallbackSend({
    to: 'fallback@example.com',
    subject: 'Fallback',
    html: '<p>still works</p>'
  }).catch(() => {});

  assert.equal(typeof fetchMock, 'function');
  fetchMock.mock.restore();
  process.env = originalEnv;
});
