import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const { user, isAuthenticated, setUser, clearUser } = useAuthStore();
  const navigate = useNavigate();

  const fetchMe = useCallback(async () => {
    try {
      const user = await authApi.getMe();
      if (user?.role) {
        setUser(user);
        return user;
      }
      clearUser();
      return null;
    } catch {
      clearUser();
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearUser();
      navigate('/');
    }
  }, []); // empty deps

  return { user, isAuthenticated, fetchMe, logout, setUser, clearUser };
};