const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.post('/', authMiddleware, roleMiddleware('teacher'), upload.single('file'), async (req, res) => {
  try {
    const { classId, title, description, deadline } = req.body;

    if (!classId || !title || !deadline) {
      return res.status(400).json({ error: 'classId, title and deadline are required' });
    }

    const [classes] = await db.query('SELECT teacher_id FROM classes WHERE id = ?', [classId]);
    if (classes.length === 0 || classes[0].teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [result] = await db.query(
      'INSERT INTO assignments (class_id, title, description, deadline, file_path, original_filename) VALUES (?, ?, ?, ?, ?, ?)',
      [classId, title, description, deadline, req.file?.path, req.file?.originalname]
    );

    res.status(201).json({ assignmentId: result.insertId, message: 'Assignment created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

router.get('/class/:classId', authMiddleware, async (req, res) => {
  try {
    const [classes] = await db.query('SELECT id, teacher_id FROM classes WHERE id = ?', [req.params.classId]);

    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const classroom = classes[0];

    if (req.user.role === 'teacher' && classroom.teacher_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role === 'student') {
      const [enrollments] = await db.query(
        'SELECT id FROM class_students WHERE class_id = ? AND student_id = ?',
        [req.params.classId, req.user.id]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const [assignments] = await db.query(
      'SELECT id, title, description, deadline, file_path, original_filename FROM assignments WHERE class_id = ? ORDER BY deadline',
      [req.params.classId]
    );

    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

router.post('/:id/submit', authMiddleware, roleMiddleware('student'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const [assignments] = await db.query('SELECT id, class_id, deadline FROM assignments WHERE id = ?', [req.params.id]);
    if (assignments.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const [enrollments] = await db.query(
      'SELECT id FROM class_students WHERE class_id = ? AND student_id = ?',
      [assignments[0].class_id, req.user.id]
    );

    if (enrollments.length === 0) {
      return res.status(403).json({ error: 'You are not enrolled in this class' });
    }

    const isLate = new Date() > new Date(assignments[0].deadline);

    const [existing] = await db.query(
      'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing.length > 0) {
      await db.query(
        'UPDATE submissions SET file_path = ?, original_filename = ?, is_late = ?, updated_at = NOW() WHERE id = ?',
        [req.file.path, req.file.originalname, isLate, existing[0].id]
      );
      res.json({ submissionId: existing[0].id, isLate, message: 'Resubmitted successfully' });
    } else {
      const [result] = await db.query(
        'INSERT INTO submissions (assignment_id, student_id, file_path, original_filename, is_late) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, req.user.id, req.file.path, req.file.originalname, isLate]
      );
      res.status(201).json({ submissionId: result.insertId, isLate, message: 'Submitted successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Submission failed' });
  }
});

router.post('/:id/grade', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const { submissionId, marks } = req.body;

    if (submissionId === undefined || marks === undefined) {
      return res.status(400).json({ error: 'submissionId and marks are required' });
    }

    if (Number(marks) < 0 || Number(marks) > 100) {
      return res.status(400).json({ error: 'Marks must be between 0 and 100' });
    }

    const [assignments] = await db.query(
      `SELECT a.id
       FROM assignments a
       JOIN classes c ON a.class_id = c.id
       WHERE a.id = ? AND c.teacher_id = ?`,
      [req.params.id, req.user.id]
    );

    if (assignments.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [submissions] = await db.query(
      'SELECT id FROM submissions WHERE id = ? AND assignment_id = ?',
      [submissionId, req.params.id]
    );

    if (submissions.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    await db.query('UPDATE submissions SET marks = ? WHERE id = ?', [Number(marks), submissionId]);
    res.json({ message: 'Graded successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Grading failed' });
  }
});

router.get('/:id/submissions', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const [assignments] = await db.query(
      `SELECT a.id
       FROM assignments a
       JOIN classes c ON a.class_id = c.id
       WHERE a.id = ? AND c.teacher_id = ?`,
      [req.params.id, req.user.id]
    );

    if (assignments.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [submissions] = await db.query(
      `SELECT s.id, u.name as student_name, s.file_path, s.original_filename, s.marks, s.submitted_at, s.is_late
       FROM submissions s
       JOIN users u ON s.student_id = u.id
       WHERE s.assignment_id = ?
       ORDER BY s.submitted_at`,
      [req.params.id]
    );

    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

router.delete('/:id', authMiddleware, roleMiddleware('teacher'), async (req, res) => {
  try {
    const [assignments] = await db.query(
      `SELECT a.id
       FROM assignments a
       JOIN classes c ON a.class_id = c.id
       WHERE a.id = ? AND c.teacher_id = ?`,
      [req.params.id, req.user.id]
    );

    if (assignments.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.query('DELETE FROM assignments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

module.exports = router;
