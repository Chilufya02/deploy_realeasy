const db = require('../db');

async function getNotificationsForUser(user) {
  if (user.role !== 'tenant') return [];
  const [tRows] = await db.query('SELECT id FROM tenants WHERE email = ?', [user.email]);
  if (!tRows.length) return [];
  const tenantId = tRows[0].id;
  const [rows] = await db.query(
    `SELECT id, type, title, message, DATE_FORMAT(date, "%Y-%m-%d") as date, \`read\`
       FROM notifications WHERE tenant_id = ?
       ORDER BY date DESC`,
    [tenantId]
  );
  return rows;
}

async function markAllAsRead(user) {
  if (user.role !== 'tenant') return;
  const [tRows] = await db.query('SELECT id FROM tenants WHERE email = ?', [user.email]);
  if (!tRows.length) return;
  const tenantId = tRows[0].id;
  await db.query('UPDATE notifications SET `read` = TRUE WHERE tenant_id = ?', [tenantId]);
}

async function clearAll(user) {
  if (user.role !== 'tenant') return;
  const [tRows] = await db.query('SELECT id FROM tenants WHERE email = ?', [user.email]);
  if (!tRows.length) return;
  const tenantId = tRows[0].id;
  await db.query('DELETE FROM notifications WHERE tenant_id = ?', [tenantId]);
}

module.exports = {
  getNotificationsForUser,
  markAllAsRead,
  clearAll
};

