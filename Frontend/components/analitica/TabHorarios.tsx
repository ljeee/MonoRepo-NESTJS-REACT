import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View } from '../../tw';
import { SegmentedControl } from '../ui';
import { ChartCard, ColumnChart, Heatmap } from '../charts';
import { claveConsulta, useApi } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import { useBreakpoint } from '../../styles/responsive';
import type { PropsTabAnalitica } from './tipos';
import { TextoError } from './TabResumen';
import { DIA_LABEL } from './etiquetas';

type MetricaHorario = 'facturas' | 'facturado';

const METRICAS: { value: MetricaHorario; label: string }[] = [
  { value: 'facturas', label: 'Pedidos' },
  { value: 'facturado', label: 'Dinero' },
];

export function TabHorarios({ consulta, version, onFiltrar }: PropsTabAnalitica) {
  const api = useApi();
  const { isMobile } = useBreakpoint();
  const [metrica, setMetrica] = useState<MetricaHorario>('facturas');
  const horarios = useConsulta(() => api.analitica.horarios(consulta), [api, consulta, version], { clave: claveConsulta('analitica:horarios', consulta) });
  const formato = metrica === 'facturado' ? 'monedaCompacta' : 'numero';

  // Solo las horas en que hubo ventas (más un margen), para que el mapa no sea casi todo vacío.
  const horas = useMemo(() => {
    const conVentas = (horarios.data?.porHora ?? []).filter((h) => h.facturas > 0).map((h) => h.hora);
    if (!conVentas.length) return [] as number[];
    const desde = Math.min(...conVentas);
    const hasta = Math.max(...conVentas);
    return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  }, [horarios.data]);

  const celdas = useMemo(() => {
    const m = new Map<string, { facturas: number; facturado: number }>();
    for (const c of horarios.data?.celdas ?? []) m.set(`${c.diaSemana}:${c.hora}`, c);
    return m;
  }, [horarios.data]);

  const porHora = (horarios.data?.porHora ?? []).filter((h) => horas.includes(h.hora));
  const pico = porHora.reduce<{ hora: number; v: number } | null>(
    (max, h) => (!max || h[metrica] > max.v ? { hora: h.hora, v: h[metrica] } : max),
    null,
  );

  return (
    <View style={styles.columna}>
      {horarios.error && <TextoError mensaje={horarios.error} />}
      <SegmentedControl options={METRICAS} value={metrica} onChange={setMetrica} color="#A855F7" />

      <ChartCard
        title="Día × hora"
        subtitle="Más intenso = más movimiento"
        icon="calendar-clock"
        color="#A855F7"
        loading={horarios.loading}
        empty={!horas.length}
      >
        <Heatmap
          rows={DIA_LABEL.map((d, i) => ({ key: String(i + 1), label: d }))}
          columns={horas.map((h) => ({ key: String(h), label: `${h}h` }))}
          value={(dia, hora) => celdas.get(`${dia}:${hora}`)?.[metrica]}
          color="#A855F7"
          formato={formato}
          cellWidth={isMobile ? 34 : 44}
          rowLabelWidth={42}
        />
      </ChartCard>

      <View style={styles.grilla}>
        <ChartCard
          className={isMobile ? 'w-full' : 'w-[calc(50%-8px)]'}
          title="Por hora"
          subtitle={pico ? `Hora pico: ${pico.hora}h` : undefined}
          icon="clock-outline"
          color="#3B82F6"
          loading={horarios.loading}
          empty={!porHora.length}
        >
          <ColumnChart
            color="#3B82F6"
            formato={formato}
            highlightKey={pico ? String(pico.hora) : undefined}
            data={porHora.map((h) => ({ key: String(h.hora), label: `${h.hora}h`, value: h[metrica] }))}
          />
        </ChartCard>
        <ChartCard
          className={isMobile ? 'w-full' : 'w-[calc(50%-8px)]'}
          title="Por día de la semana"
          icon="calendar-week"
          color="#10B981"
          loading={horarios.loading}
          empty={!horarios.data?.porDia.some((d) => d.facturas > 0)}
        >
          <ColumnChart
            color="#10B981"
            formato={formato}
            data={DIA_LABEL.map((d, i) => {
              const fila = horarios.data?.porDia.find((x) => x.diaSemana === i + 1);
              return { key: String(i + 1), label: d, value: fila?.[metrica] ?? 0 };
            })}
          />
          <View style={styles.atajos}>
            <SegmentedControl
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'semana', label: 'Lun–Jue' },
                { value: 'finde', label: 'Vie–Dom' },
              ]}
              value={
                consulta.diaSemana?.join(',') === '1,2,3,4'
                  ? 'semana'
                  : consulta.diaSemana?.join(',') === '5,6,7'
                    ? 'finde'
                    : 'todos'
              }
              onChange={(v) => onFiltrar('diaSemana', v === 'semana' ? [1, 2, 3, 4] : v === 'finde' ? [5, 6, 7] : undefined)}
              color="#10B981"
            />
          </View>
        </ChartCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: 16 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  atajos: { marginTop: 14 },
});
