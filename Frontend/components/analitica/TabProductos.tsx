import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { DataTable, Icon, Paginator, SearchInput, SegmentedControl } from '../ui';
import type { DataTableColumn } from '../ui/DataTable';
import { BarList, ChartCard, ColumnChart, LineChart, colorVariacion, formatearValor, variacion } from '../charts';
import { claveConsulta, useApi } from '@/src/shared';
import type { AgrupacionProductos, FilaProductoAnalitica, OrdenProductos } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { useBreakpoint } from '../../styles/responsive';
import { downloadCsv, escapeCsvValue } from '../../utils/csvExport';
import type { PropsTabAnalitica } from './tipos';
import { TextoError } from './TabResumen';
import { etiquetaCategoria, etiquetaPeriodo, etiquetaTamano } from './etiquetas';

const POR_PAGINA = 25;
/** Filas por petición al exportar (tope del endpoint): se recorren todas las páginas. */
const LOTE_EXPORTAR = 500;

const AGRUPACIONES: { value: AgrupacionProductos; label: string }[] = [
  { value: 'producto', label: 'Producto' },
  { value: 'variante', label: 'Variante' },
  { value: 'tamano', label: 'Tamaño' },
  { value: 'categoria', label: 'Categoría' },
];

const COLUMNA_ORDEN: Record<string, OrdenProductos> = { unidades: 'unidades', ingresos: 'ingresos', veces: 'veces' };

/** Nombre legible de la fila según la agrupación (tamaño y categoría llegan como clave). */
function nombreFila(f: FilaProductoAnalitica, agrupar: AgrupacionProductos) {
  if (agrupar === 'tamano') return etiquetaTamano(f.clave) || 'Sin tamaño';
  if (agrupar === 'categoria') return etiquetaCategoria(f.clave);
  return f.nombre;
}

export function TabProductos({ consulta, version, onFiltrar }: PropsTabAnalitica) {
  const api = useApi();
  const { isMobile } = useBreakpoint();
  const [agrupar, setAgrupar] = useState<AgrupacionProductos>('producto');
  const [orden, setOrden] = useState<OrdenProductos>('unidades');
  const [texto, setTexto] = useState('');
  const [exportando, setExportando] = useState(false);

  // Búsqueda con espera: no consultar en cada tecla.
  const q = useDebouncedValue(texto.trim(), 350);

  // Cualquier cambio de criterio vuelve a la primera página EN EL MISMO render (antes un efecto la reiniciaba
  // después: se pedía la página vieja con el criterio nuevo y luego la 1, dos peticiones).
  const criterio = useMemo(() => claveConsulta('productos', { ...consulta, agrupar, orden, q }), [consulta, agrupar, orden, q]);
  const [paginaDe, setPaginaDe] = useState({ criterio, pagina: 1 });
  const pagina = paginaDe.criterio === criterio ? paginaDe.pagina : 1;
  const setPagina = useCallback((p: number) => setPaginaDe({ criterio, pagina: p }), [criterio]);

  const params = useMemo(
    () => ({ ...consulta, agrupar, orden, q: q || undefined, limit: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA }),
    [consulta, agrupar, orden, q, pagina],
  );
  const tabla = useConsulta(() => api.analitica.productos(params), [api, params, version], {
    clave: claveConsulta('analitica:productos', params),
  });

  const productoUnico = consulta.productoId?.length === 1 ? consulta.productoId[0] : null;

  const alTocarFila = useCallback(
    (f: FilaProductoAnalitica) => {
      if (agrupar === 'producto' && f.productoId) onFiltrar('productoId', [f.productoId]);
      else if (agrupar === 'tamano' && f.clave) onFiltrar('tamano', [f.clave as never]);
      else if (agrupar === 'categoria' && f.clave) onFiltrar('categoria', [f.clave as never]);
      else if (agrupar === 'variante' && f.productoId) onFiltrar('productoId', [f.productoId]);
    },
    [agrupar, onFiltrar],
  );

  const columnas = useMemo<DataTableColumn<FilaProductoAnalitica>[]>(
    () => [
      {
        key: 'nombre',
        label: AGRUPACIONES.find((a) => a.value === agrupar)?.label ?? 'Nombre',
        render: (f) => (
          <Text className="text-white text-xs font-bold" numberOfLines={2}>
            {nombreFila(f, agrupar)}
          </Text>
        ),
      },
      {
        key: 'unidades',
        label: 'Unidades',
        width: 96,
        align: 'right',
        sortable: true,
        render: (f) => <CeldaNumero valor={f.unidades} anterior={f.anterior?.unidades} pct={f.pctUnidades} />,
      },
      {
        key: 'ingresos',
        label: 'Ingresos',
        width: 112,
        align: 'right',
        sortable: true,
        render: (f) => <CeldaNumero valor={f.ingresos} anterior={f.anterior?.ingresos} pct={f.pctIngresos} moneda />,
      },
      {
        key: 'veces',
        label: 'Órdenes',
        width: 80,
        align: 'right',
        sortable: true,
        render: (f) => <Text className="text-slate-300 text-xs font-black">{formatearValor(f.veces)}</Text>,
      },
      {
        key: 'precio',
        label: 'Precio prom.',
        width: 100,
        align: 'right',
        render: (f) => <Text className="text-slate-400 text-xs font-bold">{formatearValor(f.precioPromedio, 'moneda')}</Text>,
      },
    ],
    [agrupar],
  );

  const exportar = useCallback(async () => {
    setExportando(true);
    try {
      // TODAS las filas: de LOTE_EXPORTAR en LOTE_EXPORTAR hasta el total (antes se cortaba en 500).
      const filas: FilaProductoAnalitica[] = [];
      for (let offset = 0; ; offset += LOTE_EXPORTAR) {
        const r = await api.analitica.productos({ ...consulta, agrupar, orden, q: q || undefined, limit: LOTE_EXPORTAR, offset });
        filas.push(...r.filas);
        if (r.filas.length < LOTE_EXPORTAR || filas.length >= r.total) break;
      }
      const encabezado = ['Nombre', 'Unidades', '% unidades', 'Ingresos', '% ingresos', 'Órdenes', 'Precio promedio'];
      const lineas = filas.map((f) =>
        [nombreFila(f, agrupar), f.unidades, f.pctUnidades, f.ingresos, f.pctIngresos, f.veces, Math.round(f.precioPromedio)]
          .map((v) => escapeCsvValue(String(v)))
          .join(','),
      );
      downloadCsv([encabezado.join(','), ...lineas].join('\n'), `productos_${agrupar}_${consulta.from}_${consulta.to}.csv`);
    } finally {
      setExportando(false);
    }
  }, [api, consulta, agrupar, orden, q]);

  const total = tabla.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <View style={styles.columna}>
      {productoUnico != null && <DetalleProducto productoId={productoUnico} {...{ consulta, version, isMobile }} />}

      <ChartCard
        title="Ventas por producto"
        subtitle={
          tabla.data
            ? `${formatearValor(tabla.data.totales.unidades)} unidades · ${formatearValor(tabla.data.totales.ingresos, 'moneda')}`
            : undefined
        }
        icon="table"
        color="#10B981"
        right={
          Platform.OS === 'web' ? (
            <Pressable
              onPress={exportar}
              disabled={exportando || !total}
              className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10"
              style={exportando || !total ? styles.deshabilitado : undefined}
            >
              <Icon name="download" size={14} color="#94A3B8" />
              <Text className="text-slate-300 text-[10px] font-black uppercase">{exportando ? 'Exportando…' : 'CSV'}</Text>
            </Pressable>
          ) : undefined
        }
      >
        <View style={styles.controles}>
          <SegmentedControl options={AGRUPACIONES} value={agrupar} onChange={setAgrupar} color="#10B981" />
          <SearchInput value={texto} onChangeText={setTexto} />
        </View>

        {tabla.error ? (
          <TextoError mensaje={tabla.error} />
        ) : (
          <DataTable
            columns={columnas}
            rows={tabla.data?.filas ?? []}
            rowKey={(f) => f.clave}
            sortKey={orden}
            onSort={(k) => COLUMNA_ORDEN[k] && setOrden(COLUMNA_ORDEN[k])}
            onRowPress={alTocarFila}
            minWidth={560}
            emptyText={tabla.loading ? 'Cargando…' : q ? `Nada coincide con "${q}"` : 'Sin ventas en el período'}
          />
        )}
        {totalPaginas > 1 && (
          <Paginator page={pagina} totalPages={totalPaginas} onChange={setPagina} caption={`${formatearValor(total)} filas`} />
        )}
        <Text className="text-slate-600 text-[10px] font-bold mt-3">
          Toca una fila para filtrar todo el tablero por ella.
        </Text>
      </ChartCard>
    </View>
  );
}

const CeldaNumero = React.memo(function CeldaNumero({
  valor,
  anterior,
  pct,
  moneda,
}: {
  valor: number;
  anterior?: number | null;
  pct: number;
  moneda?: boolean;
}) {
  const delta = anterior != null ? variacion(valor, anterior) : null;
  return (
    <View style={styles.celdaNumero}>
      <Text className="text-white text-xs font-black">{formatearValor(valor, moneda ? 'monedaCompacta' : 'numero')}</Text>
      <Text className="text-slate-500 text-[9px] font-bold">
        {pct}%
        {delta != null && <Text style={{ color: colorVariacion(delta) }}>{` · ${delta > 0 ? '+' : ''}${delta}%`}</Text>}
      </Text>
    </View>
  );
});

/** Drill-down de un producto: tendencia, mezcla por tamaño, sabores y horas. */
function DetalleProducto({
  productoId,
  consulta,
  version,
  isMobile,
}: {
  productoId: number;
  consulta: PropsTabAnalitica['consulta'];
  version: number;
  isMobile: boolean;
}) {
  const api = useApi();
  const filtros = useMemo(() => ({ ...consulta, productoId: [productoId] }), [consulta, productoId]);
  const serie = useConsulta(() => api.analitica.serie(filtros), [api, filtros, version], { clave: claveConsulta('analitica:serie', filtros) });
  const tamanos = useConsulta(() => api.analitica.productos({ ...filtros, agrupar: 'tamano', limit: 10 }), [api, filtros, version], {
    clave: claveConsulta('analitica:productos', { ...filtros, agrupar: 'tamano', limit: 10 }),
  });
  const sabores = useConsulta(() => api.analitica.sabores({ ...filtros, limit: 8 }), [api, filtros, version], {
    clave: claveConsulta('analitica:sabores', { ...filtros, limit: 8 }),
  });
  const horarios = useConsulta(() => api.analitica.horarios(filtros), [api, filtros, version], { clave: claveConsulta('analitica:horarios', filtros) });
  const ancho = isMobile ? 'w-full' : 'w-[calc(50%-8px)]';

  const puntos = (serie.data?.puntos ?? []).map((p) => ({
    key: p.periodo,
    label: etiquetaPeriodo(p.periodo, serie.data?.granularidad ?? 'dia'),
    value: p.unidades,
  }));
  const tieneTamanos = (tamanos.data?.filas ?? []).some((f) => f.clave);

  return (
    <View style={styles.grilla}>
      <ChartCard className="w-full" title="Unidades en el tiempo" icon="chart-line" color="#14B8A6" loading={serie.loading} empty={!puntos.some((p) => p.value > 0)}>
        <LineChart
          data={puntos}
          comparison={serie.data?.anterior?.map((p) => p.unidades) ?? null}
          color="#14B8A6"
          labelEvery={Math.max(1, Math.ceil(puntos.length / 8))}
        />
      </ChartCard>
      {tieneTamanos && (
        <ChartCard className={ancho} title="Por tamaño" icon="resize" color="#3B82F6" loading={tamanos.loading}>
          <BarList
            ranked={false}
            color="#3B82F6"
            items={(tamanos.data?.filas ?? []).map((f) => ({
              key: f.clave || 'sin',
              label: etiquetaTamano(f.clave) || 'Sin tamaño',
              value: f.unidades,
              sublabel: `${f.pctUnidades}% · ${formatearValor(f.ingresos, 'monedaCompacta')}`,
            }))}
          />
        </ChartCard>
      )}
      {!!sabores.data?.filas.length && (
        <ChartCard className={ancho} title="Sabores en este producto" icon="pizza" color="#FB923C" loading={sabores.loading}>
          <BarList
            color="#FB923C"
            items={sabores.data.filas.map((s) => ({
              key: s.clave,
              label: s.nombre,
              value: s.apariciones,
              sublabel: `${s.pct}%`,
              muted: s.sinClasificar,
            }))}
          />
        </ChartCard>
      )}
      <ChartCard className="w-full" title="Horas en que se pide" icon="clock-outline" color="#A855F7" loading={horarios.loading} empty={!horarios.data?.porHora.some((h) => h.facturas > 0)}>
        <ColumnChart
          color="#A855F7"
          data={(horarios.data?.porHora ?? []).map((h) => ({ key: String(h.hora), label: `${h.hora}h`, value: h.facturas }))}
        />
      </ChartCard>
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: 16 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  controles: { gap: 10, marginBottom: 14 },
  deshabilitado: { opacity: 0.4 },
  celdaNumero: { alignItems: 'flex-end' },
});
