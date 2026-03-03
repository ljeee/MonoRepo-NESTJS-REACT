import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    ChefHat, LogOut,
    PlusCircle, Clock, ClipboardList,
    FileText, Scale, CreditCard, CheckCircle2,
    Users, Bike, Package,
    Settings, ChevronDown, ChevronRight,
    ShoppingBag, Receipt, Database
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrdenesSocket } from '../hooks/use-ordenes-socket';

type NavItem = { label: string; path: string; icon: React.ReactNode };
type NavSection = { title: string; icon: React.ReactNode; items: NavItem[] };

const SECTIONS: NavSection[] = [
    {
        title: 'Órdenes',
        icon: <ShoppingBag size={16} />,
        items: [
            { label: 'Crear Orden', path: '/crear-orden', icon: <PlusCircle size={18} /> },
            { label: 'Órdenes del Día', path: '/ordenes', icon: <Clock size={18} /> },
            { label: 'Todas las Órdenes', path: '/ordenes-todas', icon: <ClipboardList size={18} /> },
        ],
    },
    {
        title: 'Facturación',
        icon: <Receipt size={16} />,
        items: [
            { label: 'Facturas del Día', path: '/facturas', icon: <FileText size={18} /> },
            { label: 'Balance / Cierre', path: '/balance-fechas', icon: <Scale size={18} /> },
            { label: 'Egresos Diarios', path: '/facturas-pagos', icon: <CreditCard size={18} /> },
            { label: 'Historial Cierre', path: '/historial', icon: <CheckCircle2 size={18} /> },
        ],
    },
    {
        title: 'Información',
        icon: <Database size={16} />,
        items: [
            { label: 'Clientes', path: '/clientes', icon: <Users size={18} /> },
            { label: 'Domiciliarios', path: '/domiciliarios', icon: <Bike size={18} /> },
            { label: 'Catálogo', path: '/gestion-productos', icon: <Package size={18} /> },
        ],
    },
];

function SidebarSection({
    section,
    expanded,
    onToggle,
}: {
    section: NavSection;
    expanded: boolean;
    onToggle: () => void;
}) {
    const location = useLocation();
    const hasActive = section.items.some((i) => location.pathname === i.path);

    return (
        <div className="sidebar-section">
            <button
                type="button"
                className={`sidebar-section-header ${hasActive ? 'section-active' : ''}`}
                onClick={onToggle}
            >
                <div className="sidebar-section-left">
                    {section.icon}
                    <span className="sidebar-section-title">{section.title}</span>
                </div>
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {expanded && (
                <div className="sidebar-section-items">
                    {section.items.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Sidebar() {
    const { logout, user } = useAuth();
    const { isConnected } = useOrdenesSocket();
    const location = useLocation();

    // Auto-expand section containing active route
    const activeIdx = SECTIONS.findIndex((s) =>
        s.items.some((i) => location.pathname === i.path),
    );

    const [expanded, setExpanded] = useState<Record<number, boolean>>(
        activeIdx >= 0 ? { [activeIdx]: true } : { 0: true },
    );

    const toggle = (idx: number) =>
        setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

    return (
        <aside className="pos-sidebar">
            <div className="pos-brand">
                <ChefHat size={28} color="#f97316" />
                <h2>POS Desktop</h2>
            </div>

            <div className="sidebar-user-info">
                {user && (user as any).name ? String((user as any).name) : 'Cajero'}
            </div>

            <nav className="pos-nav">
                {SECTIONS.map((section, idx) => (
                    <SidebarSection
                        key={section.title}
                        section={section}
                        expanded={!!expanded[idx]}
                        onToggle={() => toggle(idx)}
                    />
                ))}

                {/* Ajustes separado — no está en ninguna categoría */}
                <div className="sidebar-section-divider" />
                <NavLink
                    to="/ajustes"
                    className={({ isActive }) => `sidebar-nav-item standalone ${isActive ? 'active' : ''}`}
                >
                    <Settings size={18} />
                    <span>Ajustes</span>
                </NavLink>
            </nav>

            <div className="pos-status">
                <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></div>
                <span className="status-text">{isConnected ? 'En Línea' : 'Reconectando...'}</span>
            </div>

            <div className="sidebar-logout-wrap">
                <button onClick={logout} className="btn-alert sidebar-logout-btn" aria-label="Cerrar sesión">
                    <LogOut size={16} />
                    Salir
                </button>
            </div>
        </aside>
    );
}
