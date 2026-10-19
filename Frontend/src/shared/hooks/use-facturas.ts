import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useApi } from '../contexts/ApiContext';
import type { FacturaVenta, FacturaStats } from '../types/models';
import { cobrado, isAnulada, montoEfectivo, montoTransferencia } from '../domain/factura';
import { ordenarRecientesPrimero, traerPorCursor } from '../utils/paginas';
import { claveConsulta, consultarConCooldown } from '../utils/consultas';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const apiMessage = error.response?.data?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

// ─── Map raw API response ─────────────────────────────────────────────────────

export function mapFactura(rawFactura: unknown): FacturaVenta {
  const factura = asRecord(rawFactura);
  const rawOrdenes = asArray(factura.ordenes);
  const rawDomicilios = asArray(factura.domicilios);

  return {
    facturaId: typeof factura.facturaId === 'number' ? factura.facturaId : undefined,
    clienteNombre: typeof factura.clienteNombre === 'string' ? factura.clienteNombre : undefined,
    telefonoCliente: typeof factura.telefonoCliente === 'string' ? factura.telefonoCliente : null,
    fechaFactura: typeof factura.fechaFactura === 'string' ? factura.fechaFactura : undefined,
    fechaCobro: typeof factura.fechaCobro === 'string' ? factura.fechaCobro : null,
    total: numberOrZero(factura.total),
    // Sin este campo, el saldo de una factura con abono (estado 'parcial') se calculaba
    // como el total completo y el cajero volvía a cobrar lo ya abonado.
    montoPagado: factura.montoPagado != null ? numberOrZero(factura.montoPagado) : undefined,
    descripcion: typeof factura.descripcion === 'string' ? factura.descripcion : undefined,
    estado: typeof factura.estado === 'string' ? factura.estado : undefined,
    metodo: typeof factura.metodo === 'string' ? factura.metodo : undefined,
    pagoEfectivo: typeof factura.pagoEfectivo === 'number' || typeof factura.pagoEfectivo === 'string' ? numberOrZero(factura.pagoEfectivo) : undefined,
    pagoTransferencia: typeof factura.pagoTransferencia === 'number' || typeof factura.pagoTransferencia === 'string' ? numberOrZero(factura.pagoTransferencia) : undefined,
    cuentaTransferenciaId: typeof factura.cuentaTransferenciaId === 'number' ? factura.cuentaTransferenciaId : null,
    cuentaTransferenciaNombre: typeof factura.cuentaTransferenciaNombre === 'string' ? factura.cuentaTransferenciaNombre : null,
    desgloseTransferencia: asArray(factura.desgloseTransferencia).length
      ? asArray(factura.desgloseTransferencia).map((raw) => {
          const e = asRecord(raw);
          return {
            cuentaId: typeof e.cuentaId === 'number' ? e.cuentaId : null,
            cuenta: typeof e.cuenta === 'string' ? e.cuenta : null,
            monto: numberOrZero(e.monto),
          };
        })
      : null,
    ordenes: rawOrdenes.map((rawOrden) => {
      const orden = asRecord(rawOrden);
      const rawProductos = asArray(orden.productos);

      return {
        ordenId: typeof orden.ordenId === 'number' ? orden.ordenId : undefined,
        tipoPedido: typeof orden.tipoPedido === 'string' ? orden.tipoPedido : undefined,
        productos: rawProductos.map((rawProducto) => {
          const producto = asRecord(rawProducto);
          const productoRaw = producto.producto;
          const productoObj = asRecord(productoRaw);

          const cantidad = numberOrZero(producto.cantidad) || 1;
          let subtotal = numberOrZero(producto.subtotal);
          let precioUnitario = numberOrZero(producto.precioUnitario);

          // Fallback: calculate from subtotal if precioUnitario is missing
          if (precioUnitario === 0 && subtotal > 0) {
            precioUnitario = subtotal / cantidad;
          }

          // Also check nested variante.precio
          if (precioUnitario === 0) {
            const variante = asRecord(producto.variante);
            const variantePrecio = numberOrZero(variante.precio);
            if (variantePrecio > 0) precioUnitario = variantePrecio;
          }

          // Important: if subtotal is 0 but we have precioUnitario, calculate it
          if (subtotal === 0 && precioUnitario > 0) {
            subtotal = precioUnitario * cantidad;
          }

          const listaRaw = producto.precioLista;
          return {
            cantidad,
            precioUnitario,
            subtotal,
            productoNombre:
              typeof productoRaw === 'string'
                ? productoRaw
                : (typeof productoObj.nombre === 'string' ? productoObj.nombre : 'Producto'),
            // Para el libro diario: qué líneas se cobraron con precio cambiado a mano y cuál era el del menú.
            precioManual: producto.precioManual === true,
            precioLista: listaRaw === null || listaRaw === undefined || listaRaw === '' ? null : numberOrZero(listaRaw),
          };
        }),
      };
    }),
    domicilios: rawDomicilios.map((rawDomicilio) => {
      const domicilio = asRecord(rawDomicilio);
      const rawDomiciliario = asRecord(domicilio.domiciliario);
      return {
        costoDomicilio: numberOrZero(domicilio.costoDomicilio),
        direccionEntrega: typeof domicilio.direccionEntrega === 'string' ? domicilio.direccionEntrega : undefined,
        referencia:
          typeof domicilio.referenciaDomicilio === 'string'
            ? domicilio.referenciaDomicilio
            : typeof domicilio.referencia === 'string'
            ? domicilio.referencia
            : undefined,
        telefono: typeof domicilio.telefono === 'string' ? domicilio.telefono : undefined,
        domiciliario: domicilio.domiciliario
          ? {
              domiciliarioNombre:
                typeof rawDomiciliario.domiciliarioNombre === 'string'
                  ? rawDomiciliario.domiciliarioNombre
                  : undefined,
              telefono:
                typeof rawDomiciliario.telefono === 'string'
                  ? rawDomiciliario.telefono
                  : undefined,
            }
          : undefined,
      };
    }),
  };
}

export function calcStats(list: FacturaVenta[], activeFilter?: string): FacturaStats {
  const validas = list.filter((f) => !isAnulada(f));
  const porMetodo = activeFilter === 'efectivo' || activeFilter === 'transferencia' || activeFilter === 'qr';

  // Con filtro por método, una mixta solo aporta su parte de ese método (no el total).
  const totalDe = (f: FacturaVenta): number => {
    if (f.metodo === 'efectivo_transferencia') {
      if (activeFilter === 'efectivo') return Number(f.pagoEfectivo) || 0;
      if (activeFilter === 'transferencia' || activeFilter === 'qr') return Number(f.pagoTransferencia) || 0;
    }
    return Number(f.total) || 0;
  };
  // Cobrado con las definiciones del dominio: incluye abonos de las parciales (antes una
  // factura con abono contaba como 100% pendiente).
  const cobradoDe = (f: FacturaVenta): number =>
    !porMetodo ? cobrado(f) : activeFilter === 'efectivo' ? montoEfectivo(f) : montoTransferencia(f);

  const total = validas.reduce((s, f) => s + totalDe(f), 0);
  const pagado = validas.reduce((s, f) => s + cobradoDe(f), 0);
  return { totalDia: total, totalPagado: pagado, totalPendiente: Math.max(0, total - pagado), count: validas.length };
}

// ─── Facturas del Día ─────────────────────────────────────────────────────────

export function useFacturasDia() {
  const api = useApi();
  const [data, setData] = useState<FacturaVenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<FacturaStats>({ totalDia: 0, totalPagado: 0, totalPendiente: 0, count: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await api.facturas.getDay();
      const mapped = raw.map(mapFactura);
      setData(mapped);
      try {
        setStats(await api.facturas.getDayStats());
      } catch {
        setStats(calcStats(mapped));
      }
      setLoading(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al cargar facturas del día'));
      setLoading(false);
    }
  }, [api]);

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  return { data, loading, error, refetch: fetchData, stats, updateEstado, updateFactura };
}

// ─── Facturas por Rango ───────────────────────────────────────────────────────
// NOTE: limit is a primitive number (not an object) to keep it stable across
// renders and prevent infinite re-render loops caused by object reference
// instability in useCallback/useEffect dependency arrays.

/**
 * `limit` que pide TODO el rango al servidor (sin paginar). Es el valor por defecto: la
 * contabilidad no admite topes silenciosos (antes se cortaba a 50 por página y los totales o
 * las exportaciones solo veían esa página). Si una pantalla necesita paginar, que lo haga
 * en el cliente sobre el conjunto completo y con los totales del servidor.
 */
export const SIN_LIMITE = 0;

export function useFacturasRango(limit: number = SIN_LIMITE, { conTransferencia = false }: { conTransferencia?: boolean } = {}) {
  const api = useApi();
  const [data, setData] = useState<FacturaVenta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<FacturaStats>({ totalDia: 0, totalPagado: 0, totalPendiente: 0, count: 0 });
  /** Avance de la carga por tandas de un rango completo (null = no se está cargando por tandas). */
  const [progreso, setProgreso] = useState<{ cargadas: number; total: number } | null>(null);
  /** Cuándo devolvió el servidor lo que se ve, y si salió del cooldown (búsqueda repetida, sin petición). */
  const [actualizadoEn, setActualizadoEn] = useState<number | null>(null);
  const [desdeCache, setDesdeCache] = useState(false);
  /** Solo se pinta la respuesta de la búsqueda más reciente (dos seguidas no se pisan). */
  const idPeticion = useRef(0);

  const [estado, setEstado] = useState<string | undefined>(undefined);
  const [clienteNombre, setClienteNombre] = useState<string | undefined>(undefined);
  const [metodo, setMetodo] = useState<string | undefined>(undefined);
  const [cuentaTransferenciaId, setCuentaTransferenciaId] = useState<number | undefined>(undefined);

  const fromRef = useRef(from);
  const toRef = useRef(to);
  const pageRef = useRef(page);
  const estadoRef = useRef(estado);
  const clienteNombreRef = useRef(clienteNombre);
  const metodoRef = useRef(metodo);
  const cuentaTransferenciaIdRef = useRef(cuentaTransferenciaId);

  useEffect(() => { fromRef.current = from; }, [from]);
  useEffect(() => { toRef.current = to; }, [to]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { estadoRef.current = estado; }, [estado]);
  useEffect(() => { clienteNombreRef.current = clienteNombre; }, [clienteNombre]);
  useEffect(() => { metodoRef.current = metodo; }, [metodo]);
  useEffect(() => { cuentaTransferenciaIdRef.current = cuentaTransferenciaId; }, [cuentaTransferenciaId]);

  const fetchData = useCallback(async (f?: string, t?: string, p?: number, est?: string, cli?: string, met?: string, cuentaId?: number, { forzar = false }: { forzar?: boolean } = {}) => {
    const finalFrom = f ?? fromRef.current;
    const finalTo = t ?? toRef.current;
    const finalPage = p ?? pageRef.current;
    const finalEstado = est !== undefined ? est : estadoRef.current;
    const finalClienteNombre = cli !== undefined ? cli : clienteNombreRef.current;
    const finalMetodo = met !== undefined ? met : metodoRef.current;
    const finalCuentaId = cuentaId !== undefined ? cuentaId : cuentaTransferenciaIdRef.current;
    if (!finalFrom || !finalTo) return;

    const id = ++idPeticion.current;
    setLoading(true);
    setError(null);
    try {
      const filtros = {
        from: finalFrom,
        to: finalTo,
        estado: finalEstado || undefined,
        clienteNombre: finalClienteNombre || undefined,
        metodo: finalMetodo || undefined,
        cuentaTransferenciaId: finalCuentaId || undefined,
        conTransferencia: conTransferencia || undefined,
      };
      // Rango completo: por tandas con cursor (no una respuesta gigante, y sin duplicar ni perder facturas
      // que entran mientras se descarga), pero la pantalla recibe TODO. Con cooldown: repetir la misma
      // búsqueda no la vuelve a descargar; cualquier escritura invalida (services/api.ts).
      const completo = limit === SIN_LIMITE;
      const r = await consultarConCooldown(
        claveConsulta(completo ? 'facturas:rango' : 'facturas:pagina', completo ? filtros : { ...filtros, page: finalPage, limit }),
        () =>
          completo
            ? traerPorCursor(
                ({ cursor, limite, pagina }) => api.facturas.getAll({ ...filtros, cursor, limit: limite, page: pagina }),
                (fv) => fv.facturaId ?? '',
                { onProgreso: (cargadas, total) => { if (id === idPeticion.current) setProgreso({ cargadas, total }); } },
              ).then((x) => ({
                data: ordenarRecientesPrimero(x.data, (fv) => fv.fechaFactura, (fv) => fv.facturaId ?? 0),
                total: x.total,
                totalPages: 1,
                page: 1,
              }))
            : api.facturas.getAll({ ...filtros, page: finalPage, limit }),
        { forzar },
      );
      if (id !== idPeticion.current) return; // llegó una búsqueda más nueva
      const response = r.valor;
      setActualizadoEn(r.obtenidoEn);
      setDesdeCache(r.desdeCache);
      const mapped = response.data.map(mapFactura);
      setData(mapped);
      setTotalPages(response.totalPages);
      setTotalCount(response.total);
      setPage(response.page);
      setStats(calcStats(mapped));
      setProgreso(null);
      setLoading(false);
    } catch (error: unknown) {
      if (id !== idPeticion.current) return;
      setError(getErrorMessage(error, 'Error al cargar facturas'));
      setProgreso(null);
      setLoading(false);
    }
  }, [api, limit, conTransferencia]);

  /** Repite la última búsqueda saltándose el cooldown (deslizar para recargar). */
  const recargar = useCallback(
    () => fetchData(undefined, undefined, undefined, undefined, undefined, undefined, undefined, { forzar: true }),
    [fetchData],
  );

  const updateEstado = useCallback(async (facturaId: number, nuevoEstado: string) => {
    try {
      await api.facturas.updateEstado(facturaId, nuevoEstado);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  const updateFactura = useCallback(async (facturaId: number, data: Partial<FacturaVenta>) => {
    try {
      await api.facturas.update(facturaId, data);
      await fetchData();
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al actualizar factura'));
    }
  }, [api, fetchData]);

  const deleteFactura = useCallback(async (facturaId: number): Promise<boolean> => {
    try {
      await api.facturas.delete(facturaId);
      await fetchData();
      return true;
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Error al eliminar factura'));
      return false;
    }
  }, [api, fetchData]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
    pageRef.current = p;
    fetchData(undefined, undefined, p);
  }, [fetchData]);

  // Reset page to 1 when doing a brand-new search
  const search = useCallback((f: string, t: string, est?: string, cli?: string, met?: string, cuentaId?: number) => {
    setPage(1);
    pageRef.current = 1;
    setEstado(est);
    estadoRef.current = est;
    setClienteNombre(cli);
    clienteNombreRef.current = cli;
    setMetodo(met);
    metodoRef.current = met;
    setCuentaTransferenciaId(cuentaId);
    cuentaTransferenciaIdRef.current = cuentaId;
    fetchData(f, t, 1, est, cli, met, cuentaId);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    from,
    to,
    setFrom,
    setTo,
    estado,
    setEstado,
    clienteNombre,
    setClienteNombre,
    fetchData,
    recargar,
    search,
    stats,
    updateEstado,
    updateFactura,
    deleteFactura,
    page,
    progreso,
    actualizadoEn,
    desdeCache,
    totalPages,
    total: totalCount,
    goToPage,
    limit,
  };
}
