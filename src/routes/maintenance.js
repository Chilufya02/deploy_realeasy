const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const {
  validateMaintenanceCreate,
  validateMaintenanceUpdate,
  validateStatusUpdate
} = require('../middleware/validation/maintenance');
const { generateMaintenanceReport } = require('../services/maintenanceReport');

const UPLOADS_DIR = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'maintenance'
);
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = req.params && req.params.id ? req.params.id : Date.now();
    const unique = `${id}-${Date.now()}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image uploads are allowed'));
  }
});

// Get all maintenance requests
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tenant_id, property_id } = req.query;
    let query = 'SELECT * FROM maintenance_requests';
    const params = [];

    if (tenant_id) {
      query += ' WHERE tenant_id = ?';
      params.push(tenant_id);
    }

    if (property_id) {
      query += tenant_id ? ' AND property_id = ?' : ' WHERE property_id = ?';
      params.push(property_id);
    }

    if (!tenant_id && !property_id && req.user.role === 'landlord') {
      query += ' WHERE property_id IN (SELECT id FROM properties WHERE landlord_id = ?)';
      params.push(req.user.id);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const [rows] = await db.query(query, params);
    const formatted = rows.map(r => ({
      ...r,
      image: r.image ? `${baseUrl}/${r.image}` : null
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Download maintenance records for a tenant
router.get('/records/:tenantId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const [tenantRows] = await db.query('SELECT name, email FROM tenants WHERE id = ?', [tenantId]);
    if (!tenantRows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const tenant = tenantRows[0];
    if (req.user.role === 'tenant' && tenant.email !== req.user.email) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const [rows] = await db.query(
      'SELECT date, issue, status FROM maintenance_requests WHERE tenant_id = ? ORDER BY date',
      [tenantId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'No maintenance records found' });
    }

    const pdf = generateMaintenanceReport(tenant.name, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="maintenance-records.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate maintenance records' });
  }
});

// Create maintenance request
router.post('/', upload.single('image'), validateMaintenanceCreate, async (req, res) => {
  const { tenant_id, property_id, issue, priority, status, date } = req.body;
  try {
    const [result] = await db.execute(
      'INSERT INTO maintenance_requests (tenant_id, property_id, issue, priority, status, date, image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tenant_id, property_id, issue, priority, status || 'Pending', date, null]
    );

    let imagePath = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname);
      const newFilename = `${result.insertId}-${Date.now()}${ext}`;
      const newPath = path.join(UPLOADS_DIR, newFilename);
      fs.renameSync(req.file.path, newPath);
      imagePath = `uploads/maintenance/${newFilename}`;
      await db.execute('UPDATE maintenance_requests SET image=? WHERE id=?', [imagePath, result.insertId]);
    }

    const [rows] = await db.query('SELECT * FROM maintenance_requests WHERE id = ?', [result.insertId]);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
      ...rows[0],
      image: imagePath ? `${baseUrl}/${imagePath}` : null
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update maintenance request (with optional image)
router.put('/:id', upload.single('image'), validateMaintenanceUpdate, async (req, res) => {
  const { tenant_id, property_id, issue, priority, status, date } = req.body;
  let oldImage = null;
  let imagePath = null;

  try {
    if (req.file) {
      const [rows] = await db.query(
        'SELECT image FROM maintenance_requests WHERE id = ?',
        [req.params.id]
      );
      oldImage = rows.length ? rows[0].image : null;
      imagePath = `uploads/maintenance/${req.file.filename}`;
    }

    const query = req.file
      ? 'UPDATE maintenance_requests SET tenant_id=?, property_id=?, issue=?, priority=?, status=?, date=?, image=? WHERE id=?'
      : 'UPDATE maintenance_requests SET tenant_id=?, property_id=?, issue=?, priority=?, status=?, date=? WHERE id=?';
    const params = req.file
      ? [tenant_id, property_id, issue, priority, status, date, imagePath, req.params.id]
      : [tenant_id, property_id, issue, priority, status, date, req.params.id];
    await db.execute(query, params);

    if (req.file && oldImage) {
      const filePath = path.join(__dirname, '..', '..', oldImage);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Failed to delete maintenance image:', err);
        }
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const [rows] = await db.query('SELECT * FROM maintenance_requests WHERE id = ?', [req.params.id]);
    const row = rows[0];
    if (status) {
      const [tenantRows] = await db.query('SELECT email FROM tenants WHERE id = ?', [tenant_id]);
      if (tenantRows.length) {
        // Notification service removed; here we might send email/SMS in the future.
      }
    }
    res.json({ ...row, image: row.image ? `${baseUrl}/${row.image}` : null });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update only the status of a maintenance request
router.patch('/:id/status', validateStatusUpdate, async (req, res) => {
  const { status } = req.body;
  try {
    await db.execute('UPDATE maintenance_requests SET status=? WHERE id=?', [status, req.params.id]);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const [rows] = await db.query('SELECT * FROM maintenance_requests WHERE id = ?', [req.params.id]);
    const row = rows[0];
    if (row) {
      const [tenantRows] = await db.query('SELECT email FROM tenants WHERE id = ?', [row.tenant_id]);
      if (tenantRows.length) {
        // Notification service removed; here we might send email/SMS in the future.
      }
    }
    res.json({ ...row, image: row.image ? `${baseUrl}/${row.image}` : null });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Upload or replace maintenance request image
router.put('/:id/image', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const [rows] = await db.query('SELECT image FROM maintenance_requests WHERE id = ?', [req.params.id]);
    const oldImage = rows.length ? rows[0].image : null;
    const newPath = `uploads/maintenance/${req.file.filename}`;
    await db.execute('UPDATE maintenance_requests SET image=? WHERE id=?', [newPath, req.params.id]);
    if (oldImage) {
      const filePath = path.join(__dirname, '..', '..', oldImage);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Failed to delete maintenance image:', err);
        }
      }
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({ success: true, image: `${baseUrl}/${newPath}` });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete maintenance request image
router.delete('/:id/image', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT image FROM maintenance_requests WHERE id = ?', [req.params.id]);
    await db.execute('UPDATE maintenance_requests SET image=NULL WHERE id=?', [req.params.id]);
    if (rows.length && rows[0].image) {
      const filePath = path.join(__dirname, '..', '..', rows[0].image);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Failed to delete maintenance image:', err);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete maintenance request
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT image FROM maintenance_requests WHERE id = ?', [req.params.id]);
    await db.execute('DELETE FROM maintenance_requests WHERE id = ?', [req.params.id]);
    if (rows.length && rows[0].image) {
      const filePath = path.join(__dirname, '..', '..', rows[0].image);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Failed to delete maintenance image:', err);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
