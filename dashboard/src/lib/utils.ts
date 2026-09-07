import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// migrateStorageKey performs a one-time, backward-compatible rename of a
// localStorage key (fg_* -> cw_* during the ChainWarden rebrand): the value
// under the old key is copied to the new key (only if the new key is empty)
// and the old key is deleted. Returns the migrated value, or null when there
// was nothing to migrate.
export function migrateStorageKey(oldKey: string, newKey: string): string | null {
  try {
    const legacy = localStorage.getItem(oldKey)
    if (legacy === null) return null
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, legacy)
    }
    localStorage.removeItem(oldKey)
    return legacy
  } catch {
    return null
  }
}
