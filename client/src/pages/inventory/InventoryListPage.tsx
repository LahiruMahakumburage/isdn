import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function InventoryListPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [summary,   setSummary]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [rdcId,     setRdcId]     = useState('');
  const [lowStock,  setLowStock]  = useState(false);
  const [rdcs,      setRdcs]      = useState<any[]>([]);

  const fetch = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (search)  params.search    = search;
      if (rdcId)   params.rdc_id   = rdcId;
      if (lowStock) params.low_stock = 'true';
      const [invRes, sumRes, rdcRes] = await Promise.all([
        api.get('/inventory', { params }),
        api.get('/inventory/summary'),
        api.get('/rdcs'),
      ]);
      setInventory(invRes.data.data.inventory);
      setSummary(sumRes.data.data);
      setRdcs(rdcRes.data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [search, rdcId, lowStock]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Inventory</h1>

      {/* RDC Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {summary.map((r: any) => (
          <button key={r.id} onClick={() => setRdcId(String(r.id))}
            className={`bg-white border rounded-xl p-3 text-left transition hover:shadow-md
              ${rdcId===String(r.id) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}`}>
            <p className="text-xs font-medium text-gray-700 capitalize">{r.region}</p>
            <p className="text-lg font-bold text-gray-900">{r.total_units?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-400">{r.product_count} products</p>
            {r.low_stock_count > 0 && (
              <p className="text-xs text-red-500 font-medium">{r.low_stock_count} low stock</p>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Search product…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"/>
        <select value={rdcId} onChange={e => setRdcId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All RDCs</option>
          {rdcs.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={lowStock} onChange={e => setLowStock(e.target.checked)}
            className="rounded"/>
          Low stock only
        </label>
        {(rdcId||search||lowStock) && (
          <button onClick={() => { setRdcId(''); setSearch(''); setLowStock(false); }}
            className="text-xs text-blue-600 hover:underline ml-auto">Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading inventory…</div>
        ) : inventory.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No inventory records found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Product','SKU','RDC','On Hand','Reserved','Available','Reorder Level','Status'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventory.map((row: any) => {
                const isLow = row.quantity_on_hand <= row.reorder_level;
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{row.product_name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.sku}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{row.region}</td>
                    <td className="px-4 py-3 font-semibold">{row.quantity_on_hand}</td>
                    <td className="px-4 py-3 text-gray-500">{row.quantity_reserved}</td>
                    <td className={`px-4 py-3 font-semibold ${row.available<0?'text-red-600':'text-green-700'}`}>{row.available}</td>
                    <td className="px-4 py-3 text-gray-500">{row.reorder_level}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isLow ? 'Low' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
