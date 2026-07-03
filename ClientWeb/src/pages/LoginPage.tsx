import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';

export default function LoginPage() {
  const { login, registro } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [mode, setMode] = useState<'login' | 'registro'>('login');
  const [telefono, setTelefono] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(telefono, password);
      } else {
        await registro(telefono, password, nombre);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          mode === 'login'
            ? 'No se pudo iniciar sesión. Verifica tu teléfono y contraseña.'
            : 'No se pudo crear la cuenta. Intenta de nuevo.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-md mx-auto px-4 mt-10 pb-10">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-2xl font-bold mb-1">
          {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {mode === 'login'
            ? 'Ingresa con tu celular para hacer tu pedido.'
            : 'Regístrate con tu celular para pedir a domicilio.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-telefono" className="block text-sm font-medium mb-1">Celular</label>
            <input
              id="login-telefono"
              required
              type="tel"
              inputMode="numeric"
              pattern="\d{7,15}"
              maxLength={15}
              title="Entre 7 y 15 dígitos, solo números"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={inputClass}
              placeholder="Ej. 3001234567"
              autoComplete="tel"
            />
          </div>

          {mode === 'registro' && (
            <div>
              <label htmlFor="login-nombre" className="block text-sm font-medium mb-1">
                Nombre <span className="text-slate-500 dark:text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                id="login-nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
                placeholder="Ej. Juan Pérez"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium mb-1">Contraseña</label>
            <input
              id="login-password"
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="Mínimo 8 caracteres"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#f5a524] hover:bg-[#e49413] text-black py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
          >
            {loading ? (
              <span className="animate-pulse">Procesando...</span>
            ) : mode === 'login' ? (
              'Ingresar'
            ) : (
              'Crear cuenta'
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'registro' : 'login');
            setError('');
          }}
          className="w-full mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          {mode === 'login'
            ? '¿No tienes cuenta? Regístrate'
            : '¿Ya tienes cuenta? Ingresa'}
        </button>
      </div>
    </main>
  );
}
