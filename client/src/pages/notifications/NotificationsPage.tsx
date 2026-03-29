import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import api from '../../services/api';
import { formatDateTime } from '../../utils/formatDate';

function useBasePath() {
  const path = window.location.pathname;
  if (path.startsWith('/staff'))    return '/staff';
  if (path.startsWith('/customer')) return '/customer';
  return '';
}

const TYPE_ICONS: Record<string,string> = {
  new_order:        '📦',
  order_confirmed:  '✅',
  order_delivered:  '🎉',
  low_stock:        '⚠️',
  delivery_update:  '🚚',
  payment_received: '💳',
  default:          '🔔',
};

const TYPE_LABELS: Record<string,string> = {
  new_order:        'New Order',
  order_confirmed:  'Order Confirmed',
  order_delivered:  'Order Delivered',
  low_stock:        'Low Stock',
  delivery_update:  'Delivery Update',
  payment_received: 'Payment',
};

export default function NotificationsPage() {
  const navigate             = useNavigate();
  const base                 = useBasePath();
  const [notifs,  setNotifs] = useState<any[]>([]);
  const [loading, setLoad]   = useState(true);
  const [filter,  setFilter] = useState<'all'|'unread'>('all');

  const fetchAll = async () => {
    setLoad(true);
    try {
      const res = await api.get('/notifications?limit=100');
      setNotifs(res.data.data?.notifications || []);
    } finally { setLoad(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const markRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
  };

  const deleteNotif = async (id: number) => {
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    if (!confirm('Clear all notifications?')) return;
    await api.delete('/notifications').catch(() => {});
    setNotifs([]);
  };

  const displayed = filter === 'unread'
    ? notifs.filter(n => !n.is_read)
    : notifs;

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-sm text-blue-600 border border-blue-200 px-3 py-1.5
                         rounded-lg hover:bg-blue-50 transition">
              ✓ Mark all read
            </button>
          )}
          {notifs.length > 0 && (
            <button onClick={clearAll}
              className="text-sm text-gray-500 border border-gray-300 px-3 py-1.5
                         rounded-lg hover:bg-gray-50 transition">
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all','unread'] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition
              ${filter===f
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}>
            {f === 'all' ? `All (${notifs.length})` : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">Loading…</div>
      ) : displayed.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">🔔</p>
          <p className="text-gray-500 font-medium">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Notifications will appear here as you use the system.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <div key={n.id}
              className={`bg-white border rounded-xl p-4 flex items-start gap-4
                          transition group
                          ${!n.is_read
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'}`}>
              {/* Icon */}
              <div className={`w-11 h-11 rounded-full flex items-center
                justify-center text-xl flex-shrink-0
                ${!n.is_read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {TYPE_ICONS[n.type] || TYPE_ICONS.default}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-semibold
                    ${!n.is_read ? 'text-blue-900' : 'text-gray-900'}`}>
                    {n.title}
                  </p>
                  <span className="text-xs text-gray-400 bg-gray-100
                                   px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                  {!n.is_read && (
                    <span className="w-2 h-2 bg-blue-500 rounded-full"/>
                  )}
                </div>
                {n.body && (
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    {n.body}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1.5">
                  {formatDateTime(n.created_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1 flex-shrink-0 opacity-0
                              group-hover:opacity-100 transition">
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)}
                    className="text-xs text-blue-600 hover:underline whitespace-nowrap">
                    Mark read
                  </button>
                )}
                {n.related_id && (
                  <button
                    onClick={() => {
                      if (!n.is_read) markRead(n.id);
                      if (['new_order','order_confirmed','order_delivered'].includes(n.type))
                        navigate(`${base}/orders/${n.related_id}`);
                      else if (n.type === 'low_stock')
                        navigate(`${base}/inventory`);
                    }}
                    className="text-xs text-gray-500 hover:underline whitespace-nowrap">
                    View →
                  </button>
                )}
                <button onClick={() => deleteNotif(n.id)}
                  className="text-xs text-red-400 hover:text-red-600">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
