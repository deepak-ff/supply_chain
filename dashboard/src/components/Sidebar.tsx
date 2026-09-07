import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useUIStore } from '../store/ui';
import { cn } from './ui/utils';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { NAV_SECTIONS, STANDALONE, type NavItem } from './nav';

interface SidebarProps {
  current: string;
  onNavigate: (path: string) => void;
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
      title={open ? undefined : item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Active = 3px violet rail + tinted background, never a filled block.
        'wd-hover relative flex w-full items-center rounded-r-sm text-left text-[0.78rem]',
        open ? 'gap-2.5 py-[7px] pl-[13px] pr-2.5' : 'justify-center py-2.5',
        active
          ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] font-medium text-primary'
          : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-0 left-0 top-0 w-[3px] rounded-r-sm',
          active ? 'bg-primary' : 'bg-transparent',
        )}
      />
      {/* Fixed 16px box keeps every icon optically aligned with its label. */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <item.icon size={16} strokeWidth={1.75} aria-hidden="true" />
      </span>
      {open && <span className="min-w-0 truncate font-mono text-[0.74rem]">{item.label}</span>}
    </button>
  );
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-border-color bg-surface',
        sidebarOpen ? 'w-[var(--sidebar-w)]' : 'w-[var(--sidebar-w-collapsed)]',
      )}
      aria-label="Primary" >
      {/* Brand — same 52px height as the top bar so the hairlines line up. */}
      <button
        type="button"
        onClick={() => onNavigate('/')}
        title="ChainWarden — home"
        className={cn(
          'wd-hover flex h-[var(--shell-h)] shrink-0 items-center gap-2 border-b border-border-color bg-transparent hover:bg-surface-muted',
          sidebarOpen ? 'px-3.5' : 'justify-center px-0',
        )}
      >
        <img
          src="/logo-icon.png"
          alt=""
          aria-hidden="true"
          className="h-6 w-6 shrink-0 object-contain" />
        {sidebarOpen && (
          <span className="truncate font-mono text-[0.82rem] font-semibold tracking-tight text-text-primary">
            ChainWarden<span aria-hidden="true" className="cw-blink" />
          </span>
        )}
      </button>

      <WorkspaceSwitcher collapsed={!sidebarOpen} />

      <nav className={cn('flex-1 overflow-y-auto pb-2', sidebarOpen ? 'px-2' : 'px-1.5')}>
        <div className={sidebarOpen ? 'mb-1.5' : 'mb-2'}>
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
              <p className="m-0 px-[13px] pb-1 pt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                {section.section}
              </p>
            ) : (
              <div aria-hidden="true" className="mx-1 my-2 border-t border-border-color" />
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

      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        className={cn(
          'wd-hover flex h-9 shrink-0 items-center justify-center gap-2 border-t border-border-color bg-transparent text-[0.7rem] text-text-muted hover:bg-surface-muted hover:text-text-secondary',
          sidebarOpen && 'px-3',
        )}
      >
        {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
        {sidebarOpen && <span>Collapse</span>}
      </button>
    </aside>
  );
}
