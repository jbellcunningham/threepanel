/**
 * FILE: /opt/threepanel/app/threepanel/src/lib/containerTypeDisplay.ts
 *
 * PURPOSE:
 * - Centralize display metadata for container types
 * - Provide a stable label + icon mapping for built-in types
 * - Provide a clean fallback for custom user-defined types
 *
 * ARCHITECTURE ROLE:
 * - Shared UI helper for container list, detail, settings, and future menus
 */

/* =========================================================
   1) Types
   ========================================================= */

export type ContainerTypeDisplay = {
  label: string
  icon: string
}

/* =========================================================
   2) Helpers
   ========================================================= */

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/* =========================================================
   3) Public API
   ========================================================= */

export function getContainerTypeDisplay(type?: string): ContainerTypeDisplay {
  if (!type) {
    return {
      label: 'Container',
      icon: '📦'
    }
  }

  const normalized = type.trim().toLowerCase()

  if (normalized === 'tracker') {
    return {
      label: 'Tracker',
      icon: '📊'
    }
  }

  if (normalized === 'todo') {
    return {
      label: 'To-Do',
      icon: '✅'
    }
  }

  if (normalized === 'journal') {
    return {
      label: 'Journal',
      icon: '📓'
    }
  }

  return {
    label: titleCase(normalized),
    icon: '📦'
  }
}
