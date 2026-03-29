import { useEffect, useState } from 'react';
import api from '../../services/api';
import { exportDeliveryEfficiency } from '../../utils/exportCsv';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function DeliveryEfficiencyPage() {
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [exporting, setExporting] = useState(false);
  const [from,      setFrom]      = useState(
    () => new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  );
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/reports/delivery-efficiency',
        { params: { from, to } });
      setData(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load report');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [from, to]);

  const getRateColor = (rate: number) =>
    rate >= 90 ? 'text-green-600' : rate >= 70 ? 'text-yellow-600' : 'text-red-600';
  const getRateBarColor = (rate: number) =>
    rate >= 90 ? 'bg-green-500' : rate >= 70 ? 'bg-yellow-500' : 'bg-red-500';

  const byRdc:    any[] = data?.byRdc    || [];
  const byDriver: any[] = data?.byDriver || [];
  const totals:   any   = data?.totals   || {};

  const handleExport = () => {
    if (!data) return;
    setExporting(true);
    try { exportDeliveryEfficiency(data, from, to); }
    finally { setTimeout(() => setExporting(false), 800); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Delivery Efficiency
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            On-time delivery rates and driver performance
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Total',        value: totals.total     || 0,   color:'text-gray-900'  },
              { label:'Delivered',    value: totals.delivered || 0,   color:'text-green-600' },
              { label:'Failed',       value: totals.failed    || 0,   color:'text-red-600'   },
              { label:'Success Rate', value: `${totals.success_rate||0}%`,
                color: getRateColor(totals.success_rate||0) },
            ].map(c => (
              <div key={c.label}
                className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {byRdc.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12
                            text-center text-gray-400">
              No delivery data for this period.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h2 className="text-sm font-medium text-gray-700 mb-4">
                    Deliveries by RDC
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={byRdc}
                      margin={{ top:5, right:10, left:0, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="rdc_name" tick={{ fontSize:11 }}
                        tickFormatter={v => v.replace(' RDC','')}/>
                      <YAxis tick={{ fontSize:11 }}/>
                      <Tooltip/><Legend/>
                      <Bar dataKey="delivered" fill="#16a34a" radius={[4,4,0,0]} name="Delivered"/>
                      <Bar dataKey="failed"    fill="#dc2626" radius={[4,4,0,0]} name="Failed"/>
                      <Bar dataKey="pending"   fill="#d97706" radius={[4,4,0,0]} name="Pending"/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h2 className="text-sm font-medium text-gray-700 mb-4">
                    Success Rate by RDC
                  </h2>
                  <div className="space-y-4">
                    {byRdc.map((r: any) => (
                      <div key={r.rdc_name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-gray-700">
                            {r.rdc_name}
                          </span>
                          <span className={`text-sm font-bold
                            ${getRateColor(r.success_rate||0)}`}>
                            {r.success_rate||0}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full
                            ${getRateBarColor(r.success_rate||0)}`}
                            style={{ width:`${Math.min(r.success_rate||0,100)}%` }}/>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.delivered} delivered · {r.failed} failed
                          {r.avg_hours ? ` · avg ${r.avg_hours}h` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-medium text-gray-700">
                    RDC Performance
                  </h2>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['RDC','Region','Total','Delivered','Failed',
                        'Pending','Success Rate','Avg Hours'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs
                                               font-medium text-gray-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {byRdc.map((r: any) => (
                      <tr key={r.rdc_name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.rdc_name}</td>
                        <td className="px-4 py-3 text-gray-500 capitalize">{r.region}</td>
                        <td className="px-4 py-3 font-semibold">{r.total_deliveries}</td>
                        <td className="px-4 py-3 text-green-600 font-semibold">{r.delivered}</td>
                        <td className="px-4 py-3 text-red-600">{r.failed}</td>
                        <td className="px-4 py-3 text-amber-600">{r.pending}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full
                                ${getRateBarColor(r.success_rate||0)}`}
                                style={{ width:`${Math.min(r.success_rate||0,100)}%` }}/>
                            </div>
                            <span className={`font-semibold text-xs
                              ${getRateColor(r.success_rate||0)}`}>
                              {r.success_rate||0}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {r.avg_hours ? `${r.avg_hours}h` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {byDriver.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-700">
                      Driver Performance
                    </h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {['#','Driver','Phone','Total','Delivered',
                          'Failed','Success Rate'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs
                                                 font-medium text-gray-500 uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {byDriver.map((d: any, i: number) => (
                        <tr key={d.driver_name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{d.driver_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{d.phone||'—'}</td>
                          <td className="px-4 py-3 font-semibold">{d.total}</td>
                          <td className="px-4 py-3 text-green-600 font-semibold">{d.delivered}</td>
                          <td className="px-4 py-3 text-red-600">{d.failed}</td>
                          <td className="px-4 py-3">
                            <span className={`font-bold
                              ${getRateColor(d.success_rate||0)}`}>
                              {d.success_rate||0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
