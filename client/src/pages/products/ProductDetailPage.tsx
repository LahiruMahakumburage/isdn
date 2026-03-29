import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

export default function ProductDetailPage() {
  const { id }              = useParams<{ id: string }>();
  const navigate            = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/products/${id}`)
      .then(r => setProduct(r.data.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading…</div>
  );
  if (!product) return (
    <div className="p-8 text-center text-gray-500">Product not found.</div>
  );

  const totalStock  = product.stock?.reduce(
    (s: number, r: any) => s + r.quantity_on_hand, 0) ?? 0;
  const totalAvail  = product.stock?.reduce(
    (s: number, r: any) => s + r.available, 0) ?? 0;
  const isLow       = totalStock <= product.reorder_level;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/products')}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← Products
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
        <span className="font-mono text-sm text-gray-400 bg-gray-100
                         px-2 py-0.5 rounded">
          {product.sku}
        </span>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${product.is_active
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'}`}>
          {product.is_active ? 'Active' : 'Inactive'}
        </span>
        <button onClick={() => navigate(`/products/${id}/edit`)}
          className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg
                     text-sm font-medium hover:bg-blue-700 transition">
          Edit Product
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Unit Price',     value: formatCurrency(product.unit_price), color: 'text-gray-900' },
          { label: 'Total Stock',    value: totalStock,   color: isLow ? 'text-red-600' : 'text-green-600' },
          { label: 'Available',      value: totalAvail,   color: 'text-blue-600' },
          { label: 'Sold (30 days)', value: product.sales?.sold_30d ?? 0, color: 'text-purple-600' },
        ].map(c => (
          <div key={c.label}
            className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        {/* Product info */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Details</h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Category',      product.category_name],
              ['Unit',          product.unit],
              ['Unit Price',    formatCurrency(product.unit_price)],
              ['Reorder Level', `${product.reorder_level} units`],
              ['Revenue (30d)', formatCurrency(product.sales?.revenue_30d ?? 0)],
              ['Orders (30d)',  product.sales?.order_count_30d ?? 0],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between">
                <dt className="text-gray-500">{k}</dt>
                <dd className="font-medium text-gray-800">{v}</dd>
              </div>
            ))}
          </dl>
          {isLow && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-red-600 text-xs font-medium">
                ⚠ Stock below reorder level ({product.reorder_level})
              </p>
            </div>
          )}
        </div>

        {/* Stock chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Stock by RDC
          </h2>
          {!product.stock || product.stock.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">
              No stock records
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={product.stock}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="rdc_name" tick={{ fontSize: 11 }}
                  tickFormatter={v => v.replace(' RDC', '')}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Bar dataKey="quantity_on_hand" fill="#2563eb"
                  radius={[4,4,0,0]} name="On Hand"/>
                <Bar dataKey="available" fill="#16a34a"
                  radius={[4,4,0,0]} name="Available"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Stock table per RDC */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">
            Inventory per RDC
          </h2>
        </div>
        {!product.stock || product.stock.length === 0 ? (
          <p className="p-6 text-center text-gray-400 text-sm">
            No inventory records
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['RDC','Region','On Hand','Reserved','Available','Status'].map(h => (
                  <th key={h}
                    className="px-4 py-2 text-left text-xs font-medium
                               text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {product.stock.map((row: any) => {
                const low = row.quantity_on_hand <= product.reorder_level;
                return (
                  <tr key={row.rdc_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {row.rdc_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">
                      {row.region}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {row.quantity_on_hand}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.quantity_reserved}
                    </td>
                    <td className={`px-4 py-3 font-semibold
                      ${row.available < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {row.available}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${low
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'}`}>
                        {low ? 'Low Stock' : 'OK'}
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
