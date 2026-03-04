import { useNavigate } from 'react-router-dom';
import { useNotifications, Notification } from '../contexts/NotificationsContext';
import {
    Bell, X, CheckCheck, Trash2,
    ShoppingCart, Info, AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';

function timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    return `Hace ${Math.floor(hours / 24)}d`;
}

function getNotifIcon(type: string) {
    switch (type) {
        case 'order': return <ShoppingCart size={16} />;
        case 'success': return <CheckCircle size={16} />;
        case 'warning': return <AlertTriangle size={16} />;
        case 'error': return <XCircle size={16} />;
        default: return <Info size={16} />;
    }
}

function getNotifClass(type: string) {
    switch (type) {
        case 'order': return 'notif-type-order';
        case 'success': return 'notif-type-success';
        case 'warning': return 'notif-type-warning';
        case 'error': return 'notif-type-error';
        default: return 'notif-type-info';
    }
}

interface NotificationsPanelProps {
    open: boolean;
    onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: NotificationsPanelProps) {
    const { notifications, unreadCount, markAsRead, markAllRead, clearAll, removeNotification } = useNotifications();
    const navigate = useNavigate();

    const handleClick = (notif: Notification) => {
        markAsRead(notif.id);
        if (notif.link) {
            navigate(notif.link);
            onClose();
        }
    };

    if (!open) return null;

    return (
        <>
            <div
                className="notif-backdrop"
                onClick={onClose}
                role="presentation"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        onClose();
                    }
                }}
            />
            <div className="notif-panel">
                <div className="notif-panel-header">
                    <div className="notif-panel-title">
                        <Bell size={18} />
                        <span>Notificaciones</span>
                        {unreadCount > 0 && (
                            <span className="notif-badge">{unreadCount}</span>
                        )}
                    </div>
                    <div className="notif-panel-actions">
                        {notifications.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={markAllRead}
                                    title="Marcar todas como leídas"
                                >
                                    <CheckCheck size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={clearAll}
                                    title="Limpiar todas"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            className="btn-icon"
                            onClick={onClose}
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="notif-panel-list">
                    {notifications.length === 0 ? (
                        <div className="notif-empty">
                            <Bell size={32} />
                            <p>Sin notificaciones</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`notif-item ${!notif.read ? 'unread' : ''} ${getNotifClass(notif.type)}`}
                                onClick={() => handleClick(notif)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="notif-item-icon">
                                    {getNotifIcon(notif.type)}
                                </div>
                                <div className="notif-item-content">
                                    <div className="notif-item-title">{notif.title}</div>
                                    <div className="notif-item-message">{notif.message}</div>
                                    <div className="notif-item-time">{timeAgo(notif.timestamp)}</div>
                                </div>
                                <button
                                    type="button"
                                    className="notif-item-dismiss"
                                    onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                                    title="Descartar"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}

/** Bell button with unread badge, can be placed in sidebar */
export function NotificationBell({ onClick }: { onClick: () => void }) {
    const { unreadCount } = useNotifications();

    return (
        <button
            type="button"
            className="notif-bell-btn"
            onClick={onClick}
            title="Notificaciones"
        >
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
        </button>
    );
}
