import { useEffect, useRef, useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ROLE_LABELS } from '../utils/roleLabels';
import { displayName } from '../utils/person';

const NAV_LINK_CLASSES = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    isActive
      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

const ICON_BUTTON_CLASSES =
  'rounded-md border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

// Same "focus something inside, return focus to the trigger on close" pattern
// as ConfirmDialog.tsx, applied to the mobile nav panel instead of a modal.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const MOBILE_MENU_ID = 'mobile-nav-panel';

export function AppLayout() {
  const { user, logout } = useAuth();
  // Demo accounts are named after their role; don't repeat it as a pill.
  const showRolePill = user ? displayName(user) !== ROLE_LABELS[user.role] : false;
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const panelNode = menuPanelRef.current;
    const triggerNode = menuButtonRef.current;
    const focusable = panelNode?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const target = focusable && focusable.length > 0 ? focusable[0] : panelNode;
    target?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerNode?.focus();
    };
  }, [isMenuOpen]);

  const navLinks = (
    <>
      <NavLink to="/dashboard" className={NAV_LINK_CLASSES} onClick={() => setIsMenuOpen(false)}>
        Pulpit
      </NavLink>
      <NavLink to="/tickets" className={NAV_LINK_CLASSES} onClick={() => setIsMenuOpen(false)}>
        Zgłoszenia
      </NavLink>
      {user?.role === 'ADMIN' && (
        <NavLink to="/admin/users" className={NAV_LINK_CLASSES} onClick={() => setIsMenuOpen(false)}>
          Administracja
        </NavLink>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow dark:focus:bg-slate-800 dark:focus:text-slate-100"
      >
        Przejdź do głównej treści
      </a>
      <header role="banner" className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">IT HelpDesk</p>
            {user && <nav aria-label="Główna" className="hidden items-center gap-1 md:flex">{navLinks}</nav>}
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'}
              className={ICON_BUTTON_CLASSES}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {user && (
              <div className="hidden items-center gap-4 md:flex">
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {displayName(user)}
                  {showRolePill && (
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Wyloguj się
                </button>
              </div>
            )}
            {user && (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                aria-label={isMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
                aria-expanded={isMenuOpen}
                aria-controls={MOBILE_MENU_ID}
                className={`${ICON_BUTTON_CLASSES} md:hidden`}
              >
                {isMenuOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            )}
          </div>
        </div>

        {user && isMenuOpen && (
          <div
            id={MOBILE_MENU_ID}
            ref={menuPanelRef}
            tabIndex={-1}
            className="border-t border-slate-200 px-6 py-4 focus:outline-none md:hidden dark:border-slate-800"
          >
            <nav aria-label="Główna (mobile)" className="flex flex-col gap-1">
              {navLinks}
            </nav>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {displayName(user)}
                {showRolePill && (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  logout();
                }}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Wyloguj się
              </button>
            </div>
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-6 py-10 focus:outline-none">
        <Outlet />
      </main>
    </div>
  );
}
