import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';
import { paginate }     from '../../utils/pagination';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// GET /inventory — stock levels across all RDCs (or filtered by rdc_id)
router.get('/', async (req, res) => {
  try {
    const { offset, limit } = paginate(Number(req.query.page)||1, Number(req.query.limit)||50);
    const rdcId  = req.query.rdc_id  ? Number(req.query.rdc_id)  : null;
    const search = req.query.search  ? `%${req.query.search}%`   : '%';
    const low    = req.query.low_stock === 'true';

    let sql = `
      SELECT i.id, i.rdc_id, i.quantity_on_hand, i.quantity_reserved,
             (i.quantity_on_hand - i.quantity_reserved) AS available,
             p.id AS product_id, p.name AS product_name, p.sku, p.unit,
             p.reorder_level, r.name AS rdc_name, r.region,
             i.last_updated_at
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN rdcs     r ON i.rdc_id     = r.id
      WHERE (p.name LIKE ? OR p.sku LIKE ?)`;
    const params: any[] = [search, search];
    if (rdcId) { sql += ' AND i.rdc_id = ?'; params.push(rdcId); }
    if (low)   { sql += ' AND i.quantity_on_hand <= p.reorder_level'; }
    sql += ' ORDER BY r.region, p.name LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows]: any = await pool.query(sql, params);
    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE (p.name LIKE ? OR p.sku LIKE ?)
       ${rdcId ? 'AND i.rdc_id = ?' : ''}
       ${low   ? 'AND i.quantity_on_hand <= p.reorder_level' : ''}`,
      rdcId ? [search, search, rdcId] : [search, search]
    );
    ok(res, { inventory: rows, total });
  } catch (e: any) { fail(res, e.message); }
});

// GET /inventory/summary — totals per RDC
router.get('/summary', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT r.id, r.name, r.region,
              COUNT(i.id) AS product_count,
              SUM(i.quantity_on_hand) AS total_units,
              SUM(CASE WHEN i.quantity_on_hand <= p.reorder_level THEN 1 ELSE 0 END) AS low_stock_count
       FROM rdcs r
       LEFT JOIN inventory i ON r.id = i.rdc_id
       LEFT JOIN products  p ON i.product_id = p.id
       WHERE r.is_active = 1
       GROUP BY r.id ORDER BY r.region`
    );
    ok(res, rows);
  } catch (e: any) { fail(res, e.message); }
});

// PATCH /inventory/:id/adjust — manual stock adjustment
router.patch('/:id/adjust',
  authorize('super_admin','rdc_manager','rdc_staff'),
  async (req, res) => {
    try {
      const { adjustment, reason } = req.body;
      if (!adjustment || isNaN(Number(adjustment)))
        return fail(res, 'adjustment (number) is required', 400);
      const [rows]: any = await pool.query('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
      if (!rows[0]) return fail(res, 'Inventory record not found', 404);
      const newQty = Math.max(0, rows[0].quantity_on_hand + Number(adjustment));
      await pool.query(
        'UPDATE inventory SET quantity_on_hand = ? WHERE id = ?',
        [newQty, req.params.id]
      );
      ok(res, { id: req.params.id, new_quantity: newQty, reason });
    } catch (e: any) { fail(res, e.message); }
  }
);

// GET /inventory/transfers — list stock transfers
router.get('/transfers', async (req, res) => {
  try {
    const { offset, limit } = paginate(Number(req.query.page)||1, 20);
    const [rows]: any = await pool.query(
      `SELECT st.*, p.name AS product_name, p.sku,
              fr.name AS from_rdc_name, tr.name AS to_rdc_name,
              u.full_name AS initiated_by_name
       FROM stock_transfers st
       JOIN products p ON st.product_id   = p.id
       JOIN rdcs    fr ON st.from_rdc_id  = fr.id
       JOIN rdcs    tr ON st.to_rdc_id    = tr.id
       JOIN users    u ON st.initiated_by = u.id
       ORDER BY st.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    ok(res, rows);
  } catch (e: any) { fail(res, e.message); }
});

// POST /inventory/transfers — create transfer
router.post('/transfers',
  authorize('super_admin','rdc_manager'),
  async (req, res) => {
    const { from_rdc_id, to_rdc_id, product_id, quantity, notes } = req.body;
    if (!from_rdc_id || !to_rdc_id || !product_id || !quantity)
      return fail(res, 'from_rdc_id, to_rdc_id, product_id, quantity required', 400);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [inv]: any = await conn.query(
        `SELECT quantity_on_hand - quantity_reserved AS available
         FROM inventory WHERE rdc_id = ? AND product_id = ? FOR UPDATE`,
        [from_rdc_id, product_id]
      );
      if (!inv[0] || inv[0].available < quantity)
        throw new Error('Insufficient available stock in source RDC');
      const id = uuidv4();
      await conn.query(
        `INSERT INTO stock_transfers
           (id, from_rdc_id, to_rdc_id, product_id, quantity, status, initiated_by, notes)
         VALUES (?,?,?,?,?,'pending',?,?)`,
        [id, from_rdc_id, to_rdc_id, product_id, quantity, req.user!.userId, notes||null]
      );
      // Deduct from source, add to destination
      await conn.query(
        `UPDATE inventory SET quantity_on_hand = quantity_on_hand - ? WHERE rdc_id=? AND product_id=?`,
        [quantity, from_rdc_id, product_id]
      );
      await conn.query(
        `INSERT INTO inventory (rdc_id, product_id, quantity_on_hand)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE quantity_on_hand = quantity_on_hand + ?`,
        [to_rdc_id, product_id, quantity, quantity]
      );
      await conn.query(`UPDATE stock_transfers SET status='completed' WHERE id=?`, [id]);
      await conn.commit();
      ok(res, { id }, 'Transfer completed');
    } catch(e: any) { await conn.rollback(); fail(res, e.message); }
    finally { conn.release(); }
  }
);

export default router;
