const { test, assert, makeResponse } = require('../_test-utils');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function captureRes() {
  return { status(code) { this.code = code; return { json: body => { this.body = body; } }; } };
}

function routeHandler(path, method, name) {
  const router = require('../accounts/account.controller');
  const route = router.stack.find(layer => layer.route && layer.route.path === path && layer.route.methods[method]).route;
  return name ? route.stack.find(layer => layer.handle.name === name).handle : route.stack.at(-1).handle;
}

function validate(path, method, name, body, user) {
  let error;
  routeHandler(path, method, name)({ body, user }, {}, err => { error = err; });
  return error;
}

test('authorize returns 403 for an insufficient role and 401 for a deleted account', async (t) => {
  const authorize = require('../_middleware/authorize');
  const db = require('../_helpers/db');
  const originalAccount = db.Account;
  t.after(() => { db.Account = originalAccount; });
  t.mock.method(jwt, 'verify', () => ({ id: 'account-1' }));

  let account = { _id: { toString: () => 'account-1' }, role: 'User' };
  db.Account = { findById: () => ({ select: () => ({ lean: async () => account }) }) };

  const forbidden = captureRes();
  let nextCalled = false;
  await authorize(['Admin'])({ headers: { authorization: 'Bearer t' } }, forbidden, () => { nextCalled = true; });
  assert.equal(forbidden.code, 403);
  assert.equal(nextCalled, false);

  account = null;
  const deleted = captureRes();
  await authorize()({ headers: { authorization: 'Bearer t' } }, deleted, () => { nextCalled = true; });
  assert.equal(deleted.code, 401);
  assert.equal(nextCalled, false);
});

test('ownership failures return 403', async () => {
  const user = { id: 'owner-1', role: 'User', ownsToken: async () => false };
  for (const method of ['get', 'put', 'delete']) {
    const res = captureRes();
    await routeHandler('/:id', method)({ params: { id: 'someone-else' }, body: {}, user }, res, assert.fail);
    assert.equal(res.code, 403, method);
    assert.equal(res.body.message, 'You can only access your own account');
  }

  const res = captureRes();
  await routeHandler('/revoke-token', 'post')({ body: { token: 'tok' }, cookies: {}, user, ip: '::1' }, res, assert.fail);
  assert.equal(res.code, 403);
  assert.equal(res.body.message, 'You can only revoke your own tokens');
});

test('passwords must be at least 8 characters', () => {
  const register = { gender: 'male', firstName: 'A', lastName: 'B', email: 'a@example.com', acceptTerms: true };
  assert.ok(validate('/register', 'post', 'registerSchema', { ...register, password: 'pass123', confirmPassword: 'pass123' }));
  assert.equal(validate('/register', 'post', 'registerSchema', { ...register, password: 'pass1234', confirmPassword: 'pass1234' }), undefined);

  assert.ok(validate('/reset-password', 'post', 'resetPasswordSchema', { token: 't', password: 'short12', confirmPassword: 'short12' }));
  assert.ok(validate('/change-password', 'post', 'changePasswordSchema', { oldPassword: 'x', newPassword: 'short12', confirmPassword: 'short12' }));
  assert.ok(validate('/:id', 'put', 'updateSchema', { password: 'short12', confirmPassword: 'short12' }, { role: 'User' }));
});

test('inactive accounts cannot authenticate or refresh', async (t) => {
  const db = require('../_helpers/db');
  const service = require('../accounts/account.service');
  const originals = { Account: db.Account, RefreshToken: db.RefreshToken };
  t.after(() => Object.assign(db, originals));
  t.mock.method(bcrypt, 'compare', async () => true);

  db.Account = {
    findOne: async () => ({ email: 'a@example.com', passwordHash: 'h', isVerified: true, status: 'inactive' })
  };
  await assert.rejects(
    () => service.authenticate({ email: 'a@example.com', password: 'password123', ipAddress: '::1' }),
    error => error.status === 403 && error.message === 'Your account is inactive'
  );

  const stored = {
    isActive: true,
    account: { email: 'a@example.com', status: 'inactive' },
    save: async function () { this.saved = true; }
  };
  db.RefreshToken = { findOne: () => ({ populate: async () => stored }) };
  await assert.rejects(
    () => service.refreshToken({ token: 'tok', ipAddress: '::1' }),
    error => error.status === 403
  );
  assert.ok(stored.revoked, 'refresh token is revoked');
  assert.equal(stored.revokedByIp, '::1');
  assert.equal(stored.saved, true);
});

test('password reset tokens expire after 15 minutes', async (t) => {
  const db = require('../_helpers/db');
  const service = require('../accounts/account.service');
  const originalAccount = db.Account;
  t.after(() => { db.Account = originalAccount; });

  let resetToken;
  db.Account = {
    findOne: async () => ({
      email: 'a@example.com',
      save: async function () { resetToken = this.resetToken; throw new Error('stop-before-email'); }
    })
  };
  const before = Date.now();
  await assert.rejects(() => service.forgotPassword({ email: 'a@example.com' }), /stop-before-email/);
  const ttl = resetToken.expires.getTime() - before;
  assert.ok(ttl > 14 * 60 * 1000 && ttl <= 15 * 60 * 1000 + 1000, `ttl was ${ttl}ms`);
});
