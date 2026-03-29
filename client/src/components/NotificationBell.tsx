import { useEffect, useState, useRef } from 'react';
import { useNavigate }                 from 'react-router-dom';
import api from '../services/api';
import { formatDateTime } from '../utils/formatDate';

const TYPE_ICONS: Record<string,string> = {
  new_order:        '📦',
  order_confirmed:  '✅',
  order_delivered:  '🎉',
  low_stock:        '⚠️',
  delivery_update:  '🚚',
  payment_received: '💳',
  default:          '🔔',
};

function useBasePath() {
  const path = window.location.pathname;
  if (path.startsWith('/staff'))    return '/staff';
  if (path.startsWith('/customer')) return '/customer';
  return '';
}

export default function NotificationBell() {
  const navigate                      = useNavigate();
  const base                          = useBasePath();
  const [open,    setOpen]            = useState(false);
  const [notifs,  setNotifs]          = useState<any[]>([]);
  const [unread,  setUnread]          = useState(0);
  const [loading, setLoading]         = useState(false);
  const dropdownRef                   = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    try {
      const res = await api.get('/notifications?limit=20');
      const data = res.data.data;
      setNotifs(data?.notifications || []);
      setUnread(data?.unread_count  || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    await api.patch('/notifications/read-all').catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnread(0);
    setLoading(false);
  };

  const deleteNotif = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    setLoading(true);
    await api.delete('/notifications').catch(() => {});
    setNotifs([]); setUnread(0);
    setLoading(false);
  };

  const handleClick = (n: any) => {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    if (['new_order','order_confirmed','order_delivered'].includes(n.type))
      navigate(n.related_id ? `${base}/orders/${n.related_id}` : `${base}/orders`);
    else if (n.type === 'low_stock')
      navigate(`${base}/inventory`);
    else if (n.type === 'payment_received')
      navigate(`${base}/billing`);
  };

  return (
    <div className="relative" ref={dropdownRef}>

      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white
                   hover:bg-gray-700 transition">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px]
                           bg-red-500 text-white text-[10px] rounded-full
                           flex items-center justify-center font-bold px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown — positioned to the RIGHT of the bell, outside the sidebar */}
      {open && (
        <div
          className="fixed z-[9999] bg-white rounded-2xl shadow-2xl
                     border border-gray-200 overflow-hidden"
          style={{ width: 340, top: (() => {
            const el = dropdownRef.current;
            if (!el) return 60;
            const rect = el.getBoundingClientRect();
            return rect.bottom + 8;
          })(), left: (() => {
            const el = dropdownRef.current;
            if (!el) return 224;
            const rect = el.getBoundingClientRect();
            // Open to the right of the sidebar (always start at sidebar width + gap)
            return Math.max(rect.right + 8, 232);
          })() }}>

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50
                          flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🔔</span>
              <h3 className="text-sm font-semibold text-gray-900">
                Notifications
              </h3>
              {unread > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold
                                 px-2 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} disabled={loading}
                  className="text-xs text-blue-600 hover:underline">
                  Mark all read
                </button>
              )}
              {notifs.length > 0 && (
                <button onClick={clearAll} disabled={loading}
                  className="text-xs text-gray-400 hover:text-red-500">
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
            {notifs.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-sm text-gray-400 font-medium">
                  No notifications yet
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  You're all caught up!
                </p>
              </div>
            ) : (
              notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`px-4 py-3 flex items-start gap-3 cursor-pointer
                    hover:bg-gray-50 transition-colors group
                    ${!n.is_read ? 'bg-blue-50 hover:bg-blue-100' : ''}`}>

                  {/* Icon circle */}
                  <div className={`w-9 h-9 rounded-full flex items-center
                    justify-center text-base flex-shrink-0 mt-0.5
                    ${!n.is_read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug
                      ${!n.is_read
                        ? 'font-semibold text-blue-900'
                        : 'font-medium text-gray-800'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed
                                    line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDateTime(n.created_at)}
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full"/>
                    )}
                    <button
                      onClick={e => deleteNotif(n.id, e)}
                      className="text-gray-300 hover:text-red-400 transition
                                 opacity-0 group-hover:opacity-100 text-xs leading-none">
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50
                          text-center">
            <button
              onClick={() => { setOpen(false); navigate(`${base}/notifications`); }}
              className="text-xs text-blue-600 hover:underline font-medium">
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
