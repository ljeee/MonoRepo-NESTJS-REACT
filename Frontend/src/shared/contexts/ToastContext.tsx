import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    message: string;
    variant: ToastVariant;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
    hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toastIdRef = useRef(0);
    const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    useEffect(() => {
        return () => {
            timeoutRefs.current.forEach((timeoutId) => clearTimeout(timeoutId));
            timeoutRefs.current.clear();
        };
    }, []);

    const showToast = useCallback((message: string, variant: ToastVariant = 'info', duration = 4000) => {
        const MAX_TOASTS = 3;

        // El id se calcula AQUÍ, no dentro del updater de setToasts.
        //
        // Antes el updater asignaba `id` y un flag `added`, y el auto-cierre se
        // programaba desde un setTimeout(…, 0) que los leía. Pero React no
        // garantiza que el updater corra de forma síncrona: en React 19 puede
        // ejecutarse durante el render, es decir DESPUÉS de ese setTimeout. En
        // esa carrera `added` seguía en false, el temporizador jamás se creaba
        // y el toast se quedaba pegado en pantalla para siempre (de ahí que el
        // fallo fuera intermitente). Además, mutar variables dentro de un
        // updater rompe con StrictMode, que lo invoca dos veces.
        toastIdRef.current += 1;
        const id = `toast-${toastIdRef.current}-${Date.now()}`;

        // Updater PURO: sin efectos secundarios, seguro ante doble invocación.
        setToasts((prev) => {
            // Deduplicate: same message+variant already visible → skip
            if (prev.some((t) => t.message === message && t.variant === variant)) {
                return prev;
            }
            // Drop oldest if at cap
            const base = prev.length >= MAX_TOASTS ? prev.slice(-(MAX_TOASTS - 1)) : prev;
            return [...base, { id, message, variant, duration }];
        });

        // El temporizador se programa siempre y de inmediato. Si el toast se
        // descartó por duplicado o por el tope, el filtro simplemente no
        // encuentra ese id y no hace nada.
        if (duration > 0) {
            const timeoutId = setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
                timeoutRefs.current.delete(id);
            }, duration);
            timeoutRefs.current.set(id, timeoutId);
        }
    }, []);

    const hideToast = useCallback((id: string) => {
        const timeoutId = timeoutRefs.current.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutRefs.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const value = useMemo(
        () => ({ toasts, showToast, hideToast }),
        [toasts, showToast, hideToast]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
