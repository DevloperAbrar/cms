import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

export const Sidebar = ({ links, isOpen, onClose }) => (
  <>
    {/* Mobile overlay */}
    {isOpen && (
      <div
        className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
    )}

    <aside
      className={`
        fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-200 z-50
        transform transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0 lg:z-auto lg:h-auto lg:min-h-screen
      `}
    >
      {/* Mobile close */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200 lg:hidden">
        <span className="font-semibold text-primary-700">CampusCMS</span>
        <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="p-3 space-y-0.5 mt-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={() => onClose?.()}
            className={({ isActive }) =>
              isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'
            }
          >
            {link.icon && <link.icon className="h-4 w-4 flex-shrink-0" />}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  </>
);