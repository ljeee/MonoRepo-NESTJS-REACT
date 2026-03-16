import { FormEvent, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ChefHat } from 'lucide-react';

export function LoginPage() {
    const { login, isLoading } = useAuth();
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(user, pass);
        } catch (err: any) {
            if (err?.response) {
                // Server responded with an error status
                setError(`Error ${err.response.status}: ${err.response.data?.message || JSON.stringify(err.response.data)}`);
            } else if (err?.request) {
                // Request was made but no response received (CORS, network, timeout)
                setError(`Sin respuesta del servidor. Verifica que el backend esté corriendo. (${err.message})`);
            } else {
                setError(`Error: ${err.message}`);
            }
        }
    };

    return (
        <div className="login-screen">
            <form onSubmit={handleLogin} className="login-card">
                <div className="login-header">
                    <ChefHat size={48} color="#f97316" />
                    <h2 className="login-title">POS Ingreso</h2>
                </div>

                {error && <div className="login-error" role="alert">{error}</div>}

                <input
                    placeholder="Usuario"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    aria-label="Usuario"
                    autoComplete="username"
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    aria-label="Contraseña"
                    autoComplete="current-password"
                />

                <button type="submit" disabled={isLoading} className="login-submit">
                    {isLoading ? 'Cargando...' : 'Iniciar Sesión'}
                </button>
            </form>
        </div>
    );
}
