const test = require('node:test');
const assert = require('node:assert');
const propertiesRouter = require('../src/routes/properties');
const db = require('../src/db');

test('deleting tenant when property unassigned', async () => {
  const originalQuery = db.query;
  const originalExecute = db.execute;
  let deleteCalled = false;

  db.query = async (sql, params) => {
    if (sql.startsWith('SELECT tenant_id FROM properties WHERE id = ?')) {
      assert.strictEqual(params[0], 5);
      return [[{ tenant_id: 7 }]];
    }
    if (sql.startsWith('SELECT * FROM properties WHERE id = ?')) {
      assert.strictEqual(params[0], 5);
      return [[{ id: 5, address: 'A', type: 'T', rent: 1000, status: 'Vacant', tenant_id: null }]];
    }
    throw new Error('Unexpected query: ' + sql);
  };

  db.execute = async (sql, params) => {
    if (sql.startsWith('UPDATE properties SET')) {
      assert.ok(sql.includes('tenant_id = ?'), 'tenant_id field updated');
      assert.deepStrictEqual(params.slice(-1), [5]);
      return [{}];
    }
    if (sql.startsWith('DELETE FROM tenants WHERE id = ?')) {
      deleteCalled = true;
      assert.strictEqual(params[0], 7);
      return [{}];
    }
    throw new Error('Unexpected execute: ' + sql);
  };

  const handlerLayer = propertiesRouter.stack.find(
    layer => layer.route && layer.route.path === '/:id' && layer.route.methods.put
  );
  const handler = handlerLayer.route.stack[2].handle;

  const req = {
    params: { id: 5 },
    body: { address: 'A', type: 'T', rent: 1000, status: 'Vacant', tenant_id: null }
  };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
    }
  };

  await handler(req, res);

  assert.strictEqual(deleteCalled, true);
  assert.deepStrictEqual(res.body, {
    id: 5,
    address: 'A',
    type: 'T',
    rent: 1000,
    status: 'Vacant',
    tenant_id: null
  });

  db.query = originalQuery;
  db.execute = originalExecute;
});

