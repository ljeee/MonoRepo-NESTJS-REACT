import React, { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text } from '../../tw';
import { ChipGroup, Icon, SegmentedControl } from '../ui';
import { BarList, ChartCard, Heatmap, formatearValor } from '../charts';
import { claveConsulta, useApi, useSaborGrupos } from '@/src/shared';
import type { MetricaSabor, TamanoPizza } from '@/src/shared';
import { useConsulta } from '../../hooks/use-consulta';
import { useBreakpoint } from '../../styles/responsive';
import type { PropsTabAnalitica } from './tipos';
import { TextoError } from './TabResumen';
import { TAMANO_LABEL } from './etiquetas';

const METRICAS: { value: MetricaSabor; label: string }[] = [
  { value: 'apariciones', label: 'Pizzas con el sabor' },
  { value: 'porciones', label: 'Equivalente' },
];

const TAMANOS: TamanoPizza[] = ['pequena', 'mediana', 'grande'];

export function TabSabores({ consulta, version, onFiltrar }: PropsTabAnalitica) {
  const api = useApi();
  const { isMobile } = useBreakpoint();
  const [metrica, setMetrica] = useState<MetricaSabor>('apariciones');
  const { grupos } = useSaborGrupos();

  const ranking = useConsulta(() => api.analitica.sabores({ ...consulta, metrica, limit: 30 }), [api, consulta, metrica, version], {
    clave: claveConsulta('analitica:sabores', { ...consulta, metrica, limit: 30 }),
  });
  const matriz = useConsulta(() => api.analitica.saboresMatriz({ ...consulta, metrica }), [api, consulta, metrica, version], {
    clave: claveConsulta('analitica:matriz', { ...consulta, metrica }),
  });
  const combinaciones = useConsulta(() => api.analitica.combinaciones({ ...consulta, limit: 15 }), [api, consulta, version], {
    clave: claveConsulta('analitica:combinaciones', { ...consulta, limit: 15 }),
  });

  const tamanoActivo = consulta.tamano?.length === 1 ? consulta.tamano[0] : null;
  const grupoActivo = consulta.saborGrupoId?.length === 1 ? consulta.saborGrupoId[0] : null;
  const ancho = isMobile ? 'w-full' : 'w-[calc(50%-8px)]';
  const sinClasificar = ranking.data?.sinClasificar[metrica] ?? 0;

  const filasMatriz = useMemo(() => (matriz.data?.filas ?? []).slice(0, 20), [matriz.data]);
  const columnasMatriz = useMemo(
    () => (matriz.data?.tamanos ?? TAMANOS).map((t) => ({ key: t, label: TAMANO_LABEL[t] ?? t })),
    [matriz.data],
  );

  return (
    <View style={styles.columna}>
      <View className="bg-white/[0.03] border border-white/5 rounded-2xl p-4" style={styles.controles}>
        <View style={styles.control}>
          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Tamaño</Text>
          <ChipGroup
            allowEmpty
            color="#FB923C"
            value={tamanoActivo}
            onChange={(t) => onFiltrar('tamano', t ? [t] : undefined)}
            options={TAMANOS.map((t) => ({ value: t, label: TAMANO_LABEL[t] }))}
          />
        </View>
        {grupos.length > 1 && (
          <View style={styles.control}>
            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Grupo</Text>
            <ChipGroup
              allowEmpty
              color="#EAB308"
              value={grupoActivo}
              onChange={(g) => onFiltrar('saborGrupoId', g != null ? [g] : undefined)}
              options={grupos.map((g) => ({ value: g.id, label: g.nombre }))}
            />
          </View>
        )}
        <View style={styles.control}>
          <Text className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Contar como</Text>
          <SegmentedControl options={METRICAS} value={metrica} onChange={setMetrica} color="#FB923C" />
          <Text className="text-slate-600 text-[10px] font-bold">
            {metrica === 'apariciones'
              ? 'Cada pizza que lleva el sabor suma 1, aunque sea mitad y mitad.'
              : 'Una pizza de 2 sabores suma ½ a cada uno: refleja cuánto se consume de verdad.'}
          </Text>
        </View>
      </View>

      {ranking.error && <TextoError mensaje={ranking.error} />}

      {sinClasificar > 0 && (
        <View className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex-row gap-2 items-center">
          <Icon name="help-circle-outline" size={16} color="#FBBF24" />
          <Text className="text-amber-200 text-[11px] font-bold flex-1">
            {formatearValor(sinClasificar)} {metrica === 'apariciones' ? 'apariciones' : 'porciones'} corresponden a ventas antiguas
            cuyo sabor no se pudo reconocer; aparecen como «Sin clasificar».
          </Text>
        </View>
      )}

      <View style={styles.grilla}>
        <ChartCard
          className={ancho}
          title={tamanoActivo ? `Sabores en ${TAMANO_LABEL[tamanoActivo].toLowerCase()}` : 'Ranking de sabores'}
          subtitle={ranking.data ? `${formatearValor(ranking.data.total)} en total` : undefined}
          icon="pizza"
          color="#FB923C"
          loading={ranking.loading}
          empty={!ranking.data?.filas.length}
        >
          <BarList
            color="#FB923C"
            items={(ranking.data?.filas ?? []).map((s) => ({
              key: s.clave,
              label: s.nombre,
              value: s[metrica],
              sublabel: `${s.pct}% · ${formatearValor(s.ordenes)} órdenes${s.grupo && grupos.length > 1 ? ` · ${s.grupo}` : ''}`,
              muted: s.sinClasificar,
            }))}
            onPressItem={(clave) => {
              const fila = ranking.data?.filas.find((s) => s.clave === clave);
              if (fila?.saborId) onFiltrar('saborId', [fila.saborId]);
            }}
          />
        </ChartCard>

        <ChartCard
          className={ancho}
          title="Combinaciones más pedidas"
          subtitle="Pizzas con exactamente estos sabores"
          icon="circle-half-full"
          color="#A855F7"
          loading={combinaciones.loading}
          empty={!combinaciones.data?.filas.length}
        >
          <BarList
            color="#A855F7"
            items={(combinaciones.data?.filas ?? []).map((c) => ({
              key: c.sabores.join('|'),
              label: c.sabores.join(' + '),
              value: c.pizzas,
              sublabel: `${formatearValor(c.lineas)} líneas de venta`,
            }))}
          />
        </ChartCard>
      </View>

      <ChartCard
        title="Sabor × tamaño"
        subtitle={filasMatriz.length === 20 ? 'Los 20 sabores con más ventas' : undefined}
        icon="grid"
        color="#F5A524"
        loading={matriz.loading}
        empty={!filasMatriz.length}
      >
        <Heatmap
          rows={filasMatriz.map((f) => ({ key: f.clave, label: f.nombre }))}
          columns={columnasMatriz}
          value={(fila, col) => {
            const f = filasMatriz.find((x) => x.clave === fila);
            return f?.porTamano[col as TamanoPizza]?.[metrica];
          }}
          color="#F5A524"
          showValues
          cellWidth={72}
          rowLabelWidth={130}
        />
      </ChartCard>
    </View>
  );
}

const styles = StyleSheet.create({
  columna: { gap: 16 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  controles: { gap: 14 },
  control: { gap: 8 },
});
