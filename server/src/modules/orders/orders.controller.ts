import { Request, Response } from 'express';
import { ordersService } from './orders.service';
import { ok, fail } from '../../utils/response';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, rdc_id, page, limit } = req.query;
    const customer_id = req.user!.roles.includes('customer')
      ? req.user!.userId : undefined;
    const data = await ordersService.getAll({
      status:      status  as string,
      rdc_id:      rdc_id  ? Number(rdc_id) : undefined,
      customer_id,
      page:        page    ? Number(page)   : 1,
      limit:       limit   ? Number(limit)  : 20,
    });
    ok(res, data);
  } catch (e: any) { fail(res, e.message); }
};

export const getOrder = async (req: Request, res: Response) => {
  try {
    const order = await ordersService.getById(req.params.id);
    if (!order) return fail(res, 'Order not found', 404);
    ok(res, order);
  } catch (e: any) { fail(res, e.message); }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const result = await ordersService.create(req.user!.userId, req.body);
    ok(res, result, 'Order placed successfully');
  } catch (e: any) { fail(res, e.message); }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const result = await ordersService.updateStatus(
      req.params.id, req.body, req.user!.userId
    );
    ok(res, result, 'Order status updated');
  } catch (e: any) { fail(res, e.message); }
};

export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const stats = await ordersService.getStats();
    ok(res, stats);
  } catch (e: any) { fail(res, e.message); }
};
