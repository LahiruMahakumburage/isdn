import { pool } from '../../db/connection';
import { createNotification, notifyRole } from '../../utils/notify';
import { v4 as uuidv4 } from 'uuid';
import { CreateOrderDto, UpdateOrderStatusDto } from './orders.dto';
import { paginate } from '../../utils/pagination';

const generateOrderNumber = () => {
  const d    = new Date();
  const y    = d.getFullYear();
  const m    = String(d.getMonth() + 1).padStart(2, '0');
  const day  = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `ORD-${y}${m}${day}-${rand}`;
};

export const ordersService = {

  async getAll(filters: {
    status?: string; rdc_id?: number; customer_id?: string;
    page?: number;   limit?: number;
  }) {
    const { offset, limit } = paginate(filters.page, filters.limit);
    const conditions: string[] = [];
    const params: any[]        = [];

    if (filters.status)      { conditions.push('o.status = ?');      params.push(filters.status); }
    if (filters.rdc_id)      { conditions.push('o.rdc_id = ?');      params.push(filters.rdc_id); }
    if (filters.customer_id) { conditions.push('o.customer_id = ?'); params.push(filters.customer_id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows]: any = await pool.query(
      `SELECT o.id, o.order_number, o.status, o.total, o.ordered_at,
              o.delivery_address, o.confirmed_at, o.delivered_at,
              u.full_name AS customer_name, u.email AS customer_email,
              r.name AS rdc_name
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       JOIN rdcs  r ON o.rdc_id      = r.id
       ${where}
       ORDER BY o.ordered_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [[{ total }]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${where}`,
      params
    );

    return { orders: rows, total, page: filters.page || 1, limit };
  },

  async getById(id: string) {
    const [rows]: any = await pool.query(
      `SELECT o.*, u.full_name AS customer_name, u.email AS customer_email,
              u.phone AS customer_phone, r.name AS rdc_name
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       JOIN rdcs  r ON o.rdc_id      = r.id
       WHERE o.id = ?`,
      [id]
    );
    if (!rows[0]) return null;
    const order = rows[0];

    const [items]: any = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.sku, p.unit
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [id]
    );
    order.items = items;

    const [delivery]: any = await pool.query(
      `SELECT d.*, u.full_name AS driver_name
       FROM deliveries d
       LEFT JOIN users u ON d.driver_id = u.id
       WHERE d.order_id = ?`,
      [id]
    );
    order.delivery = delivery[0] || null;

    return order;
  },

  async create(customerId: string, dto: CreateOrderDto) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const item of dto.items) {
        const [inv]: any = await conn.query(
          `SELECT quantity_on_hand - quantity_reserved AS available
           FROM inventory
           WHERE rdc_id = ? AND product_id = ?
           FOR UPDATE`,
          [dto.rdc_id, item.product_id]
        );
        if (!inv[0] || inv[0].available < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        }
      }

      const productIds      = dto.items.map(i => i.product_id);
      const [products]: any = await conn.query(
        `SELECT id, unit_price FROM products WHERE id IN (?)`,
        [productIds]
      );
      const priceMap: Record<string, number> = {};
      products.forEach((p: any) => { priceMap[p.id] = p.unit_price; });

      let subtotal = 0;
      const itemsWithPrice = dto.items.map(item => {
        const unit_price = priceMap[item.product_id];
        const line_total = unit_price * item.quantity;
        subtotal        += line_total;
        return { ...item, unit_price, line_total };
      });
      const tax   = parseFloat((subtotal * 0.08).toFixed(2));
      const total = parseFloat((subtotal + tax).toFixed(2));

      const orderId     = uuidv4();
      const orderNumber = generateOrderNumber();
      await conn.query(
        `INSERT INTO orders
           (id, order_number, customer_id, rdc_id, status, delivery_address,
            delivery_lat, delivery_lng, subtotal, tax, total, notes, confirmed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
        [orderId, orderNumber, customerId, dto.rdc_id, 'confirmed',
         dto.delivery_address, dto.delivery_lat ?? null, dto.delivery_lng ?? null,
         subtotal, tax, total, dto.notes ?? null]
      );

      for (const item of itemsWithPrice) {
        await conn.query(
          `INSERT INTO order_items
             (order_id, product_id, quantity, unit_price, line_total)
           VALUES (?,?,?,?,?)`,
          [orderId, item.product_id, item.quantity, item.unit_price, item.line_total]
        );
        await conn.query(
          `UPDATE inventory
           SET quantity_reserved = quantity_reserved + ?
           WHERE rdc_id = ? AND product_id = ?`,
          [item.quantity, dto.rdc_id, item.product_id]
        );
      }

      const invoiceId     = uuidv4();
      const invoiceNumber = `INV-${orderNumber.replace('ORD-', '')}`;
      const dueDate       = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await conn.query(
        `INSERT INTO invoices
           (id, invoice_number, order_id, customer_id,
            subtotal, tax_amount, total_amount, status, due_date, issued_at)
         VALUES (?,?,?,?,?,?,?,'issued',?,NOW())`,
        [invoiceId, invoiceNumber, orderId, customerId,
         subtotal, tax, total, dueDate.toISOString().split('T')[0]]
      );

      await conn.commit();

      // ── Notify admins of new order ─────────────────────
      notifyRole({
        role:      'super_admin',
        type:      'new_order',
        title:     'New Order Placed',
        body:      `Order ${orderNumber} has been placed — LKR ${total.toLocaleString()}.`,
        relatedId: orderId,
      }).catch(() => {});

      // ── Notify RDC managers of new order ───────────────
      notifyRole({
        role:      'rdc_manager',
        type:      'new_order',
        title:     'New Order Received',
        body:      `Order ${orderNumber} needs to be processed.`,
        relatedId: orderId,
      }).catch(() => {});

      // ── Notify customer their order is confirmed ────────
      createNotification({
        userId:    customerId,
        type:      'order_confirmed',
        title:     'Order Confirmed ✅',
        body:      `Your order ${orderNumber} has been confirmed. Total: LKR ${total.toLocaleString()}.`,
        relatedId: orderId,
      }).catch(() => {});

      return { orderId, orderNumber, total };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  async updateStatus(id: string, dto: UpdateOrderStatusDto, _userId: string) {
    const [rows]: any = await pool.query(
      'SELECT id, status, rdc_id FROM orders WHERE id = ?', [id]
    );
    if (!rows[0]) throw new Error('Order not found');

    const validTransitions: Record<string, string[]> = {
      draft:      ['confirmed', 'cancelled'],
      confirmed:  ['picking',   'cancelled'],
      picking:    ['dispatched','cancelled'],
      dispatched: ['delivered'],
      delivered:  [],
      cancelled:  [],
    };

    if (!validTransitions[rows[0].status]?.includes(dto.status)) {
      throw new Error(`Cannot transition from "${rows[0].status}" to "${dto.status}"`);
    }

    let sql = 'UPDATE orders SET status = ?';
    const params: any[] = [dto.status];
    if (dto.status === 'confirmed') sql += ', confirmed_at = NOW()';
    if (dto.status === 'delivered') sql += ', delivered_at = NOW()';
    sql += ' WHERE id = ?';
    params.push(id);
    await pool.query(sql, params);

    if (dto.status === 'cancelled') {
      const [items]: any = await pool.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?', [id]
      );
      for (const item of items) {
        await pool.query(
          `UPDATE inventory
           SET quantity_reserved = GREATEST(0, quantity_reserved - ?)
           WHERE rdc_id = ? AND product_id = ?`,
          [item.quantity, rows[0].rdc_id, item.product_id]
        );
      }
    }

    return { id, status: dto.status };
  },

  async getStats() {
    const [[stats]]: any = await pool.query(
      `SELECT
         COUNT(*)                                                       AS total_orders,
         SUM(CASE WHEN status = 'confirmed'  THEN 1 ELSE 0 END)        AS confirmed,
         SUM(CASE WHEN status = 'picking'    THEN 1 ELSE 0 END)        AS picking,
         SUM(CASE WHEN status = 'dispatched' THEN 1 ELSE 0 END)        AS dispatched,
         SUM(CASE WHEN status = 'delivered'  THEN 1 ELSE 0 END)        AS delivered,
         SUM(CASE WHEN status = 'cancelled'  THEN 1 ELSE 0 END)        AS cancelled,
         COALESCE(SUM(CASE WHEN DATE(ordered_at) = CURDATE()
                           THEN total ELSE 0 END), 0)                  AS revenue_today,
         SUM(CASE WHEN DATE(ordered_at) = CURDATE() THEN 1 ELSE 0 END) AS orders_today
       FROM orders`
    );
    return stats;
  },
};
