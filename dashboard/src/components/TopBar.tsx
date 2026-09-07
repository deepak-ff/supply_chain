import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut, Moon, Search, Settings, Sun } from 'lucide-react';
import { getAuthStatus } from '../lib/api';
import { useUIStore } from '../store/ui';
import { cn } from './ui/utils';
import { TrustPulseChip } from './TrustPulseChip';
import { resolveBreadcrumbs } from './nav';

/**
 * Dispatches the same synthetic keydown the global Cmd/Ctrl+K listener in
 * App.tsx already handles, rather than duplicating open-state wiring here —
 * this button is a discoverable, clickable entry point to that one listener.
 */
function openCommandPalette() {
  const isMac = navigator.platform.toLowerCase().includes('mac');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac }));
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'wd-hover flex h-7 w-7 shrink-0 items-center justify-center rounded border border-transparent bg-transparent',
        'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
      )}
    >
      {children}
    </button>
  );
}

function UserMenu({
  onNavigate,
  onLogout,
}: {
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const auth = useQuery({
    queryKey: ['auth-me'],
    queryFn: getAuthStatus,
    retry: false,
    staleTime: 60_000,
  });

  const email = auth.data?.email ?? (auth.data?.auth_enabled ? 'admin' : 'local session');
  const initials = (auth.data?.email ?? 'CW').slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          'wd-hover flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-white',
          'hover:opacity-90',
        )}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded border border-border-color bg-surface shadow-card" >
          <div className="border-b border-border-color px-3 py-2.5">
            <p className="m-0 truncate text-[0.78rem] font-semibold text-text-primary">{email}</p>
            <p className="m-0 mt-0.5 text-[0.68rem] text-text-muted">
              {auth.data?.auth_enabled ? 'Administrator' : 'Auth disabled'}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate('/settings');
            }}
            className="wd-hover flex w-full items-center gap-2 bg-transparent px-3 py-2 text-left text-[0.78rem] text-text-secondary hover:bg-surface-muted hover:text-text-primary" >
            <Settings size={14} /> Settings
          </button>
          {onLogout && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="wd-hover flex w-full items-center gap-2 border-t border-border-color bg-transparent px-3 py-2 text-left text-[0.78rem] text-text-secondary hover:bg-surface-muted hover:text-critical" >
              <LogOut size={14} /> Log out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TopBar — persistent, 52px, surface background, hairline bottom border.
 *
 * breadcrumb (section / page) · global search (Ctrl+K) · theme toggle ·
 * Trust Pulse chip · user menu.
 */
export function TopBar({
  path,
  onNavigate,
  onLogout,
}: {
  path: string;
  onNavigate: (path: string) => void;
  onLogout?: () => void;
}) {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const { section, page } = resolveBreadcrumbs(path);

  return (
    <header className="flex h-[var(--shell-h)] shrink-0 items-center gap-3 border-b border-border-color bg-surface px-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[0.78rem]">
        <span className="shrink-0 font-medium uppercase tracking-wide text-text-muted">
          {section}
        </span>
        <ChevronRight size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
        <span className="truncate font-semibold text-text-primary">{page}</span>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Global search — opens the command palette (Ctrl/Cmd+K) */}
        <button
          type="button"
          onClick={openCommandPalette}
          title="Search (Ctrl+K)"
          className={cn(
            'wd-hover hidden h-7 items-center gap-2 rounded border border-border-color bg-bg-base px-2 text-text-muted',
            'hover:border-text-muted hover:text-text-secondary sm:flex',
          )}
        >
          <Search size={13} aria-hidden="true" />
          <span className="text-[0.72rem]">Search</span>
          <kbd className="rounded border border-border-color bg-surface px-1 font-mono text-[0.62rem] text-text-muted">
            ⌘K
          </kbd>
        </button>

        <span className="sm:hidden">
          <IconButton label="Search (Ctrl+K)" onClick={openCommandPalette}>
            <Search size={15} />
          </IconButton>
        </span>

        <TrustPulseChip onNavigate={onNavigate} />

        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>

        <UserMenu onNavigate={onNavigate} onLogout={onLogout} />
      </div>
    </header>
  );
}
