const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, role, created_at, is_active FROM users ORDER BY created_at DESC'
    );
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// admin 

router.put('/users/:id/deactivate', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [req.params.id]);
    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

router.put('/users/:id/activate', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await db.query('UPDATE users SET is_active = TRUE WHERE id = ?', [req.params.id]);
    res.json({ message: 'User activated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate user' });
  }
});

router.put('/users/:id/role', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await db.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.get('/reports', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const [userCounts] = await db.query(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role'
    );
    const [classCount] = await db.query('SELECT COUNT(*) as count FROM classes');
    const [assignmentCount] = await db.query('SELECT COUNT(*) as count FROM assignments');
    const [submissionCount] = await db.query('SELECT COUNT(*) as count FROM submissions');
    const [avgMarks] = await db.query('SELECT AVG(marks) as avg FROM submissions WHERE marks IS NOT NULL');

    res.json({
      totalUsers: userCounts.reduce((acc, curr) => ({ ...acc, [curr.role]: curr.count }), {}),
      totalClasses: classCount[0].count,
      totalAssignments: assignmentCount[0].count,
      totalSubmissions: submissionCount[0].count,
      avgMarksAcrossSystem: avgMarks[0].avg || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
