import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  PlusCircle,
  Printer,
  Settings as SettingsIcon,
  Table2,
  X,
} from 'lucide-react';
import { cx } from '@/lib/cx';
import { useSettings } from './SettingsContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/records', label: 'Employees', icon: Table2, end: false },
  { to: '/records/new', label: 'Add Employee', icon: PlusCircle, end: false },
  { to: '/data', label: 'Import / Export', icon: FileSpreadsheet, end: false },
  { to: '/reports', label: 'Reports', icon: Printer, end: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
];

export function Layout({ children }: { children?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { settings } = useSettings();
  const title = settings.preferences.appTitle || 'Kores Employee Records';

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink-50 print:hidden">
      <header className="no-print sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight text-ink-900">{title}</span>
          </NavLink>

          <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                  )
                }
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
              Menu
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav id="mobile-navigation" className="border-t border-ink-200 bg-white px-4 py-3 lg:hidden" aria-label="Mobile navigation">
            <div className="grid gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-100',
                    )
                  }
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="no-print mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:hidden">{children ?? <Outlet />}</main>

      <footer className="no-print border-t border-ink-200 bg-white print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs leading-relaxed text-ink-500 sm:px-6 lg:px-8">
          <p className="font-medium text-ink-700">{title} runs entirely in your browser.</p>
          <p className="mt-1">
            Employee data and photos are stored in this browser&apos;s IndexedDB on this device only. They are not
            synchronised across browsers or devices, and clearing site data will remove them. Export a backup regularly —
            browser storage is not encrypted and must not be treated as a secure vault for sensitive information.
          </p>
        </div>
      </footer>
    </div>
  );
}
