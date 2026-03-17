import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationSocket } from '../../hooks/use-notification-socket';

export function MainLayout() {
    const { token, isLoading } = useAuth();

    // Socket → Notification center bridge
    useNotificationSocket();

    if (isLoading) return <div className="app-loading-center">Cargando POS...</div>;

    // Protección de ruta principal
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="pos-container">
            <Sidebar />
            <main className="pos-content">
                <Outlet />
            </main>
        </div>
    );
}
