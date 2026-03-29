import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency }       from '../../utils/formatCurrency';
import { exportStockTurnover }  from '../../utils/exportCsv';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function StockTurnoverPage() {
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [exporting, setExporting] = useState(false);
  const [rdcs,      setRdcs]      = useState<any[]>([]);
  const [rdcId,     setRdcId]     = useState('');
  const [filter,    setFilter]    = useState<'all'|'critical'|'low'|'healthy'>('all');

  const fetchReport = async () => {
    setLoading(true); setError('');
    try {
      const params: any = {};
      if (rdcId) params.rdc_id = rdcId;
      const [repRes, rdcRes] = await Promise.all([
        api.get('/reports/stock-turnover', { params }),
        api.get('/rdcs'),
      ]);
      setData(repRes.data.data);
      setRdcs(rdcRes.data.data || []);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load report');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [rdcId]);

  const getStatus = (days: number | null) => {
    if (!days || days === 0) return 'no-sales';
    if (days <= 7)  return 'critical';
    if (days <= 30) return 'low';
    return 'healthy';
  };

  const statusStyle: Record<string, string> = {
    critical:  'bg-red-100 text-red-700',
    low:       'bg-yellow-100 text-yellow-700',
    healthy:   'bg-green-100 text-green-700',
    'no-sales':'bg-gray-100 text-gray-500',
  };

  const items: any[]  = data?.items   || [];
  const summary: any  = data?.summary || {};

  const filtered = items.filter(row => {
    if (filter === 'all') return true;
    return getStatus(Number(row.days_of_stock)) === filter;
  });

  const chartData = items
    .filter(r => Number(r.sold_30d) > 0)
    .slice(0, 10)
    .map(r => ({
      name:  r.sku,
      sold:  Number(r.sold_30d),
      stock: Number(r.quantity_on_hand),
    }));

  const handleExport = () => {
    const rdcName = rdcs.find(r => String(r.id) === rdcId)?.name || '';
    setExporting(true);
    try { exportStockTurnover(filtered.length ? filtered : items, rdcName); }
    finally { setTimeout(() => setExporting(false), 800); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Stock Turnover</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Sales velocity and stock health — last 30 days
          </p>
        </div>
        {data && (
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 bg-green-600 text-white
                       px-4 py-2 rounded-lg text-sm font-medium
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

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4
                      flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Filter by RDC</label>
          <select value={rdcId} onChange={e => setRdcId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">All RDCs</option>
            {rdcs.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Stock status</label>
          <div className="flex gap-1 flex-wrap">
            {[
              { key:'all',      label:'All'          },
              { key:'critical', label:'Critical ≤7d' },
              { key:'low',      label:'Low 8–30d'    },
              { key:'healthy',  label:'Healthy >30d' },
            ].map(f => (
              <button key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                  ${filter===f.key
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={fetchReport}
          className="ml-auto px-4 py-1.5 border border-gray-300 rounded-lg
                     text-sm hover:bg-gray-50">
          Refresh
        </button>
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
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total SKUs',      value: summary.total_skus || 0,
                color:'text-gray-900'  },
              { label:'Critical Stock',  value: summary.critical   || 0,
                color:'text-red-600'   },
              { label:'Total Units',     value: Number(summary.total_units||0).toLocaleString(),
                color:'text-blue-600'  },
              { label:'Inventory Value', value: formatCurrency(summary.total_value || 0),
                color:'text-green-600' },
            ].map(c => (
              <div key={c.label}
                className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4">
                Top 10 Products — Units Sold vs On Hand (30 days)
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}
                  margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="name" tick={{ fontSize:10 }} minTickGap={5} interval={0}/>
                  <YAxis tick={{ fontSize:11 }}/>
                  <Tooltip/>
                  <Bar dataKey="sold"  fill="#2563eb" radius={[4,4,0,0]} name="Sold (30d)"/>
                  <Bar dataKey="stock" fill="#e2e8f0" radius={[4,4,0,0]} name="On Hand"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center
                            justify-between">
              <h2 className="text-sm font-medium text-gray-700">
                Stock Details
                <span className="ml-2 text-gray-400 font-normal">
                  ({filtered.length} items
                  {filter !== 'all' ? ` · ${filter}` : ''})
                </span>
              </h2>
            </div>
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                {items.length === 0
                  ? 'No inventory data. Seed inventory in phpMyAdmin.'
                  : 'No items match this filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Product','SKU','RDC','On Hand','Reserved',
                        'Sold 30d','Revenue 30d','Days of Stock','Status'].map(h => (
                        <th key={h}
                          className="px-4 py-3 text-left text-xs font-medium
                                     text-gray-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((row: any, i: number) => {
                      const st = getStatus(Number(row.days_of_stock));
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs font-mono">{row.sku}</td>
                          <td className="px-4 py-3 text-gray-500 capitalize">{row.region}</td>
                          <td className="px-4 py-3 font-semibold">{row.quantity_on_hand}</td>
                          <td className="px-4 py-3 text-gray-400">{row.quantity_reserved}</td>
                          <td className="px-4 py-3 font-semibold text-blue-600">{row.sold_30d}</td>
                          <td className="px-4 py-3 text-gray-700">{formatCurrency(row.revenue_30d)}</td>
                          <td className={`px-4 py-3 font-semibold ${
                            !row.days_of_stock || row.days_of_stock == 0 ? 'text-gray-400'
                            : Number(row.days_of_stock) <= 7  ? 'text-red-600'
                            : Number(row.days_of_stock) <= 30 ? 'text-yellow-600'
                            : 'text-green-600'}`}>
                            {row.days_of_stock && row.days_of_stock > 0
                              ? `${row.days_of_stock}d` : 'No sales'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs
                                             font-medium ${statusStyle[st]}`}>
                              {st === 'no-sales' ? 'No sales' : st}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
