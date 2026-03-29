import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';
import { paginate }     from '../../utils/pagination';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// ── GET /products ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const page      = Math.max(1, Number(req.query.page)     || 1);
    const limit     = Math.min(100, Number(req.query.limit)  || 50);
    const offset    = (page - 1) * limit;
    const search    = req.query.search    as string || '';
    const catId     = req.query.category  as string || '';
    const activeOnly= req.query.active !== 'false';

    let sql = `
      SELECT p.id, p.sku, p.name, p.unit_price, p.unit,
             p.reorder_level, p.is_active, p.created_at,
             c.id AS category_id, c.name AS category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1`;
    const params: any[] = [];

    if (activeOnly) { sql += ' AND p.is_active = 1'; }
    if (search) {
      sql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (catId) { sql += ' AND p.category_id = ?'; params.push(catId); }
    sql += ' ORDER BY p.name LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows]: any = await pool.query(sql, params);

    let countSql = `SELECT COUNT(*) AS total FROM products p WHERE 1=1`;
    const countParams: any[] = [];
    if (activeOnly) { countSql += ' AND p.is_active = 1'; }
    if (search) {
      countSql += ' AND (p.name LIKE ? OR p.sku LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    if (catId) { countSql += ' AND p.category_id = ?'; countParams.push(catId); }
    const [[{ total }]]: any = await pool.query(countSql, countParams);

    ok(res, { products: rows, total, page, limit });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── GET /products/categories ──────────────────────────────
router.get('/categories', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT c.id, c.name, c.parent_id,
              COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
       GROUP BY c.id ORDER BY c.name`
    );
    ok(res, rows);
  } catch (e: any) { fail(res, e.message); }
});

// ── GET /products/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Product not found', 404);

    // Stock levels across all RDCs
    const [stock]: any = await pool.query(
      `SELECT i.rdc_id, i.quantity_on_hand, i.quantity_reserved,
              (i.quantity_on_hand - i.quantity_reserved) AS available,
              r.name AS rdc_name, r.region
       FROM inventory i
       JOIN rdcs r ON i.rdc_id = r.id
       WHERE i.product_id = ?
       ORDER BY r.region`,
      [req.params.id]
    );

    // Sales last 30 days
    const [[sales]]: any = await pool.query(
      `SELECT COALESCE(SUM(oi.quantity), 0)   AS sold_30d,
              COALESCE(SUM(oi.line_total), 0) AS revenue_30d,
              COUNT(DISTINCT oi.order_id)     AS order_count_30d
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.product_id = ?
         AND DATE(o.ordered_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         AND o.status != 'cancelled'`,
      [req.params.id]
    );

    ok(res, { ...rows[0], stock, sales });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── POST /products ────────────────────────────────────────
router.post('/',
  authorize('super_admin', 'rdc_manager'),
  async (req, res) => {
    try {
      const { sku, name, category_id, unit, unit_price, reorder_level } = req.body;
      if (!sku || !name || !category_id || !unit_price)
        return fail(res, 'sku, name, category_id, unit_price are required', 400);

      const [exist]: any = await pool.query(
        'SELECT id FROM products WHERE sku = ?', [sku]
      );
      if (exist[0]) return fail(res, `SKU "${sku}" already exists`, 409);

      const id = uuidv4();
      await pool.query(
        `INSERT INTO products
           (id, sku, name, category_id, unit, unit_price, reorder_level, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [id, sku.toUpperCase(), name, category_id,
         unit || 'piece', unit_price, reorder_level || 0]
      );

      // Auto-create inventory rows for all RDCs (0 stock)
      const [rdcs]: any = await pool.query(
        'SELECT id FROM rdcs WHERE is_active = 1'
      );
      for (const rdc of rdcs) {
        await pool.query(
          `INSERT IGNORE INTO inventory (rdc_id, product_id, quantity_on_hand)
           VALUES (?, ?, 0)`,
          [rdc.id, id]
        );
      }

      ok(res, { id }, 'Product created');
    } catch (e: any) { console.error(e); fail(res, e.message); }
  }
);

// ── PATCH /products/:id ───────────────────────────────────
router.patch('/:id',
  authorize('super_admin', 'rdc_manager'),
  async (req, res) => {
    try {
      const { name, unit, unit_price, reorder_level, category_id, is_active } = req.body;
      const [rows]: any = await pool.query(
        'SELECT id FROM products WHERE id = ?', [req.params.id]
      );
      if (!rows[0]) return fail(res, 'Product not found', 404);

      await pool.query(
        `UPDATE products SET
           name          = COALESCE(?, name),
           unit          = COALESCE(?, unit),
           unit_price    = COALESCE(?, unit_price),
           reorder_level = COALESCE(?, reorder_level),
           category_id   = COALESCE(?, category_id),
           is_active     = COALESCE(?, is_active),
           updated_at    = NOW()
         WHERE id = ?`,
        [name       ?? null,
         unit       ?? null,
         unit_price ?? null,
         reorder_level !== undefined ? reorder_level : null,
         category_id ?? null,
         is_active   !== undefined ? is_active : null,
         req.params.id]
      );
      ok(res, { id: req.params.id }, 'Product updated');
    } catch (e: any) { console.error(e); fail(res, e.message); }
  }
);

// ── DELETE /products/:id — soft delete ────────────────────
router.delete('/:id',
  authorize('super_admin'),
  async (req, res) => {
    try {
      await pool.query(
        'UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]
      );
      ok(res, null, 'Product deactivated');
    } catch (e: any) { fail(res, e.message); }
  }
);

export default router;
