import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function StockAdjustmentPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [rdcId,     setRdcId]     = useState('');
  const [rdcs,      setRdcs]      = useState<any[]>([]);
  const [adjusting, setAdjusting] = useState<string|null>(null);
  const [adjVal,    setAdjVal]    = useState('');
  const [reason,    setReason]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (rdcId) params.rdc_id = rdcId;
      const [invRes, rdcRes] = await Promise.all([
        api.get('/inventory', { params }),
        api.get('/rdcs'),
      ]);
      setInventory(invRes.data.data?.inventory || []);
      setRdcs(rdcRes.data.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [rdcId]);

  const handleAdjust = async (id: string) => {
    if (!adjVal || isNaN(Number(adjVal)))
      return setMsg('Enter a valid number (negative to reduce).');
    setSaving(true); setMsg('');
    try {
      await api.patch(`/inventory/${id}/adjust`, {
        adjustment: Number(adjVal), reason,
      });
      setMsg('Stock adjusted successfully.');
      setAdjusting(null); setAdjVal(''); setReason('');
      fetchAll();
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Adjustment failed.');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Stock Adjustment</h1>
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4
                      flex gap-3 items-center">
        <label className="text-sm text-gray-600 font-medium">Filter by RDC:</label>
        <select value={rdcId} onChange={e => setRdcId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All RDCs</option>
          {rdcs.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {msg && (
          <span className={`text-sm ml-auto
            ${msg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
            {msg}
          </span>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Product','SKU','RDC','On Hand','Reserved','Available','Adjust'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs
                                        font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventory.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{row.product_name}</td>
                  <td className="px-4 py-3 text-gray-500">{row.sku}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{row.region}</td>
                  <td className="px-4 py-3 font-semibold">{row.quantity_on_hand}</td>
                  <td className="px-4 py-3 text-gray-500">{row.quantity_reserved}</td>
                  <td className={`px-4 py-3 font-semibold
                    ${row.available < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {row.available}
                  </td>
                  <td className="px-4 py-3">
                    {adjusting === row.id ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={adjVal}
                          onChange={e => setAdjVal(e.target.value)}
                          placeholder="+10 or -5"
                          className="w-20 border border-gray-300 rounded px-2 py-1
                                     text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                        <input type="text" value={reason}
                          onChange={e => setReason(e.target.value)}
                          placeholder="Reason…"
                          className="w-24 border border-gray-300 rounded px-2 py-1
                                     text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"/>
                        <button onClick={() => handleAdjust(row.id)} disabled={saving}
                          className="bg-blue-600 text-white text-xs px-2 py-1 rounded
                                     hover:bg-blue-700 disabled:opacity-50">
                          {saving ? '…' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setAdjusting(null); setAdjVal(''); setReason(''); }}
                          className="text-gray-400 hover:text-gray-600 text-xs px-1">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setAdjusting(row.id)}
                        className="text-xs bg-gray-100 text-gray-600 px-2 py-1
                                   rounded hover:bg-gray-200">
                        Adjust
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
