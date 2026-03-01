import { FormEvent, useEffect, useState } from 'react';
import { setApiBaseUrl } from '../services/api';
import { getBackendUrl, setBackendUrl as persistBackendUrl, validateBackendUrl } from '../services/settings';

export function AjustesPage() {
  const [backendUrl, setBackendUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function loadSettings() {
      const savedUrl = await getBackendUrl();
      setBackendUrl(savedUrl);
      setLoading(false);
    }

    loadSettings();
  }, []);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      if (!validateBackendUrl(backendUrl)) {
        setMessage('No se pudo guardar la configuración: URL inválida.');
        return;
      }
      const value = await persistBackendUrl(backendUrl);
      setApiBaseUrl(value);
      setMessage('Configuración guardada correctamente.');
    } catch {
      setMessage('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Cargando ajustes...</div>;
  }

  const messageClassName = message
    ? `desk-message ${message.startsWith('No ') ? 'desk-danger-text' : 'desk-success-text'}`
    : '';

  return (
    <div className="desk-grid">
      <section className="desk-card">
        <h2 className="desk-title-no-margin">Ajustes Avanzados</h2>
        <p className="desk-subtle-text desk-title-no-margin">
          Configura la URL del backend y parámetros operativos locales.
        </p>

        <form onSubmit={handleSave}>
          <label className="desk-form-label">URL Backend</label>
          <input
            type="url"
            value={backendUrl}
            onChange={(event) => setBackendUrl(event.target.value)}
            placeholder="http://localhost:3000"
            required
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </form>

        {message && <div className={messageClassName}>{message}</div>}
      </section>

      <section className="desk-card">
        <h3 className="desk-title-no-margin">Atajos de Teclado</h3>
        <ul className="desk-list-tight">
          <li>F1: Crear orden</li>
          <li>F2: Órdenes pendientes</li>
          <li>F3: Facturas</li>
        </ul>
      </section>
    </div>
  );
}