import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';
import { paginate }     from '../../utils/pagination';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

// ── GET /billing/invoices ─────────────────────────────────
router.get('/invoices', async (req, res) => {
  try {
    const { offset, limit } = paginate(Number(req.query.page)||1, 20);
    const isCustomer = req.user!.roles.includes('customer');
    const customerId = isCustomer ? req.user!.userId : (req.query.customer_id as string || null);
    const status     = req.query.status as string || null;

    let sql = `
      SELECT i.id, i.invoice_number, i.status, i.total_amount,
             i.due_date, i.issued_at, i.paid_at,
             u.full_name AS customer_name, u.email AS customer_email,
             o.order_number, o.id AS order_id,
             r.name AS rdc_name
      FROM invoices i
      JOIN users  u ON i.customer_id = u.id
      JOIN orders o ON i.order_id    = o.id
      JOIN rdcs   r ON o.rdc_id      = r.id
      WHERE 1=1`;
    const params: any[] = [];
    if (customerId) { sql += ' AND i.customer_id=?'; params.push(customerId); }
    if (status)     { sql += ' AND i.status=?';      params.push(status); }
    sql += ' ORDER BY i.issued_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows]: any = await pool.query(sql, params);

    // Total count
    let cntSql = `SELECT COUNT(*) AS total FROM invoices i WHERE 1=1`;
    const cp: any[] = [];
    if (customerId) { cntSql += ' AND i.customer_id=?'; cp.push(customerId); }
    if (status)     { cntSql += ' AND i.status=?';      cp.push(status); }
    const [[{ total }]]: any = await pool.query(cntSql, cp);

    ok(res, { invoices: rows, total });
  } catch (e: any) { fail(res, e.message); }
});

// ── GET /billing/invoices/:id ─────────────────────────────
router.get('/invoices/:id', async (req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT i.*,
              u.full_name AS customer_name, u.email AS customer_email,
              u.phone AS customer_phone,
              o.order_number, o.delivery_address,
              r.name AS rdc_name
       FROM invoices i
       JOIN users  u ON i.customer_id = u.id
       JOIN orders o ON i.order_id    = o.id
       JOIN rdcs   r ON o.rdc_id      = r.id
       WHERE i.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 'Invoice not found', 404);

    // Order items
    const [items]: any = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.sku
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [rows[0].order_id]
    );

    // Payment history
    const [payments]: any = await pool.query(
      `SELECT p.*, u.full_name AS recorded_by_name
       FROM payments p
       LEFT JOIN users u ON p.recorded_by = u.id
       WHERE p.invoice_id = ?
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );

    ok(res, { ...rows[0], items, payments });
  } catch (e: any) { fail(res, e.message); }
});

// ── POST /billing/invoices/:id/pay ────────────────────────
router.post('/invoices/:id/pay',
  authorize('super_admin','rdc_manager','rdc_staff','customer'),
  async (req, res) => {
    try {
      const { amount, method, gateway_ref, notes } = req.body;
      if (!amount || !method)
        return fail(res, 'amount and method are required', 400);

      const [inv]: any = await pool.query(
        'SELECT * FROM invoices WHERE id=?', [req.params.id]
      );
      if (!inv[0])                   return fail(res, 'Invoice not found', 404);
      if (inv[0].status === 'paid')  return fail(res, 'Invoice already paid', 400);
      if (inv[0].status === 'void')  return fail(res, 'Invoice is void', 400);

      const paid = Number(amount);
      const due  = Number(inv[0].total_amount);
      if (paid < due) return fail(res,
        `Payment amount ${paid} is less than invoice total ${due}`, 400);

      const id = uuidv4();
      await pool.query(
        `INSERT INTO payments
           (id,invoice_id,amount,method,gateway_ref,status,paid_at,recorded_by)
         VALUES (?,?,?,?,?,'success',NOW(),?)`,
        [id, req.params.id, paid, method, gateway_ref||null, req.user!.userId]
      );
      await pool.query(
        `UPDATE invoices SET status='paid', paid_at=NOW() WHERE id=?`,
        [req.params.id]
      );
      ok(res, { id }, 'Payment recorded successfully');
    } catch (e: any) { console.error(e); fail(res, e.message); }
  }
);

// ── POST /billing/invoices/:id/void ──────────────────────
router.post('/invoices/:id/void',
  authorize('super_admin'),
  async (req, res) => {
    try {
      const [inv]: any = await pool.query(
        'SELECT id, status FROM invoices WHERE id=?', [req.params.id]
      );
      if (!inv[0]) return fail(res, 'Invoice not found', 404);
      if (inv[0].status === 'paid')
        return fail(res, 'Cannot void a paid invoice', 400);
      await pool.query(
        `UPDATE invoices SET status='void' WHERE id=?`, [req.params.id]
      );
      ok(res, null, 'Invoice voided');
    } catch (e: any) { fail(res, e.message); }
  }
);

// ── GET /billing/payments — all payments ─────────────────
router.get('/payments',
  authorize('super_admin','rdc_manager'),
  async (req, res) => {
    try {
      const { offset, limit } = paginate(Number(req.query.page)||1, 20);
      const method = req.query.method as string || null;
      const from   = req.query.from   as string || null;
      const to     = req.query.to     as string || null;

      let sql = `
        SELECT p.id, p.amount, p.method, p.gateway_ref,
               p.status, p.paid_at, p.created_at,
               i.invoice_number, i.total_amount,
               u.full_name AS customer_name,
               r.full_name AS recorded_by_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        JOIN users    u ON i.customer_id = u.id
        LEFT JOIN users r ON p.recorded_by = r.id
        WHERE p.status = 'success'`;
      const params: any[] = [];
      if (method) { sql += ' AND p.method=?';                       params.push(method); }
      if (from)   { sql += ' AND DATE(p.paid_at)>=?';               params.push(from); }
      if (to)     { sql += ' AND DATE(p.paid_at)<=?';               params.push(to); }
      sql += ' ORDER BY p.paid_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [rows]: any = await pool.query(sql, params);

      // Summary totals
      const [[totals]]: any = await pool.query(
        `SELECT
           COUNT(*)                                                         AS total_count,
           SUM(amount)                                                      AS total_amount,
           SUM(CASE WHEN method='cash'          THEN amount ELSE 0 END)    AS cash,
           SUM(CASE WHEN method='bank_transfer'  THEN amount ELSE 0 END)    AS bank_transfer,
           SUM(CASE WHEN method='card'           THEN amount ELSE 0 END)    AS card,
           SUM(CASE WHEN method='online_gateway' THEN amount ELSE 0 END)    AS online_gateway,
           SUM(CASE WHEN DATE(paid_at)=CURDATE() THEN amount ELSE 0 END)   AS today
         FROM payments WHERE status='success'`
      );

      ok(res, { payments: rows, totals });
    } catch (e: any) { fail(res, e.message); }
  }
);

// ── GET /billing/summary ──────────────────────────────────
router.get('/summary',
  authorize('super_admin','rdc_manager'),
  async (_req, res) => {
    try {
      const [[s]]: any = await pool.query(
        `SELECT
           COUNT(*)                                                        AS total,
           SUM(CASE WHEN status='draft'   THEN 1 ELSE 0 END)              AS draft,
           SUM(CASE WHEN status='issued'  THEN 1 ELSE 0 END)              AS issued,
           SUM(CASE WHEN status='paid'    THEN 1 ELSE 0 END)              AS paid,
           SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END)              AS overdue,
           SUM(CASE WHEN status='void'    THEN 1 ELSE 0 END)              AS void,
           SUM(CASE WHEN status='paid'    THEN total_amount ELSE 0 END)   AS total_paid,
           SUM(CASE WHEN status IN('issued','overdue')
                    THEN total_amount ELSE 0 END)                         AS total_outstanding
         FROM invoices`
      );
      ok(res, s);
    } catch (e: any) { fail(res, e.message); }
  }
);

export default router;
