import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { useUIStore } from '../store/ui';
import { cn } from './ui/utils';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NAV_SECTIONS, STANDALONE, type NavItem } from './nav';

interface SidebarProps {
  current: string;
  onNavigate: (path: string) => void;
}

function TagChip({ tag, active }: { tag: string; active: boolean }) {
  const tone =
    tag === 'LIVE' ? 'border-[color-mix(in_srgb,var(--critical)_40%,transparent)] bg-[color-mix(in_srgb,var(--critical)_10%,transparent)] text-critical'
    : tag === 'AI' ? 'border-[color-mix(in_srgb,var(--magenta)_40%,transparent)] bg-[color-mix(in_srgb,var(--magenta)_10%,transparent)] text-magenta'
    : tag === 'GO' ? 'border-[color-mix(in_srgb,var(--neon)_40%,transparent)] bg-[color-mix(in_srgb,var(--neon)_10%,transparent)] text-neon'
    : 'border-border-color bg-surface-muted text-text-muted';
  return (
    <span
      className={cn(
        'ml-auto shrink-0 rounded border px-1 font-mono text-[0.55rem] font-bold tracking-widest',
        tone,
        active && 'shadow-glow',
      )}
    >
      {tag}
    </span>
  );
}

function NavButton({
  item,
  active,
  open,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  open: boolean;
  onNavigate: (path: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      title={open ? `${item.label} — ${item.path}` : item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'wd-hover group relative flex w-full items-center rounded text-left text-[0.78rem]',
        open ? 'gap-2.5 py-[7px] pl-[13px] pr-2' : 'justify-center py-2.5',
        active
          ? 'cyber-active font-semibold text-neon'
          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-1 left-0 top-1 w-[3px] rounded-r-full transition-all',
          active ? 'cyber-active-rail' : 'bg-transparent group-hover:bg-border-color',
        )}
      />
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center transition-all',
          active && 'drop-shadow-[0_0_6px_var(--neon)]',
        )}
      >
        <item.icon size={16} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      </span>
      {open && (
        <>
          <span className="min-w-0 flex-1 truncate font-mono text-[0.74rem]">{item.label}</span>
          {item.tag && <TagChip tag={item.tag} active={active} />}
        </>
      )}
      {!open && active && (
        <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-neon shadow-glow" />
      )}
    </button>
  );
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <aside
      className={cn(
        'relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border-color bg-[color-mix(in_srgb,var(--surface)_95%,transparent)] backdrop-blur',
        sidebarOpen ? 'w-[var(--sidebar-w)]' : 'w-[var(--sidebar-w-collapsed)]',
      )}
      aria-label="Primary"
    >
      {/* Neon top hairline */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-[2px] bg-gradient-to-r from-transparent via-neon to-transparent opacity-70" />

      {/* Brand — same height as the top bar so the hairlines line up. */}
      <button
        type="button"
        onClick={() => onNavigate('/')}
        title="ChainWarden — home"
        className={cn(
          'wd-hover relative flex h-[var(--shell-h)] shrink-0 items-center gap-2.5 border-b border-border-color bg-transparent hover:bg-surface-muted',
          sidebarOpen ? 'px-3.5' : 'justify-center px-0',
        )}
      >
        <span className="relative grid h-8 w-8 shrink-0 place-items-center">
          <span aria-hidden="true" className="cyber-hex absolute inset-0 bg-gradient-to-br from-[color-mix(in_srgb,var(--neon)_30%,transparent)] to-[color-mix(in_srgb,var(--magenta)_30%,transparent)]" />
          <span aria-hidden="true" className="cyber-hex absolute inset-[2px] bg-surface" />
          <img src="/logo-icon.png" alt="" aria-hidden="true" className="relative h-5 w-5 object-contain" />
        </span>
        {sidebarOpen && (
          <span className="min-w-0 text-left leading-tight">
            <span className="block truncate font-mono text-[0.82rem] font-bold tracking-tight text-text-primary">
              ChainWarden<span aria-hidden="true" className="cw-blink" />
            </span>
            <span className="block font-mono text-[0.55rem] uppercase tracking-[0.28em] text-neon">
              neon sentry
            </span>
          </span>
        )}
      </button>

      <WorkspaceSwitcher collapsed={!sidebarOpen} />

      <nav className={cn('flex-1 overflow-y-auto pb-2', sidebarOpen ? 'px-2' : 'px-1.5')}>
        <div className={sidebarOpen ? 'mb-1' : 'mb-2'}>
          <NavButton
            item={STANDALONE}
            active={current === STANDALONE.path}
            open={sidebarOpen}
            onNavigate={onNavigate}
          />
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.section} className="mb-1.5">
            {sidebarOpen ? (
              <div className="px-[13px] pb-1 pt-3">
                <p className="m-0 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-neon">
                  <span aria-hidden="true" className="text-magenta">//</span>
                  {section.section}
                </p>
                <p className="m-0 mt-0.5 font-mono text-[0.58rem] tracking-wide text-text-muted">
                  {section.blurb}
                </p>
              </div>
            ) : (
              <div aria-hidden="true" className="cyber-divider mx-1 my-2" />
            )}
            <div className="flex flex-col gap-px">
              {section.items.map((item) => (
                <NavButton
                  key={item.path}
                  item={item}
                  active={current === item.path}
                  open={sidebarOpen}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Cyber footer — shield line + collapse */}
      {sidebarOpen && (
        <div className="mx-2 mb-2 flex items-center gap-2 rounded border border-[color-mix(in_srgb,var(--success)_25%,transparent)] bg-[color-mix(in_srgb,var(--success)_5%,transparent)] px-2.5 py-2">
          <ShieldCheck size={14} className="shrink-0 text-success" aria-hidden="true" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="m-0 font-mono text-[0.62rem] font-bold uppercase tracking-widest text-success">shield up</p>
            <p className="m-0 truncate font-mono text-[0.58rem] text-text-muted">223 sigs · 8 engines</p>
          </div>
          <span aria-hidden="true" className="cw-live-dot h-1.5 w-1.5 shrink-0" />
        </div>
      )}

      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        className={cn(
          'wd-hover flex h-9 shrink-0 items-center justify-center gap-2 border-t border-border-color bg-transparent text-[0.7rem] text-text-muted hover:bg-surface-muted hover:text-neon',
          sidebarOpen && 'px-3',
        )}
      >
        {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        {sidebarOpen && <span className="font-mono text-[0.65rem] uppercase tracking-widest">Collapse</span>}
      </button>
    </aside>
  );
}
