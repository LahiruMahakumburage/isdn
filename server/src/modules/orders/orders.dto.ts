export interface CreateOrderDto {
  rdc_id: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  notes?: string;
  items: OrderItemDto[];
}

export interface OrderItemDto {
  product_id: string;
  quantity: number;
}

export interface UpdateOrderStatusDto {
  status: 'confirmed' | 'picking' | 'dispatched' | 'delivered' | 'cancelled';
}
