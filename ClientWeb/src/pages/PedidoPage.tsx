import { useCallback, useEffect, useState } from 'react';
import MapPicker from '../components/MapPicker';
import { api, getApiErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type {
  CartItem,
  CreateOrdenPayload,
  PizzaSabor,
  Producto,
  ProductoVariante,
} from '../lib/types';

const COSTO_DOMICILIO = 5000;
const DEFAULT_POSITION = { lat: 6.2442, lng: -75.5812 };
const MAX_SABORES = 3;

const currencyFormatter = new Intl.NumberFormat('es-CO');
const formatCOP = (n: number) => `$${currencyFormatter.format(n)}`;

const inputClass =
  'w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';

const sectionClass =
  'bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700';

// Misma lógica que Frontend/src/shared/utils/personalizacion.ts (y el backend)
type Personalizacion = 'pizza' | 'calzone' | 'jugo' | 'ninguna';

function resolverPersonalizacion(producto: Producto): Personalizacion {
  const p = producto.personalizacion;
  if (p === 'pizza' || p === 'calzone' || p === 'jugo' || p === 'ninguna') return p;
  const n = (producto.productoNombre || '').toLowerCase();
  if (n.includes('pizza') && !n.includes('burguer')) return 'pizza';
  if (n.includes('calzone')) return 'calzone';
  if (n.includes('jugo')) return 'jugo';
  return 'ninguna';
}

function saboresParaProducto(personalizacion: Personalizacion, sabores: PizzaSabor[]): PizzaSabor[] {
  if (personalizacion === 'pizza') {
    return sabores.filter((s) => s.activo && (s.tipo === 'tradicional' || s.tipo === 'especial'));
  }
  if (personalizacion === 'calzone') {
    return sabores.filter((s) => s.activo && s.tipo === 'calzone');
  }
  return [];
}

// ─── Card de producto del catálogo ────────────────────────────────────────────

interface ProductoCardProps {
  producto: Producto;
  sabores: PizzaSabor[];
  onAdd: (item: CartItem) => void;
}

function ProductoCard({ producto, sabores, onAdd }: ProductoCardProps) {
  const variantes = (producto.variantes ?? []).filter((v) => v.activo);
  const personalizacion = resolverPersonalizacion(producto);
  const saboresDisponibles = saboresParaProducto(personalizacion, sabores);
  const necesitaSabores = saboresDisponibles.length > 0;

  const [varianteId, setVarianteId] = useState<number | undefined>(variantes[0]?.varianteId);
  const [selectedSabores, setSelectedSabores] = useState<string[]>([]);
  const [base, setBase] = useState<'leche' | 'agua'>('agua');
  const [aviso, setAviso] = useState('');

  if (variantes.length === 0) return null;

  const variante: ProductoVariante =
    variantes.find((v) => v.varianteId === varianteId) ?? variantes[0];

  const precio =
    personalizacion === 'jugo' && base === 'leche' && variante.precioLeche != null
      ? variante.precioLeche
      : variante.precio;

  const toggleSabor = (nombre: string) => {
    setAviso('');
    setSelectedSabores((prev) => {
      if (prev.includes(nombre)) return prev.filter((s) => s !== nombre);
      if (prev.length >= MAX_SABORES) return prev;
      return [...prev, nombre];
    });
  };

  const handleAdd = () => {
    if (necesitaSabores && selectedSabores.length === 0) {
      setAviso('Elige al menos un sabor');
      return;
    }
    onAdd({
      id: `${producto.productoId}-${variante.varianteId}-${selectedSabores.join('|')}-${personalizacion === 'jugo' ? base : ''}`,
      productoId: producto.productoId,
      productoNombre: producto.productoNombre,
      varianteId: variante.varianteId,
      varianteNombre: variante.nombre,
      precio,
      cantidad: 1,
      sabores: selectedSabores.length > 0 ? selectedSabores : undefined,
    });
    setSelectedSabores([]);
    setAviso('');
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {producto.emoji ? `${producto.emoji} ` : ''}
            {producto.productoNombre}
          </p>
          {producto.descripcion ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{producto.descripcion}</p>
          ) : null}
        </div>
        <span className="font-bold text-[#c97e06] dark:text-[#f5a524] whitespace-nowrap">
          {formatCOP(precio)}
        </span>
      </div>

      {variantes.length > 1 ? (
        <select
          value={variante.varianteId}
          onChange={(e) => setVarianteId(Number(e.target.value))}
          className="mt-3 w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
        >
          {variantes.map((v) => (
            <option key={v.varianteId} value={v.varianteId}>
              {v.nombre} — {formatCOP(v.precio)}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{variante.nombre}</p>
      )}

      {personalizacion === 'jugo' ? (
        <div className="mt-3 flex gap-2">
          {(['agua', 'leche'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBase(b)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                base === b
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
            >
              En {b}
            </button>
          ))}
        </div>
      ) : null}

      {necesitaSabores ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            Sabores (hasta {MAX_SABORES})
          </p>
          <div className="flex flex-wrap gap-2">
            {saboresDisponibles.map((s) => {
              const selected = selectedSabores.includes(s.nombre);
              return (
                <button
                  key={s.saborId}
                  type="button"
                  onClick={() => toggleSabor(s.nombre)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selected
                      ? 'border-[#f5a524] bg-[#f5a524]/15 text-[#c97e06] dark:text-[#f5a524] font-medium'
                      : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {s.nombre}
                  {s.tipo === 'especial' ? ' ★' : ''}
                </button>
              );
            })}
          </div>
          {aviso ? <p className="text-xs text-red-500 mt-2">{aviso}</p> : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAdd}
        className="mt-4 w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
      >
        Agregar al pedido
      </button>
    </div>
  );
}

// ─── Página de pedido ─────────────────────────────────────────────────────────

export default function PedidoPage() {
  const { user } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [sabores, setSabores] = useState<PizzaSabor[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [formData, setFormData] = useState({
    nombre: user?.name || '',
    direccion: '',
    referencia: '',
    metodo: 'efectivo' as 'efectivo' | 'transferencia',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const loadCatalog = useCallback(() => {
    setCatalogLoading(true);
    setCatalogError('');
    Promise.all([api.productos.getAll(), api.pizzaSabores.getAll()])
      .then(([prods, sabs]) => {
        setProductos(prods.filter((p) => p.activo && (p.variantes ?? []).some((v) => v.activo)));
        setSabores(sabs);
      })
      .catch((err) => {
        setCatalogError(getApiErrorMessage(err, 'No se pudo cargar el menú.'));
      })
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, item];
    });
  }, []);

  const changeCantidad = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  };

  const subtotal = cart.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  const resetAll = () => {
    setCart([]);
    setFormData({ nombre: user?.name || '', direccion: '', referencia: '', metodo: 'efectivo' });
    setPosition(DEFAULT_POSITION);
    setSuccess(false);
    setError('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (cart.length === 0) {
      setError('Agrega al menos un producto al pedido.');
      return;
    }
    setLoading(true);
    setError('');

    // Contrato de POST /ordenes (CreateOrdenesDto) — mismo shape que envía el POS
    const payload: CreateOrdenPayload = {
      tipoPedido: 'domicilio',
      telefonoCliente: user.username,
      nombreCliente: formData.nombre || undefined,
      direccionCliente: formData.direccion,
      referenciaCliente: formData.referencia || undefined,
      latitudCliente: position.lat,
      longitudCliente: position.lng,
      metodo: formData.metodo,
      costoDomicilio: COSTO_DOMICILIO,
      productos: cart.map((i) => ({
        tipo: i.productoNombre,
        productoId: i.productoId,
        varianteId: i.varianteId,
        cantidad: i.cantidad,
        sabor1: i.sabores?.[0],
        sabor2: i.sabores?.[1],
        sabor3: i.sabores?.[2],
      })),
    };

    try {
      await api.ordenes.create(payload);
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, 'Hubo un problema al crear tu orden. Intenta de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">¡Orden Recibida!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Tu pedido está en preparación. El domiciliario podrá ver la ubicación exacta de tu puerta.
          </p>
          <button
            onClick={resetAll}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold"
          >
            Nueva Orden
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 mt-6 pb-10">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Menú */}
        <section className={sectionClass}>
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-sm">1</span>
            Elige tus productos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Menú de Dfiru Pizzería. Los sabores especiales (★) pueden tener recargo.
          </p>

          {catalogLoading ? (
            <p className="text-center text-slate-500 py-8 animate-pulse">Cargando menú...</p>
          ) : catalogError ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-3">{catalogError}</p>
              <button
                type="button"
                onClick={loadCatalog}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm"
              >
                Reintentar
              </button>
            </div>
          ) : productos.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No hay productos disponibles.</p>
          ) : (
            <div className="space-y-4">
              {productos.map((p) => (
                <ProductoCard key={p.productoId} producto={p} sabores={sabores} onAdd={addToCart} />
              ))}
            </div>
          )}
        </section>

        {/* Carrito */}
        <section className={sectionClass}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-sm">2</span>
            Tu pedido
          </h2>

          {cart.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aún no has agregado productos.
            </p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.productoNombre} · {item.varianteNombre}
                    </p>
                    {item.sabores && item.sabores.length > 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.sabores.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeCantidad(item.id, -1)}
                      className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                      aria-label={`Quitar uno de ${item.productoNombre}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-bold">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => changeCantidad(item.id, 1)}
                      className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                      aria-label={`Agregar uno de ${item.productoNombre}`}
                    >
                      +
                    </button>
                    <span className="w-20 text-right font-medium">
                      {formatCOP(item.precio * item.cantidad)}
                    </span>
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-1 text-sm">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatCOP(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Domicilio</span>
                  <span>{formatCOP(COSTO_DOMICILIO)}</span>
                </div>
                <div className="flex justify-between font-bold text-base">
                  <span>Total estimado</span>
                  <span>{formatCOP(subtotal + COSTO_DOMICILIO)}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Ubicación */}
        <section className={sectionClass}>
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-sm">3</span>
            Fija tu ubicación
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Mueve el mapa para señalar la puerta exacta de tu casa. Esto ayudará a nuestro
            domiciliario.
          </p>
          <MapPicker position={position} onPositionChange={setPosition} />
        </section>

        {/* Datos */}
        <section className={sectionClass}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-sm">4</span>
            Tus Datos
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Celular</label>
              <input
                disabled
                value={user?.username ?? ''}
                type="tel"
                className={`${inputClass} opacity-60 cursor-not-allowed`}
              />
              <p className="text-xs text-slate-400 mt-1">El pedido queda a nombre de tu cuenta.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Nombre Completo</label>
              <input
                required
                name="nombre"
                value={formData.nombre}
                onChange={handleInputChange}
                type="text"
                className={inputClass}
                placeholder="Ej. Juan Pérez"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Dirección Escrita</label>
              <input
                required
                name="direccion"
                value={formData.direccion}
                onChange={handleInputChange}
                type="text"
                className={inputClass}
                placeholder="Ej. Calle 10 # 5-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Referencia o Detalles <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                name="referencia"
                value={formData.referencia}
                onChange={handleInputChange}
                type="text"
                className={inputClass}
                placeholder="Ej. Casa de rejas azules, al lado de la tienda"
              />
            </div>
          </div>
        </section>

        {/* Pago */}
        <section className={sectionClass}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-sm">5</span>
            Método de Pago
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <label
              className={`border rounded-xl p-4 cursor-pointer transition-all text-center flex flex-col items-center gap-2 ${formData.metodo === 'efectivo' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <input
                type="radio"
                name="metodo"
                value="efectivo"
                checked={formData.metodo === 'efectivo'}
                onChange={handleInputChange}
                className="sr-only"
              />
              <span className="text-2xl">💵</span>
              <span className="font-medium">Efectivo</span>
            </label>

            <label
              className={`border rounded-xl p-4 cursor-pointer transition-all text-center flex flex-col items-center gap-2 ${formData.metodo === 'transferencia' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <input
                type="radio"
                name="metodo"
                value="transferencia"
                checked={formData.metodo === 'transferencia'}
                onChange={handleInputChange}
                className="sr-only"
              />
              <span className="text-2xl">📱</span>
              <span className="font-medium">Transferencia</span>
            </label>
          </div>
        </section>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || cart.length === 0}
          className="w-full bg-[#f5a524] hover:bg-[#e49413] text-black py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-pulse">Procesando...</span>
          ) : (
            `Confirmar Pedido${cart.length > 0 ? ` · ${formatCOP(subtotal + COSTO_DOMICILIO)}` : ''}`
          )}
        </button>
      </form>
    </main>
  );
}
