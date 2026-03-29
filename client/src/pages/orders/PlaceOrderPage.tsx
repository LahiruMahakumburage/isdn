import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';

interface Product  { id: string; sku: string; name: string; unit_price: number; unit: string; }
interface RDC      { id: number; name: string; region: string; }
interface CartItem extends Product { quantity: number; }

// Returns the correct base path prefix for the current role
function useBasePath() {
  const location = useLocation();
  if (location.pathname.startsWith('/staff'))    return '/staff';
  if (location.pathname.startsWith('/customer')) return '/customer';
  return '';
}

export default function PlaceOrderPage() {
  const navigate                     = useNavigate();
  const base                         = useBasePath();
  const [products,   setProducts]    = useState<Product[]>([]);
  const [rdcs,       setRdcs]        = useState<RDC[]>([]);
  const [cart,       setCart]        = useState<CartItem[]>([]);
  const [rdcId,      setRdcId]       = useState('');
  const [address,    setAddress]     = useState('');
  const [notes,      setNotes]       = useState('');
  const [search,     setSearch]      = useState('');
  const [submitting, setSubmitting]  = useState(false);
  const [error,      setError]       = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/products?limit=200'),
      api.get('/rdcs'),
    ]).then(([pRes, rRes]) => {
      setProducts(pRes.data.data?.products || pRes.data.data || []);
      setRdcs(rRes.data.data || []);
    }).catch(() => {});
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i =>
        i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      );
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.id !== id));
    else setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const total    = subtotal;

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    setError('');
    if (!rdcId)            return setError('Please select a distribution centre.');
    if (!address.trim())   return setError('Please enter a delivery address.');
    if (cart.length === 0) return setError('Please add at least one product.');
    setSubmitting(true);
    try {
      const res = await api.post('/orders', {
        rdc_id:           parseInt(rdcId),
        delivery_address: address,
        notes:            notes || undefined,
        items:            cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
      });
      const { orderNumber } = res.data.data;
      alert(`Order ${orderNumber} placed successfully!`);
      navigate(`${base}/orders`);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to place order.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(`${base}/orders`)}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">Place New Order</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Product catalogue */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex gap-3 items-center">
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <span className="text-xs text-gray-400">{filtered.length} products</span>
            </div>

            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                {products.length === 0
                  ? 'No products available. Add products first.'
                  : 'No products match your search.'}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {filtered.map(p => {
                  const inCart = cart.find(i => i.id === p.id);
                  return (
                    <div key={p.id}
                      className="flex items-center justify-between px-4 py-3
                                 hover:bg-gray-50">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.sku} · {formatCurrency(p.unit_price)} per {p.unit}
                        </p>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQty(p.id, inCart.quantity - 1)}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200
                                       text-sm font-bold flex items-center justify-center">
                            −
                          </button>
                          <span className="w-8 text-center text-sm font-semibold">
                            {inCart.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(p.id, inCart.quantity + 1)}
                            className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700
                                       text-white text-sm font-bold flex items-center justify-center">
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          className="text-xs bg-blue-600 text-white px-3 py-1.5
                                     rounded-lg hover:bg-blue-700 transition">
                          + Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Order summary panel */}
        <div className="space-y-4">
          {/* RDC selector */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distribution Centre <span className="text-red-400">*</span>
            </label>
            <select
              value={rdcId}
              onChange={e => setRdcId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select RDC…</option>
              {rdcs.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.region})
                </option>
              ))}
            </select>
          </div>

          {/* Delivery address */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Address <span className="text-red-400">*</span>
            </label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Enter delivery address…"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none"/>
          </div>

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions…"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none"/>
          </div>

          {/* Cart summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Order Summary
            </h3>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No items added yet
              </p>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {cart.map(item => (
                    <div key={item.id}
                      className="flex justify-between items-center text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="ml-2 text-right">
                        <p className="font-semibold text-gray-800">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </p>
                        <button
                          onClick={() => updateQty(item.id, 0)}
                          className="text-xs text-red-400 hover:text-red-600">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex justify-between text-base font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0}
            className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm
                       font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {submitting
              ? 'Placing order…'
              : `Place Order · ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
