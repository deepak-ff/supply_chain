import {
  Shield, Crosshair, RefreshCw, HardDrive, Bot, Activity, GitBranch, Bell,
  FolderOpen, Package, FileText, ListFilter, KeyRound, Download, Webhook,
  GitMerge, LayoutDashboard, FileCheck, PenTool,
  Network, Puzzle, Globe2, Building2, Sparkles, Cpu, Radar,
  ClipboardList, Terminal, SquareTerminal, ScanSearch, Boxes,
  ScrollText, Fingerprint, Route, Hammer, Satellite, FileDown, Zap, Siren,
  Hexagon, Rocket, Swords,
} from 'lucide-react';
import type { ElementType } from 'react';

/**
 * Navigation model — the single source of truth for what the sidebar renders,
 * what the command palette offers, and what the top bar's breadcrumb shows.
 * Kept in a plain module (no React) so it can be imported from anywhere
 * without dragging the sidebar component along.
 *
 * NAMING — every label is a plain-language *synonym* of the old name,
 * re-skinned with a cyber-ops flavor:
 *
 *   Dashboard    → Command Deck    (console / control panel)
 *   Analyze      → Recon           (inspect / examine / probe)
 *   Monitor      → Overwatch       (watch / surveil / guard)
 *   Inventory    → Arsenal         (stockpile / vault / supply)
 *   Policy       → Doctrine        (directive / protocol / mandate)
 *   Integrations → Uplinks         (links / connectors / mesh)
 *   Resources    → Archives        (store / records / vault)
 *
 * Routes (paths) are unchanged — only labels moved, so deep-links keep working.
 */

export interface NavItem {
  label: string;
  /** Short cyber tag shown as a chip in the sidebar (e.g. "LIVE", "AI"). */
  tag?: string;
  icon: ElementType;
  path: string;
}

export interface NavSection {
  section: string;
  /** One-line subtitle that explains the synonym in plain words. */
  blurb: string;
  items: NavItem[];
}

export const STANDALONE: NavItem = { label: 'Command Deck', icon: LayoutDashboard, path: '/dashboard' };

export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'Recon',
    blurb: 'inspect · probe · examine',
    items: [
      { label: 'Threat Probe',    icon: ScanSearch,    path: '/scan',       tag: 'GO' },
      { label: 'Sweep Logs',      icon: ClipboardList, path: '/sessions' },
      { label: 'Deep Trace',      icon: RefreshCw,     path: '/recursive' },
      { label: 'Host Inspect',    icon: HardDrive,     path: '/audit' },
      { label: 'Neural Shield',   icon: Bot,           path: '/ai-security', tag: 'AI' },
      { label: 'Oracle Brief',    icon: Sparkles,      path: '/advisory',    tag: 'AI' },
      { label: 'Fix Operatives',  icon: Cpu,           path: '/agents',      tag: 'AI' },
      { label: 'Strike Console',  icon: SquareTerminal, path: '/terminal' },
    ],
  },
  {
    section: 'Overwatch',
    blurb: 'watch · surveil · guard',
    items: [
      { label: 'Live Sentinel',   icon: Activity,      path: '/monitor',    tag: 'LIVE' },
      { label: 'Signal Logs',     icon: Terminal,      path: '/logs' },
      { label: 'Exposure Map',    icon: Network,       path: '/attack-surface' },
      { label: 'Trust Pulse',     icon: Radar,         path: '/trust' },
      { label: 'Drift Radar',     icon: GitBranch,     path: '/drift' },
      { label: 'Red Alerts',      icon: Siren,         path: '/alerts' },
    ],
  },
  {
    section: 'Arsenal',
    blurb: 'stockpile · vault · supply',
    items: [
      { label: 'Missions',        icon: Rocket,        path: '/projects' },
      { label: 'Supply Vault',    icon: Boxes,         path: '/inventory' },
      { label: 'Manifest Ledger', icon: ScrollText,    path: '/sbom' },
    ],
  },
  {
    section: 'Doctrine',
    blurb: 'directives · protocol · rules',
    items: [
      { label: 'Directives',      icon: Shield,        path: '/policy' },
      { label: 'Permit / Deny',   icon: ListFilter,    path: '/allowlist' },
      { label: 'Threat Prints',   icon: Fingerprint,   path: '/sign' },
      { label: 'Origin Trail',    icon: Route,         path: '/provenance' },
      { label: 'Print Forge',     icon: Hammer,        path: '/intel/new' },
    ],
  },
  {
    section: 'Uplinks',
    blurb: 'links · mesh · connectors',
    items: [
      { label: 'Mesh Links',      icon: Satellite,     path: '/integrations' },
      { label: 'Intel Extracts',  icon: FileDown,      path: '/exports' },
      { label: 'Tripwires',       icon: Zap,           path: '/webhooks' },
      { label: 'Pipeline Sentry', icon: GitMerge,      path: '/cicd' },
    ],
  },
  {
    section: 'Archives',
    blurb: 'records · intel · docs',
    items: [
      { label: 'About the Warden', icon: Hexagon,      path: '/welcome' },
      { label: 'Command Tier',    icon: Swords,        path: '/enterprise' },
    ],
  },
];

/** Keep tree-shaken legacy icon imports referenced so refactors stay type-safe. */
export const _LEGACY_ICONS = {
  Shield, Crosshair, HardDrive, Bot, Activity, GitBranch, Bell, FolderOpen,
  Package, FileText, ListFilter, KeyRound, Download, Webhook, GitMerge,
  FileCheck, PenTool, Network, Puzzle, Globe2, Building2, Sparkles, Cpu,
  Radar, ClipboardList, Terminal, SquareTerminal,
};

/** Routes that are reachable but not listed in a nav section. */
const EXTRA_CRUMBS: Record<string, { section: string; page: string }> = {
  '/dependencies': { section: 'Arsenal',  page: 'Supply Vault' },
  '/policies':     { section: 'Doctrine', page: 'Directives' },
  '/enterprise':   { section: 'Archives', page: 'Command Tier' },
  '/welcome':      { section: 'Archives', page: 'About the Warden' },
  '/docs':         { section: 'Archives', page: 'Field Manual' },
  '/risks':        { section: 'Archives', page: 'Hot Zones' },
  '/graph':        { section: 'Archives', page: 'Blast Graph' },
  '/settings':     { section: 'Archives', page: 'War-Room Tuning' },
  '/intelligence': { section: 'Archives', page: 'Signal Intel' },
  '/manual':       { section: 'Archives', page: 'Field Manual' },
  '/api-reference': { section: 'Archives', page: 'API Reference' },
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
  if (path.startsWith('/sessions/')) return { section: 'Recon', page: 'Sweep Detail' };
  return { section: 'Overview', page: 'Command Deck' };
}
