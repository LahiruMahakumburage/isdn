import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatChartDate, formatChartMonth } from '../../utils/formatDate';
import { exportSalesReport } from '../../utils/exportCsv';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function SalesDetailPage() {
  const navigate              = useNavigate();
  const [data,      setData]  = useState<any>(null);
  const [loading,   setLoad]  = useState(true);
  const [error,     setError] = useState('');
  const [exporting, setExp]   = useState(false);
  const [rdcs,      setRdcs]  = useState<any[]>([]);
  const [rdcId,     setRdcId] = useState('');
  const [from,      setFrom]  = useState(
    () => new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  );
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoad(true); setError('');
    try {
      const params: any = { from, to };
      if (rdcId) params.rdc_id = rdcId;
      const [repRes, rdcRes] = await Promise.all([
        api.get('/reports/sales', { params }),
        api.get('/rdcs'),
      ]);
      setData(repRes.data.data);
      setRdcs(rdcRes.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load');
    } finally { setLoad(false); }
  };

  useEffect(() => { fetchReport(); }, [from, to, rdcId]);

  const totals       = data?.totals       || {};
  const daily        = data?.daily        || [];
  const byRdc        = data?.byRdc        || [];
  const monthly      = data?.monthly      || [];
  const topProducts  = data?.topProducts  || [];
  const topCustomers = data?.topCustomers || [];

  const handleExport = () => {
    if (!data) return;
    setExp(true);
    try { exportSalesReport(data, from, to); }
    finally { setTimeout(() => setExp(false), 1200); }
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
          <h1 className="text-2xl font-semibold text-gray-900">Sales Report</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Revenue, orders and product performance
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => navigate('/reports/customers')}
            className="text-sm text-gray-500 border border-gray-300 px-3 py-1.5
                       rounded-lg hover:bg-gray-50">
            Customers Report →
          </button>
          {data && (
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 bg-green-600 text-white
                         px-4 py-1.5 rounded-lg text-sm font-medium
                         hover:bg-green-700 disabled:opacity-60 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
        </div>
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
          <label className="block text-xs text-gray-500 mb-1">RDC</label>
          <select value={rdcId} onChange={e => setRdcId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All RDCs</option>
            {rdcs.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
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

      {loading && <div className="p-16 text-center text-gray-400">Loading…</div>}
      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={fetchReport}
            className="text-xs text-red-600 hover:underline mt-1">Retry</button>
        </div>
      )}
      {!loading && !error && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total Orders',    value: totals.total_orders     || 0,   color:'text-blue-600'   },
              { label:'Total Revenue',   value: formatCurrency(totals.total_revenue    || 0), color:'text-green-600'  },
              { label:'Avg Order Value', value: formatCurrency(totals.avg_order_value  || 0), color:'text-purple-600' },
              { label:'Largest Order',   value: formatCurrency(totals.max_order_value  || 0), color:'text-amber-600'  },
            ].map(c => (
              <div key={c.label}
                className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Daily chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-4">
              Daily Revenue
            </h2>
            {daily.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center
                              text-gray-400 text-sm">
                No orders in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={daily}
                  margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:"#9ca3af" }} tickLine={false}
                    axisLine={false} minTickGap={25}
                    tickFormatter={formatChartDate}/>
                  <YAxis tick={{ fontSize:11, fill:'#9ca3af' }} tickLine={false}
                    axisLine={false} width={38}
                    tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                  <Tooltip
                    formatter={(v: any) => [formatCurrency(v), 'Revenue']}
                    labelFormatter={l => `Date: ${l}`}/>
                  <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="revenue"
                  stroke="#2563eb" strokeWidth={2.5}
                  fill="url(#grad1)" dot={false}
                  activeDot={{ r:5, fill:'#2563eb', strokeWidth:2, stroke:'white' }}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* By RDC */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Revenue by RDC
              </h2>
              {byRdc.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center
                                text-gray-400 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byRdc}
                    margin={{ top:5, right:10, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="rdc_name" tick={{ fontSize:11 }}
                      tickFormatter={v => v.replace(' RDC','')}/>
                    <YAxis tick={{ fontSize:11 }}
                      tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                    <Tooltip formatter={(v: any) => [formatCurrency(v),'Revenue']}/>
                    <Bar dataKey="revenue" fill="#2563eb" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Monthly trend */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Monthly Trend (6 months)
              </h2>
              {monthly.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center
                                text-gray-400 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthly}
                    margin={{ top:5, right:10, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="month" tick={{ fontSize:11 }} tickFormatter={formatChartMonth}/>
                    <YAxis tick={{ fontSize:11 }}
                      tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                    <Tooltip formatter={(v: any) => [formatCurrency(v),'Revenue']}/>
                    <Bar dataKey="revenue" fill="#7c3aed" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Top Products + Top Customers */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-700">
                  Top Products by Sales
                </h2>
              </div>
              {topProducts.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">No data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#','Product','SKU','Units','Revenue'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs
                                               font-medium text-gray-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topProducts.slice(0,10).map((p: any, i: number) => (
                      <tr key={p.sku} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">{p.sku}</td>
                        <td className="px-4 py-2.5 font-semibold text-blue-600">{p.total_sold}</td>
                        <td className="px-4 py-2.5 font-medium">{formatCurrency(p.total_revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
                <h2 className="text-sm font-medium text-gray-700">
                  Top Customers
                </h2>
                <button onClick={() => navigate('/reports/customers')}
                  className="text-xs text-blue-600 hover:underline">
                  Full report →
                </button>
              </div>
              {topCustomers.length === 0 ? (
                <p className="p-8 text-center text-gray-400 text-sm">No data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#','Customer','Orders','Total Spent'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs
                                               font-medium text-gray-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topCustomers.slice(0,8).map((c: any, i: number) => (
                      <tr key={c.email} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-800">{c.full_name}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-blue-600">
                          {c.order_count}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          {formatCurrency(c.total_spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
