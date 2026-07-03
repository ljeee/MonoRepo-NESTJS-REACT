import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { EmpresaConfig } from '../lib/types';

interface DatoProps {
  label: string;
  value?: string | null;
}

function Dato({ label, value }: DatoProps) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

export default function NosotrosPage() {
  const [empresa, setEmpresa] = useState<EmpresaConfig>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.empresa
      .get()
      .then((data) => {
        if (active) setEmpresa(data);
      })
      .catch(() => {
        // Si el API no responde se muestran los datos por defecto de la marca
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const nombre = empresa.nombreComercial || 'Dfiru Pizzería';
  const ubicacion = [empresa.municipio, empresa.departamento].filter(Boolean).join(', ');

  return (
    <main className="max-w-2xl mx-auto px-4 mt-6 pb-10 space-y-6">
      <section className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
        <span className="text-6xl block mb-4" aria-hidden="true">🍕</span>
        <h1 className="text-3xl font-bold mb-2">{nombre}</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Pizzas artesanales hechas al momento con ingredientes frescos. Pide en línea y recibe en
          la puerta de tu casa — nuestro domiciliario llega hasta tu ubicación exacta.
        </p>
      </section>

      <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold mb-4">Información</h2>
        {loading ? (
          <p className="text-center text-slate-500 py-4 animate-pulse">Cargando...</p>
        ) : (
          <div>
            <Dato label="Nombre comercial" value={nombre} />
            <Dato label="Razón social" value={empresa.razonSocial} />
            <Dato label="NIT" value={empresa.nit} />
            <Dato label="Dirección" value={empresa.direccion} />
            <Dato label="Teléfono" value={empresa.telefono} />
            <Dato label="Ubicación" value={ubicacion || null} />
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold mb-2">¿Cómo funciona?</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>Regístrate con tu número de celular.</li>
          <li>Elige tus pizzas y bebidas del menú.</li>
          <li>Fija la ubicación exacta de tu puerta en el mapa.</li>
          <li>Paga en efectivo o por transferencia al recibir.</li>
        </ol>
      </section>
    </main>
  );
}
