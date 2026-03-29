import { useEffect, useState }        from 'react';
import { useNavigate, useLocation }   from 'react-router-dom';
import api from '../../services/api';
import { formatDate } from '../../utils/formatDate';

// Returns the URL prefix for the current portal
function useBasePath() {
  const location = useLocation();
  if (location.pathname.startsWith('/staff'))    return '/staff';
  if (location.pathname.startsWith('/customer')) return '/customer';
  return '';
}

const STATUS_COLOURS: Record<string,string> = {
  scheduled:        'bg-blue-100 text-blue-700',
  out_for_delivery: 'bg-yellow-100 text-yellow-700',
  delivered:        'bg-green-100 text-green-700',
  failed:           'bg-red-100 text-red-700',
};

const STATUS_STEPS: Record<string,string> = {
  scheduled:        'out_for_delivery',
  out_for_delivery: 'delivered',
};

export default function DeliverySchedulePage() {
  const navigate                      = useNavigate();
  const base                          = useBasePath();
  const [deliveries, setDeliveries]   = useState<any[]>([]);
  const [stats,      setStats]        = useState<any>(null);
  const [loading,    setLoading]      = useState(true);
  const [status,     setStatus]       = useState('');
  const [page,       setPage]         = useState(1);
  const [total,      setTotal]        = useState(0);
  const [updating,   setUpdating]     = useState<string|null>(null);

  // Schedule modal state
  const [showSchedule, setShowSchedule] = useState(false);
  const [orders,       setOrders]       = useState<any[]>([]);
  const [drivers,      setDrivers]      = useState<any[]>([]);
  const [schedForm,    setSchedForm]    = useState({
    order_id:'',
    driver_id:'',
    scheduled_date: new Date().toISOString().split('T')[0],
  });
  const [scheduling, setScheduling]    = useState(false);
  const [schedErr,   setSchedErr]      = useState('');
  const limit = 15;

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (status) params.status = status;
      const res = await api.get('/delivery', { params });
      setDeliveries(res.data.data?.deliveries || []);
      setTotal(res.data.data?.total           || 0);
    } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/delivery/stats/summary');
      setStats(res.data.data);
    } catch {}
  };

  useEffect(() => { fetchDeliveries(); }, [page, status]);
  useEffect(() => { fetchStats(); },     []);

  const advanceStatus = async (id: string, newStatus: string) => {
    if (!confirm(`Mark delivery as "${newStatus.replace('_',' ')}"?`)) return;
    setUpdating(id);
    try {
      await api.patch(`/delivery/${id}/status`, { status: newStatus });
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to update');
    } finally { setUpdating(null); }
  };

  const failDelivery = async (id: string) => {
    if (!confirm('Mark this delivery as failed?')) return;
    setUpdating(id);
    try {
      await api.patch(`/delivery/${id}/status`, { status: 'failed' });
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed');
    } finally { setUpdating(null); }
  };

  const openSchedule = async () => {
    try {
      const [ordRes, drvRes] = await Promise.all([
        api.get('/orders?status=confirmed&limit=50'),
        api.get('/delivery/drivers'),
      ]);
      setOrders(ordRes.data.data?.orders || []);
      setDrivers(drvRes.data.data        || []);
      setShowSchedule(true);
    } catch {}
  };

  const handleSchedule = async () => {
    setSchedErr('');
    if (!schedForm.order_id || !schedForm.scheduled_date)
      return setSchedErr('Order and scheduled date are required.');
    setScheduling(true);
    try {
      await api.post('/delivery', {
        order_id:       schedForm.order_id,
        driver_id:      schedForm.driver_id || undefined,
        scheduled_date: schedForm.scheduled_date,
      });
      setShowSchedule(false);
      setSchedForm({
        order_id:'', driver_id:'',
        scheduled_date: new Date().toISOString().split('T')[0],
      });
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      setSchedErr(e.response?.data?.message || 'Scheduling failed.');
    } finally { setScheduling(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Delivery Schedule</h1>
        <button onClick={openSchedule}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          + Schedule Delivery
        </button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label:'Today',        value: stats.today,            color:'text-blue-600'   },
            { label:'Scheduled',    value: stats.scheduled,        color:'text-indigo-600' },
            { label:'Out for Del.', value: stats.out_for_delivery, color:'text-yellow-600' },
            { label:'Delivered',    value: stats.delivered,        color:'text-green-600'  },
            { label:'Failed',       value: stats.failed,           color:'text-red-600'    },
          ].map(s => (
            <div key={s.label}
              className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4
                      flex gap-3 items-center flex-wrap">
        <label className="text-sm text-gray-600 font-medium">Status:</label>
        <div className="flex gap-2 flex-wrap">
          {['','scheduled','out_for_delivery','delivered','failed'].map(s => (
            <button key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition
                ${status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {s === '' ? 'All' : s.replace('_',' ')}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">{total} deliveries</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading deliveries…</div>
        ) : deliveries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No deliveries found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Order','Customer','Address','Driver','Date','Status','Actions'].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-left text-xs font-medium
                               text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deliveries.map((d: any) => {
                const nextStatus = STATUS_STEPS[d.status];
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {/* ── Role-aware order link ── */}
                      <button
                        onClick={() => navigate(`${base}/orders/${d.order_id}`)}
                        className="font-medium text-blue-600 hover:underline text-xs">
                        {d.order_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {d.customer_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs
                                   max-w-[140px] truncate">
                      {d.delivery_address}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {d.driver_name || (
                        <span className="text-amber-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(d.scheduled_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${STATUS_COLOURS[d.status] || 'bg-gray-100 text-gray-600'}`}>
                        {d.status.replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* ── Role-aware Track button ── */}
                        <button
                          onClick={() => navigate(`${base}/delivery/${d.id}/track`)}
                          className="text-xs text-blue-600 hover:underline font-medium px-1">
                          Track
                        </button>

                        {/* Advance status */}
                        {nextStatus && (
                          <button
                            onClick={() => advanceStatus(d.id, nextStatus)}
                            disabled={updating === d.id}
                            className="text-xs bg-blue-600 text-white px-2 py-1
                                       rounded hover:bg-blue-700 disabled:opacity-50">
                            {updating === d.id ? '…'
                              : nextStatus === 'out_for_delivery' ? 'Dispatch'
                              : 'Deliver'}
                          </button>
                        )}

                        {/* Fail button */}
                        {d.status === 'out_for_delivery' && (
                          <button
                            onClick={() => failDelivery(d.id)}
                            disabled={updating === d.id}
                            className="text-xs bg-red-500 text-white px-2 py-1
                                       rounded hover:bg-red-600 disabled:opacity-50">
                            Fail
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
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

      {/* ── Schedule delivery modal ── */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center
                        justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Schedule Delivery
              </h2>
              <button onClick={() => setShowSchedule(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Order <span className="text-red-400">*</span>
                </label>
                <select value={schedForm.order_id}
                  onChange={e => setSchedForm(f => ({ ...f, order_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select confirmed order…</option>
                  {orders.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customer_name}
                    </option>
                  ))}
                </select>
                {orders.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No confirmed orders available
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Driver (optional)
                </label>
                <select value={schedForm.driver_id}
                  onChange={e => setSchedForm(f => ({ ...f, driver_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Assign later…</option>
                  {drivers.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}{d.rdc_name ? ` (${d.rdc_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Scheduled Date <span className="text-red-400">*</span>
                </label>
                <input type="date"
                  value={schedForm.scheduled_date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setSchedForm(f => ({ ...f, scheduled_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>

              {schedErr && (
                <p className="text-red-500 text-sm bg-red-50 border border-red-200
                              rounded-lg px-3 py-2">
                  {schedErr}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={handleSchedule} disabled={scheduling}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm
                             font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                  {scheduling ? 'Scheduling…' : 'Confirm Schedule'}
                </button>
                <button onClick={() => setShowSchedule(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm
                             hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
