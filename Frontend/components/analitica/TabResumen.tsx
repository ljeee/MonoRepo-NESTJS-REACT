import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { StatCard, Icon, InlineError } from '../ui';
import { BarList, ChartCard, DonutChart, LineChart, formatearValor } from '../charts';
import { claveConsulta, useApi } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import { useBreakpoint } from '../../styles/responsive';
import type { PropsTabAnalitica } from './tipos';
import { CANAL_LABEL, METODO_LABEL, TIPO_PEDIDO_LABEL, colorDe, etiquetaCategoria, etiquetaPeriodo, etiquetaTamano } from './etiquetas';

export function TabResumen({ consulta, version, onFiltrar, onIrA }: PropsTabAnalitica) {
  const api = useApi();
  const { isMobile } = useBreakpoint();

  // Con clave: volver a esta pestaña o repetir la búsqueda dentro del cooldown no pide nada otra vez.
  const resumen = useConsulta(() => api.analitica.resumen(consulta), [api, consulta, version], { clave: claveConsulta('analitica:resumen', consulta) });
  const serie = useConsulta(() => api.analitica.serie(consulta), [api, consulta, version], { clave: claveConsulta('analitica:serie', consulta) });
  const mix = useConsulta(() => api.analitica.mix(consulta), [api, consulta, version], { clave: claveConsulta('analitica:mix', consulta) });
  const productos = useConsulta(
    () => api.analitica.productos({ ...consulta, agrupar: 'producto', limit: 5 }),
    [api, consulta, version],
    { clave: claveConsulta('analitica:productos', { ...consulta, agrupar: 'producto', limit: 5 }) },
  );
  const sabores = useConsulta(() => api.analitica.sabores({ ...consulta, limit: 5 }), [api, consulta, version], {
    clave: claveConsulta('analitica:sabores', { ...consulta, limit: 5 }),
  });

  const k = resumen.data?.actual;
  const a = resumen.data?.anterior ?? undefined;
  const ancho = isMobile ? 'w-full' : 'w-[calc(50%-8px)]';
  const destacados = resumen.data?.destacados;

  const puntos = useMemo(
    () =>
      (serie.data?.puntos ?? []).map((p) => ({
        key: p.periodo,
        label: etiquetaPeriodo(p.periodo, serie.data?.granularidad ?? 'dia'),
        value: p.facturado,
      })),
    [serie.data],
  );

  return (
    <View style={styles.columna}>
      {resumen.error && <TextoError mensaje={resumen.error} />}

      {resumen.data?.filtrosDeLinea && (
        <View className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 flex-row gap-2 items-center">
          <Icon name="information-outline" size={16} color="#60A5FA" />
          <Text className="text-blue-200 text-[11px] font-bold flex-1">
            Con filtros de producto, tamaño o sabor, el dinero corresponde a las facturas que incluyen esos productos;
            unidades y descuentos cuentan solo las líneas que cumplen.
          </Text>
        </View>
      )}

      {/* Destacados */}
      <View style={styles.grilla}>
        <StatCard
          className={isMobile ? 'w-full' : ''}
          label="Pizza más vendida"
          icon="pizza"
          color="#FB923C"
          value={destacados?.pizzaMasVendida ? destacados.pizzaMasVendida.sabores.join(' + ') : '—'}
          sub={
            destacados?.pizzaMasVendida
              ? `${etiquetaTamano(destacados.pizzaMasVendida.tamano)} · ${formatearValor(destacados.pizzaMasVendida.unidades)} vendidas`
              : resumen.loading
                ? 'Calculando…'
                : 'Sin pizzas en el período'
          }
          onPress={() => onIrA('sabores')}
        />
        <StatCard
          label="Sabor estrella"
          icon="star-circle-outline"
          color="#EAB308"
          value={destacados?.saborMasPedido?.nombre ?? '—'}
          sub={destacados?.saborMasPedido ? `En ${formatearValor(destacados.saborMasPedido.apariciones)} pizzas` : undefined}
          onPress={() => onIrA('sabores')}
        />
        <StatCard
          label="Combinación favorita"
          icon="circle-half-full"
          color="#A855F7"
          value={destacados?.combinacionMasPedida ? destacados.combinacionMasPedida.sabores.join(' + ') : '—'}
          sub={destacados?.combinacionMasPedida ? `${formatearValor(destacados.combinacionMasPedida.pizzas)} pizzas` : undefined}
          onPress={() => onIrA('sabores')}
        />
      </View>

      {/* KPIs */}
      <View style={styles.grilla}>
        <StatCard label="Facturado" icon="cash-multiple" color="#10B981" value={formatearValor(k?.facturado ?? 0, 'monedaCompacta')} current={k?.facturado} previous={a?.facturado} sub={`${k?.facturas ?? 0} facturas`} />
        <StatCard label="Cobrado" icon="cash-check" color="#22C55E" value={formatearValor(k?.cobrado ?? 0, 'monedaCompacta')} current={k?.cobrado} previous={a?.cobrado} sub={k?.porCobrar ? `Por cobrar ${formatearValor(k.porCobrar, 'monedaCompacta')}` : 'Todo cobrado'} />
        <StatCard label="Ticket promedio" icon="receipt" color="#3B82F6" value={formatearValor(k?.ticket ?? 0, 'monedaCompacta')} current={k?.ticket} previous={a?.ticket} />
        <StatCard label="Órdenes" icon="clipboard-list-outline" color="#F5A524" value={formatearValor(k?.ordenes ?? 0)} current={k?.ordenes} previous={a?.ordenes} sub={`${k?.domicilios ?? 0} domicilios`} />
        <StatCard label="Unidades vendidas" icon="package-variant" color="#14B8A6" value={formatearValor(k?.unidades ?? 0)} current={k?.unidades} previous={a?.unidades} sub={`${formatearValor(k?.pizzas ?? 0)} pizzas`} />
        <StatCard label="Cancelación" icon="close-octagon-outline" color="#F43F5E" value={formatearValor(k?.tasaCancelacion ?? 0, 'porcentaje')} current={k?.tasaCancelacion} previous={a?.tasaCancelacion} lowerIsBetter sub={`${k?.canceladas ?? 0} canceladas`} />
        <StatCard label="Descuentos" icon="tag-minus-outline" color="#A855F7" value={formatearValor(k?.descuentos ?? 0, 'monedaCompacta')} current={k?.descuentos} previous={a?.descuentos} lowerIsBetter sub="Por precio manual" />
      </View>

      <ChartCard
        title="Tendencia de ventas"
        subtitle={consulta.comparar ? 'Línea punteada: período anterior' : 'Facturado por período'}
        icon="chart-line"
        color="#10B981"
        loading={serie.loading}
        empty={!serie.loading && puntos.every((p) => p.value === 0)}
      >
        <LineChart
          data={puntos}
          comparison={serie.data?.anterior?.map((p) => p.facturado) ?? null}
          formato="moneda"
          labelEvery={Math.max(1, Math.ceil(puntos.length / 8))}
        />
      </ChartCard>

      <View style={styles.grilla}>
        <ChartCard className={ancho} title="Top productos" icon="trophy-outline" color="#10B981" loading={productos.loading} empty={!productos.data?.filas.length}>
          <BarList
            items={(productos.data?.filas ?? []).map((f) => ({
              key: f.clave,
              label: f.nombre,
              value: f.unidades,
              sublabel: `${f.veces} órdenes · ${formatearValor(f.ingresos, 'monedaCompacta')}`,
            }))}
            onPressItem={(clave) => {
              const fila = productos.data?.filas.find((f) => f.clave === clave);
              if (fila?.productoId) {
                onFiltrar('productoId', [fila.productoId]);
                onIrA('productos');
              }
            }}
          />
        </ChartCard>
        <ChartCard className={ancho} title="Sabores favoritos" icon="pizza" color="#FB923C" loading={sabores.loading} empty={!sabores.data?.filas.length}>
          <BarList
            color="#FB923C"
            items={(sabores.data?.filas ?? []).map((s) => ({
              key: s.clave,
              label: s.nombre,
              value: s.apariciones,
              sublabel: `${s.pct}% de las pizzas`,
              muted: s.sinClasificar,
            }))}
            onPressItem={() => onIrA('sabores')}
          />
        </ChartCard>
      </View>

      <View style={styles.grilla}>
        <ChartCard className={ancho} title="Tipo de pedido" icon="silverware-fork-knife" color="#3B82F6" loading={mix.loading} empty={!mix.data?.tipoPedido.length}>
          <DonutChart
            centerLabel="Órdenes"
            segments={(mix.data?.tipoPedido ?? []).map((t, i) => ({ key: t.clave, label: TIPO_PEDIDO_LABEL[t.clave] ?? t.clave, value: t.ordenes, color: colorDe(i) }))}
          />
        </ChartCard>
        <ChartCard className={ancho} title="Método de pago" icon="credit-card-outline" color="#F5A524" loading={mix.loading} empty={!mix.data?.metodoPago.length}>
          <DonutChart
            formato="moneda"
            centerLabel="Facturado"
            segments={(mix.data?.metodoPago ?? []).map((m, i) => ({ key: m.clave, label: METODO_LABEL[m.clave] ?? m.clave, value: m.facturado, color: colorDe(i) }))}
          />
          {!!mix.data && (
            <Text className="text-slate-500 text-[10px] font-bold mt-3">
              Cobrado: efectivo {formatearValor(mix.data.cobradoPorMetodo.efectivo, 'monedaCompacta')} · QR/Trans{' '}
              {formatearValor(mix.data.cobradoPorMetodo.transferencia, 'monedaCompacta')}
            </Text>
          )}
        </ChartCard>
        <ChartCard className={ancho} title="Categorías" icon="shape-outline" color="#14B8A6" loading={mix.loading} empty={!mix.data?.categoria.length}>
          <DonutChart
            formato="moneda"
            centerLabel="Ventas"
            segments={(mix.data?.categoria ?? []).map((c, i) => ({ key: c.clave, label: etiquetaCategoria(c.clave), value: c.ingresos, color: colorDe(i) }))}
          />
        </ChartCard>
        <ChartCard className={ancho} title="Canal" subtitle="Dónde se creó la orden" icon="cellphone-link" color="#A855F7" loading={mix.loading} empty={!mix.data?.canal.length}>
          <DonutChart
            centerLabel="Órdenes"
            segments={(mix.data?.canal ?? []).map((c, i) => ({ key: c.clave, label: CANAL_LABEL[c.clave] ?? c.clave, value: c.ordenes, color: colorDe(i) }))}
          />
        </ChartCard>
      </View>
    </View>
  );
}

export function TextoError({ mensaje }: { mensaje: string }) {
  return <InlineError message={mensaje} size="sm" />;
}

const styles = StyleSheet.create({
  columna: { gap: 16 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
