const { test, assert } = require('../_test-utils');
test('role constants exist', () => {
  const Role = require('../_helpers/role');
  assert.deepEqual(Role, { Admin: 'Admin', User: 'User' });
});
