const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const signaturePositions = require('../config/signaturePositions');
const { authMiddleware, requireRole } = require('../middleware/auth');
const leaseService = require('../services/leaseSigning');
const leaseGenerator = require('../services/leaseGenerator');
const { validateSendLease } = require('../middleware/validation/leases');

const LEASES_DIR = path.join(__dirname, '..', '..', 'uploads', 'leases');
fs.mkdirSync(LEASES_DIR, { recursive: true });
const SIGNATURES_DIR = path.join(LEASES_DIR, 'signatures');
fs.mkdirSync(SIGNATURES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LEASES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + ext);
  }
});
const upload = multer({ storage });

// Generate a lease document
router.post('/generate', authMiddleware, requireRole('landlord'), async (req, res) => {
  try {
    const {
      propertyId,
      tenantId,
      startDate,
      endDate,
      rent,
      securityDeposit = 0
    } = req.body;
    const normalizedDeposit = Number(securityDeposit);
    if (
      !propertyId ||
      !tenantId ||
      !startDate ||
      !endDate ||
      !rent
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (Number.isNaN(normalizedDeposit) || normalizedDeposit < 0) {
      return res.status(400).json({ error: 'Invalid security deposit amount' });
    }

    const [propRows] = await db.query('SELECT address FROM properties WHERE id = ?', [propertyId]);
    if (!propRows.length) return res.status(404).json({ error: 'Property not found' });
    const [tenantRows] = await db.query('SELECT name FROM tenants WHERE id = ?', [tenantId]);
    if (!tenantRows.length) return res.status(404).json({ error: 'Tenant not found' });

    const [paymentRows] = await db.query(
      'SELECT COUNT(*) AS payment_count FROM payments WHERE tenant_id = ? AND property_id = ? AND status = "Received"',
      [tenantId, propertyId]
    );
    if (!paymentRows[0]?.payment_count) {
      return res
        .status(400)
        .json({ error: 'Cannot generate lease before receiving a payment from this tenant' });
    }

    const [landlordRows] = await db.query(
      'SELECT CONCAT(first_name, " ", last_name) AS name FROM users WHERE id = ?',
      [req.user.id]
    );

    const filename = `lease-${Date.now()}.pdf`;
    const filePath = path.join(LEASES_DIR, filename);
    await leaseGenerator.generate(
      {
        propertyAddress: propRows[0].address,
        tenantName: tenantRows[0].name,
        landlordName: landlordRows[0]?.name,
        startDate,
        endDate,
        rent,
        securityDeposit: normalizedDeposit
      },
      filePath
    );

    const [result] = await db.execute(
      'INSERT INTO leases (property_id, tenant_id, status, document_path, start_date, end_date, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [propertyId, tenantId, 'generated', filename, startDate, endDate, startDate]
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res
      .status(201)
      .json({ id: result.insertId, status: 'generated', url: `${baseUrl}/uploads/leases/${filename}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate lease' });
  }
});

// Send a lease document for signature
router.post('/send', authMiddleware, requireRole('landlord'), upload.single('document'), validateSendLease, async (req, res) => {
  try {
    const { propertyId, tenantId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Document is required' });

    const [tenantRows] = await db.query('SELECT name, email FROM tenants WHERE id = ?', [tenantId]);
    if (!tenantRows.length) return res.status(404).json({ error: 'Tenant not found' });
    const tenant = tenantRows[0];

    const { envelopeId } = await leaseService.sendDocument(req.file.path, tenant);

    const [result] = await db.execute(
      'INSERT INTO leases (property_id, tenant_id, status, document_path, provider_envelope_id) VALUES (?, ?, ?, ?, ?)',
      [propertyId, tenantId, 'sent', req.file.filename, envelopeId]
    );

    res.status(201).json({ id: result.insertId, status: 'sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send lease' });
  }
});

// Get latest lease for a tenant
router.get('/tenant/:tenantId', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM leases WHERE tenant_id = ? ORDER BY id DESC LIMIT 1', [
      req.params.tenantId
    ]);
    if (!rows.length) return res.status(404).json({ error: 'Lease not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch lease' });
  }
});

// Save digital signature
router.post('/:id/sign', authMiddleware, async (req, res) => {
  try {
    const { signature } = req.body;
    if (!signature) return res.status(400).json({ error: 'Signature is required' });
    const role = req.user.role;
    const filename = `${req.params.id}-${role}.png`;
    const filePath = path.join(SIGNATURES_DIR, filename);
    const base64Data = signature.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');
    const column = role === 'landlord' ? 'landlord_signature_path' : 'tenant_signature_path';
    await db.execute(`UPDATE leases SET ${column} = ? WHERE id = ?`, [path.join('signatures', filename), req.params.id]);
    const [rows] = await db.query(
      'SELECT landlord_signature_path, tenant_signature_path, signed_document_path, document_path FROM leases WHERE id = ?',
      [req.params.id]
    );

    let status = 'pending';
    if (rows[0].landlord_signature_path && rows[0].tenant_signature_path) {
      status = 'signed';
    }

    // Attempt to embed any available signatures into the lease PDF
    let signedFilename = rows[0].signed_document_path || `${req.params.id}-signed.pdf`;
    try {
      const basePdfPath = path.join(LEASES_DIR, rows[0].document_path);
      const pdfBytes = fs.readFileSync(basePdfPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const page = pdfDoc.getPages()[0];
      if (rows[0].landlord_signature_path) {
        const landBytes = fs.readFileSync(path.join(LEASES_DIR, rows[0].landlord_signature_path));
        const landImg = await pdfDoc.embedPng(landBytes);
        const pos = signaturePositions.landlord;
        const landY = page.getHeight() - pos.y - pos.height;
        page.drawImage(landImg, { x: pos.x, y: landY, width: pos.width, height: pos.height });
      }
      if (rows[0].tenant_signature_path) {
        const tenantBytes = fs.readFileSync(path.join(LEASES_DIR, rows[0].tenant_signature_path));
        const tenantImg = await pdfDoc.embedPng(tenantBytes);
        const pos = signaturePositions.tenant;
        const tenantY = page.getHeight() - pos.y - pos.height;
        page.drawImage(tenantImg, { x: pos.x, y: tenantY, width: pos.width, height: pos.height });
      }

      const signedPdfBytes = await pdfDoc.save();
      signedFilename = `${req.params.id}-signed.pdf`;
      fs.writeFileSync(path.join(LEASES_DIR, signedFilename), signedPdfBytes);
      await db.execute('UPDATE leases SET signed_document_path = ?, status = ? WHERE id = ?', [signedFilename, status, req.params.id]);
    } catch (e) {
      console.error('Failed to generate signed PDF', e);
      await db.execute('UPDATE leases SET status = ? WHERE id = ?', [status, req.params.id]);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/leases/${signedFilename}`;
    res.json({ status, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save signature' });
  }
});

// Check signing status
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM leases WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Lease not found' });
    let lease = rows[0];

    if (lease.status !== 'signed') {
      const status = await leaseService.checkStatus(lease.provider_envelope_id);
      if (status === 'signed') {
        const signedPath = path.join(LEASES_DIR, `${lease.id}-signed.pdf`);
        await leaseService.downloadSignedDocument(lease.provider_envelope_id, signedPath);
        await db.execute(
          'UPDATE leases SET status = ?, signed_document_path = ? WHERE id = ?',
          [status, path.basename(signedPath), lease.id]
        );
        lease.status = status;
        lease.signed_document_path = path.basename(signedPath);
      }
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = lease.signed_document_path
      ? `${baseUrl}/uploads/leases/${lease.signed_document_path}`
      : null;
    res.json({ status: lease.status, signedUrl: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Download signed lease
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT signed_document_path FROM leases WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Lease not found' });
    const lease = rows[0];
    if (!lease.signed_document_path) return res.status(404).json({ error: 'Signed document not available' });
    const filePath = path.join(LEASES_DIR, lease.signed_document_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.download(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to download lease' });
  }
});

module.exports = router;
