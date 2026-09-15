import { Navigate } from 'react-router-dom';

export default function PlatformGuard({ children }) {
  const token = localStorage.getItem('platform_token');
  if (!token) return <Navigate to="/platform/login" replace />;
  return children;
}