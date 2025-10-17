const escapeText = (text = '') => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function generatePaymentReceipt(payment = {}) {
  const dateStr = new Date(payment.date).toISOString().split('T')[0];
  const lines = [];

  // Header with background color
  lines.push('0 0 1 rg');
  lines.push('0 742 612 50 re f');

  // Logo text
  lines.push('BT');
  lines.push('/F1 24 Tf');
  lines.push('1 1 1 rg');
  lines.push('1 0 0 1 20 755 Tm (RealEasy) Tj');
  lines.push('ET');

  // Title and details
  lines.push('BT');
  lines.push('0 0 0 rg');
  lines.push('/F1 16 Tf 50 700 Td (Payment Receipt) Tj');
  lines.push('/F1 12 Tf');
  let y = 680;
  const addLine = (text) => {
    lines.push(`1 0 0 1 50 ${y} Tm`);
    lines.push(`(${escapeText(text)}) Tj`);
    y -= 15;
  };
  if (payment.tenant) addLine('Tenant: ' + payment.tenant);
  if (payment.property) addLine('Property: ' + payment.property);
  addLine('Date: ' + dateStr);
  addLine('Amount: K ' + payment.amount);
  if (payment.method) addLine('Method: ' + payment.method);
  if (payment.reference) addLine('Reference: ' + payment.reference);
  lines.push('ET');

  // Footer note
  lines.push('BT');
  lines.push('0 0 1 rg');
  lines.push('/F1 12 Tf 50 100 Td (Thank you for choosing RealEasy!) Tj');
  lines.push('ET');

  const content = lines.join('\n');

  const objects = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n');
  objects.push('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n');
  objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n');
  objects.push(`4 0 obj << /Length ${content.length} >> stream\n${content}\nendstream\nendobj\n`);
  objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n');

  let pdf = '%PDF-1.3\n';
  const offsets = [0];
  objects.forEach(obj => {
    offsets.push(pdf.length);
    pdf += obj;
  });
  const xrefPos = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${offsets.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += offsets[i].toString().padStart(10, '0') + ' 00000 n \n';
  }
  pdf += 'trailer << /Size ' + offsets.length + ' /Root 1 0 R >>\n';
  pdf += 'startxref\n' + xrefPos + '\n%%EOF';

  return Buffer.from(pdf, 'binary');
}

module.exports = { generatePaymentReceipt };
