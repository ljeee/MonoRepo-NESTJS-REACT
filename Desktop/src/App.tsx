import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { listen } from '@tauri-apps/api/event';
import { Server } from 'lucide-react';

import { setApiBaseUrl } from './services/api';
import { getBackendUrl, setBackendUrl as persistBackendUrl, validateBackendUrl } from './services/settings';
import { AuthProvider } from './contexts/AuthContext';
import { OrderProvider } from './contexts/OrderContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ToastViewport } from './components/ToastViewport';

import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/Login';
import { OrdersOfDayPending } from './pages/Ordenes';
import { CreateOrderPage } from './pages/CrearOrden';
import { FacturasPage } from './pages/Facturas';
import { HistorialPage } from './pages/Historial';
import { AjustesPage } from './pages/Ajustes';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';

import './App.css';

// Wrapper de arranque config 
function AppInitialState({ children }: { children: React.ReactNode }) {
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [isConfiguring, setIsConfiguring] = useState<boolean>(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function initSettings() {
      const savedUrl = await getBackendUrl();
      if (savedUrl) {
        setBackendUrl(savedUrl);
        setApiBaseUrl(savedUrl);
        setIsConfiguring(false);
      } else {
        setIsConfiguring(true);
      }
    }
    initSettings();
  }, []);

  const guardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateBackendUrl(backendUrl)) {
      setError('Ingresa una URL válida (http:// o https://).');
      return;
    }
    const value = await persistBackendUrl(backendUrl);
    setApiBaseUrl(value);
    setError('');
    setIsConfiguring(false);
  };

  if (isConfiguring) {
    return (
      <main className="config-screen">
        <div className="config-card">
          <Server size={48} color="#f97316" className="config-icon" />
          <h2>Configurar Servidor POS</h2>
          <p>Ingresa la IP donde corre tu servidor de NestJS (Ej: http://192.168.1.50:3000).</p>

          <form onSubmit={guardarConfiguracion}>
            <input
              type="url"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://localhost:3000"
              required
            />
            {error && <div className="config-error">{error}</div>}
            <button type="submit" className="btn-primary">Conectar al Sistema</button>
          </form>
        </div>
      </main>
    );
  }

  // Si ya tenemos URL, inicializamos proveedores y router
  return <>{children}</>;
}

function KeyboardShortcutsBinder() {
  const navigate = useNavigate();

  useKeyboardShortcuts({
    onF1: () => navigate('/crear-orden'),
    onF2: () => navigate('/ordenes'),
    onF3: () => navigate('/facturas'),
  });

  return null;
}

function CloseFeedbackBinder() {
  const { showToast } = useToast();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function bindEvent() {
      if (typeof window === 'undefined' || !(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
        return;
      }

      unlisten = await listen<string>('app://close-prevented', (event) => {
        showToast(event.payload || 'Presiona cerrar nuevamente para salir.', 'warning', 2400);
      });
    }

    bindEvent();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [showToast]);

  return null;
}


function App() {
  return (
    <AppInitialState>
      <BrowserRouter>
        <KeyboardShortcutsBinder />
        <ToastProvider>
          <CloseFeedbackBinder />
          <ToastViewport />
          <AuthProvider>
            <OrderProvider>
              <Routes>
                {/* Ruta de Login (Sin Layout) */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rutas protegidas (Con MainLayout y Sidebar) */}
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Navigate to="/ordenes" replace />} />
                  <Route path="/ordenes" element={<OrdersOfDayPending />} />
                  <Route path="/crear-orden" element={<CreateOrderPage />} />
                  <Route path="/facturas" element={<FacturasPage />} />
                  <Route path="/historial" element={<HistorialPage />} />
                  <Route path="/ajustes" element={<AjustesPage />} />
                </Route>
              </Routes>
            </OrderProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </AppInitialState>
  );
}

export default App;
