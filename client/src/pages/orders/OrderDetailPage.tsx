import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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

const STATUS_FLOW = ['confirmed','picking','dispatched','delivered'];

export default function OrderDetailPage() {
  const { id }              = useParams<{ id: string }>();
  const navigate            = useNavigate();
  const base                = useBasePath();
  const [order,   setOrder] = useState<any>(null);
  const [loading, setLoad]  = useState(true);
  const [updating,setUpd]   = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data.data);
    } finally { setLoad(false); }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const advanceStatus = async () => {
    const idx  = STATUS_FLOW.indexOf(order.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    if (!confirm(`Move order to "${next}"?`)) return;
    setUpd(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: next });
      fetchOrder();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed');
    } finally { setUpd(false); }
  };

  const cancelOrder = async () => {
    if (!confirm('Cancel this order?')) return;
    setUpd(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: 'cancelled' });
      fetchOrder();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed');
    } finally { setUpd(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!order)  return <div className="p-8 text-center text-gray-500">Order not found.</div>;

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(order.status) + 1];
  const canCancel  = ['confirmed','picking'].includes(order.status);

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate(`${base}/orders`)}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← Orders
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">
          {order.order_number}
        </h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${STATUS_COLOURS[order.status] || 'bg-gray-100 text-gray-600'}`}>
          {order.status}
        </span>
        <div className="ml-auto flex gap-2">
          {nextStatus && (
            <button onClick={advanceStatus} disabled={updating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                         font-medium hover:bg-blue-700 disabled:opacity-50 transition capitalize">
              {updating ? '…' : `Mark ${nextStatus}`}
            </button>
          )}
          {canCancel && (
            <button onClick={cancelOrder} disabled={updating}
              className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm
                         font-medium hover:bg-red-600 disabled:opacity-50 transition">
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Order info */}
        <div className="xl:col-span-2 space-y-4">
          {/* Status timeline */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Status</h2>
            <div className="flex items-center gap-0">
              {STATUS_FLOW.map((s, i) => {
                const done    = STATUS_FLOW.indexOf(order.status) >= i;
                const current = order.status === s;
                return (
                  <div key={s} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center
                        justify-center text-xs font-bold border-2 transition
                        ${done
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-300 text-gray-300'}`}>
                        {done ? '✓' : i+1}
                      </div>
                      <p className={`text-xs mt-1 font-medium capitalize
                        ${current ? 'text-blue-600' : done ? 'text-gray-600' : 'text-gray-300'}`}>
                        {s}
                      </p>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1
                        ${STATUS_FLOW.indexOf(order.status) > i ? 'bg-blue-600' : 'bg-gray-200'}`}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-700">Items Ordered</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Product','SKU','Qty','Unit Price','Line Total'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs
                                           font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">
                      {item.sku}
                    </td>
                    <td className="px-4 py-2.5 font-semibold">{item.quantity}</td>
                    <td className="px-4 py-2.5">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-800">
                    Total
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-base">
                    {formatCurrency(order.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Side info */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Order Details</h2>
            <div className="space-y-2 text-sm">
              {[
                ['RDC',       order.rdc_name],
                ['Ordered',   formatDateTime(order.ordered_at)],
                ['Delivered', order.delivered_at ? formatDateTime(order.delivered_at) : '—'],
              ].map(([k,v]) => (
                <div key={String(k)} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="text-gray-800 font-medium text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Customer</h2>
            <p className="font-semibold text-gray-800">{order.customer_name}</p>
            {order.customer_email && (
              <p className="text-xs text-gray-400 mt-0.5">{order.customer_email}</p>
            )}
            {order.customer_phone && (
              <a href={`tel:${order.customer_phone}`}
                className="text-sm text-blue-600 hover:underline block mt-1">
                {order.customer_phone}
              </a>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Delivery Address</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {order.delivery_address || '—'}
            </p>
          </div>

          {order.notes && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Notes</h2>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
