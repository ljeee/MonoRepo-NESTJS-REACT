import { NavLink } from 'react-router-dom';
import { Clock, CheckCircle2, Settings, ChefHat, LogOut, FileText, PlusCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrdenesSocket } from '../hooks/use-ordenes-socket';

export function Sidebar() {
    const { logout, user } = useAuth();
    const { isConnected } = useOrdenesSocket();

    return (
        <aside className="pos-sidebar">
            <div className="pos-brand">
                <ChefHat size={32} color="#f97316" />
                <h2>POS Desktop</h2>
            </div>

            <div className="sidebar-user-info">
                Cajero: {user && user.nombre ? String(user.nombre) : 'Usuario'}
            </div>

            <nav className="pos-nav">
                <NavLink to="/crear-orden" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <PlusCircle size={20} />
                    <span>Crear Orden</span>
                </NavLink>
                <NavLink to="/ordenes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Clock size={20} />
                    <span>Órdenes Pendientes</span>
                </NavLink>
                <NavLink to="/facturas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <FileText size={20} />
                    <span>Facturas del Día</span>
                </NavLink>
                <NavLink to="/historial" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <CheckCircle2 size={20} />
                    <span>Historial Cierre</span>
                </NavLink>
                <NavLink to="/ajustes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Settings size={20} />
                    <span>Ajustes Locales</span>
                </NavLink>
            </nav>

            <div className="pos-status">
                <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></div>
                <span className="status-text">{isConnected ? 'En Línea' : 'Reconectando...'}</span>
            </div>

            <div className="sidebar-logout-wrap">
                <button onClick={logout} className="btn-alert sidebar-logout-btn" aria-label="Cerrar sesión">
                    <LogOut size={16} />
                    Salir del Sistema
                </button>
            </div>
        </aside>
    );
}
