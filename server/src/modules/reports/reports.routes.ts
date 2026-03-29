import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { pool }         from '../../db/connection';
import { ok, fail }     from '../../utils/response';

const router = Router();
router.use(authenticate);
router.use(authorize('super_admin','rdc_manager','rdc_staff','logistics_officer'));

// ── GET /reports/kpi ──────────────────────────────────────
router.get('/kpi', async (_req, res) => {
  try {
    const [[orders]]:  any = await pool.query(
      `SELECT
         COUNT(*)                                                          AS total_orders,
         SUM(CASE WHEN DATE(ordered_at)=CURDATE() THEN 1 ELSE 0 END)      AS orders_today,
         COALESCE(SUM(CASE WHEN DATE(ordered_at)=CURDATE()
                           THEN total ELSE 0 END), 0)                     AS revenue_today,
         COALESCE(SUM(CASE WHEN YEARWEEK(ordered_at)=YEARWEEK(NOW())
                           THEN total ELSE 0 END), 0)                     AS revenue_week,
         COALESCE(SUM(CASE WHEN MONTH(ordered_at)=MONTH(NOW())
                            AND YEAR(ordered_at)=YEAR(NOW())
                           THEN total ELSE 0 END), 0)                     AS revenue_month,
         SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END)              AS delivered,
         SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END)              AS cancelled
       FROM orders WHERE status != 'cancelled' OR status = 'cancelled'`
    );
    const [[inventory]]: any = await pool.query(
      `SELECT COUNT(*) AS low_stock
       FROM inventory i JOIN products p ON i.product_id=p.id
       WHERE i.quantity_on_hand <= p.reorder_level`
    );
    const [[deliveries]]: any = await pool.query(
      `SELECT COUNT(*) AS pending
       FROM deliveries WHERE status IN ('scheduled','out_for_delivery')`
    );
    const [[billing]]: any = await pool.query(
      `SELECT COUNT(*) AS overdue,
              COALESCE(SUM(total_amount),0) AS overdue_amount
       FROM invoices WHERE status='overdue'`
    );
    const [[rdcs]]: any = await pool.query(
      `SELECT COUNT(*) AS active FROM rdcs WHERE is_active=1`
    );
    const [[customers]]: any = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u JOIN user_roles ur ON u.id=ur.user_id
       JOIN roles r ON ur.role_id=r.id WHERE r.name='customer'`
    );
    ok(res, {
      total_orders:       orders.total_orders       || 0,
      orders_today:       orders.orders_today        || 0,
      revenue_today:      orders.revenue_today       || 0,
      revenue_week:       orders.revenue_week        || 0,
      revenue_month:      orders.revenue_month       || 0,
      delivered:          orders.delivered           || 0,
      cancelled:          orders.cancelled           || 0,
      low_stock_items:    inventory.low_stock        || 0,
      pending_deliveries: deliveries.pending         || 0,
      overdue_invoices:   billing.overdue            || 0,
      overdue_amount:     billing.overdue_amount     || 0,
      active_rdcs:        rdcs.active                || 0,
      total_customers:    customers.total            || 0,
    });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── GET /reports/sales ────────────────────────────────────
router.get('/sales', async (req, res) => {
  try {
    const from  = req.query.from as string
      || new Date(Date.now()-30*864e5).toISOString().split('T')[0];
    const to    = req.query.to   as string
      || new Date().toISOString().split('T')[0];
    const rdcId = req.query.rdc_id ? Number(req.query.rdc_id) : null;

    const cond = rdcId
      ? `WHERE DATE(o.ordered_at) BETWEEN ? AND ?
         AND o.status != 'cancelled' AND o.rdc_id = ?`
      : `WHERE DATE(o.ordered_at) BETWEEN ? AND ?
         AND o.status != 'cancelled'`;
    const p = rdcId ? [from, to, rdcId] : [from, to];

    // Daily sales
    const [daily]: any = await pool.query(
      `SELECT DATE(o.ordered_at) AS date,
              COUNT(*)            AS order_count,
              SUM(o.total)        AS revenue
       FROM orders o ${cond}
       GROUP BY DATE(o.ordered_at) ORDER BY date`, p
    );

    // By RDC
    const [byRdc]: any = await pool.query(
      `SELECT r.name AS rdc_name, r.region,
              COUNT(o.id)  AS order_count,
              SUM(o.total) AS revenue
       FROM orders o JOIN rdcs r ON o.rdc_id=r.id
       ${cond} GROUP BY r.id ORDER BY revenue DESC`, p
    );

    // Top 10 products
    const [topProducts]: any = await pool.query(
      `SELECT p.name, p.sku, p.unit,
              SUM(oi.quantity)   AS total_sold,
              SUM(oi.line_total) AS total_revenue,
              COUNT(DISTINCT oi.order_id) AS order_count
       FROM order_items oi
       JOIN products p ON oi.product_id=p.id
       JOIN orders   o ON oi.order_id=o.id
       ${cond} GROUP BY p.id ORDER BY total_sold DESC LIMIT 10`, p
    );

    // Totals
    const [[totals]]: any = await pool.query(
      `SELECT COUNT(*)        AS total_orders,
              SUM(total)      AS total_revenue,
              AVG(total)      AS avg_order_value,
              SUM(subtotal)   AS total_subtotal,
              SUM(tax)        AS total_tax
       FROM orders o ${cond}`, p
    );

    // Orders by status
    const [byStatus]: any = await pool.query(
      `SELECT status, COUNT(*) AS count, SUM(total) AS revenue
       FROM orders o ${cond.replace("status != 'cancelled' AND",'')}
       GROUP BY status ORDER BY count DESC`,
      rdcId ? [from, to, rdcId] : [from, to]
    );

    ok(res, { daily, byRdc, topProducts, totals, byStatus, from, to });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── GET /reports/stock-turnover ───────────────────────────
router.get('/stock-turnover', async (req, res) => {
  try {
    const rdcId = req.query.rdc_id ? Number(req.query.rdc_id) : null;
    const days  = Number(req.query.days) || 30;

    let sql = `
      SELECT p.name, p.sku, p.unit, p.reorder_level,
             r.name AS rdc_name, r.region,
             i.quantity_on_hand, i.quantity_reserved,
             (i.quantity_on_hand - i.quantity_reserved) AS available,
             COALESCE(SUM(oi.quantity), 0)   AS sold_period,
             COALESCE(SUM(oi.line_total), 0) AS revenue_period,
             CASE WHEN COALESCE(SUM(oi.quantity),0) > 0
                  THEN ROUND(i.quantity_on_hand / SUM(oi.quantity) * ?, 1)
                  ELSE NULL END AS days_of_stock
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN rdcs     r ON i.rdc_id     = r.id
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders       o ON oi.order_id   = o.id
        AND DATE(o.ordered_at) >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        AND o.status != 'cancelled'
      WHERE 1=1`;
    const params: any[] = [days, days];
    if (rdcId) { sql += ' AND i.rdc_id = ?'; params.push(rdcId); }
    sql += ' GROUP BY i.id ORDER BY sold_period DESC, p.name';

    const [rows]: any = await pool.query(sql, params);
    ok(res, { items: rows, period_days: days });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── GET /reports/delivery-efficiency ─────────────────────
router.get('/delivery-efficiency', async (req, res) => {
  try {
    const from = req.query.from as string
      || new Date(Date.now()-30*864e5).toISOString().split('T')[0];
    const to   = req.query.to   as string
      || new Date().toISOString().split('T')[0];

    const [byRdc]: any = await pool.query(
      `SELECT r.name AS rdc_name, r.region,
              COUNT(d.id) AS total_deliveries,
              SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN d.status='failed'    THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN d.status IN('scheduled','out_for_delivery')
                       THEN 1 ELSE 0 END) AS pending,
              ROUND(SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END)*100.0
                    / NULLIF(COUNT(d.id),0), 1) AS success_rate,
              ROUND(AVG(CASE WHEN d.actual_delivery_at IS NOT NULL
                THEN TIMESTAMPDIFF(HOUR,d.scheduled_date,d.actual_delivery_at)
                END), 1) AS avg_hours
       FROM deliveries d
       JOIN rdcs r ON d.rdc_id = r.id
       WHERE DATE(d.scheduled_date) BETWEEN ? AND ?
       GROUP BY r.id ORDER BY success_rate DESC`,
      [from, to]
    );

    const [[totals]]: any = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) AS failed,
              ROUND(SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END)*100.0
                    / NULLIF(COUNT(*),0), 1) AS overall_rate
       FROM deliveries
       WHERE DATE(scheduled_date) BETWEEN ? AND ?`,
      [from, to]
    );

    const [daily]: any = await pool.query(
      `SELECT DATE(scheduled_date) AS date,
              COUNT(*) AS total,
              SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) AS failed
       FROM deliveries
       WHERE DATE(scheduled_date) BETWEEN ? AND ?
       GROUP BY DATE(scheduled_date) ORDER BY date`,
      [from, to]
    );

    ok(res, { byRdc, totals, daily, from, to });
  } catch (e: any) { console.error(e); fail(res, e.message); }
});

// ── GET /reports/customers ────────────────────────────────
router.get('/customers', async (_req, res) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone,
              COUNT(DISTINCT o.id)  AS order_count,
              COALESCE(SUM(o.total),0) AS total_spent,
              MAX(o.ordered_at)     AS last_order,
              MIN(o.ordered_at)     AS first_order
       FROM users u
       JOIN user_roles ur ON u.id=ur.user_id
       JOIN roles      r  ON ur.role_id=r.id AND r.name='customer'
       LEFT JOIN orders o ON o.customer_id=u.id AND o.status NOT IN('cancelled','returned')
       WHERE u.is_active=1
       GROUP BY u.id
       ORDER BY total_spent DESC, order_count DESC`
    );
    ok(res, rows);
  } catch (e: any) { fail(res, e.message); }
});

export default router;