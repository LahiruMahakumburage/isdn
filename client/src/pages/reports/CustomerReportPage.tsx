import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function CustomerReportPage() {
  const navigate              = useNavigate();
  const [customers, setCust]  = useState<any[]>([]);
  const [stats,     setStats] = useState<any>(null);
  const [loading,   setLoad]  = useState(true);
  const [error,     setError] = useState('');
  const [search,    setSearch]= useState('');

  const fetchAll = async () => {
    setLoad(true); setError('');
    try {
      const [custRes, kpiRes] = await Promise.all([
        api.get('/reports/customers'),
        api.get('/reports/kpi'),
      ]);
      setCust(custRes.data.data || []);
      setStats(kpiRes.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load customer report');
    } finally { setLoad(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = customers.filter(c =>
    !search ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = customers.reduce((s,c) => s + Number(c.total_spent||0), 0);
  const totalOrders  = customers.reduce((s,c) => s + Number(c.order_count||0), 0);
  const avgSpend     = customers.length > 0 ? totalRevenue / customers.length : 0;

  // Chart: top 8 customers by spend
  const chartData = customers.slice(0,8).map(c => ({
    name:  c.full_name?.split(' ')[0] || 'Customer',
    spent: Number(c.total_spent || 0),
    orders: Number(c.order_count || 0),
  }));

  // Spend tier breakdown
  const tiers = {
    high:   customers.filter(c => Number(c.total_spent||0) >= 10000).length,
    mid:    customers.filter(c => Number(c.total_spent||0) >= 1000 && Number(c.total_spent||0) < 10000).length,
    low:    customers.filter(c => Number(c.total_spent||0) < 1000).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate('/reports')}
              className="text-gray-400 hover:text-gray-600 text-sm">
              ← Reports
            </button>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Customer Report
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Customer spend analysis and order history
          </p>
        </div>
        <button onClick={() => navigate('/reports/sales')}
          className="text-sm text-gray-500 border border-gray-300 px-3 py-1.5
                     rounded-lg hover:bg-gray-50">
          ← Sales Report
        </button>
      </div>

      {loading && <div className="p-16 text-center text-gray-400">Loading…</div>}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={fetchAll}
            className="text-xs text-red-600 hover:underline mt-1">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total Customers',  value: stats?.total_customers || customers.length, color:'text-blue-600'   },
              { label:'Total Revenue',    value: formatCurrency(totalRevenue),                color:'text-green-600'  },
              { label:'Total Orders',     value: totalOrders,                                 color:'text-purple-600' },
              { label:'Avg Spend / Cust', value: formatCurrency(avgSpend),                   color:'text-amber-600'  },
            ].map(c => (
              <div key={c.label}
                className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Spend tier badges */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:'High Value',  desc:'LKR 10,000+',  value: tiers.high, color:'bg-green-50 border-green-200', text:'text-green-700' },
              { label:'Mid Value',   desc:'LKR 1,000–9,999', value: tiers.mid, color:'bg-blue-50 border-blue-200', text:'text-blue-700' },
              { label:'Entry Level', desc:'Under LKR 1,000', value: tiers.low, color:'bg-gray-50 border-gray-200',  text:'text-gray-700' },
            ].map(t => (
              <div key={t.label}
                className={`${t.color} border rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-bold ${t.text}`}>{t.value}</p>
                <p className="text-sm font-medium text-gray-700 mt-1">{t.label}</p>
                <p className="text-xs text-gray-400">{t.desc}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Top 8 Customers by Total Spend
              </h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}
                  margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="name" tick={{ fontSize:11 }}/>
                  <YAxis tick={{ fontSize:11 }}
                    tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                  <Tooltip formatter={(v: any) => formatCurrency(v)}/>
                  <Bar dataKey="spent" fill="#2563eb"
                    radius={[4,4,0,0]} name="Total Spent"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Search + Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center
                            justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-medium text-gray-700">
                All Customers
                <span className="ml-2 text-gray-400 font-normal">
                  ({filtered.length})
                </span>
              </h2>
              <input
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"/>
            </div>

            {filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                {customers.length === 0
                  ? 'No customers found. Add some customer accounts.'
                  : 'No customers match your search.'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['#','Customer','Email','Phone','Orders',
                      'Total Spent','Avg Order','Last Order','Tier'].map(h => (
                      <th key={h}
                        className="px-4 py-3 text-left text-xs font-medium
                                   text-gray-500 uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((c: any, i: number) => {
                    const spent  = Number(c.total_spent  || 0);
                    const orders = Number(c.order_count  || 0);
                    const avg    = orders > 0 ? spent / orders : 0;
                    const tier   = spent >= 10000 ? { label:'High',  style:'bg-green-100 text-green-700' }
                                 : spent >= 1000  ? { label:'Mid',   style:'bg-blue-100 text-blue-700'   }
                                 :                  { label:'Entry', style:'bg-gray-100 text-gray-600'   };
                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {c.full_name}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.email}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {c.phone || '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-center
                                       text-blue-600">
                          {orders}
                        </td>
                        <td className="px-4 py-3 font-bold text-green-700">
                          {formatCurrency(spent)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {formatCurrency(avg)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {c.last_order
                            ? formatDateTime(c.last_order).split(',')[0]
                            : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs
                                           font-medium ${tier.style}`}>
                            {tier.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Summary footer */}
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td colSpan={4}
                      className="px-4 py-3 text-right text-xs font-bold text-gray-600">
                      Totals ({filtered.length} customers)
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-600 text-center">
                      {filtered.reduce((s,c) => s+Number(c.order_count||0),0)}
                    </td>
                    <td className="px-4 py-3 font-bold text-green-700">
                      {formatCurrency(filtered.reduce((s,c) => s+Number(c.total_spent||0),0))}
                    </td>
                    <td colSpan={3}/>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
