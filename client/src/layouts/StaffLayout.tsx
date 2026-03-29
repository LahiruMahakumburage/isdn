import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore }    from '../store/authStore';
import NotificationBell   from '../components/NotificationBell';

export default function StaffLayout() {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();
  const roles            = user?.roles || [];
  const isManager        = roles.includes('rdc_manager');
  const isLogistics      = roles.includes('logistics_officer');

  const navItems = [
    { to: '/staff/dashboard',          label: 'Dashboard'        },
    { to: '/staff/orders',             label: 'Orders'           },
    { to: '/staff/inventory',          label: 'Inventory'        },
    { to: '/staff/inventory/transfer', label: '↳ Transfers'      },
    { to: '/staff/inventory/adjust',   label: '↳ Adjustments'    },
    { to: '/staff/delivery',           label: 'Delivery'         },
    { to: '/staff/delivery/routes',    label: '↳ Routes'         },
    { to: '/staff/delivery/planner',   label: '↳ Planner'        },
    // Manager-only extras
    ...(isManager ? [
      { to: '/staff/billing',                label: 'Billing'          },
      { to: '/staff/reports',                label: 'Reports'          },
      { to: '/staff/reports/sales',          label: '↳ Sales'          },
      { to: '/staff/reports/turnover',       label: '↳ Stock Turnover' },
      { to: '/staff/reports/delivery',       label: '↳ Delivery Eff.' },
      { to: '/staff/reports/customers',      label: '↳ Customers'      },
    ] : []),
    // Notifications for all staff
    { to: '/staff/notifications', label: 'Notifications' },
  ];

  const portalLabel =
    isManager   ? 'RDC Manager' :
    isLogistics ? 'Logistics Officer' :
                  'Staff';

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">

        {/* Header with bell */}
        <div className="p-5 border-b border-gray-700 flex items-center
                        justify-between">
          <div>
            <h1 className="text-base font-bold tracking-wide">ISDN</h1>
            <p className="text-xs text-gray-400 mt-0.5">{portalLabel} Portal</p>
          </div>
          <NotificationBell />
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/staff/dashboard'}
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-lg text-sm transition
                 ${item.label.startsWith('↳') ? 'pl-6 text-xs' : ''}
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
          <p className="text-xs text-gray-400 mb-0.5 truncate">{user?.email}</p>
          <p className="text-xs text-blue-400 mb-2 capitalize">
            {roles[0]?.replace(/_/g, ' ')}
          </p>
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
