import { useEffect } from 'react';

interface KeyboardShortcutsConfig {
  onF1?: () => void;
  onF2?: () => void;
  onF3?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useKeyboardShortcuts({ onF1, onF2, onF3 }: KeyboardShortcutsConfig) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'F1' && onF1) {
        event.preventDefault();
        onF1();
      }

      if (event.key === 'F2' && onF2) {
        event.preventDefault();
        onF2();
      }

      if (event.key === 'F3' && onF3) {
        event.preventDefault();
        onF3();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onF1, onF2, onF3]);
}