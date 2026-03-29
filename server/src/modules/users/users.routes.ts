import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';
import { paginate }     from '../../utils/pagination';
import { hash }         from '../../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);
router.use(authorize('super_admin','rdc_manager'));

// GET /users
router.get('/', async (req, res) => {
  try {
    const { offset, limit } = paginate(Number(req.query.page)||1, 20);
    const search = req.query.search ? `%${req.query.search}%` : '%';
    const role   = req.query.role   as string || null;
    let sql = `
      SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
             u.last_login_at, u.created_at, r.name AS rdc_name,
             GROUP_CONCAT(ro.name ORDER BY ro.name) AS roles
      FROM users u
      LEFT JOIN rdcs       r  ON u.rdc_id    = r.id
      LEFT JOIN user_roles ur ON u.id        = ur.user_id
      LEFT JOIN roles      ro ON ur.role_id  = ro.id
      WHERE (u.full_name LIKE ? OR u.email LIKE ?)`;
    const params: any[] = [search, search];
    if (role) { sql += ` AND ro.name = ?`; params.push(role); }
    sql += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const [rows]: any   = await pool.query(sql, params);
    const [[{total}]]: any = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles ro ON ur.role_id = ro.id
       WHERE (u.full_name LIKE ? OR u.email LIKE ?)
       ${role ? 'AND ro.name = ?' : ''}`,
      role ? [search, search, role] : [search, search]
    );
    ok(res, { users: rows.map((u:any) => ({...u, roles: u.roles?.split(',')||[]})), total });
  } catch (e: any) { fail(res, e.message); }
});

// GET /users/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.is_active,
              u.last_login_at, u.created_at, u.rdc_id,
              r.name AS rdc_name,
              GROUP_CONCAT(ro.name) AS roles
       FROM users u
       LEFT JOIN rdcs       r  ON u.rdc_id   = r.id
       LEFT JOIN user_roles ur ON u.id       = ur.user_id
       LEFT JOIN roles      ro ON ur.role_id = ro.id
       WHERE u.id = ? GROUP BY u.id`, [req.params.id]
    );
    if (!rows[0]) return fail(res, 'User not found', 404);
    const u = rows[0];
    ok(res, { ...u, roles: u.roles?.split(',')||[] });
  } catch (e: any) { fail(res, e.message); }
});

// POST /users — create user
router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const { full_name, email, password, phone, rdc_id, role } = req.body;
    if (!full_name||!email||!password||!role)
      return fail(res, 'full_name, email, password, role required', 400);
    const [exist]: any = await pool.query('SELECT id FROM users WHERE email=?',[email]);
    if (exist[0]) return fail(res, 'Email already registered', 409);
    const [roleRow]: any = await pool.query('SELECT id FROM roles WHERE name=?',[role]);
    if (!roleRow[0]) return fail(res, 'Invalid role', 400);
    const id = uuidv4();
    const password_hash = await hash(password);
    await pool.query(
      `INSERT INTO users (id,full_name,email,password_hash,phone,rdc_id) VALUES (?,?,?,?,?,?)`,
      [id, full_name, email, password_hash, phone||null, rdc_id||null]
    );
    await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)',[id,roleRow[0].id]);
    ok(res, { id }, 'User created');
  } catch (e: any) { fail(res, e.message); }
});

// PATCH /users/:id — update user
router.patch('/:id', async (req, res) => {
  try {
    const { full_name, phone, rdc_id, is_active } = req.body;
    await pool.query(
      `UPDATE users SET
         full_name = COALESCE(?,full_name),
         phone     = COALESCE(?,phone),
         rdc_id    = COALESCE(?,rdc_id),
         is_active = COALESCE(?,is_active)
       WHERE id = ?`,
      [full_name||null, phone||null, rdc_id||null, is_active??null, req.params.id]
    );
    ok(res, { id: req.params.id }, 'User updated');
  } catch (e: any) { fail(res, e.message); }
});

// PATCH /users/:id/roles — assign role
router.patch('/:id/roles', authorize('super_admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const [roleRow]: any = await pool.query('SELECT id FROM roles WHERE name=?',[role]);
    if (!roleRow[0]) return fail(res, 'Invalid role', 400);
    await pool.query('DELETE FROM user_roles WHERE user_id=?',[req.params.id]);
    await pool.query('INSERT INTO user_roles(user_id,role_id) VALUES(?,?)',[req.params.id,roleRow[0].id]);
    ok(res, null, 'Role updated');
  } catch (e: any) { fail(res, e.message); }
});

// DELETE /users/:id — deactivate
router.delete('/:id', authorize('super_admin'), async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active=0 WHERE id=?',[req.params.id]);
    ok(res, null, 'User deactivated');
  } catch (e: any) { fail(res, e.message); }
});

export default router;
