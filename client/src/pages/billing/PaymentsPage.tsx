import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency }    from '../../utils/formatCurrency';
import { formatDateTime }    from '../../utils/formatDate';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const METHOD_LABELS: Record<string,string> = {
  cash:           '💵 Cash',
  bank_transfer:  '🏦 Bank Transfer',
  card:           '💳 Card',
  online_gateway: '🌐 Online',
};

const METHOD_COLOURS: Record<string,string> = {
  cash:           'bg-yellow-100 text-yellow-700',
  bank_transfer:  'bg-blue-100 text-blue-700',
  card:           'bg-purple-100 text-purple-700',
  online_gateway: 'bg-teal-100 text-teal-700',
};

export default function PaymentsPage() {
  const navigate                    = useNavigate();
  const [payments, setPayments]     = useState<any[]>([]);
  const [totals,   setTotals]       = useState<any>(null);
  const [loading,  setLoading]      = useState(true);
  const [method,   setMethod]       = useState('');
  const [from,     setFrom]         = useState(
    () => new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  );
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { from, to };
      if (method) params.method = method;
      const res = await api.get('/billing/payments', { params });
      setPayments(res.data.data?.payments || []);
      setTotals(res.data.data?.totals);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [from, to, method]);

  const chartData = totals ? [
    { name:'Cash',     value: Number(totals.cash          || 0) },
    { name:'Bank',     value: Number(totals.bank_transfer || 0) },
    { name:'Card',     value: Number(totals.card          || 0) },
    { name:'Online',   value: Number(totals.online_gateway|| 0) },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            All received payments across all invoices
          </p>
        </div>
        <button onClick={() => navigate('/billing')}
          className="text-sm border border-gray-300 text-gray-600 px-3 py-1.5
                     rounded-lg hover:bg-gray-50">
          ← Invoices
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4
                      flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"/>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All methods</option>
            {Object.entries(METHOD_LABELS).map(([k,v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-1 ml-auto">
          {[{label:'7d',days:7},{label:'30d',days:30},{label:'90d',days:90}].map(p => (
            <button key={p.label}
              onClick={() => {
                setTo(new Date().toISOString().split('T')[0]);
                setFrom(new Date(Date.now()-p.days*864e5).toISOString().split('T')[0]);
              }}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg
                         hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700">
              Last {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      {totals && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Total Received',  value: formatCurrency(totals.total_amount||0), color:'text-green-600' },
            { label:'Transactions',    value: totals.total_count || 0,                color:'text-blue-600'  },
            { label:'Today',           value: formatCurrency(totals.today||0),         color:'text-purple-600'},
            { label:'Avg per Payment', value: formatCurrency(
                totals.total_count > 0 ? (totals.total_amount/totals.total_count) : 0
              ), color:'text-amber-600' },
          ].map(c => (
            <div key={c.label}
              className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Method breakdown chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Revenue by Payment Method
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}
              margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{ fontSize:12 }}/>
              <YAxis tick={{ fontSize:11 }}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
              <Tooltip formatter={(v: any) => formatCurrency(v)}/>
              <Bar dataKey="value" fill="#2563eb" radius={[4,4,0,0]} name="Amount"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Payments table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
          <h2 className="text-sm font-medium text-gray-700">Payment Records</h2>
          <span className="text-sm text-gray-400">{payments.length} payments</span>
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            No payments in this period
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Invoice','Customer','Method','Reference','Amount','Date'].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-left text-xs font-medium
                               text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-blue-600
                                 font-medium">
                    {p.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${METHOD_COLOURS[p.method] || 'bg-gray-100 text-gray-600'}`}>
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                    {p.gateway_ref || '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-green-600">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDateTime(p.paid_at)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals footer */}
            {totals && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4}
                    className="px-4 py-3 text-right font-bold text-gray-700">
                    Total Received ({totals.total_count} payments)
                  </td>
                  <td className="px-4 py-3 font-bold text-green-600 text-base">
                    {formatCurrency(totals.total_amount || 0)}
                  </td>
                  <td/>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
