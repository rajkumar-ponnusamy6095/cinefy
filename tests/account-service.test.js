const { test, assert } = require('../_test-utils');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
test('account.service covers auth, token and password flows', async (t) => {
  const db = require('../_helpers/db');
  const service = require('../accounts/account.service');
  const config = require('../config');
  config.secret = '12345678901234567890123456789012';

  const accountRecord = {
    _id: { toString: () => 'account-1' },
    email: 'existing@example.com',
    firstName: 'Test',
    lastName: 'User',
    gender: 'female',
    phone: '123',
    department: 'Engineering',
    status: 'active',
    role: 'User',
    createdAt: new Date('2024-01-01'),
    updated: new Date('2024-01-02'),
    verified: new Date('2024-01-01'),
    passwordHash: 'hashed',
    isVerified: true,
    passwordReset: null,
    save: async () => {},
    deleteOne: async () => {}
  };

  class AccountModel {
    constructor(data) {
      Object.assign(this, data);
      this.id = data.id || 'account-1';
      this._id = { toString: () => this.id };
      this.save = async () => {};
      this.deleteOne = async () => {};
    }

    static findOne(query) {
      if (query && query.email === 'existing@example.com') {
        return Promise.resolve({ ...accountRecord, email: 'existing@example.com', save: async () => {} });
      }
      if (query && query.email === 'created@example.com') {
        return Promise.resolve(null);
      }
      if (query && query.verificationToken === 'token-1') {
        return Promise.resolve({ ...accountRecord, verificationToken: 'token-1', save: async () => {} });
      }
      if (query && query['resetToken.token'] === 'token-1') {
        return Promise.resolve({ ...accountRecord, resetToken: { token: 'token-1', expires: new Date(Date.now() + 60000) }, save: async () => {} });
      }
      if (query && query.email === 'new@example.com') {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    }

    static countDocuments() { return Promise.resolve(0); }

    static findById(id) {
      if (id === 'bad-id') {
        return { select() { return this; }, lean: async () => null };
      }
      const document = { ...accountRecord, id: 'account-1', _id: { toString: () => 'account-1' }, save: async () => {}, deleteOne: async () => {} };
      return {
        ...document,
        select() { return this; },
        lean: async () => ({ ...document }),
        save: async () => {},
        deleteOne: async () => {}
      };
    }

    static find() {
      return {
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        select() { return this; },
        lean: async () => [{ ...accountRecord, _id: { toString: () => 'account-1' } }]
      };
    }
  }

  class RefreshTokenModel {
    constructor(data) {
      Object.assign(this, data);
      this.id = data.token || 'token-1';
      this.save = async () => {};
    }

    static findOne({ token }) {
      const refreshRecord = {
        token,
        account: { id: 'account-1', email: 'account@example.com' },
        isActive: true,
        revoked: null,
        expires: new Date(Date.now() + 86400000),
        save: async () => {},
        populate() { return this; }
      };
      return refreshRecord;
    }

    static exists() { return Promise.resolve(true); }
    static deleteMany() { return Promise.resolve(); }
  }

  const originalAccount = db.Account;
  const originalRefreshToken = db.RefreshToken;
  const originalIsValidId = db.isValidId;
  db.Account = AccountModel;
  db.RefreshToken = RefreshTokenModel;
  db.isValidId = id => !!id && id !== 'bad-id' && id !== 'bad';

  const sentEmails = [];
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async ({ to, subject, html }) => {
      assert.ok(to);
      assert.ok(subject);
      assert.ok(html);
      sentEmails.push({ to, subject, html });
      return { messageId: 'msg-1' };
    }
  }));
  const compareStub = t.mock.method(bcrypt, 'compare', async () => true);
  const hashStub = t.mock.method(bcrypt, 'hash', async password => `hash:${password}`);

  const auth = await service.authenticate({ email: 'existing@example.com', password: 'secret', ipAddress: '127.0.0.1' });
  assert.equal(auth.email, 'existing@example.com');
  assert.ok(auth.jwtToken);
  assert.ok(auth.refreshToken);

  const refresh = await service.refreshToken({ token: 'token-1', ipAddress: '127.0.0.2' });
  assert.equal(refresh.email, 'account@example.com');
  assert.ok(refresh.jwtToken);
  assert.ok(refresh.refreshToken);

  await service.revokeToken({ token: 'token-1', ipAddress: '127.0.0.3' });
  await service.logout({ token: 'token-1', ipAddress: '127.0.0.4' });

  await service.register({
    email: 'new@example.com',
    password: 'secret123',
    firstName: 'New',
    lastName: 'User',
    gender: 'male',
    department: 'Finance',
    phone: '999'
  });
  await service.register({
    email: 'existing@example.com',
    password: 'secret123',
    firstName: 'User',
    lastName: 'Existing',
    gender: 'male'
  });

  await service.verifyEmail({ token: 'token-1' });
  await assert.rejects(() => service.verifyEmail({ token: 'missing' }), /Verification failed/);

  await service.forgotPassword({ email: 'existing@example.com' });
  await service.validateResetToken({ token: 'token-1' });
  await assert.rejects(() => service.validateResetToken({ token: 'bad' }), /Invalid token/);
  await service.resetPassword({ token: 'token-1', password: 'newpass123' });

  const all = await service.getAll({
    search: 'user',
    role: 'User',
    status: 'active',
    department: 'Engineering',
    sortBy: 'id',
    sortOrder: 'asc',
    page: 1,
    pagination: 'page',
    limit: 10
  });
  assert.equal(all.data.length, 1);
  assert.equal(all.pagination.page, 1);

  const cursor = await service.getAll({
    sortBy: 'id',
    pagination: 'cursor',
    afterId: '507f1f77bcf86cd799439011',
    limit: 1
  });
  assert.ok(cursor.pagination.hasMore !== undefined);

  await assert.rejects(() => service.getAll({ sortBy: 'unknown' }), /Invalid sort field/);
  await assert.rejects(() => service.getAll({ pagination: 'bad' }), /pagination must be "page" or "cursor"/);
  await assert.rejects(() => service.getAll({ pagination: 'cursor', sortBy: 'email' }), /Cursor pagination only supports sorting by id/);
  await assert.rejects(() => service.getAll({ pagination: 'cursor', afterId: 'bad' }), /afterId must be a valid account id/);

  const byId = await service.getById('account-1');
  assert.equal(byId.email, 'existing@example.com');
  await assert.rejects(() => service.getById('bad-id'), /Account not found/);

  const created = await service.create({
    email: 'created@example.com',
    firstName: 'Create',
    lastName: 'User',
    gender: 'male',
    role: 'User'
  });
  assert.equal(created.email, 'created@example.com');
  assert.equal(created.isVerified, false);
  const passwordSetupEmail = sentEmails.find(email => email.to === 'created@example.com');
  assert.equal(passwordSetupEmail.subject, 'Cinefy - Set Password');
  assert.match(passwordSetupEmail.html, /set your password/i);
  assert.match(passwordSetupEmail.html, /reset-password/);

  const updated = await service.update('account-1', { firstName: 'Updated', password: 'changed' });
  assert.equal(updated.firstName, 'Updated');
  await assert.rejects(() => service.update('bad-id', {}), /Account not found/);

  await service.delete('account-1');

  db.Account = originalAccount;
  db.RefreshToken = originalRefreshToken;
  db.isValidId = originalIsValidId;
  hashStub.mock.restore();
  compareStub.mock.restore();
});
