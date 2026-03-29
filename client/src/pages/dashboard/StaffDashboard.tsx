import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency }      from '../../utils/formatCurrency';
import { formatDateTime }      from '../../utils/formatDate';

export default function StaffDashboard() {
  const navigate                 = useNavigate();
  const [orders,    setOrders]   = useState<any[]>([]);
  const [deliveries,setDel]      = useState<any[]>([]);
  const [stats,     setStats]    = useState<any>(null);
  const [inv,       setInv]      = useState<any[]>([]);
  const [loading,   setLoading]  = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ordRes, delRes, statRes, invRes] = await Promise.all([
          api.get('/orders?limit=8&status=confirmed'),
          api.get('/delivery?status=scheduled&limit=5'),
          api.get('/orders/stats'),
          api.get('/inventory?low_stock=true&limit=5'),
        ]);
        setOrders(ordRes.data.data?.orders      || []);
        setDel(delRes.data.data?.deliveries     || []);
        setStats(statRes.data.data);
        setInv(invRes.data.data?.inventory      || []);
      } finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading…</div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Dashboard</h1>
        <button onClick={() => navigate('/staff/orders/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          + New Order
        </button>
      </div>

      {/* KPI strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Orders Today',  value: stats.orders_today,               color:'text-blue-600'   },
            { label:'To Pick',       value: stats.confirmed    || 0,           color:'text-yellow-600' },
            { label:'Dispatched',    value: stats.dispatched   || 0,           color:'text-purple-600' },
            { label:'Revenue Today', value: formatCurrency(stats.revenue_today || 0), color:'text-green-600' },
          ].map(c => (
            <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Orders to process */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">Orders to Process</h2>
            <button onClick={() => navigate('/staff/orders')}
              className="text-xs text-blue-600 hover:underline">View all →</button>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-green-600 text-sm font-medium">
                All orders processed
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map((o: any) => (
                <div key={o.id}
                  className="px-5 py-3 flex justify-between items-center
                             hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/staff/orders/${o.id}`)}>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {o.order_number}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{o.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(o.total)}
                    </p>
                    <span className="text-xs bg-blue-100 text-blue-700
                                     px-2 py-0.5 rounded-full capitalize">
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scheduled deliveries */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">
              Scheduled Deliveries
            </h2>
            <button onClick={() => navigate('/staff/delivery')}
              className="text-xs text-blue-600 hover:underline">View all →</button>
          </div>
          {deliveries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 text-sm">No deliveries scheduled</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {deliveries.map((d: any) => (
                <div key={d.id} className="px-5 py-3">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-800">
                      {d.order_number}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(d.scheduled_date)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{d.customer_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {d.delivery_address}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alerts */}
      {inv.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">
              Low Stock Alerts
            </h2>
            <button onClick={() => navigate('/staff/inventory')}
              className="text-xs text-blue-600 hover:underline">View inventory →</button>
          </div>
          <div className="divide-y divide-gray-100">
            {inv.map((row: any) => (
              <div key={row.id}
                className="px-5 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {row.product_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {row.sku} · {row.rdc_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">
                    {row.quantity_on_hand}
                  </p>
                  <p className="text-xs text-gray-400">
                    min {row.reorder_level}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
