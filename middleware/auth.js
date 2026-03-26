const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.query(
      'SELECT id, name, email, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!users[0].is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const [sessions] = await db.query(
      'SELECT id FROM sessions WHERE user_id = ? AND token_hash = ? AND expires_at > NOW()',
      [decoded.userId, token]
    );

    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    req.user = users[0];
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const roleMiddleware = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

module.exports = {
  authMiddleware,
  roleMiddleware
};
