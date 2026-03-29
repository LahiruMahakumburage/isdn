import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Module routers
import authRoutes         from './modules/auth/auth.routes';
import usersRoutes        from './modules/users/users.routes';
import rdcsRoutes         from './modules/rdcs/rdcs.routes';
import productsRoutes     from './modules/products/products.routes';
import ordersRoutes       from './modules/orders/orders.routes';
import inventoryRoutes    from './modules/inventory/inventory.routes';
import deliveryRoutes     from './modules/delivery/delivery.routes';
import billingRoutes      from './modules/billing/billing.routes';
import reportsRoutes      from './modules/reports/reports.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(rateLimiter);

const API = '/api/v1';
app.use(`${API}/auth`,          authRoutes);
app.use(`${API}/users`,         usersRoutes);
app.use(`${API}/rdcs`,          rdcsRoutes);
app.use(`${API}/products`,      productsRoutes);
app.use(`${API}/orders`,        ordersRoutes);
app.use(`${API}/inventory`,     inventoryRoutes);
app.use(`${API}/delivery`,      deliveryRoutes);
app.use(`${API}/billing`,       billingRoutes);
app.use(`${API}/reports`,       reportsRoutes);
app.use(`${API}/notifications`, notificationsRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);

export default app;
