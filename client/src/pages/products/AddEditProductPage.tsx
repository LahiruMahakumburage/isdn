import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';

interface Category { id: number; name: string; }

const UNITS = [
  'piece','carton','box','kg','g','litre','ml',
  'bag','packet','bottle','can','dozen','pair',
];

export default function AddEditProductPage() {
  const { id }            = useParams<{ id?: string }>();
  const navigate          = useNavigate();
  const isEdit            = Boolean(id);

  const [categories, setCats]     = useState<Category[]>([]);
  const [loading,    setLoading]  = useState(isEdit);
  const [saving,     setSaving]   = useState(false);
  const [error,      setError]    = useState('');

  const [form, setForm] = useState({
    sku:           '',
    name:          '',
    category_id:   '',
    unit:          'carton',
    unit_price:    '',
    reorder_level: '0',
    is_active:     true,
  });

  /* Load categories + existing product (edit mode) */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes] = await Promise.all([
          api.get('/products/categories'),
        ]);
        setCats(catRes.data.data || []);

        if (isEdit && id) {
          const pRes = await api.get(`/products/${id}`);
          const p    = pRes.data.data;
          setForm({
            sku:           p.sku,
            name:          p.name,
            category_id:   String(p.category_id),
            unit:          p.unit,
            unit_price:    String(p.unit_price),
            reorder_level: String(p.reorder_level),
            is_active:     Boolean(p.is_active),
          });
        }
      } finally { setLoading(false); }
    };
    fetchData();
  }, [id]);

  const set = (k: string, v: any) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setError('');
    if (!form.sku.trim())        return setError('SKU is required.');
    if (!form.name.trim())       return setError('Product name is required.');
    if (!form.category_id)       return setError('Category is required.');
    if (!form.unit_price ||
        isNaN(Number(form.unit_price)) ||
        Number(form.unit_price) <= 0)
      return setError('Enter a valid unit price.');

    setSaving(true);
    try {
      const payload = {
        sku:           form.sku.trim().toUpperCase(),
        name:          form.name.trim(),
        category_id:   Number(form.category_id),
        unit:          form.unit,
        unit_price:    Number(form.unit_price),
        reorder_level: Number(form.reorder_level) || 0,
        is_active:     form.is_active ? 1 : 0,
      };

      if (isEdit && id) {
        await api.patch(`/products/${id}`, payload);
        navigate(`/products/${id}`);
      } else {
        const res = await api.post('/products', payload);
        navigate(`/products/${res.data.data.id}`);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed.');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="p-8 text-center text-gray-400">Loading…</div>
  );

  const preview = Number(form.unit_price) > 0
    ? formatCurrency(Number(form.unit_price)) : null;

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(isEdit ? `/products/${id}` : '/products')}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← {isEdit ? 'Product' : 'Products'}
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isEdit ? 'Edit Product' : 'Add New Product'}
        </h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

        {/* SKU + Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              SKU <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.sku}
              onChange={e => set('sku', e.target.value.toUpperCase())}
              disabled={isEdit}
              placeholder="e.g. BEV-001"
              className={`w-full border rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${isEdit
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-gray-300'}`}
            />
            {isEdit && (
              <p className="text-xs text-gray-400 mt-1">SKU cannot be changed</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Product Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Mineral Water 500ml 24pk"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Category <span className="text-red-400">*</span>
          </label>
          <select
            value={form.category_id}
            onChange={e => set('category_id', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select category…</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Unit + Unit Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Unit of Measure
            </label>
            <select
              value={form.unit}
              onChange={e => set('unit', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500">
              {UNITS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Unit Price (LKR) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2
                               text-sm text-gray-400">
                LKR
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={e => set('unit_price', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg pl-12 pr-3 py-2
                           text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {preview && (
              <p className="text-xs text-green-600 mt-1">= {preview}</p>
            )}
          </div>
        </div>

        {/* Reorder Level */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reorder Level (units)
            </label>
            <input
              type="number"
              min="0"
              value={form.reorder_level}
              onChange={e => set('reorder_level', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Alert when stock falls to or below this level
            </p>
          </div>
          {isEdit && (
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => set('is_active', !form.is_active)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors
                    ${form.is_active ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow
                    transition-transform
                    ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`}/>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {form.is_active ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {form.is_active
                      ? 'Visible in catalogue'
                      : 'Hidden from catalogue'}
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm
                       font-medium hover:bg-blue-700 disabled:opacity-50 transition">
            {saving
              ? (isEdit ? 'Saving…' : 'Creating…')
              : (isEdit ? 'Save Changes' : 'Create Product')}
          </button>
          <button
            onClick={() => navigate(isEdit ? `/products/${id}` : '/products')}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm
                       hover:bg-gray-50 transition">
            Cancel
          </button>
          {isEdit && (
            <button
              onClick={() => navigate(`/products/${id}`)}
              className="ml-auto text-sm text-gray-400 hover:text-gray-600">
              View product →
            </button>
          )}
        </div>
      </div>

      {/* Helper note for new products */}
      {!isEdit && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-blue-700 text-xs font-medium">
            After creating a product, inventory rows are automatically created
            for all 5 RDCs with 0 stock. Use Stock Adjustment to set initial quantities.
          </p>
        </div>
      )}
    </div>
  );
}
