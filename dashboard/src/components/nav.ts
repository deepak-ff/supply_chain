import {
  Shield, Search, RefreshCw, HardDrive, Bot, Activity, GitBranch, Bell,
  FolderOpen, Package, FileText, ListFilter, KeyRound, Download, Webhook,
  GitMerge, LayoutDashboard, FileCheck, PenTool,
  Network, Puzzle, Globe2, Building2, Sparkles, Cpu,
  ClipboardList, Terminal, SquareTerminal, Radar,
} from 'lucide-react';
import type { ElementType } from 'react';

/**
 * Navigation model — the single source of truth for what the sidebar renders,
 * what the command palette offers, and what the top bar's breadcrumb shows.
 * Kept in a plain module (no React) so it can be imported from anywhere
 * without dragging the sidebar component along.
 */

export interface NavItem {
  label: string;
  icon: ElementType;
  path: string;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const STANDALONE: NavItem = { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' };

export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'Analyze',
    items: [
      { label: 'Scan Now',            icon: Search,       path: '/scan' },
      { label: 'Scan Sessions',       icon: ClipboardList, path: '/sessions' },
      { label: 'Recursive Scanning',  icon: RefreshCw,    path: '/recursive' },
      { label: 'System Audit',        icon: HardDrive,    path: '/audit' },
      { label: 'AI Security',         icon: Bot,          path: '/ai-security' },
      { label: 'AI Advisory',         icon: Sparkles,     path: '/advisory' },
      { label: 'AI Patch Agent',      icon: Cpu,          path: '/agents' },
      { label: 'Terminal',            icon: SquareTerminal, path: '/terminal' },
    ],
  },
  {
    section: 'Monitor',
    items: [
      { label: 'Live Monitoring',     icon: Activity,     path: '/monitor' },
      { label: 'Log Monitor',         icon: Terminal,     path: '/logs' },
      { label: 'Attack Surface',      icon: Network,      path: '/attack-surface' },
      { label: 'Trust Score',         icon: Radar,        path: '/trust' },
      { label: 'Dependency Drift',    icon: GitBranch,    path: '/drift' },
      { label: 'Alerts',             icon: Bell,          path: '/alerts' },
    ],
  },
  {
    section: 'Inventory',
    items: [
      { label: 'Projects',            icon: FolderOpen,   path: '/projects' },
      { label: 'Dependencies',        icon: Package,      path: '/inventory' },
      { label: 'SBOM',               icon: FileText,      path: '/sbom' },
    ],
  },
  {
    section: 'Policy',
    items: [
      { label: 'Policies',            icon: Shield,       path: '/policy' },
      { label: 'Allowlist/Blocklist', icon: ListFilter,   path: '/allowlist' },
      { label: 'Signatures',          icon: KeyRound,     path: '/sign' },
      { label: 'Provenance',          icon: FileCheck,    path: '/provenance' },
      { label: 'Sig. Authoring',      icon: PenTool,      path: '/intel/new' },
    ],
  },
  {
    section: 'Integrations',
    items: [
      { label: 'Integrations',        icon: Puzzle,       path: '/integrations' },
      { label: 'Exports',             icon: Download,     path: '/exports' },
      { label: 'Webhooks',            icon: Webhook,      path: '/webhooks' },
      { label: 'CI/CD',              icon: GitMerge,      path: '/cicd' },
    ],
  },
  {
    section: 'Resources',
    items: [
      { label: 'About ChainWarden', icon: Globe2,       path: '/welcome' },
      { label: 'Enterprise',          icon: Building2,    path: '/enterprise' },
    ],
  },
];

/** Routes that are reachable but not listed in a nav section. */
const EXTRA_CRUMBS: Record<string, { section: string; page: string }> = {
  '/dependencies': { section: 'Inventory', page: 'Dependencies' },
  '/policies':     { section: 'Policy',    page: 'Policies' },
  '/enterprise':   { section: 'Resources', page: 'Enterprise' },
  '/welcome':      { section: 'Resources', page: 'About ChainWarden' },
  '/docs':         { section: 'Resources', page: 'Documentation' },
};

/**
 * Breadcrumb source of truth. Derived from NAV_SECTIONS (the same list the
 * sidebar and the command palette render), so it can never drift out of sync
 * with what is actually reachable.
 */
export function resolveBreadcrumbs(path: string): { section: string; page: string } {
  if (path === STANDALONE.path) return { section: 'Overview', page: STANDALONE.label };
  for (const s of NAV_SECTIONS) {
    for (const item of s.items) {
      if (item.path === path) return { section: s.section, page: item.label };
    }
  }
  if (EXTRA_CRUMBS[path]) return EXTRA_CRUMBS[path];
  if (path.startsWith('/sessions/')) return { section: 'Analyze', page: 'Scan Session' };
  return { section: 'Overview', page: 'Dashboard' };
}
