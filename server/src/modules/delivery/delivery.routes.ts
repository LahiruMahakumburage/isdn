import { createNotification } from '../../utils/notify';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';
import { paginate }     from '../../utils/pagination';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// ── GET /delivery ─────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { offset, limit } = paginate(
      Number(req.query.page)  || 1,
      Number(req.query.limit) || 20
    );
    const status = req.query.status as string || null;
    const rdcId  = req.query.rdc_id ? Number(req.query.rdc_id) : null;
    const isDriver = req.user!.roles.includes('logistics_officer');
    const driverId = isDriver ? req.user!.userId : null;

    let sql = `
      SELECT d.id, d.status, d.scheduled_date, d.actual_delivery_at,
             d.current_lat, d.current_lng, d.last_gps_update,
             d.proof_of_delivery,
             o.id AS order_id, o.order_number, o.delivery_address,
             o.total, o.delivery_lat, o.delivery_lng,
             u.id AS driver_id, u.full_name AS driver_name,
             u.phone AS driver_phone,
             c.full_name AS customer_name, c.phone AS customer_phone,
             r.id AS rdc_id, r.name AS rdc_name, r.region
      FROM deliveries d
      JOIN orders o ON d.order_id    = o.id
      JOIN rdcs   r ON d.rdc_id      = r.id
      LEFT JOIN users u ON d.driver_id   = u.id
      JOIN users  c ON o.customer_id = c.id
      WHERE 1=1`;
    const params: any[] = [];

    if (status)   { sql += ' AND d.status = ?';    params.push(status);   }
    if (rdcId)    { sql += ' AND d.rdc_id = ?';    params.push(rdcId);    }
    if (driverId) { sql += ' AND d.driver_id = ?'; params.push(driverId); }

    sql += ' ORDER BY d.scheduled_date DESC, d.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows]: any = await pool.query(sql, params);

    let countSql = `SELECT COUNT(*) AS total FROM deliveries d WHERE 1=1`;
    const cp: any[] = [];
    if (status)   { countSql += ' AND d.status = ?';    cp.push(status);   }
    if (rdcId)    { countSql += ' AND d.rdc_id = ?';    cp.push(rdcId);    }
    if (driverId) { countSql += ' AND d.driver_id = ?'; cp.push(driverId); }
    const [[{ total }]]: any = await pool.query(countSql, cp);

    ok(res, { deliveries: rows, total });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── GET /delivery/stats/summary ───────────────────────────
router.get('/stats/summary',
  authorize('super_admin','rdc_manager','rdc_staff','logistics_officer'),
  async (_req, res) => {
    try {
      const [[s]]: any = await pool.query(
        `SELECT
           COUNT(*)                                                         AS total,
           SUM(CASE WHEN status='scheduled'        THEN 1 ELSE 0 END)       AS scheduled,
           SUM(CASE WHEN status='out_for_delivery' THEN 1 ELSE 0 END)       AS out_for_delivery,
           SUM(CASE WHEN status='delivered'        THEN 1 ELSE 0 END)       AS delivered,
           SUM(CASE WHEN status='failed'           THEN 1 ELSE 0 END)       AS failed,
           SUM(CASE WHEN DATE(scheduled_date)=CURDATE() THEN 1 ELSE 0 END)  AS today
         FROM deliveries`
      );
      ok(res, s);
    } catch (e: any) { fail(res, e.message); }
  }
);

// ── GET /delivery/drivers — logistics officers list ───────
router.get('/drivers',
  authorize('super_admin','rdc_manager','rdc_staff','logistics_officer'),
  async (_req, res) => {
    try {
      const [rows]: any = await pool.query(
        `SELECT u.id, u.full_name, u.phone, u.rdc_id, r.name AS rdc_name
         FROM users u
         LEFT JOIN rdcs r ON u.rdc_id = r.id
         JOIN user_roles ur ON u.id = ur.user_id
         JOIN roles ro ON ur.role_id = ro.id
         WHERE ro.name = 'logistics_officer' AND u.is_active = 1
         ORDER BY u.full_name`
      );
      ok(res, rows);
    } catch (e: any) { fail(res, e.message); }
  }
);

// ── GET /delivery/:id ─────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT d.*, 
              o.order_number, o.delivery_address,
              o.delivery_lat, o.delivery_lng, o.total, o.status AS order_status,
              u.full_name AS driver_name, u.phone AS driver_phone,
              c.full_name AS customer_name, c.phone AS customer_phone,
              c.email AS customer_email,
              r.name AS rdc_name, r.region
       FROM deliveries d
       JOIN orders o ON d.order_id    = o.id
       JOIN rdcs   r ON d.rdc_id      = r.id
       LEFT JOIN users u ON d.driver_id   = u.id
       JOIN users  c ON o.customer_id = c.id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Delivery not found', 404);
    ok(res, rows[0]);
  } catch (e: any) { fail(res, e.message); }
});

// ── POST /delivery — schedule delivery for an order ───────
router.post('/',
  authorize('super_admin','rdc_manager','rdc_staff'),
  async (req, res) => {
    try {
      const { order_id, driver_id, scheduled_date } = req.body;
      if (!order_id || !scheduled_date)
        return fail(res, 'order_id and scheduled_date required', 400);

      // Check order exists and is in correct state
      const [ord]: any = await pool.query(
        `SELECT id, rdc_id, status FROM orders WHERE id = ?`, [order_id]
      );
      if (!ord[0]) return fail(res, 'Order not found', 404);
      if (!['confirmed','picking','dispatched'].includes(ord[0].status))
        return fail(res, `Cannot schedule delivery for order with status: ${ord[0].status}`, 400);

      // Check no existing delivery
      const [existing]: any = await pool.query(
        `SELECT id FROM deliveries WHERE order_id = ?`, [order_id]
      );
      if (existing[0])
        return fail(res, 'Delivery already scheduled for this order', 409);

      const id = uuidv4();
      await pool.query(
        `INSERT INTO deliveries
           (id, order_id, driver_id, rdc_id, scheduled_date, status)
         VALUES (?, ?, ?, ?, ?, 'scheduled')`,
        [id, order_id, driver_id || null, ord[0].rdc_id, scheduled_date]
      );
      ok(res, { id }, 'Delivery scheduled');
    } catch (e: any) { console.error(e); fail(res, e.message); }
  }
);

// ── PATCH /delivery/:id/assign — assign/change driver ─────
router.patch('/:id/assign',
  authorize('super_admin','rdc_manager'),
  async (req, res) => {
    try {
      const { driver_id } = req.body;
      const [rows]: any = await pool.query(
        'SELECT id FROM deliveries WHERE id = ?', [req.params.id]
      );
      if (!rows[0]) return fail(res, 'Delivery not found', 404);
      await pool.query(
        'UPDATE deliveries SET driver_id = ? WHERE id = ?',
        [driver_id || null, req.params.id]
      );
      ok(res, null, 'Driver assigned');
    } catch (e: any) { fail(res, e.message); }
  }
);

// ── PATCH /delivery/:id/status — advance delivery status ──
router.patch('/:id/status',
  authorize('super_admin','rdc_manager','rdc_staff','logistics_officer'),
  async (req, res) => {
    try {
      const { status } = req.body;
      const valid = ['out_for_delivery','delivered','failed'];
      if (!valid.includes(status))
        return fail(res, `Status must be one of: ${valid.join(', ')}`, 400);

      const [rows]: any = await pool.query(
        'SELECT id, order_id, status FROM deliveries WHERE id = ?', [req.params.id]
      );
      if (!rows[0]) return fail(res, 'Delivery not found', 404);

      const validTransitions: Record<string,string[]> = {
        scheduled:        ['out_for_delivery'],
        out_for_delivery: ['delivered', 'failed'],
        delivered:        [],
        failed:           [],
      };
      if (!validTransitions[rows[0].status]?.includes(status))
        return fail(res, `Cannot move from "${rows[0].status}" to "${status}"`, 400);

      let sql = 'UPDATE deliveries SET status = ?';
      const params: any[] = [status];
      if (status === 'delivered') sql += ', actual_delivery_at = NOW()';
      sql += ' WHERE id = ?';
      params.push(req.params.id);
      await pool.query(sql, params);

      // Sync order status when delivered
      if (status === 'delivered') {
      // Fetch customer for this delivery and notify them
      try {
        const [cust]: any = await pool.query(
          `SELECT o.customer_id, o.order_number
           FROM deliveries d JOIN orders o ON d.order_id=o.id
           WHERE d.id=?`, [req.params.id]
        );
        if (cust[0]) {
          await createNotification({
            userId: cust[0].customer_id,
            type: 'order_delivered',
            title: 'Order Delivered! 🎉',
            body: `Your order ${cust[0].order_number} has been delivered successfully.`,
            relatedId: rows[0].order_id,
          });
        }
      } catch {}
        await pool.query(
          `UPDATE orders SET status = 'delivered', delivered_at = NOW()
           WHERE id = ?`,
          [rows[0].order_id]
        );
        // Mark invoice paid if only one outstanding
        await pool.query(
          `UPDATE invoices SET status = 'issued'
           WHERE order_id = ? AND status = 'draft'`,
          [rows[0].order_id]
        );
      }

      ok(res, { id: req.params.id, status }, 'Delivery status updated');
    } catch (e: any) { console.error(e); fail(res, e.message); }
  }
);

// ── PATCH /delivery/:id/gps — update GPS coordinates ──────
router.patch('/:id/gps',
  authorize('logistics_officer','super_admin','rdc_manager'),
  async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (lat == null || lng == null)
        return fail(res, 'lat and lng required', 400);
      if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180)
        return fail(res, 'Invalid coordinates', 400);
      await pool.query(
        `UPDATE deliveries
         SET current_lat = ?, current_lng = ?, last_gps_update = NOW()
         WHERE id = ?`,
        [Number(lat), Number(lng), req.params.id]
      );
      ok(res, null, 'GPS updated');
    } catch (e: any) { fail(res, e.message); }
  }
);

// ── PATCH /delivery/:id/proof — upload proof of delivery ──
router.patch('/:id/proof',
  authorize('logistics_officer','super_admin'),
  async (req, res) => {
    try {
      const { proof_of_delivery } = req.body;
      if (!proof_of_delivery)
        return fail(res, 'proof_of_delivery URL required', 400);
      await pool.query(
        'UPDATE deliveries SET proof_of_delivery = ? WHERE id = ?',
        [proof_of_delivery, req.params.id]
      );
      ok(res, null, 'Proof of delivery saved');
    } catch (e: any) { fail(res, e.message); }
  }
);


// ── GET /delivery/routes/overview ────────────────────────
// Returns deliveries grouped by driver for route overview
router.get('/routes/overview',
  authorize('super_admin','rdc_manager','rdc_staff','logistics_officer'),
  async (req, res) => {
    try {
      const date  = req.query.date as string || new Date().toISOString().split('T')[0];
      const rdcId = req.query.rdc_id ? Number(req.query.rdc_id) : null;

      let sql = `
        SELECT d.id, d.status, d.scheduled_date,
               d.current_lat, d.current_lng,
               o.id AS order_id, o.order_number,
               o.delivery_address, o.delivery_lat, o.delivery_lng,
               o.total,
               u.id   AS driver_id, u.full_name AS driver_name,
               u.phone AS driver_phone,
               c.full_name AS customer_name, c.phone AS customer_phone,
               r.id AS rdc_id, r.name AS rdc_name, r.region
        FROM deliveries d
        JOIN orders o ON d.order_id    = o.id
        JOIN rdcs   r ON d.rdc_id      = r.id
        JOIN users  c ON o.customer_id = c.id
        LEFT JOIN users u ON d.driver_id = u.id
        WHERE DATE(d.scheduled_date) = ?
          AND d.status IN ('scheduled','out_for_delivery')`;
      const params: any[] = [date];
      if (rdcId) { sql += ' AND d.rdc_id=?'; params.push(rdcId); }
      sql += ' ORDER BY u.full_name, d.scheduled_date';

      const [rows]: any = await pool.query(sql, params);

      // Group by driver
      const grouped: any = {};
      const unassigned: any[] = [];
      for (const row of rows) {
        if (!row.driver_id) { unassigned.push(row); continue; }
        if (!grouped[row.driver_id]) {
          grouped[row.driver_id] = {
            driver_id:    row.driver_id,
            driver_name:  row.driver_name,
            driver_phone: row.driver_phone,
            rdc_name:     row.rdc_name,
            stops:        [],
          };
        }
        grouped[row.driver_id].stops.push(row);
      }

      ok(res, {
        routes:      Object.values(grouped),
        unassigned,
        date,
        total:       rows.length,
      });
    } catch (e: any) { console.error(e); fail(res, e.message); }
  }
);

export default router;
