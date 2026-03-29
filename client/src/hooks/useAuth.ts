import { useAuthStore } from '../store/authStore';
export const useAuth = () => {
  const { user, token, logout } = useAuthStore();
  return { user, token, logout, isAuthenticated: !!token };
};
