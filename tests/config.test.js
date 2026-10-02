const { test, assert, loadFresh } = require('../_test-utils');
test('config.validate accepts valid env values and rejects invalid ones', () => {
  const originalEnv = { ...process.env };
  const validEnv = {
    MONGODB_URI: 'mongodb://localhost:27017/cinefy',
    JWT_SECRET: '12345678901234567890123456789012',
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'mailer',
    SMTP_PASS: 'secret',
    EMAIL_FROM: 'no-reply@example.com',
    APP_URL: 'https://example.com',
    PORT: '4001',
    DB_MAX_POOL_SIZE: '25',
    CORS_ORIGINS: 'https://app.example.com, https://admin.example.com'
  };

  Object.assign(process.env, validEnv);
  const config = loadFresh('../config');
  assert.equal(config.connectionString, validEnv.MONGODB_URI);
  assert.equal(config.dbMaxPoolSize, 25);
  assert.deepEqual(config.corsOrigins, ['https://app.example.com', 'https://admin.example.com']);
  assert.doesNotThrow(() => config.validate());

  Object.assign(process.env, {
    JWT_SECRET: 'short',
    SMTP_PORT: '99999',
    PORT: '0',
    DB_MAX_POOL_SIZE: '0',
    APP_URL: 'ftp://example.com'
  });
  const invalidConfig = loadFresh('../config');
  assert.throws(() => invalidConfig.validate(), /JWT_SECRET must contain at least 32 characters/);

  Object.assign(process.env, {
    JWT_SECRET: '12345678901234567890123456789012',
    SMTP_PORT: '1',
    PORT: '4001',
    DB_MAX_POOL_SIZE: '25',
    APP_URL: 'http://example.com'
  });
  process.env.MONGODB_URI = '';
  process.env.DB_CONN = '';
  const withMissing = loadFresh('../config');
  assert.throws(() => withMissing.validate(), /Missing required environment variables: DB_CONN/);

  process.env = originalEnv;
});
