const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  AirtelMoneyProcessor,
  MTNMoneyProcessor,
  CardPaymentProcessor
} = require('../services/paymentSimulation');
const { generatePaymentStatement } = require('../services/statement');
const { generatePaymentReceipt } = require('../services/receipt');
const {
  validatePaymentCreate,
  validatePaymentUpdate,
  validateMobilePayment
} = require('../middleware/validation/payments');

async function updateLastPayment(tenantId) {
  if (!tenantId) return;
  const [rows] = await db.query(
    'SELECT MAX(date) AS last_payment FROM payments WHERE tenant_id = ? AND status = "Received"',
    [tenantId]
  );
  const lastPayment = rows[0].last_payment || null;
  await db.execute('UPDATE tenants SET last_payment = ? WHERE id = ?', [lastPayment, tenantId]);
}

async function adjustBalance(tenantId, delta) {
  if (!tenantId || !delta) return;
  await db.execute('UPDATE tenants SET balance = GREATEST(balance + ?, 0) WHERE id = ?', [delta, tenantId]);
}

// Get all payments
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tenant_id, property_id } = req.query;
    const clauses = [];
    const params = [];

    if (tenant_id) {
      clauses.push('payments.tenant_id = ?');
      params.push(tenant_id);
    }

    if (property_id) {
      clauses.push('payments.property_id = ?');
      params.push(property_id);
    }

    if (clauses.length === 0 && req.user.role === 'landlord') {
      clauses.push('payments.property_id IN (SELECT id FROM properties WHERE landlord_id = ?)');
      params.push(req.user.id);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT payments.*, tenants.name AS tenant, properties.address AS property
       FROM payments
       LEFT JOIN tenants ON payments.tenant_id = tenants.id
       LEFT JOIN properties ON payments.property_id = properties.id
       ${where}
       ORDER BY payments.date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Download tenant statement
router.get('/statement/:tenantId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const [tenantRows] = await db.query('SELECT name FROM tenants WHERE id = ?', [tenantId]);
    if (!tenantRows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const [payments] = await db.query(
      'SELECT date, amount, status, method, reference FROM payments WHERE tenant_id = ? ORDER BY date',
      [tenantId]
    );
    const pdf = generatePaymentStatement(tenantRows[0].name, payments);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="statement.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate statement' });
  }
});

// Download payment receipt
router.get('/receipt/:paymentId', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const [rows] = await db.query(
      `SELECT payments.*, tenants.name AS tenant, tenants.email AS tenant_email, properties.address AS property
       FROM payments
       LEFT JOIN tenants ON payments.tenant_id = tenants.id
       LEFT JOIN properties ON payments.property_id = properties.id
       WHERE payments.id = ?`,
      [paymentId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = rows[0];
    if (req.user.role === 'tenant' && payment.tenant_email !== req.user.email) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const pdf = generatePaymentReceipt(payment);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="receipt.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// Create payment
router.post('/', validatePaymentCreate, async (req, res) => {
  const { tenant_id, property_id, amount, status, method, date, reference, gateway_status } = req.body;
  try {
    const paymentStatus = status || 'Received';
    const [result] = await db.execute(
      'INSERT INTO payments (tenant_id, property_id, amount, status, method, reference, gateway_status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tenant_id, property_id, amount, paymentStatus, method, reference, gateway_status, date]
    );

    if (tenant_id) {
      if (paymentStatus === 'Received') {
        await adjustBalance(tenant_id, -amount);
      }
      await updateLastPayment(tenant_id);
    }
    const [rows] = await db.query(
      'SELECT payments.*, tenants.name AS tenant, properties.address AS property FROM payments LEFT JOIN tenants ON payments.tenant_id = tenants.id LEFT JOIN properties ON payments.property_id = properties.id WHERE payments.id = ?',
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create card payment
router.post('/card', async (req, res) => {
  const { tenant_id, property_id, amount, cardNumber, expiry, cvv } = req.body;
  try {
    const processor = new CardPaymentProcessor();
    const result = processor.process(amount, { cardNumber, expiry, cvv });
    const paymentStatus = result.success ? 'Received' : 'Failed';
    const gatewayStatus = result.success ? 'APPROVED' : 'DECLINED';

    const [insert] = await db.execute(
      'INSERT INTO payments (tenant_id, property_id, amount, status, method, reference, gateway_status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tenant_id, property_id, amount, paymentStatus, 'Card', result.transactionId, gatewayStatus, new Date().toISOString().split('T')[0]]
    );

    if (tenant_id && paymentStatus === 'Received') {
      await adjustBalance(tenant_id, -amount);
      await updateLastPayment(tenant_id);
    }

    const [rows] = await db.query(
      'SELECT payments.*, tenants.name AS tenant, properties.address AS property FROM payments LEFT JOIN tenants ON payments.tenant_id = tenants.id LEFT JOIN properties ON payments.property_id = properties.id WHERE payments.id = ?',
      [insert.insertId]
    );

    res.status(201).json({ ...rows[0], message: result.message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment processing error' });
  }
});

// Create mobile money payment
router.post('/mobile', validateMobilePayment, async (req, res) => {
  const { tenant_id, property_id, amount, method, phone } = req.body;
  try {
    let processor;
    if (method === 'MTN') {
      processor = new MTNMoneyProcessor();
    } else if (method === 'Airtel') {
      processor = new AirtelMoneyProcessor();
    } else {
      return res.status(400).json({ error: 'Unsupported mobile money method' });
    }

    const result = processor.process(amount, { phoneNumber: phone });
    const paymentStatus = result.success ? 'Received' : 'Failed';
    const providerStatus = result.success ? 'APPROVED' : 'DECLINED';

    const [insert] = await db.execute(
      'INSERT INTO payments (tenant_id, property_id, amount, status, method, reference, gateway_status, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tenant_id, property_id, amount, paymentStatus, method, result.transactionId, providerStatus, new Date().toISOString().split('T')[0]]
    );

    if (tenant_id && paymentStatus === 'Received') {
      await adjustBalance(tenant_id, -amount);
      await updateLastPayment(tenant_id);
    }

    res.status(201).json({
      id: insert.insertId,
      reference: result.transactionId,
      status: paymentStatus,
      message: result.message,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment processing error' });
  }
});

// Update payment
router.put('/:id', validatePaymentUpdate, async (req, res) => {
  const { tenant_id, property_id, amount, status, method, date, reference, gateway_status } = req.body;
  try {
    const [existingRows] = await db.query(
      'SELECT tenant_id, amount, status FROM payments WHERE id = ?',
      [req.params.id]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const existing = existingRows[0];

    await db.execute(
      'UPDATE payments SET tenant_id=?, property_id=?, amount=?, status=?, method=?, reference=?, gateway_status=?, date=? WHERE id=?',
      [tenant_id, property_id, amount, status, method, reference, gateway_status, date, req.params.id]
    );

    if (existing.tenant_id) {
      const revert = existing.status === 'Received' ? existing.amount : 0;
      await adjustBalance(existing.tenant_id, revert);
      await updateLastPayment(existing.tenant_id);
    }

    if (tenant_id) {
      const apply = status === 'Received' ? -amount : 0;
      await adjustBalance(tenant_id, apply);
      await updateLastPayment(tenant_id);
    }
    const [rows] = await db.query(
      'SELECT payments.*, tenants.name AS tenant, properties.address AS property FROM payments LEFT JOIN tenants ON payments.tenant_id = tenants.id LEFT JOIN properties ON payments.property_id = properties.id WHERE payments.id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete payment
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT tenant_id, amount, status FROM payments WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const payment = rows[0];
    await db.execute('DELETE FROM payments WHERE id = ?', [req.params.id]);
    if (payment.tenant_id && payment.status === 'Received') {
      await adjustBalance(payment.tenant_id, payment.amount);
    }
    if (payment.tenant_id) {
      await updateLastPayment(payment.tenant_id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
