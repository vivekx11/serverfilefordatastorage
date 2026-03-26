const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { generateClassCode } = require('../utils/codeGenerator');

router.post('/', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const { className } = req.body;
    
    if (!className) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    let classCode;
    let isUnique = false;
    
    while (!isUnique) {
      classCode = generateClassCode();
      const [existing] = await db.query('SELECT id FROM classes WHERE class_code = ?', [classCode]);
      if (existing.length === 0) isUnique = true;
    }

    const [result] = await db.query(
      'INSERT INTO classes (class_name, teacher_id, class_code) VALUES (?, ?, ?)',
      [className, req.user.id, classCode]
    );

    res.status(201).json({ classId: result.insertId, classCode, message: 'Class created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    let query, params;

    if (req.user.role === 'teacher') {
      query = `SELECT c.id, c.class_name, c.class_code, u.name as teacher_name,
               COUNT(cs.student_id) as enrollment_count
               FROM classes c
               JOIN users u ON c.teacher_id = u.id
               LEFT JOIN class_students cs ON c.id = cs.class_id
               WHERE c.teacher_id = ?
               GROUP BY c.id`;
      params = [req.user.id];
    } else if (req.user.role === 'student') {
      query = `SELECT c.id, c.class_name, c.class_code, u.name as teacher_name,
               COUNT(cs2.student_id) as enrollment_count
               FROM classes c
               JOIN users u ON c.teacher_id = u.id
               JOIN class_students cs ON c.id = cs.class_id
               LEFT JOIN class_students cs2 ON c.id = cs2.class_id
               WHERE cs.student_id = ?
               GROUP BY c.id`;
      params = [req.user.id];
    } else {
      query = `SELECT c.id, c.class_name, c.class_code, u.name as teacher_name,
               COUNT(cs.student_id) as enrollment_count
               FROM classes c
               JOIN users u ON c.teacher_id = u.id
               LEFT JOIN class_students cs ON c.id = cs.class_id
               GROUP BY c.id`;
      params = [];
    }

    const [classes] = await db.query(query, params);
    res.json({ classes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/enroll', authMiddleware, roleMiddleware('student'), async (req, res) => {
  try {
    const { classCode } = req.body;

    const [classes] = await db.query('SELECT id FROM classes WHERE class_code = ?', [classCode]);
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Invalid class code' });
    }

    const classId = classes[0].id;

    const [existing] = await db.query(
      'SELECT id FROM class_students WHERE class_id = ? AND student_id = ?',
      [classId, req.user.id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already enrolled in this class' });
    }

    await db.query(
      'INSERT INTO class_students (class_id, student_id) VALUES (?, ?)',
      [classId, req.user.id]
    );

    res.json({ classId, message: 'Enrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Enrollment failed' });
  }
});

router.get('/:id/students', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const [ownedClasses] = await db.query(
      'SELECT id FROM classes WHERE id = ? AND teacher_id = ?',
      [req.params.id, req.user.id]
    );

    if (ownedClasses.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [students] = await db.query(
      `SELECT u.id, u.name, u.email, 
       AVG(s.marks) as avg_marks,
       COUNT(DISTINCT s.id) as submission_count
       FROM class_students cs
       JOIN users u ON cs.student_id = u.id
       LEFT JOIN submissions s ON u.id = s.student_id
       LEFT JOIN assignments a ON s.assignment_id = a.id AND a.class_id = ?
       WHERE cs.class_id = ?
       GROUP BY u.id`,
      [req.params.id, req.params.id]
    );

    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const [classes] = await db.query('SELECT teacher_id FROM classes WHERE id = ?', [req.params.id]);
    
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (req.user.role !== 'admin' && classes[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('DELETE FROM classes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

module.exports = router;
