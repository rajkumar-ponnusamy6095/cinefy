const { test, assert } = require('../_test-utils');
test('_middleware/validate-request works for valid and invalid payloads', () => {
  const validateRequest = require('../_middleware/validate-request');
  const Joi = require('joi');
  const schema = Joi.object({
    email: Joi.string().email().required(),
    role: Joi.string().valid('user', 'admin')
  });

  const validReq = { body: { email: 'test@example.com', role: 'user', extra: 'ignored' } };
  let validNextCalled = false;
  validateRequest(validReq, () => { validNextCalled = true; }, schema);
  assert.equal(validNextCalled, true);
  assert.deepEqual(validReq.body, { email: 'test@example.com', role: 'user' });

  const invalidReq = { body: { email: 'not-an-email' } };
  let invalidNextArg;
  validateRequest(invalidReq, err => { invalidNextArg = err; }, schema);
  assert.ok(invalidNextArg instanceof Error);
  assert.equal(invalidNextArg.status, 400);
  assert.match(invalidNextArg.message, /Validation error/);
});
test('_middleware/error-handler covers all response branches', () => {
  const errorHandler = require('../_middleware/error-handler');

  const makeRes = () => {
    const res = {
      headersSent: false,
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        this.body = value;
        return this;
      },
      send() { return this; }
    };
    return res;
  };

  let res = makeRes();
  errorHandler('User not found', {}, res, () => {});
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: 'User not found' });

  res = makeRes();
  errorHandler('bad input', {}, res, () => {});
  assert.equal(res.statusCode, 400);

  res = makeRes();
  errorHandler({ code: 'ETHEREAL_API_ERROR', message: 'ethereal problem' }, {}, res, () => {});
  assert.equal(res.statusCode, 502);

  res = makeRes();
  errorHandler({ status: 403, message: 'forbidden' }, {}, res, () => {});
  assert.equal(res.statusCode, 403);

  res = makeRes();
  errorHandler({ name: 'ValidationError', message: 'invalid field' }, {}, res, () => {});
  assert.equal(res.statusCode, 400);

  res = makeRes();
  errorHandler({ code: 11000, message: 'duplicate key' }, {}, res, () => {});
  assert.equal(res.statusCode, 409);

  res = makeRes();
  errorHandler({ name: 'UnauthorizedError', message: 'nope' }, {}, res, () => {});
  assert.equal(res.statusCode, 401);

  res = makeRes();
  errorHandler(new Error('boom'), {}, res, () => {});
  assert.equal(res.statusCode, 500);

  res = makeRes();
  res.headersSent = true;
  let nextCalled = false;
  errorHandler(new Error('later'), {}, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
