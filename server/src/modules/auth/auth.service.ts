import jwt from 'jsonwebtoken';
import { pool } from '../../db/connection';
import { compare } from '../../utils/crypto';
import { env } from '../../config/env';

export const authService = {
  async login(email: string, password: string) {
    const [rows]: any = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.password_hash, u.rdc_id,
              GROUP_CONCAT(r.name) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.email = ? AND u.is_active = 1
       GROUP BY u.id`, [email]);
    const user = rows[0];
    if (!user) throw new Error('Invalid credentials');
    const valid = await compare(password, user.password_hash);
    if (!valid) throw new Error('Invalid credentials');
    const roles = user.roles ? user.roles.split(',') : [];
    const payload = { userId: user.id, roles, rdcId: user.rdc_id };
    const accessToken  = jwt.sign(payload, env.JWT_SECRET,         { expiresIn: env.JWT_EXPIRES_IN as any });
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    return { accessToken, refreshToken, user: { id: user.id, name: user.full_name, email: user.email, roles } };
  },

  async refreshToken(token: string) {
    const payload: any = jwt.verify(token, env.JWT_REFRESH_SECRET);
    const { userId, roles, rdcId } = payload;
    const accessToken = jwt.sign({ userId, roles, rdcId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
    return { accessToken };
  },
};
