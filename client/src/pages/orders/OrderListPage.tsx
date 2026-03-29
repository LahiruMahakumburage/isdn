import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';

function useBasePath() {
  const location = useLocation();
  if (location.pathname.startsWith('/staff'))    return '/staff';
  if (location.pathname.startsWith('/customer')) return '/customer';
  return '';
}

const STATUS_COLOURS: Record<string,string> = {
  confirmed:  'bg-blue-100 text-blue-700',
  picking:    'bg-yellow-100 text-yellow-700',
  dispatched: 'bg-purple-100 text-purple-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-700',
};

export default function OrderListPage() {
  const navigate               = useNavigate();
  const base                   = useBasePath();
  const [orders,   setOrders]  = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);
  const [search,   setSearch]  = useState('');
  const [status,   setStatus]  = useState('');
  const [page,     setPage]    = useState(1);
  const [total,    setTotal]   = useState(0);
  const limit = 20;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get('/orders', { params });
      setOrders(res.data.data?.orders || []);
      setTotal(res.data.data?.total   || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [page, search, status]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <button
          onClick={() => navigate(`${base}/orders/new`)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          + New Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4
                      flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search order # or customer…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"/>
        <div className="flex gap-1 flex-wrap">
          {['','confirmed','picking','dispatched','delivered','cancelled'].map(s => (
            <button key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition
                ${status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {s === '' ? 'All' : s}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">{total} orders</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 mb-4">No orders found</p>
            <button
              onClick={() => navigate(`${base}/orders/new`)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
              Place first order
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Order #','Customer','RDC','Total','Status','Date',''].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-left text-xs font-medium
                               text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o: any) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">
                    {o.order_number}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{o.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500">{o.rdc_name}</td>
                  <td className="px-4 py-3 font-semibold">
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
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`${base}/orders/${o.id}`)}
                      className="text-xs text-blue-600 hover:underline font-medium">
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200
                          flex items-center justify-between">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg
                         disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg
                         disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
