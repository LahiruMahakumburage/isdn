import { pool } from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

export async function createNotification(params: {
  userId:    string;
  type:      string;
  title:     string;
  body?:     string;
  relatedId?: string;
}) {
  try {
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, body, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        params.userId,
        params.type,
        params.title,
        params.body    || null,
        params.relatedId || null,
      ]
    );
  } catch (e) {
    // Never crash the main request due to notification failure
    console.error('[notify] failed:', e);
  }
}

// Notify all users with a given role
export async function notifyRole(params: {
  role:      string;
  type:      string;
  title:     string;
  body?:     string;
  relatedId?: string;
}) {
  try {
    const [users]: any = await pool.query(
      `SELECT u.id FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE r.name = ? AND u.is_active = 1`,
      [params.role]
    );
    for (const user of users) {
      await createNotification({ ...params, userId: user.id });
    }
  } catch (e) {
    console.error('[notify-role] failed:', e);
  }
}
