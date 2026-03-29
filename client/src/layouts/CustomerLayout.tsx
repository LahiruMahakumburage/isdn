import NotificationBell from '../components/NotificationBell';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const navItems = [
  { to: '/customer/dashboard', label: 'Dashboard'   },
  { to: '/customer/orders',    label: 'My Orders'   },
  { to: '/customer/billing',   label: 'Invoices'    },
];

export default function CustomerLayout() {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-base font-bold tracking-wide">ISDN</h1>
          <p className="text-xs text-gray-400 mt-0.5">Customer Portal</p>
        </div>
        <div className="px-3 py-2 border-b border-gray-700 flex justify-end"><NotificationBell /></div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/customer/dashboard'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition
                 ${isActive
                   ? 'bg-blue-600 text-white font-medium'
                   : 'text-gray-300 hover:bg-gray-800'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-1 truncate">{user?.email}</p>
          <p className="text-xs text-blue-400 mb-2">Customer</p>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-left text-xs text-gray-400 hover:text-white
                       px-2 py-1.5 rounded hover:bg-gray-800 transition">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-auto min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
