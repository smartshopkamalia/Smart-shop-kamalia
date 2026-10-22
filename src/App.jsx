import { useState, useEffect } from 'react';
import { Menu, MessageCircle, Bell, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from '@/components/Sidebar';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { InstallmentsPage } from '@/pages/InstallmentsPage';
import { RemindersPage } from '@/pages/RemindersPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ApplicationsPage } from '@/pages/ApplicationsPage';
import { InventoryPage } from '@/pages/InventoryPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { SalesmanCommissionPage } from '@/pages/SalesmanCommissionPage';
import { ExpensesPage } from '@/pages/ExpensesPage';
import { InvestorsPage } from '@/pages/InvestorsPage';
import { ApplyPage } from '@/pages/ApplyPage';
import { CustomerLoginPage } from '@/pages/CustomerLoginPage';
import { CustomerPortalPage } from '@/pages/CustomerPortalPage';
import { LandingPage } from '@/pages/LandingPage';
import { AdminLoginPage, type AdminRole } from '@/pages/AdminLoginPage';
import { useSettings } from '@/hooks/useSettings';
import { useAllData, getDueStatus } from '@/hooks/useAllData';
import { useApplications } from '@/hooks/useApplications';
import { useExpenses } from '@/hooks/useExpenses';
import { useInvestors } from '@/hooks/useInvestors';
import type { PageId, UserRole } from '@/lib/types';

interface SystemUser {
  id: string;
  username: string;
  role: string;
  display_name: string;
}

const STORAGE_KEY = 'smart_shop_auth';

type View = 'landing' | 'admin-login' | 'staff-login' | 'admin-panel' | 'apply' | 'customer-login' | 'customer-portal';

function getViewFromHash(): View {
  const hash = window.location.hash;
  if (hash === '#/apply') return 'apply';
  if (hash === '#/customer-portal') return 'customer-portal';
  return 'landing';
}

function getStoredAuth(): SystemUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SystemUser;
  } catch {
    return null;
  }
}

function storeAuth(user: SystemUser | null) {
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function App() {
  const { settings, updateSettings } = useSettings();
  const { customers, payments, loading, refresh } = useAllData();
  const { expenses } = useExpenses();
  const { investors, refresh: refreshInvestors } = useInvestors(customers, payments);
  const [page, setPage] = useState<PageId>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [view, setView] = useState<View>(getViewFromHash());
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(getStoredAuth());
  const [userRole, setUserRole] = useState<UserRole>(
    getStoredAuth()?.role === 'staff' ? 'staff' : 'admin'
  );

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener('hashchange', onHashChange);

    // Customer portal still uses Supabase auth
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // If we have stored admin/staff auth, go straight to panel
    const stored = getStoredAuth();
    if (stored && getViewFromHash() === 'landing') {
      setSystemUser(stored);
      setUserRole(stored.role === 'staff' ? 'staff' : 'admin');
      setView('admin-panel');
    }

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const { applications, pendingCount: pendingAppsCount, refresh: refreshApps, newAppAlert, setNewAppAlert } = useApplications();

  const dueCount = customers.filter((c) => getDueStatus(c).isDue).length;

  const navigate = (id: PageId) => {
    setPage(id);
    setMobileSidebarOpen(false);
  };

  const handleLogout = () => {
    storeAuth(null);
    setSystemUser(null);
    setUserRole('admin');
    setView('landing');
    window.location.hash = '';
  };

  const handlePortalSelect = (portal: 'admin' | 'staff' | 'apply' | 'customer') => {
    if (portal === 'apply') {
      window.location.hash = '#/apply';
      setView('apply');
    } else if (portal === 'customer') {
      window.location.hash = '#/customer-portal';
      setView('customer-login');
    } else if (portal === 'admin') {
      setView('admin-login');
    } else if (portal === 'staff') {
      setView('staff-login');
    }
  };

  const handleAdminLoggedIn = (user: SystemUser) => {
    storeAuth(user);
    setSystemUser(user);
    setUserRole(user.role === 'staff' ? 'staff' : 'admin');
    setView('admin-panel');
    setPage(user.role === 'staff' ? 'installments' : 'dashboard');
  };

  // ===== Public Apply Route =====
  if (view === 'apply') {
    return <ApplyPage />;
  }

  // ===== Customer Portal =====
  if (view === 'customer-portal' || view === 'customer-login') {
    if (!authReady) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      );
    }
    if (session && session.user?.app_metadata?.customer_portal) {
      return <CustomerPortalPage onLogout={handleLogout} />;
    }
    if (session && !session.user?.app_metadata?.customer_portal) {
      supabase.auth.signOut();
      setSession(null);
    }
    return <CustomerLoginPage />;
  }

  // ===== Landing Page =====
  if (view === 'landing' && !systemUser) {
    return <LandingPage onSelect={handlePortalSelect} />;
  }

  // ===== Admin / Staff Login =====
  if (view === 'admin-login' || view === 'staff-login') {
    const role: AdminRole = view === 'admin-login' ? 'admin' : 'staff';
    return (
      <AdminLoginPage
        role={role}
        onBack={() => setView('landing')}
        onLoggedIn={handleAdminLoggedIn}
      />
    );
  }

  // ===== Admin / Staff Panel =====
  if (!systemUser) {
    return <LandingPage onSelect={handlePortalSelect} />;
  }

  const isStaff = userRole === 'staff';

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        current={page}
        onNavigate={navigate}
        shopName={settings.shopName}
        dueCount={dueCount}
        pendingAppsCount={pendingAppsCount}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        role={userRole}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100 transition relative">
            <Menu className="w-5 h-5 text-slate-700" />
            {!isStaff && pendingAppsCount > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {pendingAppsCount}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{systemUser.display_name || systemUser.username}</span>
            <span className="text-sm font-bold text-slate-900 ml-1">{settings.shopName}</span>
          </div>
        </header>

        {!isStaff && (
          <div className="hidden lg:flex justify-end px-8 pt-4 gap-2 items-center">
            <span className="text-sm text-slate-600 mr-auto">
              Logged in as <strong className="text-slate-900">{systemUser.display_name || systemUser.username}</strong>
            </span>
            {pendingAppsCount > 0 && (
              <button
                onClick={() => navigate('applications')}
                className="px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition flex items-center gap-2"
              >
                <span className="relative flex">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute" />
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                </span>
                {pendingAppsCount} Pending Application{pendingAppsCount > 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={() => {
                const applyUrl = `${window.location.origin}${window.location.pathname}#/apply`;
                const msg = `Assalam-o-Alaikum! Please fill out your mobile installment application using this secure link: ${applyUrl}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Share Apply Link
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {page === 'dashboard' && !isStaff && <DashboardPage customers={customers} payments={payments} onNavigate={navigate} pendingAppsCount={pendingAppsCount} />}
              {page === 'customers' && <CustomersPage customers={customers} payments={payments} shopSettings={settings} onDataChange={refresh} role={userRole} investors={investors} />}
              {page === 'installments' && <InstallmentsPage customers={customers} payments={payments} shopSettings={settings} onDataChange={refresh} />}
              {page === 'reminders' && <RemindersPage customers={customers} shopSettings={settings} />}
              {page === 'reports' && !isStaff && <ReportsPage customers={customers} payments={payments} shopSettings={settings} expenses={expenses} />}
              {page === 'inventory' && !isStaff && <InventoryPage />}
              {page === 'accounts' && !isStaff && <AccountsPage />}
              {page === 'commissions' && !isStaff && <SalesmanCommissionPage customers={customers} />}
              {page === 'expenses' && !isStaff && <ExpensesPage />}
              {page === 'investors' && !isStaff && (
                <InvestorsPage customers={customers} payments={payments} onInvestorChange={refreshInvestors} />
              )}
              {page === 'applications' && !isStaff && <ApplicationsPage applications={applications} onDataChange={refreshApps} shopSettings={settings} />}
              {page === 'settings' && !isStaff && <SettingsPage settings={settings} onSave={updateSettings} />}
              {isStaff && (page === 'dashboard' || page === 'reports' || page === 'inventory' || page === 'accounts' || page === 'commissions' || page === 'expenses' || page === 'investors' || page === 'applications' || page === 'settings') && (
                <InstallmentsPage customers={customers} payments={payments} shopSettings={settings} onDataChange={refresh} />
              )}
            </>
          )}
        </main>

        <footer className="px-6 py-4 text-center text-xs text-slate-400 border-t border-slate-100">
          {settings.shopName} • Mobile Installment Management System
        </footer>
      </div>

      {!isStaff && newAppAlert && (
        <div className="fixed bottom-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-blue-200 p-4 max-w-sm animate-slide-in-bottom">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">New Application Received!</p>
              <p className="text-xs text-slate-500 mt-0.5">A new online installment application has been submitted.</p>
              <button
                onClick={() => { setNewAppAlert(false); navigate('applications'); }}
                className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                Review now →
              </button>
            </div>
            <button onClick={() => setNewAppAlert(false)} className="p-1 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
