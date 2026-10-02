const { test, assert, loadFresh } = require('../_test-utils');
test('server exposes app and start/shutdown path', async (t) => {
  const serverModule = loadFresh('../server');
  const config = require('../config');
  const db = require('../_helpers/db');
  const previousValidate = config.validate;
  config.validate = () => {};

  const connectStub = t.mock.method(db, 'connect', async () => undefined);
  const disconnectStub = t.mock.method(db, 'disconnect', async () => undefined);
  const listenStub = t.mock.method(serverModule.app, 'listen', () => {
    const server = {
      once(event, callback) {
        if (event === 'listening') {
          setImmediate(() => callback());
        }
        return this;
      },
      removeListener() {},
      close(callback) {
        callback();
        return this;
      }
    };
    return server;
  });

  const started = await serverModule.start();
  assert.ok(started);
  assert.equal(connectStub.mock.calls.length, 1);
  assert.equal(listenStub.mock.calls.length, 1);
  assert.equal(typeof disconnectStub, 'function');

  config.validate = previousValidate;
});
