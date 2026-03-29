import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize }    from '../../middleware/authorize';
import { validate }     from '../../middleware/validate';
import { createOrderSchema, updateStatusSchema } from './orders.validation';
import {
  getOrders, getOrder, createOrder,
  updateOrderStatus, getOrderStats,
} from './orders.controller';

const router = Router();
router.use(authenticate);

router.get ('/',             getOrders);
router.get ('/stats',        authorize('super_admin','rdc_manager','rdc_staff'), getOrderStats);
router.get ('/:id',          getOrder);
router.post('/',             authorize('customer','rdc_staff','super_admin'),
                             validate(createOrderSchema), createOrder);
router.patch('/:id/status',  authorize('super_admin','rdc_manager','rdc_staff','logistics_officer'),
                             validate(updateStatusSchema), updateOrderStatus);

export default router;
