import { useEffect } from 'react';

interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  /** Description for help overlay */
  label?: string;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * Registers global keyboard shortcuts.
 * Shortcuts using Ctrl/Alt modifiers work even when focus is on editable fields.
 * F-key shortcuts are blocked when typing in inputs.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDef[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const sc of shortcuts) {
        const keyMatch = event.key.toLowerCase() === sc.key.toLowerCase()
          || event.code.toLowerCase() === sc.key.toLowerCase();

        if (!keyMatch) continue;

        const ctrlMatch = sc.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
        const altMatch = sc.alt ? event.altKey : !event.altKey;

        if (!ctrlMatch || !altMatch) continue;
        if (sc.shift && !event.shiftKey) continue;

        // F-keys: block when editing
        if (sc.key.startsWith('F') && !sc.ctrl && !sc.alt && isEditableTarget(event.target)) {
          continue;
        }

        event.preventDefault();
        sc.action();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/** Returns the full shortcut map with labels for the help overlay */
export function getShortcutDefinitions(navigate: (path: string) => void): ShortcutDef[] {
  return [
    // ── Navigation (F-keys) ──
    { key: 'F1', action: () => navigate('/crear-orden'), label: 'Nueva Orden' },
    { key: 'F2', action: () => navigate('/ordenes'), label: 'Órdenes Activas' },
    { key: 'F3', action: () => navigate('/facturas'), label: 'Facturación del Día' },
    { key: 'F4', action: () => navigate('/'), label: 'Dashboard' },
    { key: 'F5', action: () => navigate('/estadisticas'), label: 'Estadísticas' },
    { key: 'F6', action: () => navigate('/balance-fechas'), label: 'Balance General' },

    // ── Ctrl shortcuts ──
    { key: 'n', ctrl: true, action: () => navigate('/crear-orden'), label: 'Nueva Orden' },
    { key: 'r', ctrl: true, action: () => window.location.reload(), label: 'Refrescar' },
    { key: 'p', ctrl: true, action: () => navigate('/gestion-productos'), label: 'Productos' },
    { key: 'k', ctrl: true, action: () => navigate('/clientes'), label: 'Clientes' },

    // ── Escape ──
    { key: 'Escape', action: () => navigate(-1 as any), label: 'Volver' },
  ];
}