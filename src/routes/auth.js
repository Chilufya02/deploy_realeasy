const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const {
  validateSignup,
  validateLogin,
  validateProfile,
  validatePasswordChange,
  validateForgotPassword,
  validateResetPassword
} = require('../middleware/validation/auth');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiter');
const { authMiddleware } = require('../middleware/auth');
const { sendEmail } = require('../services/email');

// Helper function to generate JWT
const JWT_SECRET = process.env.JWT_SECRET || 'insecure_default_secret';
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Helper function to log login attempts
const logLoginAttempt = async (email, ipAddress, success) => {
  try {
    await db.execute(
      'INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, ?)',
      [email, ipAddress, success]
    );
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

// Sign up
router.post('/signup', authLimiter, validateSignup, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role,
      notifyEmail = true,
      notifySMS = false
    } = req.body;

    // Check if user already exists
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (first_name, last_name, email, phone, password_hash, role, notify_email, notify_sms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        firstName,
        lastName,
        email,
        phone || null,
        passwordHash,
        role,
        notifyEmail ? 1 : 0,
        notifySMS ? 1 : 0
      ]
    );

    // If the user is a tenant, ensure a tenant record exists
    if (role === 'tenant') {
      const [existingTenants] = await db.query(
        'SELECT id FROM tenants WHERE email = ?',
        [email]
      );

      if (existingTenants.length === 0) {
        try {
          await db.execute(
            'INSERT INTO tenants (name, email, phone, property_id, balance) VALUES (?, ?, ?, NULL, 0)',
            [`${firstName} ${lastName}`.trim(), email, phone || null]
          );
        } catch (e) {
          if (e.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Tenant with this email already exists' });
          }
          throw e;
        }
      }
    }

    // Generate token
    const token = generateToken(result.insertId, email, role);

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: result.insertId,
        firstName,
        lastName,
        email,
        phone,
        role,
        notifyEmail: !!notifyEmail,
        notifySMS: !!notifySMS
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Find user
    const [users] = await db.query(
      'SELECT id, first_name, last_name, email, phone, password_hash, role, notify_email, notify_sms, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      await logLoginAttempt(email, ipAddress, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.is_active) {
      await logLoginAttempt(email, ipAddress, false);
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      await logLoginAttempt(email, ipAddress, false);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    await db.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Log successful attempt
    await logLoginAttempt(email, ipAddress, true);

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        notifyEmail: !!user.notify_email,
        notifySMS: !!user.notify_sms
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset
router.post('/forgot-password', validateForgotPassword, async (req, res) => {
  const genericMessage = 'If an account with that email exists, a reset link has been sent.';
  try {
    const { email } = req.body;

    const [users] = await db.query(
      'SELECT id, first_name FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.json({ message: genericMessage });
    }

    const user = users[0];

    // Invalidate previous tokens
    await db.execute(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ?',
      [user.id]
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiryMinutes = parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES, 10) || 60;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await db.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    const appBaseUrl = process.env.APP_BASE_URL || 'https://realeazy.site';
    const resetLink = `${appBaseUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

    const emailBody = [
      `Hello ${user.first_name || 'there'},`,
      '',
      'We received a request to reset your RealEasy password.',
      'You can set a new password by visiting the link below:',
      resetLink,
      '',
      `This link will expire in ${expiryMinutes} minutes.`,
      '',
      'If you did not request a password reset, you can safely ignore this email.',
      '',
      '— The RealEasy Team'
    ].join('\n');

    try {
      await sendEmail({
        to: email,
        subject: 'Reset your RealEasy password',
        message: emailBody
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
    }

    res.json({ message: genericMessage, resetLink: process.env.NODE_ENV !== 'production' ? resetLink : undefined });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password
router.post('/reset-password', validateResetPassword, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [tokens] = await db.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token = ? AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired password reset token' });
    }

    const resetRequest = tokens[0];

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await db.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, resetRequest.user_id]
    );

    await db.execute(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = ?',
      [resetRequest.id]
    );

    // Invalidate any other outstanding tokens for this user
    await db.execute(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = ? AND id != ?',
      [resetRequest.user_id, resetRequest.id]
    );

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout successful' });
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, first_name, last_name, email, phone, role, notify_email, notify_sms, created_at, last_login FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      notifyEmail: !!user.notify_email,
      notifySMS: !!user.notify_sms
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
router.put('/profile', authMiddleware, validateProfile, async (req, res) => {
  try {
    const { firstName, lastName, phone, notifyEmail, notifySMS } = req.body;

    await db.execute(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, notify_email = ?, notify_sms = ? WHERE id = ?',
      [firstName, lastName, phone || null, notifyEmail ? 1 : 0, notifySMS ? 1 : 0, req.user.id]
    );

    const [users] = await db.query(
      'SELECT id, first_name, last_name, email, phone, role, notify_email, notify_sms FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        notifyEmail: !!user.notify_email,
        notifySMS: !!user.notify_sms
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authMiddleware, validatePasswordChange, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    // Get current user
    const [users] = await db.query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;