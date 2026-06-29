import { Bell, LogOut, Menu, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';

export const Navbar = ({ onMenuClick }) => {
  const { logout } = useAuth();
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      <span className="font-semibold text-primary-700 text-base tracking-tight">CampusCMS</span>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700 font-medium">{user?.name}</span>
          <span className="badge bg-primary-50 text-primary-700 ml-1">{user?.role}</span>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
};