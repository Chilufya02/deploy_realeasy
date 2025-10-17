const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// Simple in-memory tracker for demo purposes. In a real application
// statuses would be retrieved from the e-sign provider (DocuSign,
// HelloSign, etc.) and persisted in a database.
const envelopes = new Map();

class LeaseSigningService {
  async sendDocument(filePath, signer) {
    const envelopeId = randomUUID();
    envelopes.set(envelopeId, { status: 'sent', filePath });
    return { envelopeId };
  }

  async checkStatus(envelopeId) {
    const info = envelopes.get(envelopeId);
    if (!info) return 'unknown';
    // Simulate signing completion on subsequent checks
    if (info.status !== 'signed' && Math.random() > 0.5) {
      info.status = 'signed';
    }
    return info.status;
  }

  async downloadSignedDocument(envelopeId, destPath) {
    const info = envelopes.get(envelopeId);
    if (!info || info.status !== 'signed') {
      throw new Error('Document not signed yet');
    }
    fs.copyFileSync(info.filePath, destPath);
    return destPath;
  }
}

module.exports = new LeaseSigningService();
