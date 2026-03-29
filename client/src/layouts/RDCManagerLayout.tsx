import { Outlet } from 'react-router-dom';
export default function RDCManagerLayout() {
  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-900 text-white p-4">
        <h2 className="text-lg font-semibold mb-6">ISDN — RDCManager</h2>
        {/* TODO: Navigation links */}
      </aside>
      <main className="flex-1 bg-gray-50 p-6"><Outlet /></main>
    </div>
  );
}
