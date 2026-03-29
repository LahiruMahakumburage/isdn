import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';

const router = Router();
router.use(authenticate);

// GET /rdcs
router.get('/', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT id, name, region, address, latitude, longitude, is_active
       FROM rdcs
       WHERE is_active = 1
       ORDER BY region`
    );
    ok(res, rows);
  } catch (e: any) {
    console.error('RDCs route error:', e);
    fail(res, e.message);
  }
});

// GET /rdcs/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM rdcs WHERE id = ?',
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'RDC not found', 404);
    ok(res, rows[0]);
  } catch (e: any) {
    console.error('RDC by id error:', e);
    fail(res, e.message);
  }
});

// GET /rdcs/:id/inventory — stock at a specific RDC
router.get('/:id/inventory', async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT i.id, i.quantity_on_hand, i.quantity_reserved,
              (i.quantity_on_hand - i.quantity_reserved) AS available,
              p.id AS product_id, p.name AS product_name,
              p.sku, p.unit, p.reorder_level
       FROM inventory i
       JOIN products p ON i.product_id = p.id
       WHERE i.rdc_id = ?
       ORDER BY p.name`,
      [req.params.id]
    );
    ok(res, rows);
  } catch (e: any) {
    console.error('RDC inventory error:', e);
    fail(res, e.message);
  }
});

export default router;
