const fs = require('fs');
const PDFDocument = require('pdfkit');
const signaturePositions = require('../config/signaturePositions');

class LeaseGenerator {
  async generate(data, destPath) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ compress: false });
      const stream = fs.createWriteStream(destPath);
      doc.pipe(stream);

      doc.fontSize(20).text('Residential Lease Agreement', { align: 'center' });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Landlord: ${data.landlordName || '_________________'}`);
      doc.text(`Tenant: ${data.tenantName}`);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Premises');
      doc.font('Helvetica').text(
        `The Landlord leases to the Tenant the property located at ${data.propertyAddress}.`
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Term');
      doc.font('Helvetica').text(
        `This lease begins on ${data.startDate} and ends on ${data.endDate}.`
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Rent');
      doc.font('Helvetica').text(
        `Tenant shall pay ${data.rent} per month, due on the first day of each month. Rent received after the fifth day of the month will incur a late fee.`
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Security Deposit');
      doc.font('Helvetica').text(
        `Tenant shall pay a security deposit of ${
          data.securityDeposit ?? 'N/A'
        } to be held by Landlord.`
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Utilities');
      doc.font('Helvetica').text(
        'Tenant is responsible for all utilities unless otherwise agreed in writing.'
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Maintenance');
      doc.font('Helvetica').text(
        'Tenant shall maintain the premises and promptly notify Landlord of any issues.'
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Termination');
      doc.font('Helvetica').text(
        'Either party must provide 30 days written notice to terminate this lease.'
      );
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Governing Law');
      doc.font('Helvetica').text(
        'This lease is governed by the laws of the jurisdiction where the property is located.'
      );
      doc.moveDown();

      const landlord = signaturePositions.landlord;
      const tenant = signaturePositions.tenant;
      const labelOffset = 110;

      const landlordBaseline = landlord.y + landlord.height - 10;
      doc.text('Landlord Signature:', landlord.x, landlordBaseline - 15);
      doc.moveTo(landlord.x + labelOffset, landlordBaseline)
        .lineTo(landlord.x + landlord.width, landlordBaseline)
        .stroke();

      const tenantBaseline = tenant.y + tenant.height - 10;
      doc.text('Tenant Signature:', tenant.x, tenantBaseline - 15);
      doc.moveTo(tenant.x + labelOffset, tenantBaseline)
        .lineTo(tenant.x + tenant.width, tenantBaseline)
        .stroke();

      doc.end();

      stream.on('finish', () => resolve(destPath));
      stream.on('error', reject);
    });
  }
}

module.exports = new LeaseGenerator();
