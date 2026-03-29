import api from './api';
export const usersService = {
  getAll:  (params?: any) => api.get('/users', { params }).then(r => r.data),
  getById: (id: string)   => api.get(`/users/${id}`).then(r => r.data),
  create:  (data: any)    => api.post('/users', data).then(r => r.data),
  update:  (id: string, data: any) => api.put(`/users/${id}`, data).then(r => r.data),
  remove:  (id: string)   => api.delete(`/users/${id}`).then(r => r.data),
};
