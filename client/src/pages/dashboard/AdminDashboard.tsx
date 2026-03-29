import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatChartDate } from '../../utils/formatDate';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface KPI {
  orders_today: number;
  revenue_today: number;
  total_orders: number;
  low_stock_items: number;
  pending_deliveries: number;
  overdue_invoices: number;
  active_rdcs: number;
}

export default function AdminDashboard() {
  const navigate              = useNavigate();
  const [kpi,    setKpi]      = useState<KPI | null>(null);
  const [sales,  setSales]    = useState<any[]>([]);
  const [byRdc,  setByRdc]    = useState<any[]>([]);
  const [loading,setLoading]  = useState(true);
  const [error,  setError]    = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [kpiRes, salesRes] = await Promise.all([
          api.get('/reports/kpi'),
          api.get('/reports/sales'),
        ]);
        setKpi(kpiRes.data.data);
        setSales((salesRes.data.data.daily || []).slice(-14));
        setByRdc(salesRes.data.data.byRdc  || []);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load dashboard data.');
      } finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const cards = kpi ? [
    { label:'Orders Today',       value: kpi.orders_today,                  color:'text-blue-600',   bg:'bg-blue-50',   link:'/orders'    },
    { label:'Revenue Today',      value: formatCurrency(kpi.revenue_today), color:'text-green-600',  bg:'bg-green-50',  link:'/orders'    },
    { label:'Pending Deliveries', value: kpi.pending_deliveries,            color:'text-purple-600', bg:'bg-purple-50', link:'/delivery'  },
    { label:'Low Stock Alerts',   value: kpi.low_stock_items,               color:'text-amber-600',  bg:'bg-amber-50',  link:'/inventory' },
    { label:'Overdue Invoices',   value: kpi.overdue_invoices,              color:'text-red-600',    bg:'bg-red-50',    link:'/billing'   },
    { label:'Active RDCs',        value: kpi.active_rdcs,                   color:'text-teal-600',   bg:'bg-teal-50',   link:'/users'     },
  ] : [];

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading dashboard…</div>
  );

  if (error) return (
    <div className="p-8 text-center">
      <p className="text-red-500 mb-2">{error}</p>
      <button onClick={() => window.location.reload()}
        className="text-sm text-blue-600 hover:underline">Retry</button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-LK', {
              weekday:'long', year:'numeric', month:'long', day:'numeric'
            })}
          </p>
        </div>
        <button onClick={() => navigate('/orders/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          + New Order
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map(c => (
          <button key={c.label} onClick={() => navigate(c.link)}
            className={`${c.bg} border border-gray-200 rounded-xl p-4
                        text-left hover:shadow-md transition group min-w-0`}>
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-bold ${c.color} leading-tight break-words`}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1 group-hover:text-blue-500
                          transition">View →</p>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue trend */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-gray-700">
              Revenue — last 14 days
            </h2>
            <button onClick={() => navigate('/reports')}
              className="text-xs text-blue-600 hover:underline">
              Full report →
            </button>
          </div>
          {sales.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-gray-400 text-sm">No sales data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sales}
                margin={{ top:10, right:10, left:0, bottom:0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"   stopColor="#2563eb" stopOpacity={0.25}/>
                    <stop offset="95%"  stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize:11, fill:'#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={25}
                  tickFormatter={formatChartDate}
                />
                <YAxis
                  tick={{ fontSize:11, fill:'#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                  width={38}
                />
                <Tooltip
                  contentStyle={{
                    background:'#1e293b', border:'none',
                    borderRadius:'10px', color:'#f8fafc',
                    fontSize:'12px', padding:'10px 14px',
                  }}
                  labelStyle={{ color:'#94a3b8', marginBottom:4 }}
                  formatter={(v: any) => [formatCurrency(v), 'Revenue']}
                  labelFormatter={l => `📅 ${formatChartDate(l)}`}
                  cursor={{ stroke:'#2563eb', strokeWidth:1, strokeDasharray:'4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                  dot={false}
                  activeDot={{ r:5, fill:'#2563eb', strokeWidth:2, stroke:'white' }}
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by RDC */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-gray-700">
              Revenue by RDC (this period)
            </h2>
          </div>
          {byRdc.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-gray-400 text-sm">No data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byRdc}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="rdc_name" tick={{ fontSize: 11 }}
                  tickFormatter={v => v.replace(' RDC','')}/>
                <YAxis tick={{ fontSize: 11 }}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={(v: any) => formatCurrency(v)}/>
                <Bar dataKey="revenue" fill="#2563eb"
                  radius={[4,4,0,0]} name="Revenue"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      {kpi && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              Order Pipeline
            </h2>
            <div className="space-y-2 text-sm">
              {[
                { label:'Total orders', value: kpi.total_orders },
                { label:'Today',        value: kpi.orders_today  },
                { label:'Pending del.', value: kpi.pending_deliveries },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-semibold text-gray-800">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              Alerts
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Low stock items</span>
                <span className={`text-sm font-bold
                  ${kpi.low_stock_items > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {kpi.low_stock_items}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Overdue invoices</span>
                <span className={`text-sm font-bold
                  ${kpi.overdue_invoices > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {kpi.overdue_invoices}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              Quick Actions
            </h2>
            <div className="space-y-2">
              {[
                { label:'Place new order',   link:'/orders/new'           },
                { label:'Add product',       link:'/products/new'         },
                { label:'Stock transfer',    link:'/inventory/transfer'   },
                { label:'View reports',      link:'/reports'              },
              ].map(a => (
                <button key={a.label} onClick={() => navigate(a.link)}
                  className="w-full text-left text-sm text-blue-600
                             hover:underline py-0.5">
                  → {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
