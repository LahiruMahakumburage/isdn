import { useEffect, useState } from 'react';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';

interface RDC     { id: number; name: string; region: string; }
interface Product { id: string; name: string; sku: string; unit: string; }

export default function StockTransferPage() {
  const [rdcs,      setRdcs]     = useState<RDC[]>([]);
  const [products,  setProducts] = useState<Product[]>([]);
  const [transfers, setTransfers]= useState<any[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [submitting,setSubmit]   = useState(false);
  const [error,     setError]    = useState('');
  const [success,   setSuccess]  = useState('');
  const [form, setForm] = useState({
    from_rdc_id:'', to_rdc_id:'', product_id:'', quantity:'', notes:''
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rdcRes, pRes, tRes] = await Promise.all([
        api.get('/rdcs'),
        api.get('/products?limit=100'),
        api.get('/inventory/transfers'),
      ]);
      setRdcs(rdcRes.data.data || []);
      setProducts(pRes.data.data?.products || []);
      setTransfers(tRes.data.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    const { from_rdc_id, to_rdc_id, product_id, quantity } = form;
    if (!from_rdc_id || !to_rdc_id || !product_id || !quantity)
      return setError('All fields except notes are required.');
    if (from_rdc_id === to_rdc_id)
      return setError('Source and destination RDC cannot be the same.');
    setSubmit(true);
    try {
      await api.post('/inventory/transfers', {
        from_rdc_id: Number(from_rdc_id),
        to_rdc_id:   Number(to_rdc_id),
        product_id,
        quantity:    Number(quantity),
        notes:       form.notes || undefined,
      });
      setSuccess('Transfer completed successfully!');
      setForm({ from_rdc_id:'', to_rdc_id:'', product_id:'', quantity:'', notes:'' });
      fetchAll();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Transfer failed.');
    } finally { setSubmit(false); }
  };

  const STATUS_COLOURS: Record<string,string> = {
    pending:   'bg-yellow-100 text-yellow-700',
    in_transit:'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Stock Transfer</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-gray-700">New Transfer</h2>
          {[
            { label:'From RDC', key:'from_rdc_id', opts: rdcs, placeholder:'Select source…' },
            { label:'To RDC',   key:'to_rdc_id',   opts: rdcs.filter(r=>String(r.id)!==form.from_rdc_id), placeholder:'Select destination…' },
          ].map(({ label, key, opts, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              <select value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">{placeholder}</option>
                {opts.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product</label>
            <select value={form.product_id}
              onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select product…</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input type="number" min="1" value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
            <input type="text" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          {error   && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-green-600 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">{success}</p>}
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm
                       font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {submitting ? 'Processing…' : 'Execute Transfer'}
          </button>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-medium text-gray-700">Transfer History</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading…</div>
          ) : transfers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No transfers yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Product','From','To','Qty','Status','By','Date'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs
                                             font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transfers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{t.product_name}</td>
                      <td className="px-4 py-3 text-gray-500">{t.from_rdc_name}</td>
                      <td className="px-4 py-3 text-gray-500">{t.to_rdc_name}</td>
                      <td className="px-4 py-3 font-semibold">{t.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${STATUS_COLOURS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.initiated_by_name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {formatDateTime(t.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
