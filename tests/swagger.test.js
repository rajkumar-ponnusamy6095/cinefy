const { test, assert } = require('../_test-utils');
test('swagger helper loads the swagger document', () => {
  const router = require('../_helpers/swagger');
  assert.ok(router);
});
