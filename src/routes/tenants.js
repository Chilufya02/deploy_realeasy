const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  validateCreateTenant,
  validateUpdateTenant
} = require('../middleware/validation/tenants');

// Get all tenants
router.get('/', authMiddleware, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'landlord') {
      [rows] = await db.query(
        `SELECT t.*, l.id AS lease_id, l.status AS lease_status, l.document_path, l.signed_document_path
         FROM tenants t
         JOIN properties p ON t.property_id = p.id
         LEFT JOIN leases l ON l.id = (
           SELECT id FROM leases WHERE tenant_id = t.id ORDER BY id DESC LIMIT 1
         )
         WHERE p.landlord_id = ?`,
        [req.user.id]
      );
    } else {
      [rows] = await db.query('SELECT * FROM tenants WHERE property_id IS NOT NULL');
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get tenant record for the logged-in user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tenants WHERE email = ?', [req.user.email]);
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get single tenant
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tenants WHERE id = ?', [
      req.params.id
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Tenant not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create tenant
router.post('/', validateCreateTenant, async (req, res) => {
  const { name, email, phone, property_id, balance, last_payment } = req.body;
  try {
    const [existing] = await db.query('SELECT id FROM tenants WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(400).json({ error: 'Tenant with this email already exists' });
    }

    let result;
    try {
      [result] = await db.execute(
        'INSERT INTO tenants (name, email, phone, property_id, balance, last_payment) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email, phone, property_id, balance || 0, last_payment]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Tenant with this email already exists' });
      }
      throw e;
    }
    await db.execute(
      'UPDATE properties SET tenant_id = ?, status = ? WHERE id = ?',
      [result.insertId, 'Occupied', property_id]
    );
    const [rows] = await db.query('SELECT * FROM tenants WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update tenant
router.put('/:id', validateUpdateTenant, async (req, res) => {
  const { name, email, phone, property_id, balance, last_payment } = req.body;
  try {
    await db.execute(
      'UPDATE tenants SET name=?, email=?, phone=?, property_id=?, balance=?, last_payment=? WHERE id=?',
      [name, email, phone, property_id, balance, last_payment, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});


// Send reminder to tenant (creates notification)
router.post('/:id/reminder', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'landlord') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const tenantId = req.params.id;
    const message =
      req.body.message || 'This is a reminder to pay your rent.';

    const [rows] = await db.query(
      `SELECT t.id FROM tenants t
       JOIN properties p ON t.property_id = p.id
       WHERE t.id = ? AND p.landlord_id = ?`,
      [tenantId, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await db.query(
      'INSERT INTO notifications (tenant_id, type, title, message) VALUES (?, ?, ?, ?)',
      [tenantId, 'reminder', 'Payment Reminder', message]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Delete tenant
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM tenants WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
