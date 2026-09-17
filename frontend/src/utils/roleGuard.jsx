import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const ROLE_HOME = {
  superadmin: '/superadmin',
  hod: '/hod',
  coordinator: '/coordinator',
  faculty: '/faculty',
  examcontroller: '/examcontroller',
  student: '/student',
};

export const RoleGuard = ({ allowedRoles, children }) => {
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const location = useLocation();

  // Wait for zustand to rehydrate from localStorage before making any decision
  if (!_hasHydrated) {
    return null; // or a loading spinner if you prefer
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = ROLE_HOME[user.role] || '/';
    return <Navigate to={home} replace />;
  }

  return children;
};

export const getRoleHome = (role) => ROLE_HOME[role] || '/';