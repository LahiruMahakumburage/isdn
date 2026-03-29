import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const COLOURS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed'];

export default function ReportsDashboard() {
  const navigate             = useNavigate();
  const [kpi,    setKpi]     = useState<any>(null);
  const [sales,  setSales]   = useState<any>(null);
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/reports/kpi'),
      api.get('/reports/sales'),
    ]).then(([kpiRes, salesRes]) => {
      setKpi(kpiRes.data.data);
      setSales(salesRes.data.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading reports…</div>
  );

  const kpiCards = kpi ? [
    { label:'Revenue Today',  value: formatCurrency(kpi.revenue_today),  color:'text-green-600',  bg:'bg-green-50'  },
    { label:'Revenue (Week)', value: formatCurrency(kpi.revenue_week),   color:'text-blue-600',   bg:'bg-blue-50'   },
    { label:'Revenue (Month)',value: formatCurrency(kpi.revenue_month),  color:'text-purple-600', bg:'bg-purple-50' },
    { label:'Total Orders',   value: kpi.total_orders,                   color:'text-gray-900',   bg:'bg-gray-50'   },
    { label:'Delivered',      value: kpi.delivered,                      color:'text-green-600',  bg:'bg-green-50'  },
    { label:'Customers',      value: kpi.total_customers,                color:'text-blue-600',   bg:'bg-blue-50'   },
  ] : [];

  const statusData = sales?.byStatus?.map((s: any) => ({
    name:  s.status.charAt(0).toUpperCase() + s.status.slice(1),
    value: Number(s.count),
  })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Business intelligence overview
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { label:'Sales Report',  link:'/reports/sales'    },
            { label:'Stock Turnover',link:'/reports/turnover' },
            { label:'Delivery Eff.', link:'/reports/delivery' },
            { label:'Customers',     link:'/reports/customers'},
          ].map(b => (
            <button key={b.link} onClick={() => navigate(b.link)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs
                         font-medium text-gray-600 hover:bg-gray-50 transition">
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map(c => (
          <div key={c.label}
            className={`${c.bg} border border-gray-200 rounded-xl p-4`}>
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Revenue trend */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-medium text-gray-700">
              Daily Revenue (last 30 days)
            </h2>
            <button onClick={() => navigate('/reports/sales')}
              className="text-xs text-blue-600 hover:underline">
              Full report →
            </button>
          </div>
          {!sales?.daily?.length ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No sales data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={sales.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{ fontSize:11 }}
                  tickFormatter={v => v.slice(5)}/>
                <YAxis tick={{ fontSize:11 }}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={(v:any) => formatCurrency(v)}
                  labelFormatter={l => `Date: ${l}`}/>
                <Line type="monotone" dataKey="revenue" stroke="#2563eb"
                  strokeWidth={2.5} dot={false} name="Revenue"/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Order status pie */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Orders by Status
          </h2>
          {!statusData.length ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value">
                  {statusData.map((_:any, i:number) => (
                    <Cell key={i} fill={COLOURS[i % COLOURS.length]}/>
                  ))}
                </Pie>
                <Tooltip formatter={(v:any) => `${v} orders`}/>
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }}/>
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Revenue by RDC */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Revenue by RDC
          </h2>
          {!sales?.byRdc?.length ? (
            <div className="h-52 flex items-center justify-center text-gray-400 text-sm">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={sales.byRdc}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="rdc_name" tick={{ fontSize:11 }}
                  tickFormatter={v => v.replace(' RDC','')}/>
                <YAxis tick={{ fontSize:11 }}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
                <Tooltip formatter={(v:any) => formatCurrency(v)}/>
                <Bar dataKey="revenue" fill="#2563eb"
                  radius={[4,4,0,0]} name="Revenue"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-medium text-gray-700">
              Top Products (30 days)
            </h2>
            <button onClick={() => navigate('/reports/sales')}
              className="text-xs text-blue-600 hover:underline">
              Details →
            </button>
          </div>
          {!sales?.topProducts?.length ? (
            <div className="p-8 text-center text-gray-400 text-sm">No data</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['#','Product','Sold','Revenue'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs
                                           font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.topProducts.slice(0,6).map((p:any, i:number) => (
                  <tr key={p.sku} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {i+1}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-800 text-xs">
                        {p.name}
                      </p>
                      <p className="text-gray-400 text-xs">{p.sku}</p>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-700">
                      {p.total_sold}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-green-600">
                      {formatCurrency(p.total_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
