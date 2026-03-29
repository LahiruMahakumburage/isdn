import api from './api';
export const deliveryService = {
  getAll:  (params?: any) => api.get('/delivery', { params }).then(r => r.data),
  getById: (id: string)   => api.get(`/delivery/${id}`).then(r => r.data),
  create:  (data: any)    => api.post('/delivery', data).then(r => r.data),
  update:  (id: string, data: any) => api.put(`/delivery/${id}`, data).then(r => r.data),
  remove:  (id: string)   => api.delete(`/delivery/${id}`).then(r => r.data),
};
