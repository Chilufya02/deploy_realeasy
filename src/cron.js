const cron = require('node-cron');
const db = require('./db');
const { sendEmail } = require('./services/email');

const sendLeaseExpiryAlerts = async () => {
  try {
    const [rows] = await db.query(`
      SELECT t.email, l.end_date
      FROM leases l
      JOIN tenants t ON l.tenant_id = t.id
      WHERE DATE(l.end_date) = DATE_ADD(CURDATE(), INTERVAL 30 DAY)
    `);
    for (const r of rows) {
      const msg = `Alert: your lease expires on ${r.end_date}`;
      await sendEmail({ to: r.email, subject: 'Lease Expiry Notice', message: msg });
    }
  } catch (err) {
    console.error('Lease expiry job failed:', err);
  }
};

cron.schedule('0 10 * * *', sendLeaseExpiryAlerts); // 10 AM daily

module.exports = { sendLeaseExpiryAlerts };
