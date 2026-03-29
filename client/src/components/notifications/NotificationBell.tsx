export default function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <button className="relative p-2">
      <span className="sr-only">Notifications</span>
      {count > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{count}</span>}
    </button>
  );
}
