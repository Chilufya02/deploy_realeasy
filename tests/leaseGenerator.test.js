const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
let hasPdfkit = true;
let leaseGenerator;
try {
  leaseGenerator = require('../src/services/leaseGenerator');
} catch {
  hasPdfkit = false;
}

test(
  'lease generator outputs a PDF file',
  { skip: !hasPdfkit },
  async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lease-'));
    const filePath = path.join(tmpDir, 'lease.pdf');
    await leaseGenerator.generate(
      {
        tenantName: 'John Doe',
        propertyAddress: '123 Main St',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        rent: '1000',
        securityDeposit: '500'
      },
      filePath
    );
    const pdfContent = fs.readFileSync(filePath);
    assert.ok(pdfContent.length > 0);
  }
);
