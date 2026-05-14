import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

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

        let added = false;
        let id = '';

        setToasts((prev) => {
            // Deduplicate: same message+variant already visible → skip
            if (prev.some((t) => t.message === message && t.variant === variant)) {
                return prev;
            }
            toastIdRef.current += 1;
            id = `toast-${toastIdRef.current}-${Date.now()}`;
            added = true;
            // Drop oldest if at cap
            const base = prev.length >= MAX_TOASTS ? prev.slice(-(MAX_TOASTS - 1)) : prev;
            return [...base, { id, message, variant, duration }];
        });

        // Schedule auto-dismiss only if we actually added the toast
        // We use a short delay so `id` is set before the timeout check runs
        setTimeout(() => {
            if (!added || !id || duration <= 0) return;
            const timeoutId = setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
                timeoutRefs.current.delete(id);
            }, duration);
            timeoutRefs.current.set(id, timeoutId);
        }, 0);
    }, []);

    const hideToast = useCallback((id: string) => {
        const timeoutId = timeoutRefs.current.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutRefs.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
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
