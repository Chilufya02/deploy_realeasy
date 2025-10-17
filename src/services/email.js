const net = require('node:net');
const dns = require('node:dns').promises;

// Simple SMTP client using only Node's built-in modules.
// Sends a plaintext email by directly connecting to the recipient's MX server.
async function sendEmail({ to, subject, message, from = 'no-reply@realeasy.local' }) {
  if (!to) throw new Error('Recipient email required');
  const domain = to.split('@')[1];
  if (!domain) throw new Error('Invalid recipient email');
  const mxRecords = await dns.resolveMx(domain);
  if (!mxRecords.length) throw new Error('No MX records found for domain');
  // Pick the lowest priority server
  mxRecords.sort((a, b) => a.priority - b.priority);
  const mx = mxRecords[0].exchange;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(25, mx);
    socket.setEncoding('utf8');

    const commands = [
      `HELO realeasy.local`,
      `MAIL FROM:<${from}>`,
      `RCPT TO:<${to}>`,
      `DATA`,
      `Subject: ${subject}\r\nFrom: ${from}\r\nTo: ${to}\r\n\r\n${message}\r\n.`,
      `QUIT`
    ];
    let step = 0;

    socket.on('data', (data) => {
      // If server returns an error code, abort.
      const code = parseInt(data.substring(0, 3), 10);
      if (code >= 400) {
        socket.end();
        reject(new Error(`SMTP error ${code}: ${data.trim()}`));
        return;
      }
      if (step < commands.length) {
        socket.write(commands[step] + '\r\n');
        step++;
      } else {
        socket.end();
        resolve();
      }
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { sendEmail };
