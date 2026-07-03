import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-[#f5a524]/15 text-[#c97e06] dark:text-[#f5a524]'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`;

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="text-2xl" aria-hidden="true">🍕</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">Dfiru Pizzería</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Pedir
          </NavLink>
          <NavLink to="/nosotros" className={navLinkClass}>
            Nosotros
          </NavLink>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={user?.name || user?.username}
            >
              Salir
            </button>
          ) : (
            <NavLink to="/login" className={navLinkClass}>
              Ingresar
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
