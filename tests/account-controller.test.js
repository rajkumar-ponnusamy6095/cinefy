const { test, assert, makeResponse, invokeRoute } = require('../_test-utils');
const jwt = require('jsonwebtoken');
test('account.controller routes invoke all handlers and helper cookies', async (t) => {
  const db = require('../_helpers/db');
  const accountService = require('../accounts/account.service');
  const config = require('../config');
  config.secret = '12345678901234567890123456789012';

  const originalService = {
    authenticate: accountService.authenticate,
    refreshToken: accountService.refreshToken,
    logout: accountService.logout,
    revokeToken: accountService.revokeToken,
    register: accountService.register,
    verifyEmail: accountService.verifyEmail,
    forgotPassword: accountService.forgotPassword,
    validateResetToken: accountService.validateResetToken,
    resetPassword: accountService.resetPassword,
    getAll: accountService.getAll,
    getById: accountService.getById,
    create: accountService.create,
    update: accountService.update,
    delete: accountService.delete
  };

  accountService.authenticate = async ({ email, password }) => {
    assert.equal(email, 'user@example.com');
    assert.equal(password, 'password');
    return { email, jwtToken: 'jwt-1', refreshToken: 'refresh-1' };
  };
  accountService.refreshToken = async ({ token }) => {
    assert.equal(token, 'cookie-refresh');
    return { email: 'user@example.com', jwtToken: 'jwt-2', refreshToken: 'refresh-2' };
  };
  accountService.logout = async () => ({ ok: true });
  accountService.revokeToken = async () => ({ ok: true });
  accountService.register = async () => ({ ok: true });
  accountService.verifyEmail = async () => ({ ok: true });
  accountService.forgotPassword = async () => ({ ok: true });
  accountService.validateResetToken = async () => ({ ok: true });
  accountService.resetPassword = async () => ({ ok: true });
  accountService.getAll = async () => ({ data: [{ id: 'a1' }], pagination: { page: 1, limit: 10, total: 1 } });
  accountService.getById = async id => ({ id, email: 'user@example.com' });
  accountService.create = async input => ({ ...input, id: 'new-1' });
  accountService.update = async (id, input) => ({ id, ...input });
  accountService.delete = async () => undefined;

  db.Account = {
    findById: async () => ({
      _id: { toString: () => 'owner-1' },
      role: 'User',
      select: () => ({ lean: async () => ({ _id: { toString: () => 'owner-1' }, role: 'User' }) })
    })
  };
  db.RefreshToken = { exists: async () => true };

  const jwtMock = t.mock.method(jwt, 'verify', () => ({ id: 'owner-1' }));

  await invokeRoute('/authenticate', 'post', { body: { email: 'user@example.com', password: 'password' } });
  await invokeRoute('/refresh-token', 'post', { cookies: { refreshToken: 'cookie-refresh' } });
  await invokeRoute('/logout', 'post', { cookies: { refreshToken: 'cookie-refresh' } });
  await invokeRoute('/revoke-token', 'post', {
    headers: { authorization: 'Bearer valid-token' },
    body: { token: 'token-revoked' },
    user: { role: 'User', ownsToken: async () => true }
  });
  await invokeRoute('/register', 'post', { body: { gender: 'male', firstName: 'A', lastName: 'B', email: 'new@example.com', password: 'secret123', confirmPassword: 'secret123', acceptTerms: true } });
  await invokeRoute('/verify-email', 'post', { body: { token: 'abc' } });
  await invokeRoute('/forgot-password', 'post', { body: { email: 'user@example.com' } });
  await invokeRoute('/validate-reset-token', 'post', { body: { token: 'abc' } });
  await invokeRoute('/reset-password', 'post', { body: { token: 'abc', password: 'newpass', confirmPassword: 'newpass' } });
  await invokeRoute('/me', 'get', { headers: { authorization: 'Bearer valid-token' }, user: { id: 'owner-1', role: 'User' } });
  await invokeRoute('/', 'get', { query: { page: '1' }, headers: { authorization: 'Bearer valid-token' }, user: { role: 'Admin' } });
  await invokeRoute('/:id', 'get', { params: { id: 'owner-1' }, headers: { authorization: 'Bearer valid-token' }, user: { id: 'owner-1', role: 'User' } });
  await invokeRoute('/', 'post', { body: { gender: 'female', firstName: 'X', lastName: 'Y', email: 'x@example.com', password: 'secret', confirmPassword: 'secret', role: 'User' }, headers: { authorization: 'Bearer valid-token' }, user: { role: 'Admin' } });
  await invokeRoute('/:id', 'put', { params: { id: 'owner-1' }, body: { firstName: 'Updated', password: 'pass123', confirmPassword: 'pass123' }, headers: { authorization: 'Bearer valid-token' }, user: { id: 'owner-1', role: 'User' } });
  await invokeRoute('/:id', 'delete', { params: { id: 'owner-1' }, headers: { authorization: 'Bearer valid-token' }, user: { id: 'owner-1', role: 'User' } });

  const response = makeResponse();
  const router = require('../accounts/account.controller');
  const setTokenCookie = router.stack.find(layer => layer.route && layer.route.path === '/authenticate').route.stack[0].handle;
  if (setTokenCookie) {
    const response2 = makeResponse();
    response2.cookie = () => {};
    const nextFn = () => {};
    setTokenCookie({ body: { email: 'u@e.com', password: 'x' } }, response2, nextFn);
  }

  Object.assign(accountService, originalService);
  jwtMock.mock.restore();
});

test('account.controller admin account creation does not require a password', () => {
  const router = require('../accounts/account.controller');
  const createRoute = router.stack.find(layer =>
    layer.route && layer.route.path === '/' && layer.route.methods.post
  ).route;
  const createSchema = createRoute.stack[1].handle;
  const req = {
    body: {
      gender: 'female',
      firstName: 'New',
      lastName: 'User',
      email: 'new@example.com',
      role: 'User'
    }
  };
  let validationError;

  createSchema(req, {}, error => { validationError = error; });

  assert.equal(validationError, undefined);
});
