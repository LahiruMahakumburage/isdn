import { useEffect, useState }         from 'react';
import { useNavigate, useLocation }    from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate }     from '../../utils/formatDate';
import { useAuthStore }   from '../../store/authStore';

function useBasePath() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/staff'))    return '/staff';
  if (loc.pathname.startsWith('/customer')) return '/customer';
  return '';
}

const STATUS_COLOURS: Record<string,string> = {
  draft:   'bg-gray-100 text-gray-600',
  issued:  'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void:    'bg-gray-100 text-gray-400',
};

export default function InvoiceListPage() {
  const navigate              = useNavigate();
  const base                  = useBasePath();
  const { user }              = useAuthStore();
  const isAdmin               = user?.roles?.includes('super_admin');
  const [invoices, setInv]    = useState<any[]>([]);
  const [summary,  setSummary]= useState<any>(null);
  const [loading,  setLoading]= useState(true);
  const [status,   setStatus] = useState('');
  const [total,    setTotal]  = useState(0);
  const [page,     setPage]   = useState(1);
  const limit = 20;

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (status) params.status = status;
      const [invRes, sumRes] = await Promise.all([
        api.get('/billing/invoices', { params }),
        api.get('/billing/summary').catch(() => ({ data: { data: null } })),
      ]);
      setInv(invRes.data.data?.invoices || []);
      setTotal(invRes.data.data?.total   || 0);
      setSummary(sumRes.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [page, status]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {base === '/customer' ? 'My Invoices' : 'Billing & Invoices'}
        </h1>
        {isAdmin && (
          <button
            onClick={() => navigate('/billing/payments')}
            className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5
                       rounded-lg hover:bg-gray-50 transition">
            View All Payments →
          </button>
        )}
      </div>

      {/* Summary cards — admin/manager only */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Outstanding', value: formatCurrency(summary.total_outstanding||0), color:'text-blue-600',   bg:'bg-blue-50'  },
            { label:'Overdue',     value: summary.overdue  || 0,                        color:'text-red-600',    bg:'bg-red-50'   },
            { label:'Paid (all)',  value: formatCurrency(summary.total_paid||0),        color:'text-green-600',  bg:'bg-green-50' },
            { label:'Total',       value: summary.total    || 0,                        color:'text-gray-900',   bg:'bg-gray-50'  },
          ].map(c => (
            <div key={c.label}
              className={`${c.bg} border border-gray-200 rounded-xl p-4`}>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4
                      flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600 font-medium">Status:</span>
        {['','draft','issued','paid','overdue','void'].map(s => (
          <button key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition
              ${status === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            {s === '' ? 'All' : s}
          </button>
        ))}
        <span className="text-sm text-gray-400 ml-auto">{total} invoices</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No invoices found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Invoice #','Customer','Order','Amount','Status','Due Date',''].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-left text-xs font-medium
                               text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 font-mono text-xs">
                    {inv.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {inv.order_number}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {formatCurrency(inv.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${STATUS_COLOURS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs
                    ${inv.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {inv.due_date ? formatDate(inv.due_date) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`${base}/billing/${inv.id}`)}
                      className="text-xs text-blue-600 hover:underline font-medium">
                      {inv.status === 'issued' || inv.status === 'overdue'
                        ? 'Pay Now →'
                        : 'View →'}
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
