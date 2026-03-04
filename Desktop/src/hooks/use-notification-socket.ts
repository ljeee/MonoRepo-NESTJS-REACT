import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useNotifications } from '../contexts/NotificationsContext';

/**
 * Polls for pending invoices and pushes notifications when count changes.
 * Only notifies about facturas pendientes del día.
 */
export function useNotificationSocket() {
    const { addNotification } = useNotifications();
    const addRef = useRef(addNotification);
    useEffect(() => { addRef.current = addNotification; }, [addNotification]);

    const lastCountRef = useRef<number | null>(null);

    useEffect(() => {
        let active = true;

        async function checkPending() {
            try {
                const facturas = await api.facturas.getDay();
                const pendientes = facturas.filter(f => f.estado === 'pendiente');
                const count = pendientes.length;

                // Only notify when count increases (new pending invoice)
                if (lastCountRef.current !== null && count > lastCountRef.current) {
                    const diff = count - lastCountRef.current;
                    addRef.current({
                        type: 'warning',
                        title: `${diff} factura${diff > 1 ? 's' : ''} pendiente${diff > 1 ? 's' : ''}`,
                        message: `Hay ${count} factura${count > 1 ? 's' : ''} sin pagar del día.`,
                        link: '/facturas',
                    });
                }
                lastCountRef.current = count;
            } catch {
                // silently ignore API errors
            }
        }

        // Initial check
        checkPending();

        // Poll every 5 minutes
        const id = setInterval(() => {
            if (active) checkPending();
        }, 5 * 60 * 1000);

        return () => {
            active = false;
            clearInterval(id);
        };
    }, []);
}
