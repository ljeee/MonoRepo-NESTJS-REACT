import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import { AuthProvider, useAuth } from './context/AuthContext';

// Code-splitting por ruta: /login (entrada de usuarios sin sesión) no descarga
// el catálogo ni Leaflet (~150KB), que solo necesita la página de pedido.
const PedidoPage = lazy(() => import('./pages/PedidoPage'));
const NosotrosPage = lazy(() => import('./pages/NosotrosPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return children;
}

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Cargando">
      <div className="w-8 h-8 border-4 border-[#f5a524] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen">
          <Header />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <PedidoPage />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/nosotros" element={<NosotrosPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
