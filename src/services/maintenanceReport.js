const escapeText = (text = '') => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function generateMaintenanceReport(tenantName, requests = []) {
  const dateStr = new Date().toISOString().split('T')[0];
  const lines = [];
  lines.push('BT');
  lines.push('/F1 20 Tf 50 750 Td (Maintenance Records) Tj');
  lines.push('/F1 12 Tf 50 730 Td (Tenant: ' + escapeText(tenantName) + ') Tj');
  lines.push('50 715 Td (Generated: ' + dateStr + ') Tj');
  // Table header
  lines.push('50 690 Td (Date) Tj');
  lines.push('120 0 Td (Issue) Tj');
  lines.push('250 0 Td (Status) Tj');
  let y = 675;
  requests.forEach(r => {
    const date = new Date(r.date).toISOString().split('T')[0];
    lines.push(`1 0 0 1 50 ${y} Tm`);
    lines.push(`(${escapeText(date)}) Tj`);
    lines.push('120 0 Td (' + escapeText(r.issue || '') + ') Tj');
    lines.push('250 0 Td (' + escapeText(r.status || '') + ') Tj');
    y -= 15;
  });
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

module.exports = { generateMaintenanceReport };
