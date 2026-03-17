import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type NotifType = 'info' | 'success' | 'warning' | 'error' | 'order';

export interface Notification {
    id: string;
    type: NotifType;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    /** Optional link to navigate to */
    link?: string;
}

interface NotificationsContextValue {
    notifications: Notification[];
    unreadCount: number;
    addNotification: (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
    markAsRead: (id: string) => void;
    markAllRead: () => void;
    clearAll: () => void;
    removeNotification: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

let counter = 0;

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotification = useCallback(
        (notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
            const newNotif: Notification = {
                ...notif,
                id: `notif-${++counter}-${Date.now()}`,
                timestamp: new Date(),
                read: false,
            };
            setNotifications((prev) => [newNotif, ...prev].slice(0, 50)); // Max 50
        },
        [],
    );

    const markAsRead = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
    }, []);

    const markAllRead = useCallback(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, []);

    const clearAll = useCallback(() => {
        setNotifications([]);
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <NotificationsContext.Provider
            value={{
                notifications,
                unreadCount,
                addNotification,
                markAsRead,
                markAllRead,
                clearAll,
                removeNotification,
            }}
        >
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
    return ctx;
}
