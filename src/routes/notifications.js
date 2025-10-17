const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const notificationsController = require('../controllers/notificationsController');

router.get('/', authMiddleware, notificationsController.getNotifications);
router.put('/read', authMiddleware, notificationsController.markNotificationsRead);
router.delete('/', authMiddleware, notificationsController.clearNotifications);

module.exports = router;

