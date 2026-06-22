import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LeadsPage } from '@/features/leads/LeadsPage';
import { LeadDetailPage } from '@/features/leads/LeadDetailPage';
import { PipelinePage } from '@/features/pipeline/PipelinePage';
import { WhatsAppPage } from '@/features/whatsapp/WhatsAppPage';
import { TemplatesPage } from '@/features/templates/TemplatesPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { QuotationsPage } from '@/features/quotations/QuotationsPage';
import { BookingsPage } from '@/features/bookings/BookingsPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';
import { useAuthStore } from '@/store/auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'leads', element: <LeadsPage /> },
      { path: 'leads/:id', element: <LeadDetailPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      { path: 'bookings', element: <BookingsPage /> },
      { path: 'whatsapp', element: <WhatsAppPage /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'quotations', element: <QuotationsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
