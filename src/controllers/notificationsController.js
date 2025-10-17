const notificationService = require('../services/notificationsService');

async function getNotifications(req, res) {
  try {
    const rows = await notificationService.getNotificationsForUser(req.user);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

async function markNotificationsRead(req, res) {
  try {
    await notificationService.markAllAsRead(req.user);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
}

async function clearNotifications(req, res) {
  try {
    await notificationService.clearAll(req.user);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
}

module.exports = {
  getNotifications,
  markNotificationsRead,
  clearNotifications
};

