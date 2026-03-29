import api from './api';
export const reportsService = {
  getAll:  (params?: any) => api.get('/reports', { params }).then(r => r.data),
  getById: (id: string)   => api.get(`/reports/${id}`).then(r => r.data),
  create:  (data: any)    => api.post('/reports', data).then(r => r.data),
  update:  (id: string, data: any) => api.put(`/reports/${id}`, data).then(r => r.data),
  remove:  (id: string)   => api.delete(`/reports/${id}`).then(r => r.data),
};
