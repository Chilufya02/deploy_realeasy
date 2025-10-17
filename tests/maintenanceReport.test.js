const test = require('node:test');
const assert = require('node:assert');
const { generateMaintenanceReport } = require('../src/services/maintenanceReport');

test('generateMaintenanceReport returns a PDF buffer', () => {
  const pdf = generateMaintenanceReport('John Doe', [
    { date: '2025-01-01', issue: 'Leaky faucet', status: 'Pending' }
  ]);
  assert.ok(Buffer.isBuffer(pdf));
});
