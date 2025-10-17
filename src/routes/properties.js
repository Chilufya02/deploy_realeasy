const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  validateCreateProperty,
  validateAssignTenant
} = require('../middleware/validation/properties');

// Use the same uploads directory as defined in server.js
// __dirname for this file is `backend/src/routes`, so go up two levels
// to reach `backend/uploads`
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
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

// Get all properties or those belonging to a landlord
router.get('/', authMiddleware, async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const { minRent, maxRent, type, keyword } = req.query;
    const filters = [];
    const params = [];

    if (req.user.role === 'landlord') {
      filters.push('p.landlord_id = ?');
      params.push(req.user.id);
    }

    if (type) {
      filters.push('p.type = ?');
      params.push(type);
    }
    if (minRent) {
      filters.push('p.rent >= ?');
      params.push(minRent);
    }
    if (maxRent) {
      filters.push('p.rent <= ?');
      params.push(maxRent);
    }
    if (keyword) {
      filters.push('p.address LIKE ?');
      params.push(`%${keyword}%`);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) AS landlord_name, u.email AS landlord_email, u.phone AS landlord_phone
         FROM properties p
         JOIN users u ON p.landlord_id = u.id ${where}`;

    const [rows] = await db.query(query, params);

    const props = rows.map(row => {
      const dir = path.join(UPLOADS_DIR, row.id.toString());
      let images = [];
      if (fs.existsSync(dir)) {
        images = fs.readdirSync(dir).map(f => `${baseUrl}/uploads/${row.id}/${f}`);
      }
      return {
        ...row,
        landlordName: row.landlord_name,
        landlordEmail: row.landlord_email,
        landlordPhone: row.landlord_phone,
        images,
        image: images[0] || null
      };
    });
    res.json(props);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get single property
router.get('/:id', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const [rows] = await db.query(
      `SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) AS landlord_name, u.email AS landlord_email, u.phone AS landlord_phone
       FROM properties p
       JOIN users u ON p.landlord_id = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Property not found' });
    const row = rows[0];
    const dir = path.join(UPLOADS_DIR, row.id.toString());
    let images = [];
    if (fs.existsSync(dir)) {
      images = fs.readdirSync(dir).map(f => `${baseUrl}/uploads/${row.id}/${f}`);
    }
    res.json({
      ...row,
      landlordName: row.landlord_name,
      landlordEmail: row.landlord_email,
      landlordPhone: row.landlord_phone,
      images,
      image: images[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create new property
router.post('/', authMiddleware, requireRole('landlord'), validateCreateProperty, async (req, res) => {
  const { address, type, rent, status } = req.body;
  try {
    const [result] = await db.execute(
      'INSERT INTO properties (address, type, rent, status, landlord_id) VALUES (?, ?, ?, ?, ?)',
      [address, type, rent, status || 'Vacant', req.user.id]
    );
    const [rows] = await db.query('SELECT * FROM properties WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Update property
router.put('/:id', authMiddleware, requireRole('landlord'), async (req, res) => {
  const { address, type, rent, status, tenant_id } = req.body;
  try {
    let existingTenantId = null;
    if (tenant_id === null) {
      const [current] = await db.query('SELECT tenant_id FROM properties WHERE id = ?', [req.params.id]);
      if (current.length) existingTenantId = current[0].tenant_id;
    }

    const fields = ['address = ?', 'type = ?', 'rent = ?', 'status = ?'];
    const values = [address, type, rent, status];
    if (tenant_id !== undefined) {
      fields.push('tenant_id = ?');
      values.push(tenant_id);
    }
    values.push(req.params.id);
    await db.execute(
      `UPDATE properties SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    if (tenant_id === null && existingTenantId) {
      await db.execute('DELETE FROM tenants WHERE id = ?', [existingTenantId]);
    }

    const [rows] = await db.query('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Assign a property to an existing tenant by email
router.post('/:id/assign', authMiddleware, requireRole('landlord'), validateAssignTenant, async (req, res) => {
  try {
    const { tenantEmail } = req.body;
    if (!tenantEmail) {
      return res.status(400).json({ error: 'Tenant email is required' });
    }

    const [propRows] = await db.query('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    if (!propRows.length) return res.status(404).json({ error: 'Property not found' });
    const property = propRows[0];

    // Find tenant record or create if exists as user
    const [tenants] = await db.query('SELECT * FROM tenants WHERE email = ?', [tenantEmail]);
    let tenant;
    if (tenants.length === 0) {
      const [users] = await db.query('SELECT first_name, last_name, phone FROM users WHERE email = ? AND role = "tenant"', [tenantEmail]);
      if (users.length === 0) {
        return res.status(404).json({ error: 'Tenant user not found' });
      }
      const user = users[0];
      let result;
      try {
        [result] = await db.execute(
          'INSERT INTO tenants (name, email, phone, property_id, balance) VALUES (?, ?, ?, ?, 0)',
          [`${user.first_name} ${user.last_name}`.trim(), tenantEmail, user.phone || null, property.id]
        );
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Tenant with this email already exists' });
        }
        throw e;
      }
      tenant = { id: result.insertId, name: `${user.first_name} ${user.last_name}`.trim(), email: tenantEmail, phone: user.phone || null, property_id: property.id, balance: 0, last_payment: null };
    } else {
      tenant = tenants[0];
      if (tenant.property_id && tenant.property_id !== property.id) {
        return res
          .status(400)
          .json({ error: 'Tenant is already assigned to another property' });
      }
      await db.execute('UPDATE tenants SET property_id = ? WHERE id = ?', [property.id, tenant.id]);
      // ensure local tenant object reflects new property_id
      tenant.property_id = property.id;
    }

    // Optionally fetch the latest tenant record
    const [updatedRows] = await db.query('SELECT * FROM tenants WHERE id = ?', [tenant.id]);
    if (updatedRows.length) {
      tenant = updatedRows[0];
    }

    await db.execute('UPDATE properties SET tenant_id = ?, status = ? WHERE id = ?', [tenant.id, 'Occupied', property.id]);

    res.json({ property: { ...property, tenant_id: tenant.id, status: 'Occupied' }, tenant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/:id/images', upload.array('images'), async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const processed = [];
  for (const file of req.files) {
    try {
      const optimized = await sharp(file.path)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      await fs.promises.writeFile(file.path, optimized);
    } catch (err) {
      console.error('Failed to optimize image:', err);
      // Keep the original file so the upload still succeeds
    }
    processed.push(`${baseUrl}/uploads/${req.params.id}/${file.filename}`);
  }

  res.json({ files: processed });
});

router.delete(
  '/:id/images/:filename',
  authMiddleware,
  requireRole('landlord'),
  (req, res) => {
    const dir = path.join(UPLOADS_DIR, req.params.id);
    const file = path.basename(req.params.filename);
    const filePath = path.join(dir, file);

    // If the file exists, attempt to remove it. Treat missing files as
    // already deleted so the client doesn't receive an error when the
    // image has been removed by another request.
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error('Failed to delete image:', err);
        return res.status(500).json({ error: 'Failed to delete image' });
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const images = fs.existsSync(dir)
      ? fs.readdirSync(dir).map(f => `${baseUrl}/uploads/${req.params.id}/${f}`)
      : [];

    res.json({ success: true, images });
  }
);

// Delete property
router.delete('/:id', authMiddleware, requireRole('landlord'), async (req, res) => {
  try {
    await db.execute('DELETE FROM properties WHERE id = ?', [req.params.id]);
    const dir = path.join(UPLOADS_DIR, req.params.id);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
