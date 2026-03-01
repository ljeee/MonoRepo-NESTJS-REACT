import { useToast } from '../contexts/ToastContext';

const variantClass: Record<string, string> = {
  success: 'toast-success',
  error: 'toast-error',
  warning: 'toast-warning',
  info: 'toast-info',
};

export function ToastViewport() {
  const { toasts, hideToast } = useToast();

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item ${variantClass[toast.variant] || variantClass.info}`}>
          <span>{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => hideToast(toast.id)} aria-label="Cerrar notificación">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}