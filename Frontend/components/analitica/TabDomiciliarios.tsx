import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { DataTable, StatCard } from '../ui';
import type { DataTableColumn } from '../ui/DataTable';
import { BarList, ChartCard, formatearValor } from '../charts';
import { claveConsulta, useApi } from '@/src/shared';
import type { DomiciliariosAnalitica } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import { useBreakpoint } from '../../styles/responsive';
import type { PropsTabAnalitica } from './tipos';
import { TextoError } from './TabResumen';

type FilaDomiciliario = DomiciliariosAnalitica['filas'][number];
type FilaDia = { dia: string; domicilios: number; sinRepartidor: number; ganancia: number; detalle: string };

const FORMATO_DIA = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

export function TabDomiciliarios({ consulta, version, onFiltrar }: PropsTabAnalitica) {
  const api = useApi();
  const { isMobile } = useBreakpoint();
  const datos = useConsulta(() => api.analitica.domiciliarios(consulta), [api, consulta, version], {
    clave: claveConsulta('analitica:domiciliarios', consulta),
  });
  const filas = useMemo(() => datos.data?.filas ?? [], [datos.data]);

  // Cada domicilio cuenta para su repartidor desde que se le asigna (no hace falta marcarlo entregado).
  const totales = useMemo(
    () =>
      filas.reduce(
        (t, f) => ({ asignados: t.asignados + f.asignados, ganancia: t.ganancia + f.ganancia }),
        { asignados: 0, ganancia: 0 },
      ),
    [filas],
  );
  const sinRepartidor = datos.data?.totales?.sinRepartidor ?? 0;

  // Día a día: domicilios del día, sin repartidor, lo que se paga y cuántos llevó cada repartidor.
  const porDia = useMemo<FilaDia[]>(() => {
    const dias = new Map<string, FilaDia>();
    for (const d of datos.data?.porDia ?? []) {
      const fila = dias.get(d.dia) ?? { dia: d.dia, domicilios: 0, sinRepartidor: 0, ganancia: 0, detalle: '' };
      fila.domicilios += d.domicilios;
      if (d.telefono == null) fila.sinRepartidor += d.domicilios;
      fila.ganancia += d.ganancia;
      fila.detalle = [fila.detalle, `${d.nombre} ${d.domicilios}`].filter(Boolean).join(' · ');
      dias.set(d.dia, fila);
    }
    return [...dias.values()].sort((a, b) => b.dia.localeCompare(a.dia));
  }, [datos.data]);

  const columnasDia = useMemo<DataTableColumn<FilaDia>[]>(
    () => [
      { key: 'dia', label: 'Día', width: 110, render: (d) => <Num v={FORMATO_DIA.format(new Date(`${d.dia}T12:00:00`))} /> },
      { key: 'domicilios', label: 'Domicilios', width: 90, align: 'right', render: (d) => <Num v={formatearValor(d.domicilios)} /> },
      {
        key: 'sinRepartidor',
        label: 'Sin repartidor',
        width: 100,
        align: 'right',
        render: (d) => <Num v={d.sinRepartidor ? formatearValor(d.sinRepartidor) : '—'} />,
      },
      { key: 'ganancia', label: 'A pagar', width: 100, align: 'right', render: (d) => <Num v={formatearValor(d.ganancia, 'monedaCompacta')} /> },
      {
        key: 'detalle',
        label: 'Por domiciliario',
        render: (d) => <Text className="text-slate-300 text-[11px]">{d.detalle}</Text>,
      },
    ],
    [],
  );

  const columnas = useMemo<DataTableColumn<FilaDomiciliario>[]>(
    () => [
      {
        key: 'nombre',
        label: 'Domiciliario',
        render: (d) => (
          <View>
            <Text className="text-white text-xs font-bold" numberOfLines={1}>
              {d.nombre}
            </Text>
            <Text className="text-slate-500 text-[10px] font-bold">{d.telefono}</Text>
          </View>
        ),
      },
      { key: 'asignados', label: 'Domicilios', width: 90, align: 'right', render: (d) => <Num v={formatearValor(d.asignados)} /> },
      { key: 'ganancia', label: 'A pagar', width: 100, align: 'right', render: (d) => <Num v={formatearValor(d.ganancia, 'monedaCompacta')} /> },
      { key: 'ticket', label: 'Ticket prom.', width: 100, align: 'right', render: (d) => <Num v={formatearValor(d.ticketPromedio, 'monedaCompacta')} /> },
    ],
    [],
  );

  return (
    <View style={styles.columna}>
      {datos.error && <TextoError mensaje={datos.error} />}
      <View style={styles.grilla}>
        <StatCard
          label="Domicilios"
          icon="moped"
          color="#3B82F6"
          value={formatearValor(datos.data?.totales?.domicilios ?? totales.asignados)}
          sub={sinRepartidor ? `${formatearValor(sinRepartidor)} sin repartidor` : 'Todos con repartidor'}
        />
        <StatCard
          label="Con repartidor"
          icon="account-check-outline"
          color="#10B981"
          value={formatearValor(totales.asignados)}
          sub="Cuentan desde que se asignan"
        />
        <StatCard
          label="A pagar a domiciliarios"
          icon="cash-fast"
          color="#F5A524"
          value={formatearValor(totales.ganancia, 'monedaCompacta')}
          sub="Costo de domicilio de lo asignado"
        />
      </View>

      <View style={styles.grilla}>
        <ChartCard
          className={isMobile ? 'w-full' : 'w-[calc(40%-8px)]'}
          title="Domicilios por domiciliario"
          icon="podium"
          color="#10B981"
          loading={datos.loading}
          empty={!filas.length}
        >
          <BarList
            items={filas.map((d) => ({
              key: d.telefono,
              label: d.nombre,
              value: d.asignados,
              sublabel: `${formatearValor(d.ganancia, 'monedaCompacta')} a pagar`,
            }))}
            onPressItem={(telefono) => onFiltrar('domiciliario', telefono)}
          />
        </ChartCard>
        <ChartCard className={isMobile ? 'w-full' : 'w-[calc(60%-8px)]'} title="Detalle" icon="table" color="#3B82F6" loading={datos.loading}>
          <DataTable
            columns={columnas}
            rows={filas}
            rowKey={(d) => d.telefono}
            onRowPress={(d) => onFiltrar('domiciliario', d.telefono)}
            minWidth={460}
            emptyText="Sin domicilios asignados en el período"
          />
        </ChartCard>
      </View>
      {porDia.length > 1 && (
        <ChartCard title="Día a día" icon="calendar-month-outline" color="#F5A524" loading={datos.loading}>
          <DataTable columns={columnasDia} rows={porDia} rowKey={(d) => d.dia} minWidth={620} />
        </ChartCard>
      )}
      <Text className="text-slate-400 text-[11px] font-bold">
        Con el atajo «Hoy» ves los domicilios del día; con «Mes», el mes con el detalle día a día. La operación del día (asignar, ver ubicación, cobrar) sigue en «Asignar domiciliarios».
      </Text>
    </View>
  );
}

const Num = React.memo(function Num({ v }: { v: string }) {
  return <Text className="text-white text-xs font-black">{v}</Text>;
});

const styles = StyleSheet.create({
  columna: { gap: 16 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
