import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatChartDate } from '../../utils/formatDate';

function useBasePath() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/staff')) return '/staff';
  return '';
}

export default function ReportsHub() {
  const navigate               = useNavigate();
  const base                   = useBasePath();
  const [kpi,     setKpi]      = useState<any>(null);
  const [sales,   setSales]    = useState<any[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true); setError('');
      try {
        const [kpiRes, salesRes] = await Promise.all([
          api.get('/reports/kpi'),
          api.get('/reports/sales'),
        ]);
        setKpi(kpiRes.data.data);
        setSales((salesRes.data.data?.daily || []).slice(-14));
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load reports');
      } finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const reportCards = [
    {
      icon: '📊',
      label: 'Sales Report',
      desc: 'Revenue, orders, top products & customers',
      link: `${base}/reports/sales`,
      color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
      badge: kpi ? formatCurrency(kpi.revenue_month || 0) : '—',
      badgeLabel: 'This month',
      badgeColor: 'text-blue-600',
    },
    {
      icon: '📦',
      label: 'Stock Turnover',
      desc: 'Inventory levels, days of stock, low stock alerts',
      link: `${base}/reports/turnover`,
      color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
      badge: kpi ? kpi.low_stock_items : '—',
      badgeLabel: 'Low stock items',
      badgeColor: kpi?.low_stock_items > 0 ? 'text-red-600' : 'text-green-600',
    },
    {
      icon: '🚚',
      label: 'Delivery Efficiency',
      desc: 'On-time rates, driver performance, RDC stats',
      link: `${base}/reports/delivery`,
      color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
      badge: kpi ? kpi.pending_deliveries : '—',
      badgeLabel: 'Pending deliveries',
      badgeColor: 'text-purple-600',
    },
    {
      icon: '👥',
      label: 'Customer Report',
      desc: 'Customer spend analysis, tiers, order history',
      link: `${base}/reports/customers`,
      color: 'bg-green-50 border-green-200 hover:border-green-400',
      badge: kpi ? kpi.total_customers : '—',
      badgeLabel: 'Total customers',
      badgeColor: 'text-green-600',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Business insights and analytics
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={() => window.location.reload()}
            className="text-xs text-red-600 hover:underline mt-1">
            Retry
          </button>
        </div>
      )}

      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label:'Revenue Today',  value: formatCurrency(kpi.revenue_today||0), color:'text-green-600'  },
            { label:'Revenue (Month)',value: formatCurrency(kpi.revenue_month||0), color:'text-blue-600'   },
            { label:'Total Orders',   value: kpi.total_orders || 0,               color:'text-gray-900'   },
            { label:'Total Revenue',  value: formatCurrency(kpi.total_revenue||0), color:'text-purple-600' },
          ].map(c => (
            <div key={c.label}
              className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-lg font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {reportCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.link)}
            className={`${card.color} border-2 rounded-2xl p-5 text-left
                        transition-all hover:shadow-md group`}>
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-700">
              {card.label}
            </h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {card.desc}
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-xl font-bold ${card.badgeColor}`}>
                  {card.badge}
                </p>
                <p className="text-xs text-gray-400">{card.badgeLabel}</p>
              </div>
              <span className="text-gray-300 group-hover:text-blue-500 text-lg">→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Revenue mini chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-700">
            Revenue — last 14 days
          </h2>
          <button
            onClick={() => navigate(`${base}/reports/sales`)}
            className="text-xs text-blue-600 hover:underline">
            Full report →
          </button>
        </div>
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600
                            rounded-full animate-spin"/>
          </div>
        ) : sales.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center
                          text-gray-400 text-sm">
            No sales data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={sales}
              margin={{ top:10, right:10, left:0, bottom:0 }}>
              <defs>
                <linearGradient id="hubRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
              <XAxis dataKey="date"
                tick={{ fontSize:11, fill:'#9ca3af' }}
                tickLine={false} axisLine={false}
                minTickGap={25} tickFormatter={formatChartDate}/>
              <YAxis
                tick={{ fontSize:11, fill:'#9ca3af' }}
                tickLine={false} axisLine={false} width={38}
                tickFormatter={v => `${(v/1000).toFixed(0)}k`}/>
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
              <Area type="monotone" dataKey="revenue"
                stroke="#2563eb" strokeWidth={2.5}
                fill="url(#hubRevGrad)" dot={false}
                activeDot={{ r:5, fill:'#2563eb', strokeWidth:2, stroke:'white' }}
                name="Revenue"/>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Quick links table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">All Reports</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { icon:'📊', label:'Sales Report',          path:`${base}/reports/sales`,     desc:'Revenue, orders, products' },
            { icon:'📦', label:'Stock Turnover',         path:`${base}/reports/turnover`,  desc:'Inventory & stock health'  },
            { icon:'🚚', label:'Delivery Efficiency',    path:`${base}/reports/delivery`,  desc:'On-time & driver stats'    },
            { icon:'👥', label:'Customer Report',         path:`${base}/reports/customers`, desc:'Spend & tier analysis'     },
          ].map(r => (
            <button key={r.label}
              onClick={() => navigate(r.path)}
              className="w-full px-5 py-3.5 flex items-center gap-4
                         hover:bg-gray-50 text-left transition">
              <span className="text-xl">{r.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{r.label}</p>
                <p className="text-xs text-gray-400">{r.desc}</p>
              </div>
              <span className="text-gray-300 text-sm">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
