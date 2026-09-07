import { create } from 'zustand';
import { migrateStorageKey } from '../lib/utils';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'cw_theme';
const LEGACY_THEME_KEY = 'fg_theme';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function getInitialTheme(): Theme {
  // One-time migration: read the pre-rebrand fg_theme key, copy it to
  // cw_theme and drop the old key.
  const legacy = migrateStorageKey(LEGACY_THEME_KEY, THEME_KEY);
  const stored = legacy ?? localStorage.getItem(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

interface UIState {
  sidebarOpen: boolean;
  currentEcosystem: string;
  theme: Theme;
  navigate: (path: string) => void;
  _setNavigateFn: (fn: (path: string) => void) => void;
  setSidebarOpen: (v: boolean) => void;
  setCurrentEcosystem: (e: string) => void;
  toggleTheme: () => void;
}

const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  currentEcosystem: 'all',
  theme: initialTheme,
  navigate: (path) => console.warn('navigate not wired:', path),
  _setNavigateFn: (fn) => set({ navigate: fn }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setCurrentEcosystem: (e) => set({ currentEcosystem: e }),
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    set({ theme: next });
  },
}));
