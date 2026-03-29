import { useEffect, useState }        from 'react';
import { useParams, useNavigate,
         useLocation }                from 'react-router-dom';
import api from '../../services/api';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { useAuthStore }   from '../../store/authStore';

function useBasePath() {
  const loc = useLocation();
  if (loc.pathname.startsWith('/staff'))    return '/staff';
  if (loc.pathname.startsWith('/customer')) return '/customer';
  return '';
}

const STATUS_COLOURS: Record<string,string> = {
  draft:   'bg-gray-100 text-gray-600',
  issued:  'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void:    'bg-gray-100 text-gray-400',
};

const METHOD_LABELS: Record<string,string> = {
  cash:           '💵 Cash',
  bank_transfer:  '🏦 Bank Transfer',
  card:           '💳 Card',
  online_gateway: '🌐 Online',
};

export default function InvoiceDetailPage() {
  const { id }              = useParams<{ id: string }>();
  const navigate            = useNavigate();
  const base                = useBasePath();
  const { user }            = useAuthStore();
  const isCustomer          = user?.roles?.includes('customer');

  const [invoice, setInv]   = useState<any>(null);
  const [loading, setLoad]  = useState(true);

  // Pay modal state
  const [showPay,  setShowPay]  = useState(false);
  const [method,   setMethod]   = useState('cash');
  const [ref,      setRef]      = useState('');
  const [paying,   setPaying]   = useState(false);
  const [payError, setPayError] = useState('');

  // Void confirmation
  const [voiding, setVoiding]   = useState(false);

  const fetchInvoice = async () => {
    setLoad(true);
    try {
      const res = await api.get(`/billing/invoices/${id}`);
      setInv(res.data.data);
    } finally { setLoad(false); }
  };

  useEffect(() => { fetchInvoice(); }, [id]);

  const handlePay = async () => {
    setPayError('');
    if (!method) return setPayError('Select a payment method.');
    if ((method === 'bank_transfer' || method === 'card') && !ref.trim())
      return setPayError('Please enter a reference number.');
    setPaying(true);
    try {
      await api.post(`/billing/invoices/${id}/pay`, {
        amount:      invoice.total_amount,
        method,
        gateway_ref: ref || undefined,
      });
      setShowPay(false);
      fetchInvoice();
    } catch (e: any) {
      setPayError(e.response?.data?.message || 'Payment failed.');
    } finally { setPaying(false); }
  };

  const handleVoid = async () => {
    if (!confirm('Void this invoice? This cannot be undone.')) return;
    setVoiding(true);
    try {
      await api.post(`/billing/invoices/${id}/void`);
      fetchInvoice();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to void');
    } finally { setVoiding(false); }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading…</div>;
  if (!invoice) return <div className="p-8 text-center text-gray-500">Invoice not found.</div>;

  const canPay  = ['issued','overdue'].includes(invoice.status);
  const canVoid = invoice.status !== 'paid' && invoice.status !== 'void'
                  && !isCustomer;

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate(`${base}/billing`)}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← Invoices
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">
          {invoice.invoice_number}
        </h1>
        <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${STATUS_COLOURS[invoice.status]}`}>
          {invoice.status}
        </span>
        <div className="ml-auto flex gap-2">
          {canPay && (
            <button onClick={() => setShowPay(true)}
              className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm
                         font-semibold hover:bg-green-700 transition flex items-center gap-2">
              <span>💳</span> Pay Now
            </button>
          )}
          {canVoid && (
            <button onClick={handleVoid} disabled={voiding}
              className="border border-gray-300 text-gray-600 px-4 py-2
                         rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
              {voiding ? 'Voiding…' : 'Void Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Paid success banner */}
      {invoice.status === 'paid' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6
                        flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="text-green-800 font-semibold">Payment Received</p>
            <p className="text-green-600 text-sm">
              Paid {invoice.paid_at ? formatDateTime(invoice.paid_at) : ''}
            </p>
          </div>
          <p className="ml-auto text-green-800 text-xl font-bold">
            {formatCurrency(invoice.total_amount)}
          </p>
        </div>
      )}

      {/* Overdue warning */}
      {invoice.status === 'overdue' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6
                        flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-red-700 font-semibold">Payment Overdue</p>
            <p className="text-red-600 text-sm">
              Due date was {invoice.due_date ? formatDate(invoice.due_date) : ''}
            </p>
          </div>
          <p className="ml-auto text-red-700 text-xl font-bold">
            {formatCurrency(invoice.total_amount)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left — items + payments */}
        <div className="xl:col-span-2 space-y-5">

          {/* Items */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-700">
                Items — {invoice.order_number}
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Product','SKU','Qty','Unit Price','Total'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs
                                           font-medium text-gray-500 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {item.product_name}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">
                      {item.sku}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4}
                    className="px-4 py-3 text-right font-bold text-gray-800">
                    Total Amount Due
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900 text-base">
                    {formatCurrency(invoice.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payment history */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-700">
                Payment History
              </h2>
            </div>
            {!invoice.payments?.length ? (
              <p className="p-6 text-center text-gray-400 text-sm">
                No payments recorded yet
              </p>
            ) : (
              <div className="divide-y divide-gray-100">
                {invoice.payments.map((p: any) => (
                  <div key={p.id} className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center
                          justify-center text-sm
                          ${p.status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                          {p.status === 'success' ? '✅' : '❌'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {METHOD_LABELS[p.method] || p.method}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatDateTime(p.paid_at || p.created_at)}
                            {p.recorded_by_name && ` · by ${p.recorded_by_name}`}
                          </p>
                          {p.gateway_ref && (
                            <p className="text-xs text-gray-400 font-mono">
                              Ref: {p.gateway_ref}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold
                          ${p.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(p.amount)}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full
                          ${p.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'}`}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — invoice info */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              Invoice Details
            </h2>
            <div className="space-y-2 text-sm">
              {[
                ['Invoice #',  invoice.invoice_number],
                ['Status',     invoice.status],
                ['Issued',     invoice.issued_at ? formatDate(invoice.issued_at) : '—'],
                ['Due Date',   invoice.due_date  ? formatDate(invoice.due_date)  : '—'],
                ['Paid On',    invoice.paid_at   ? formatDate(invoice.paid_at)   : '—'],
                ['RDC',        invoice.rdc_name],
              ].map(([k,v]) => (
                <div key={String(k)} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className={`font-medium text-right
                    ${k==='Status' ? (STATUS_COLOURS[String(v)]?.replace('bg-','text-').replace('100','700') || '') : 'text-gray-800'}`}>
                    {v || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Customer</h2>
            <p className="font-semibold text-gray-800">{invoice.customer_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{invoice.customer_email}</p>
            {invoice.customer_phone && (
              <a href={`tel:${invoice.customer_phone}`}
                className="text-sm text-blue-600 hover:underline block mt-1">
                {invoice.customer_phone}
              </a>
            )}
          </div>

          {/* Amount summary */}
          <div className={`rounded-xl p-4 border
            ${canPay
              ? 'bg-amber-50 border-amber-200'
              : invoice.status === 'paid'
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-xs text-gray-500 mb-1">Amount</p>
            <p className={`text-3xl font-bold
              ${canPay ? 'text-amber-700'
                : invoice.status === 'paid' ? 'text-green-700'
                : 'text-gray-700'}`}>
              {formatCurrency(invoice.total_amount)}
            </p>
            {canPay && (
              <button onClick={() => setShowPay(true)}
                className="w-full mt-3 bg-green-600 text-white py-2.5
                           rounded-lg text-sm font-semibold hover:bg-green-700 transition">
                💳 Pay Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Pay Modal ── */}
      {showPay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center
                        justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => { setShowPay(false); setPayError(''); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            {/* Amount */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Amount to Pay</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(invoice.total_amount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {invoice.invoice_number}
              </p>
            </div>

            {/* Payment method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key:'cash',           icon:'💵', label:'Cash'          },
                  { key:'bank_transfer',  icon:'🏦', label:'Bank Transfer' },
                  { key:'card',           icon:'💳', label:'Card'          },
                  { key:'online_gateway', icon:'🌐', label:'Online'        },
                ].map(m => (
                  <button key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl
                      border-2 text-sm font-medium transition
                      ${method === m.key
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <span className="text-lg">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference number */}
            {(method === 'bank_transfer' || method === 'card' || method === 'online_gateway') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference / Transaction #
                  {method === 'cash' ? ' (optional)' : ' *'}
                </label>
                <input
                  type="text"
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  placeholder={
                    method === 'bank_transfer' ? 'Bank ref number…'
                    : method === 'card'        ? 'Card approval code…'
                    : 'Transaction ID…'
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5
                             text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            )}

            {payError && (
              <div className="mb-4 bg-red-50 border border-red-200
                              rounded-lg px-3 py-2.5">
                <p className="text-red-600 text-sm">{payError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handlePay} disabled={paying}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl
                           text-sm font-bold hover:bg-green-700
                           disabled:opacity-50 transition">
                {paying ? 'Processing…' : `✅ Confirm Payment · ${formatCurrency(invoice.total_amount)}`}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">
              This will mark the invoice as paid immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
