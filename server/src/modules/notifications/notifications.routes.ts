import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';

const router = Router();
router.use(authenticate);

// GET /notifications — user's notifications
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100);
    const unread = req.query.unread === 'true';
    let sql = `SELECT * FROM notifications WHERE user_id=?`;
    const params: any[] = [req.user!.userId];
    if (unread) { sql += ' AND is_read=0'; }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const [rows]: any = await pool.query(sql, params);
    // Unread count
    const [[{ count }]]: any = await pool.query(
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND is_read=0`,
      [req.user!.userId]
    );
    ok(res, { notifications: rows, unread_count: count });
  } catch (e: any) { fail(res, e.message); }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?`,
      [req.params.id, req.user!.userId]
    );
    ok(res, null, 'Marked as read');
  } catch (e: any) { fail(res, e.message); }
});

// PATCH /notifications/read-all
router.patch('/read-all', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read=1 WHERE user_id=?`,
      [req.user!.userId]
    );
    ok(res, null, 'All marked as read');
  } catch (e: any) { fail(res, e.message); }
});

// DELETE /notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE id=? AND user_id=?`,
      [req.params.id, req.user!.userId]
    );
    ok(res, null, 'Deleted');
  } catch (e: any) { fail(res, e.message); }
});

// DELETE /notifications — clear all
router.delete('/', async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM notifications WHERE user_id=?`,
      [req.user!.userId]
    );
    ok(res, null, 'All cleared');
  } catch (e: any) { fail(res, e.message); }
});

export default router;
