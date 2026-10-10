const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function loadFresh(modulePath) {
  const resolvedPath = require.resolve(path.resolve(__dirname, 'tests', modulePath));
  delete require.cache[resolvedPath];
  return require(resolvedPath);
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    jsonData: undefined,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return {
        json: body => {
          this.jsonData = body;
          return this;
        }
      };
    },
    json(body) {
      this.jsonData = body;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value, options) {
      this.cookies[name] = { value, options };
      return this;
    },
    clearCookie(name, options) {
      this.cookies[name] = { value: undefined, options, cleared: true };
      return this;
    }
  };
}

async function invokeRoute(path, method, options = {}) {
  const controller = require('./accounts/account.controller');
  const match = controller.stack.find(layer =>
    layer.route && layer.route.path === path && layer.route.methods[method]
  );

  assert.ok(match, `route ${method.toUpperCase()} ${path} was not registered`);

  const req = {
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    cookies: options.cookies || {},
    headers: options.headers || {},
    ip: options.ip || '127.0.0.1',
    user: options.user,
    get(name) { return this.headers[name.toLowerCase()]; }
  };
  const res = makeResponse();
  let nextErr;
  const next = err => { nextErr = err; };

  for (const handler of match.route.stack.map(layer => layer.handle)) {
    const result = handler(req, res, next);
    if (result && typeof result.then === 'function') {
      await result;
    }
    if (nextErr) {
      break;
    }
  }

  return { req, res, nextErr };
}

module.exports = { test, assert, loadFresh, makeResponse, invokeRoute };
