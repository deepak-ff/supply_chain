import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, LogOut, Moon, Search, Settings, Sun, TerminalSquare } from 'lucide-react';
import { getAuthStatus, getActiveRisks } from '../lib/api';
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
        'wd-hover flex h-8 w-8 shrink-0 items-center justify-center rounded border border-transparent bg-transparent',
        'text-text-secondary hover:border-[color-mix(in_srgb,var(--neon)_30%,transparent)] hover:bg-surface-muted hover:text-neon hover:shadow-glow',
      )}
    >
      {children}
    </button>
  );
}

/** Live threat-level pill derived from active critical/high counts. */
function ThreatLevelPill({ onNavigate }: { onNavigate: (p: string) => void }) {
  const risks = useQuery({ queryKey: ['threat-level'], queryFn: getActiveRisks, refetchInterval: 60_000, retry: false });
  const list = risks.data?.risks ?? [];
  let crit = 0, high = 0;
  for (const r of list) {
    const s = r.top_severity?.toUpperCase();
    if (s === 'CRITICAL') crit += r.finding_count;
    else if (s === 'HIGH') high += r.finding_count;
  }
  const level = crit > 0 ? 'SEVERE' : high > 0 ? 'ELEVATED' : list.length > 0 ? 'GUARDED' : 'LOW';
  const tone =
    level === 'SEVERE' ? 'border-[color-mix(in_srgb,var(--critical)_50%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] text-critical'
    : level === 'ELEVATED' ? 'border-[color-mix(in_srgb,var(--warning)_50%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] text-warning'
    : level === 'GUARDED' ? 'border-[color-mix(in_srgb,var(--amber)_50%,transparent)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] text-amber'
    : 'border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] text-success';
  const dot = level === 'SEVERE' ? 'bg-critical' : level === 'ELEVATED' ? 'bg-warning' : level === 'GUARDED' ? 'bg-amber' : 'bg-success';
  return (
    <button
      type="button"
      onClick={() => onNavigate('/alerts')}
      title={`Threat level ${level} — ${crit} critical, ${high} high. Click to open Red Alerts.`}
      className={cn(
        'wd-hover hidden h-8 shrink-0 items-center gap-2 rounded border px-2.5 font-mono md:flex',
        tone,
      )}
    >
      <span className={cn('sonar h-1.5 w-1.5 shrink-0 rounded-full', dot)} aria-hidden="true" />
      <span className="text-[0.6rem] uppercase tracking-[0.18em] opacity-80">threat</span>
      <span className="text-[0.68rem] font-bold tracking-widest">{level}</span>
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
          'wd-hover cyber-hex flex h-8 w-8 items-center justify-center bg-gradient-to-br from-neon to-magenta text-[0.6rem] font-bold text-void',
          'hover:shadow-glow',
        )}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-60 overflow-hidden rounded border border-border-color bg-surface shadow-card"
        >
          <div className="border-b border-border-color bg-gradient-to-r from-[color-mix(in_srgb,var(--neon)_10%,transparent)] to-[color-mix(in_srgb,var(--magenta)_10%,transparent)] px-3 py-2.5">
            <p className="m-0 truncate font-mono text-[0.78rem] font-semibold text-text-primary">{email}</p>
            <p className="m-0 mt-0.5 font-mono text-[0.62rem] uppercase tracking-widest text-neon">
              {auth.data?.auth_enabled ? '// operator · admin' : '// local session'}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate('/settings');
            }}
            className="wd-hover flex w-full items-center gap-2 bg-transparent px-3 py-2 text-left text-[0.78rem] text-text-secondary hover:bg-surface-muted hover:text-text-primary"
          >
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
              className="wd-hover flex w-full items-center gap-2 border-t border-border-color bg-transparent px-3 py-2 text-left text-[0.78rem] text-text-secondary hover:bg-surface-muted hover:text-critical"
            >
              <LogOut size={14} /> Log out
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TopBar — persistent cyber command strip: breadcrumb · threat level ·
 * engine rail · search · trust pulse · theme · operator.
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
    <header className="relative flex h-[var(--shell-h)] shrink-0 items-center gap-3 border-b border-border-color bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-4 backdrop-blur">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--neon)_70%,transparent)] to-transparent opacity-60" />

      {/* Breadcrumb — cyber path style */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[0.78rem]">
        <TerminalSquare size={14} className="shrink-0 text-neon" aria-hidden="true" />
        <span className="shrink-0 font-mono text-[0.62rem] font-bold uppercase tracking-[0.2em] text-magenta">
          {section}
        </span>
        <ChevronRight size={13} className="shrink-0 text-text-muted" aria-hidden="true" />
        <span className="truncate font-mono text-[0.76rem] font-semibold text-text-primary">{page}</span>
        <span aria-hidden="true" className="hidden font-mono text-[0.62rem] text-text-muted lg:inline">_</span>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThreatLevelPill onNavigate={onNavigate} />

        {/* Live system status rail */}
        <div
          aria-hidden="true"
          title="All scan engines online"
          className="cw-scanrail hidden items-center gap-2 rounded border border-border-color bg-bg-base px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-text-muted xl:flex"
        >
          <span className="cw-live-dot h-1.5 w-1.5 shrink-0" />
          <span className="font-bold text-success">sys online</span>
          <span aria-hidden="true" className="text-border-color">·</span>
          <span>8 engines</span>
          <span aria-hidden="true" className="text-border-color">·</span>
          <span>9 ecosystems</span>
          <span aria-hidden="true" className="text-border-color">·</span>
          <span className="text-neon">223 sigs</span>
        </div>

        {/* Global search */}
        <button
          type="button"
          onClick={openCommandPalette}
          title="Search (Ctrl+K)"
          className={cn(
            'wd-hover hidden h-8 items-center gap-2 rounded border border-border-color bg-bg-base px-2.5 text-text-muted',
            'hover:border-[color-mix(in_srgb,var(--neon)_40%,transparent)] hover:text-neon hover:shadow-glow sm:flex',
          )}
        >
          <Search size={13} aria-hidden="true" />
          <span className="font-mono text-[0.7rem]">search grid_</span>
          <kbd className="rounded border border-border-color bg-surface px-1 font-mono text-[0.6rem] text-text-muted">
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
          label={theme === 'dark' ? 'Switch to day-ops theme' : 'Switch to night-ops theme'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>

        <UserMenu onNavigate={onNavigate} onLogout={onLogout} />
      </div>
    </header>
  );
}
