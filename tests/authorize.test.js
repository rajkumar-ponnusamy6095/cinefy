const { test, assert } = require('../_test-utils');
const jwt = require('jsonwebtoken');
test('_middleware/authorize guards authenticated routes', async (t) => {
  const authorize = require('../_middleware/authorize');
  const db = require('../_helpers/db');
  const config = require('../config');
  config.secret = '12345678901234567890123456789012';

  const missingToken = authorize();
  const missingRes = { status(code) { this.code = code; return { json: body => { this.body = body; } }; } };
  let nextCalled = false;
  await missingToken({ headers: {} }, missingRes, () => { nextCalled = true; });
  assert.equal(missingRes.code, 401);
  assert.equal(nextCalled, false);

  const invalidRes = { status(code) { this.code = code; return { json: body => { this.body = body; } }; } };
  t.mock.method(jwt, 'verify', () => { throw new Error('bad'); });
  await authorize()({ headers: { authorization: 'Bearer bad-token' } }, invalidRes, () => { nextCalled = true; });
  assert.equal(invalidRes.code, 401);

  const originalAccount = db.Account;
  const originalRefreshToken = db.RefreshToken;
  db.Account = {
    findById: () => ({
      select: () => ({
        lean: async () => ({ _id: { toString: () => 'account-1' }, role: 'User' })
      })
    })
  };
  db.RefreshToken = { exists: async () => true };
  t.mock.method(jwt, 'verify', () => ({ id: 'account-1' }));

  const middleware = authorize(['User']);
  const req = { headers: { authorization: 'Bearer valid-token' } };
  const resSuccess = { status(code) { this.code = code; return { json: body => { this.body = body; } }; } };
  let nextInvoked = false;
  await middleware(req, resSuccess, () => { nextInvoked = true; });
  assert.equal(nextInvoked, true);
  assert.equal(req.user.role, 'User');
  assert.equal(typeof req.user.ownsToken, 'function');
  assert.equal(await req.user.ownsToken('token-1'), true);

  db.Account = originalAccount;
  db.RefreshToken = originalRefreshToken;
});
