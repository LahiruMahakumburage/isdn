import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency }      from '../../utils/formatCurrency';
import { useAuthStore }        from '../../store/authStore';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function RDCDashboard() {
  const navigate          = useNavigate();
  const { user }          = useAuthStore();
  const rdcId             = (user as any)?.rdcId;
  const [stats,  setStats]= useState<any>(null);
  const [inv,    setInv]  = useState<any[]>([]);
  const [orders, setOrders]= useState<any[]>([]);
  const [loading,setLoad] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const invParam = rdcId ? `?rdc_id=${rdcId}&limit=20&low_stock=true` : '?limit=20&low_stock=true';
        const ordParam = rdcId ? `?rdc_id=${rdcId}&limit=5` : '?limit=5';
        const [ordRes, invRes, statRes] = await Promise.all([
          api.get(`/orders/stats`),
          api.get(`/inventory${invParam}`),
          api.get(`/orders${ordParam}`),
        ]);
        setStats(ordRes.data.data);
        setInv(invRes.data.data?.inventory  || []);
        setOrders(statRes.data.data?.orders || []);
      } finally { setLoad(false); }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading dashboard…</div>
  );

  const cards = stats ? [
    { label:'Total Orders', value: stats.total_orders, color:'text-blue-600',   link:'/staff/orders'   },
    { label:'Confirmed',    value: stats.confirmed,    color:'text-indigo-600', link:'/staff/orders'   },
    { label:'Dispatched',   value: stats.dispatched,   color:'text-purple-600', link:'/staff/delivery' },
    { label:'Delivered',    value: stats.delivered,    color:'text-green-600',  link:'/staff/orders'   },
  ] : [];

  const chartData = stats ? [
    { name:'Confirmed',  value: stats.confirmed  || 0 },
    { name:'Picking',    value: stats.picking     || 0 },
    { name:'Dispatched', value: stats.dispatched  || 0 },
    { name:'Delivered',  value: stats.delivered   || 0 },
    { name:'Cancelled',  value: stats.cancelled   || 0 },
  ] : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">RDC Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your regional distribution centre
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/staff/orders/new')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                       font-medium hover:bg-blue-700 transition">
            + New Order
          </button>
          <button onClick={() => navigate('/staff/inventory/transfer')}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg
                       text-sm font-medium hover:bg-gray-50 transition">
            Stock Transfer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.link)}
            className="bg-white border border-gray-200 rounded-xl p-4
                       text-left hover:shadow-md transition">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Status chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Orders by Status
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
              <YAxis tick={{ fontSize: 11 }}/>
              <Tooltip/>
              <Bar dataKey="value" fill="#2563eb" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Low stock */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">
              Low Stock Alerts
            </h2>
            <button onClick={() => navigate('/staff/inventory')}
              className="text-xs text-blue-600 hover:underline">
              View all →
            </button>
          </div>
          {inv.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-green-600 text-sm font-medium">
                All stock levels OK
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {inv.slice(0, 6).map((row: any) => (
                <div key={row.id}
                  className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {row.product_name}
                    </p>
                    <p className="text-xs text-gray-400">{row.sku}</p>
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
          )}
        </div>
      </div>

      {/* Recent orders */}
      {orders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">Recent Orders</h2>
            <button onClick={() => navigate('/staff/orders')}
              className="text-xs text-blue-600 hover:underline">
              View all →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Order #','Customer','Total','Status'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs
                                        font-medium text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o: any) => (
                <tr key={o.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/staff/orders/${o.id}`)}>
                  <td className="px-4 py-2.5 font-medium text-blue-600">
                    {o.order_number}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{o.customer_name}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {formatCurrency(o.total)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-1 rounded-full text-xs font-medium
                                     bg-blue-100 text-blue-700 capitalize">
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
