import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore }          from '../store/authStore';
import AuthLayout                from '../layouts/AuthLayout';
import AdminLayout               from '../layouts/AdminLayout';
import StaffLayout               from '../layouts/StaffLayout';
import CustomerLayout            from '../layouts/CustomerLayout';

import LoginPage                 from '../pages/auth/LoginPage';
import AdminDashboard            from '../pages/dashboard/AdminDashboard';
import RDCDashboard              from '../pages/dashboard/RDCDashboard';
import CustomerDashboard         from '../pages/dashboard/CustomerDashboard';
import StaffDashboard            from '../pages/dashboard/StaffDashboard';

import OrderListPage             from '../pages/orders/OrderListPage';
import OrderDetailPage           from '../pages/orders/OrderDetailPage';
import PlaceOrderPage            from '../pages/orders/PlaceOrderPage';
import OrderTrackingPage         from '../pages/orders/OrderTrackingPage';

import ProductListPage           from '../pages/products/ProductListPage';
import ProductDetailPage         from '../pages/products/ProductDetailPage';
import AddEditProductPage        from '../pages/products/AddEditProductPage';

import InventoryListPage         from '../pages/inventory/InventoryListPage';
import StockTransferPage         from '../pages/inventory/StockTransferPage';
import StockAdjustmentPage       from '../pages/inventory/StockAdjustmentPage';

import DeliverySchedulePage      from '../pages/delivery/DeliverySchedulePage';
import GPSTrackingPage           from '../pages/delivery/GPSTrackingPage';
import RouteManagementPage       from '../pages/delivery/RouteManagementPage';
import DeliveryRoutesPage        from '../pages/delivery/DeliveryRoutesPage';
import RoutePlannerPage          from '../pages/delivery/RoutePlannerPage';

import InvoiceListPage           from '../pages/billing/InvoiceListPage';
import InvoiceDetailPage         from '../pages/billing/InvoiceDetailPage';
import PaymentsPage              from '../pages/billing/PaymentsPage';

import ReportsHub               from '../pages/reports/ReportsHub';
import SalesReportPage           from '../pages/reports/SalesReportPage';
import SalesDetailPage          from '../pages/reports/SalesDetailPage';
import CustomerReportPage       from '../pages/reports/CustomerReportPage';
import StockTurnoverPage         from '../pages/reports/StockTurnoverPage';
import DeliveryEfficiencyPage    from '../pages/reports/DeliveryEfficiencyPage';

import UserListPage              from '../pages/users/UserListPage';
import UserDetailPage            from '../pages/users/UserDetailPage';
import NotificationsPage         from '../pages/notifications/NotificationsPage';

// ── Role-aware redirect ───────────────────────────────────
function HomeRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  const roles = user.roles || [];
  if (roles.includes('super_admin'))        return <Navigate to="/admin/dashboard" replace />;
  if (roles.includes('rdc_manager'))        return <Navigate to="/staff/dashboard" replace />;
  if (roles.includes('rdc_staff'))          return <Navigate to="/staff/dashboard" replace />;
  if (roles.includes('logistics_officer'))  return <Navigate to="/staff/dashboard" replace />;
  if (roles.includes('customer'))           return <Navigate to="/customer/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

// ── Route guard ────────────────────────────────────────────
function Guard({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.some(r => (user.roles || []).includes(r)))
    return <Navigate to="/unauthorized" replace />;
  return children;
}

const ADMIN = ['super_admin'];
const STAFF = ['super_admin','rdc_manager','rdc_staff','logistics_officer'];

export default function AppRoutes() {
  return (
    <Routes>

      {/* ── Auth ──────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* ── Admin-only pages ──────────────────────── */}
      <Route element={<Guard roles={ADMIN}><AdminLayout /></Guard>}>
        <Route path="/admin/dashboard"       element={<AdminDashboard />} />
        <Route path="/orders"                element={<OrderListPage />} />
        <Route path="/orders/new"            element={<PlaceOrderPage />} />
        <Route path="/orders/:id"            element={<OrderDetailPage />} />
        <Route path="/products"              element={<ProductListPage />} />
        <Route path="/products/new"          element={<AddEditProductPage />} />
        <Route path="/products/:id"          element={<ProductDetailPage />} />
        <Route path="/products/:id/edit"     element={<AddEditProductPage />} />
        <Route path="/inventory"             element={<InventoryListPage />} />
        <Route path="/inventory/transfer"    element={<StockTransferPage />} />
        <Route path="/inventory/adjust"      element={<StockAdjustmentPage />} />
        <Route path="/delivery"              element={<DeliverySchedulePage />} />
        <Route path="/delivery/routes"       element={<DeliveryRoutesPage />} />
        <Route path="/delivery/planner"      element={<RoutePlannerPage />} />
        <Route path="/delivery/:id/track"    element={<GPSTrackingPage />} />
        <Route path="/billing"               element={<InvoiceListPage />} />
        <Route path="/billing/payments"      element={<PaymentsPage />} />
        <Route path="/billing/:id"           element={<InvoiceDetailPage />} />
        <Route path="/reports"               element={<ReportsHub />} />
        <Route path="/reports/sales"         element={<SalesDetailPage />} />
        <Route path="/reports/customers"     element={<CustomerReportPage />} />
        <Route path="/reports/turnover"      element={<StockTurnoverPage />} />
        <Route path="/reports/delivery"      element={<DeliveryEfficiencyPage />} />
        <Route path="/users"                 element={<UserListPage />} />
        <Route path="/users/:id"             element={<UserDetailPage />} />
        <Route path="/notifications"         element={<NotificationsPage />} />
      </Route>

      {/* ── Staff pages (all staff roles incl. rdc_manager) ── */}
      <Route element={<Guard roles={STAFF}><StaffLayout /></Guard>}>
        <Route path="/staff/dashboard"               element={<StaffDashboard />} />

        {/* Orders */}
        <Route path="/staff/orders"                  element={<OrderListPage />} />
        <Route path="/staff/orders/new"              element={<PlaceOrderPage />} />
        <Route path="/staff/orders/:id"              element={<OrderDetailPage />} />

        {/* Inventory */}
        <Route path="/staff/inventory"               element={<InventoryListPage />} />
        <Route path="/staff/inventory/transfer"      element={<StockTransferPage />} />
        <Route path="/staff/inventory/adjust"        element={<StockAdjustmentPage />} />

        {/* Delivery */}
        <Route path="/staff/delivery"                element={<DeliverySchedulePage />} />
        <Route path="/staff/delivery/routes"         element={<DeliveryRoutesPage />} />
        <Route path="/staff/delivery/planner"        element={<RoutePlannerPage />} />
        <Route path="/staff/delivery/:id/track"      element={<GPSTrackingPage />} />

        {/* Billing (read-only for staff) */}
        <Route path="/staff/billing"                 element={<InvoiceListPage />} />
        <Route path="/staff/notifications"         element={<NotificationsPage />} />
        <Route path="/staff/billing/:id"             element={<InvoiceDetailPage />} />

        {/* Reports (rdc_manager can view) */}
        <Route path="/staff/reports"                 element={<ReportsHub />} />
        <Route path="/staff/reports/sales"           element={<SalesDetailPage />} />
        <Route path="/staff/reports/customers"       element={<CustomerReportPage />} />
        <Route path="/staff/reports/turnover"        element={<StockTurnoverPage />} />
        <Route path="/staff/reports/delivery"        element={<DeliveryEfficiencyPage />} />
      </Route>

      {/* ── Customer ──────────────────────────────── */}
      <Route element={<Guard roles={['customer']}><CustomerLayout /></Guard>}>
        <Route path="/customer/dashboard"            element={<CustomerDashboard />} />
        <Route path="/customer/orders"               element={<OrderListPage />} />
        <Route path="/customer/orders/new"           element={<PlaceOrderPage />} />
        <Route path="/customer/orders/:id"           element={<OrderTrackingPage />} />
        <Route path="/customer/billing"              element={<InvoiceListPage />} />
        <Route path="/customer/notifications"       element={<NotificationsPage />} />
        <Route path="/customer/billing/:id"          element={<InvoiceDetailPage />} />
      </Route>

      {/* ── Fallbacks ─────────────────────────────── */}
      <Route path="/"             element={<HomeRedirect />} />
      <Route path="/unauthorized" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-6xl font-bold text-gray-200 mb-4">403</p>
            <p className="text-xl text-gray-600 mb-6">Access Denied</p>
            <p className="text-sm text-gray-400 mb-8">
              You don't have permission to view this page.
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg
                         text-sm font-medium hover:bg-blue-700 transition mr-3">
              ← Go Back
            </button>
            <a href="/login"
              className="text-sm text-gray-500 hover:text-gray-700 underline">
              Sign in with different account
            </a>
          </div>
        </div>
      }/>
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
            <p className="text-xl text-gray-600 mb-6">Page Not Found</p>
            <button onClick={() => window.history.back()}
              className="bg-blue-600 text-white px-6 py-2.5 rounded-lg
                         text-sm font-medium hover:bg-blue-700 transition">
              ← Go Back
            </button>
          </div>
        </div>
      }/>
    </Routes>
  );
}
