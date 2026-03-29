import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';

export default function ProductListPage() {
  const navigate                  = useNavigate();
  const [products,  setProducts]  = useState<any[]>([]);
  const [categories,setCats]      = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [catId,     setCatId]     = useState('');
  const [showAll,   setShowAll]   = useState(false);
  const [page,      setPage]      = useState(1);
  const [total,     setTotal]     = useState(0);
  const limit = 20;

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (search)  params.search   = search;
      if (catId)   params.category = catId;
      if (showAll) params.active   = 'false';
      const [pRes, cRes] = await Promise.all([
        api.get('/products', { params }),
        api.get('/products/categories'),
      ]);
      setProducts(pRes.data.data?.products || []);
      setTotal(pRes.data.data?.total || 0);
      setCats(cRes.data.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [page, search, catId, showAll]);

  const deactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"?`)) return;
    await api.delete(`/products/${id}`);
    fetchProducts();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <button
          onClick={() => navigate('/products/new')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm
                     font-medium hover:bg-blue-700 transition">
          + Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4
                      flex flex-wrap gap-3 items-center">
        <input
          type="text" placeholder="Search name or SKU…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"/>
        <select value={catId}
          onChange={e => { setCatId(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All categories</option>
          {categories.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.product_count})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showAll}
            onChange={e => { setShowAll(e.target.checked); setPage(1); }}
            className="rounded"/>
          Show inactive
        </label>
        <span className="text-sm text-gray-400 ml-auto">{total} products</span>
      </div>

      {/* Category summary pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setCatId('')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition
              ${!catId
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
            All
          </button>
          {categories.map((c: any) => (
            <button key={c.id}
              onClick={() => setCatId(String(c.id))}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition
                ${catId === String(c.id)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {c.name} · {c.product_count}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading products…</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No products found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['SKU','Name','Category','Unit','Unit Price',
                  'Reorder Level','Status','Actions'].map(h => (
                  <th key={h}
                    className="px-4 py-3 text-left text-xs font-medium
                               text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {p.sku}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.category_name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {formatCurrency(p.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.reorder_level}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${p.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/products/${p.id}`)}
                        className="text-xs text-blue-600 hover:underline font-medium">
                        View
                      </button>
                      <button
                        onClick={() => navigate(`/products/${p.id}/edit`)}
                        className="text-xs text-gray-500 hover:underline">
                        Edit
                      </button>
                      {p.is_active && (
                        <button
                          onClick={() => deactivate(p.id, p.name)}
                          className="text-xs text-red-400 hover:underline">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200
                          flex items-center justify-between">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg
                         disabled:opacity-40 hover:bg-gray-50">
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg
                         disabled:opacity-40 hover:bg-gray-50">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
