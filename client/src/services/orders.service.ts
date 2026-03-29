import api from './api';
export const ordersService = {
  getAll:  (params?: any) => api.get('/orders', { params }).then(r => r.data),
  getById: (id: string)   => api.get(`/orders/${id}`).then(r => r.data),
  create:  (data: any)    => api.post('/orders', data).then(r => r.data),
  update:  (id: string, data: any) => api.put(`/orders/${id}`, data).then(r => r.data),
  remove:  (id: string)   => api.delete(`/orders/${id}`).then(r => r.data),
};
