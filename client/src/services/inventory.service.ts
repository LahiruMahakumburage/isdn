import api from './api';
export const inventoryService = {
  getAll:  (params?: any) => api.get('/inventory', { params }).then(r => r.data),
  getById: (id: string)   => api.get(`/inventory/${id}`).then(r => r.data),
  create:  (data: any)    => api.post('/inventory', data).then(r => r.data),
  update:  (id: string, data: any) => api.put(`/inventory/${id}`, data).then(r => r.data),
  remove:  (id: string)   => api.delete(`/inventory/${id}`).then(r => r.data),
};
