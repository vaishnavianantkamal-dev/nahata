import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Kanban, CalendarDays, Wallet, ReceiptText,
  BarChart2, Settings, Menu, X, Plus, Bell, LogOut, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { NewLeadModal } from '@/features/leads/NewLeadModal';

const navGroups = [
  { section: 'MAIN', items: [
    { to: '/dashboard', label: 'Dashboard',     icon: LayoutDashboard },
    { to: '/leads',     label: 'Leads',         icon: Users },
    { to: '/pipeline',  label: 'Pipeline',      icon: Kanban },
  ]},
  { section: 'BUSINESS', items: [
    { to: '/bookings',   label: 'Bookings',     icon: CalendarDays },
    { to: '/quotations', label: 'Quotations',   icon: ClipboardList },
    { to: '/invoices',   label: 'Invoices',     icon: ReceiptText },
    { to: '/payments',   label: 'Payments',     icon: Wallet },
  ]},
  { section: 'INSIGHTS', items: [
    { to: '/reports',   label: 'Reports',       icon: BarChart2 },
    { to: '/settings',  label: 'Settings',      icon: Settings },
  ]},
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1f18] w-full sm:w-64 md:w-80 xl:w-96 flex-shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <span className="text-2xl leading-none">🌿</span>
        <div className="flex-1 min-w-0">
          <p className="text-[19px] text-white/40 font-medium tracking-widest uppercase">nahatalawns</p>
          <p className="text-[16px] font-bold text-white font-display truncate">Nahata CRM</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white ml-auto">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin px-3">
        {navGroups.map(({ section, items }) => (
          <div key={section} className="mb-6">
            <p className="px-2 pb-2 text-[10px] font-bold tracking-widest text-white/30 uppercase">{section}</p>
            {items.map(({ to, label, icon: Icon }) => {
              const active = location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => onClose?.()}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[16px] font-semibold transition-all duration-150 mb-0.5',
                    active
                      ? 'bg-[#C9A24B] text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon size={16} className={active ? 'opacity-100' : 'opacity-70'} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10 mx-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#C9A24B] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user?.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold text-white truncate">{user?.name}</p>
            <p className="text-[14px] text-white/60 capitalize font-medium">{user?.role?.toLowerCase()}</p>
          </div>
          <button onClick={logout} title="Logout" className="p-1.5 text-white/40 hover:text-red-400 transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#f5f6fa] overflow-hidden">
      {/* Sidebar — always visible on tablets and above */}
      <div className="hidden md:flex flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile overlay sidebar (below tablets) */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Right side */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Compact top bar */}
        {/* ── Top header — dark, no white line ── */}
        <header className="flex items-center px-6 gap-4 flex-shrink-0 bg-[#0f1f18]" style={{ height: '60px' }}>
          {/* Mobile menu */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 text-white/60 hover:text-white rounded-lg"
          >
            <Menu size={20} />
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Date */}
          <div className="hidden md:flex items-center gap-2 bg-white/10 border border-white/15 rounded-xl px-3 sm:px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white/80 text-[13px] sm:text-[15px] font-semibold whitespace-nowrap">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>

          {/* + New Lead */}
          <button
            onClick={() => setNewLeadOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-[#C9A24B] hover:bg-[#a07d2e] text-white px-3 sm:px-5 py-2 rounded-xl font-bold text-[13px] sm:text-[15px] transition-all shadow-lg shadow-[#C9A24B]/30 hover:-translate-y-0.5 whitespace-nowrap"
          >
            <Plus size={16} /> New Lead
          </button>

          {/* Bell */}
          <button className="hidden sm:block p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
            <Bell size={19} />
          </button>
        </header>

        {/* Page content — no padding here, pages own their layout */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>

      <NewLeadModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
    </div>
  );
}
