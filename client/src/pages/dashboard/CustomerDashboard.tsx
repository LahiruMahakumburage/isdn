import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency }      from '../../utils/formatCurrency';
import { formatDateTime }      from '../../utils/formatDate';

const STATUS_COLOURS: Record<string,string> = {
  confirmed:  'bg-blue-100 text-blue-700',
  picking:    'bg-yellow-100 text-yellow-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
};

export default function CustomerDashboard() {
  const navigate               = useNavigate();
  const [orders,   setOrders]  = useState<any[]>([]);
  const [invoices, setInv]     = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ordRes, invRes] = await Promise.all([
          api.get('/orders?limit=10'),
          api.get('/billing/invoices?limit=5'),
        ]);
        setOrders(ordRes.data.data?.orders  || []);
        setInv(invRes.data.data?.invoices   || []);
      } finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const active    = orders.filter(o => !['delivered','cancelled'].includes(o.status));
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const unpaid    = invoices.filter((i: any) => i.status !== 'paid');

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading…</div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            My Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Welcome back! Here's your order summary.
          </p>
        </div>
        <button onClick={() => navigate('/customer/orders/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          + Place Order
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Active Orders',  value: active.length,  color:'text-blue-600'  },
          { label:'Delivered',      value: delivered,       color:'text-green-600' },
          { label:'Total Orders',   value: orders.length,   color:'text-gray-900'  },
        ].map(c => (
          <div key={c.label}
            className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Active orders tracking */}
      {active.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">
              Active Orders
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {active.map((o: any) => (
              <div key={o.id}
                className="px-5 py-4 flex items-center justify-between
                           hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/customer/orders/${o.id}`)}>
                <div>
                  <p className="font-medium text-gray-900">{o.order_number}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDateTime(o.ordered_at)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                    {o.delivery_address}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">
                      {formatCurrency(o.total)}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${STATUS_COLOURS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {o.status}
                    </span>
                  </div>
                  <span className="text-gray-400 text-lg">›</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-sm font-medium text-gray-700">Order History</h2>
          <button onClick={() => navigate('/customer/orders')}
            className="text-xs text-blue-600 hover:underline">
            View all →
          </button>
        </div>
        {orders.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 mb-4 text-sm">No orders yet</p>
            <button onClick={() => navigate('/customer/orders/new')}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg
                         text-sm hover:bg-blue-700 transition">
              Place your first order
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Order','Amount','Status','Date'].map(h => (
                  <th key={h}
                    className="px-4 py-2 text-left text-xs
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
                  onClick={() => navigate(`/customer/orders/${o.id}`)}>
                  <td className="px-4 py-3 font-medium text-blue-600">
                    {o.order_number}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatCurrency(o.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${STATUS_COLOURS[o.status] || 'bg-gray-100 text-gray-600'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDateTime(o.ordered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Unpaid invoices */}
      {unpaid.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-100 flex justify-between items-center bg-red-50">
            <h2 className="text-sm font-medium text-red-700">
              Unpaid Invoices ({unpaid.length})
            </h2>
            <button onClick={() => navigate('/customer/billing')}
              className="text-xs text-red-600 hover:underline font-medium">
              Pay now →
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {unpaid.map((inv: any) => (
              <div key={inv.id}
                className="px-5 py-3 flex justify-between items-center
                           hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/customer/billing/${inv.id}`)}>
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {inv.invoice_number}
                  </p>
                  <p className="text-xs text-gray-400">{inv.order_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(inv.total_amount)}
                  </p>
                  <span className={`text-xs font-medium
                    ${inv.status === 'overdue' ? 'text-red-600' : 'text-blue-600'}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
