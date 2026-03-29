import api from './api';
export const billingService = {
  getAll:  (params?: any) => api.get('/billing', { params }).then(r => r.data),
  getById: (id: string)   => api.get(`/billing/${id}`).then(r => r.data),
  create:  (data: any)    => api.post('/billing', data).then(r => r.data),
  update:  (id: string, data: any) => api.put(`/billing/${id}`, data).then(r => r.data),
  remove:  (id: string)   => api.delete(`/billing/${id}`).then(r => r.data),
};
