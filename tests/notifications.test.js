const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const notificationsRouter = require('../src/routes/notifications');
const db = require('../src/db');

const JWT_SECRET = process.env.JWT_SECRET || 'insecure_default_secret';

test('tenant receives reminder notifications', async () => {
  const originalQuery = db.query;
  db.query = async (sql, params) => {
    if (sql.includes('FROM users')) {
      return [[{ id: 1, email: 'tenant@example.com', role: 'tenant', is_active: true }]];
    }
    if (sql.startsWith('SELECT id FROM tenants WHERE email = ?')) {
      assert.strictEqual(params[0], 'tenant@example.com');
      return [[{ id: 99 }]];
    }
    if (sql.includes('FROM notifications WHERE tenant_id = ?')) {
      assert.ok(sql.includes('`read`'), 'query should select `read` column');
      assert.strictEqual(params[0], 99);
      return [[{ id: 2, type: 'reminder', title: 'Payment Reminder', message: 'Pay rent', date: '2024-01-01', read: 0 }]];
    }
    if (sql.includes('UPDATE notifications SET `read` = TRUE')) {
      return [{}];
    }
    throw new Error('Unexpected query: ' + sql);
  };

  const handlerLayer = notificationsRouter.stack.find(
    layer => layer.route && layer.route.path === '/' && layer.route.methods.get
  );
  const handler = handlerLayer.route.stack[1].handle; // skip auth middleware

  const req = { user: { role: 'tenant', email: 'tenant@example.com' } };
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

  assert.deepStrictEqual(res.body, [
    { id: 2, type: 'reminder', title: 'Payment Reminder', message: 'Pay rent', date: '2024-01-01', read: 0 }
  ]);

  db.query = originalQuery;
});

test('tenant clears all notifications', async () => {
  const originalQuery = db.query;
  db.query = async (sql, params) => {
    if (sql.includes('FROM users')) {
      return [[{ id: 1, email: 'tenant@example.com', role: 'tenant', is_active: true }]];
    }
    if (sql.startsWith('SELECT id FROM tenants WHERE email = ?')) {
      assert.strictEqual(params[0], 'tenant@example.com');
      return [[{ id: 99 }]];
    }
    if (sql.startsWith('DELETE FROM notifications WHERE tenant_id = ?')) {
      assert.strictEqual(params[0], 99);
      return [{}];
    }
    throw new Error('Unexpected query: ' + sql);
  };

  const handlerLayer = notificationsRouter.stack.find(
    layer => layer.route && layer.route.path === '/' && layer.route.methods.delete
  );
  const handler = handlerLayer.route.stack[1].handle; // skip auth middleware

  const req = { user: { role: 'tenant', email: 'tenant@example.com' } };
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

  assert.deepStrictEqual(res.body, { success: true });

  db.query = originalQuery;
});
