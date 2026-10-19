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

export function TabDomiciliarios({ consulta, version, onFiltrar }: PropsTabAnalitica) {
  const api = useApi();
  const { isMobile } = useBreakpoint();
  const datos = useConsulta(() => api.analitica.domiciliarios(consulta), [api, consulta, version], {
    clave: claveConsulta('analitica:domiciliarios', consulta),
  });
  const filas = useMemo(() => datos.data?.filas ?? [], [datos.data]);

  const totales = useMemo(
    () =>
      filas.reduce(
        (t, f) => ({ asignados: t.asignados + f.asignados, entregas: t.entregas + f.entregas, ganancia: t.ganancia + f.ganancia }),
        { asignados: 0, entregas: 0, ganancia: 0 },
      ),
    [filas],
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
      { key: 'asignados', label: 'Asignados', width: 84, align: 'right', render: (d) => <Num v={formatearValor(d.asignados)} /> },
      { key: 'entregas', label: 'Entregas', width: 84, align: 'right', render: (d) => <Num v={formatearValor(d.entregas)} /> },
      {
        key: 'efectividad',
        label: '% entrega',
        width: 84,
        align: 'right',
        render: (d) => <Num v={d.asignados ? `${Math.round((d.entregas / d.asignados) * 100)}%` : '—'} />,
      },
      { key: 'ganancia', label: 'Domicilios', width: 100, align: 'right', render: (d) => <Num v={formatearValor(d.ganancia, 'monedaCompacta')} /> },
      { key: 'ticket', label: 'Ticket prom.', width: 100, align: 'right', render: (d) => <Num v={formatearValor(d.ticketPromedio, 'monedaCompacta')} /> },
    ],
    [],
  );

  return (
    <View style={styles.columna}>
      {datos.error && <TextoError mensaje={datos.error} />}
      <View style={styles.grilla}>
        <StatCard label="Domicilios asignados" icon="moped" color="#3B82F6" value={formatearValor(totales.asignados)} />
        <StatCard
          label="Entregados"
          icon="check-decagram-outline"
          color="#10B981"
          value={formatearValor(totales.entregas)}
          sub={totales.asignados ? `${Math.round((totales.entregas / totales.asignados) * 100)}% de los asignados` : undefined}
        />
        <StatCard label="Costo de domicilios" icon="cash-fast" color="#F5A524" value={formatearValor(totales.ganancia, 'monedaCompacta')} sub="Lo que ganan los domiciliarios" />
      </View>

      <View style={styles.grilla}>
        <ChartCard
          className={isMobile ? 'w-full' : 'w-[calc(40%-8px)]'}
          title="Entregas por domiciliario"
          icon="podium"
          color="#10B981"
          loading={datos.loading}
          empty={!filas.length}
        >
          <BarList
            items={filas.map((d) => ({ key: d.telefono, label: d.nombre, value: d.entregas, sublabel: `${d.asignados} asignados` }))}
            onPressItem={(telefono) => onFiltrar('domiciliario', telefono)}
          />
        </ChartCard>
        <ChartCard className={isMobile ? 'w-full' : 'w-[calc(60%-8px)]'} title="Detalle" icon="table" color="#3B82F6" loading={datos.loading}>
          <DataTable
            columns={columnas}
            rows={filas}
            rowKey={(d) => d.telefono}
            onRowPress={(d) => onFiltrar('domiciliario', d.telefono)}
            minWidth={600}
            emptyText="Sin domicilios asignados en el período"
          />
        </ChartCard>
      </View>
      <Text className="text-slate-600 text-[10px] font-bold">
        La operación del día (asignar, ver ubicación, cobrar) sigue en «Asignar domiciliarios».
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
