const { test, assert, loadFresh } = require('../_test-utils');
const mongoose = require('mongoose');
test('_helpers/db.connect, disconnect and id validation', async (t) => {
  const originalEnv = { ...process.env };
  process.env.MONGODB_URI = 'mongodb://localhost:27017/cinefy';
  process.env.JWT_SECRET = '12345678901234567890123456789012';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_USER = 'mailer';
  process.env.SMTP_PASS = 'secret';
  process.env.EMAIL_FROM = 'no-reply@example.com';
  process.env.DB_MAX_POOL_SIZE = '42';

  const config = loadFresh('../config');
  const db = loadFresh('../_helpers/db');
  config.dbMaxPoolSize = 42;

  const connectStub = t.mock.method(mongoose, 'connect', async () => 'connected');
  const disconnectStub = t.mock.method(mongoose, 'disconnect', async () => 'disconnected');

  const connected = await db.connect();
  assert.equal(connected, 'connected');
  assert.equal(connectStub.mock.calls.length, 1);
  assert.deepEqual(connectStub.mock.calls[0].arguments[0], 'mongodb://localhost:27017/cinefy');
  assert.deepEqual(connectStub.mock.calls[0].arguments[1], { maxPoolSize: 42 });

  const disconnected = await db.disconnect();
  assert.equal(disconnected, 'disconnected');
  assert.equal(disconnectStub.mock.calls.length, 1);
  assert.equal(db.isValidId('507f1f77bcf86cd799439011'), true);
  assert.equal(db.isValidId('bad-id'), false);

  process.env = originalEnv;
});
