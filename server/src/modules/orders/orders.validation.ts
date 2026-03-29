import { z } from 'zod';

export const createOrderSchema = z.object({
  rdc_id:           z.number().int().positive(),
  delivery_address: z.string().min(5),
  delivery_lat:     z.number().optional(),
  delivery_lng:     z.number().optional(),
  notes:            z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity:   z.number().int().positive(),
  })).min(1, 'Order must have at least one item'),
});

export const updateStatusSchema = z.object({
  status: z.enum(['confirmed','picking','dispatched','delivered','cancelled']),
});
