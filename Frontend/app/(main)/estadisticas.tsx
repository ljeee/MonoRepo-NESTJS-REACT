import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../tw';
import { invalidarConsultas, MINIMO_RECARGA_MS, useApi, useOrdenesSocket } from '@/src/shared';
import { DateRangeFilter, Icon, PageContainer, PageHeader, SegmentedControl, PosRefreshControl } from '../../components/ui';
import type { SegmentOption } from '../../components/ui/SegmentedControl';
import { useLocalSearchParams } from 'expo-router';
import { FiltrosActivos } from '../../components/analitica/FiltrosActivos';
import { FiltrosPanel } from '../../components/analitica/FiltrosPanel';
import { TabResumen } from '../../components/analitica/TabResumen';
import { TabProductos } from '../../components/analitica/TabProductos';
import { TabSabores } from '../../components/analitica/TabSabores';
import { TabHorarios } from '../../components/analitica/TabHorarios';
import { TabClientes } from '../../components/analitica/TabClientes';
import { TabDomiciliarios } from '../../components/analitica/TabDomiciliarios';
import type { PropsTabAnalitica, TabAnalitica } from '../../components/analitica/tipos';
import { PRESETS_ANALITICA, useAnaliticaFiltros } from '../../hooks/use-analitica-filtros';
import { useConsulta } from '../../hooks/use-consulta';
import { useAuth } from '../../contexts/AuthContext';
import { getBaseUrl } from '../../services/api';

const TABS: SegmentOption<TabAnalitica>[] = [
  { value: 'resumen', label: 'Resumen', icon: 'view-dashboard-outline' },
  { value: 'productos', label: 'Productos', icon: 'package-variant' },
  { value: 'sabores', label: 'Sabores', icon: 'pizza' },
  { value: 'horarios', label: 'Horarios', icon: 'clock-outline' },
  { value: 'clientes', label: 'Clientes', icon: 'account-group-outline' },
  { value: 'domiciliarios', label: 'Domicilios', icon: 'moped' },
];

const COMPONENTE_TAB: Record<TabAnalitica, React.ComponentType<PropsTabAnalitica>> = {
  resumen: TabResumen,
  productos: TabProductos,
  sabores: TabSabores,
  horarios: TabHorarios,
  clientes: TabClientes,
  domiciliarios: TabDomiciliarios,
};

/** Espera tras un `stats:update` antes de recargar: una venta dispara varios eventos seguidos. */
const ESPERA_TIEMPO_REAL_MS = 2000;
/** En servicio entra una venta tras otra: como mucho una recarga en tiempo real cada 20 s. */
const MINIMO_ENTRE_RECARGAS_MS = 20000;
/** Mientras el histórico se procesa, re-consultar el avance cada tanto. */
const INTERVALO_CALIDAD_MS = 30000;

export default function EstadisticasScreen() {
  const api = useApi();
  const { user, token } = useAuth();
  const f = useAnaliticaFiltros();
  const { tab: tabInicial } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabAnalitica>(() =>
    TABS.some((t) => t.value === tabInicial) ? (tabInicial as TabAnalitica) : 'resumen',
  );
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [version, setVersion] = useState(0);
  const [refrescando, setRefrescando] = useState(false);

  const opciones = useConsulta(() => api.analitica.opciones(), [api]);
  const [versionCalidad, setVersionCalidad] = useState(0);
  const calidad = useConsulta(() => api.analitica.calidadDatos(), [api, versionCalidad]);
  const pendientes = calidad.data?.lineas.pendientes ?? 0;

  useEffect(() => {
    if (!pendientes) return;
    const t = setInterval(() => setVersionCalidad((v) => v + 1), INTERVALO_CALIDAD_MS);
    return () => clearInterval(t);
  }, [pendientes]);

  // Tiempo real: solo importa si el rango incluye hoy (un rango pasado no cambia).
  const incluyeHoyRef = useRef(f.incluyeHoy);
  incluyeHoyRef.current = f.incluyeHoy;
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimaRecarga = useRef(0);
  const alActualizarStats = useCallback(() => {
    if (!incluyeHoyRef.current) return;
    // Ya hay una recarga programada: esa recoge también este cambio (sin reprogramarla, para que una ráfaga
    // continua de ventas no la posponga para siempre).
    if (temporizador.current) return;
    const espera = Math.max(ESPERA_TIEMPO_REAL_MS, ultimaRecarga.current + MINIMO_ENTRE_RECARGAS_MS - Date.now());
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      ultimaRecarga.current = Date.now();
      // Los datos cambiaron: se olvidan las búsquedas guardadas por el cooldown antes de volver a pedir.
      invalidarConsultas('analitica:');
      setVersion((v) => v + 1);
    }, espera);
  }, []);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);
  useOrdenesSocket(getBaseUrl(), user?.roles?.[0] || 'cajero', undefined, token, { onStats: alActualizarStats });

  const ultimaManual = useRef(0);
  const recargar = useCallback(() => {
    setRefrescando(true);
    // Deslizar para recargar se salta el cooldown, pero no más de una vez cada 5 s.
    if (Date.now() - ultimaManual.current < MINIMO_RECARGA_MS) {
      setTimeout(() => setRefrescando(false), 400);
      return;
    }
    ultimaManual.current = Date.now();
    ultimaRecarga.current = Date.now();
    invalidarConsultas('analitica:');
    setVersion((v) => v + 1);
    setVersionCalidad((v) => v + 1);
    // Las pestañas muestran su propio "refreshing"; el gesto solo necesita confirmación visual.
    setTimeout(() => setRefrescando(false), 600);
  }, []);

  const Tab = COMPONENTE_TAB[tab];

  return (
    <PageContainer
      maxWidthVariant="wide"
      refreshControl={<PosRefreshControl refreshing={refrescando} onRefresh={recargar} />}
    >
      <PageHeader
        title="Analítica"
        subtitle="Qué se vende, cuándo y a quién"
        icon="chart-box-outline"
        rightContent={
          <Pressable
            onPress={() => setPanelAbierto(true)}
            className="flex-row items-center gap-2 px-4 py-2.5 rounded-xl border"
            style={f.cantidadActivos ? styles.botonFiltrosActivo : styles.botonFiltros}
            accessibilityLabel="Abrir filtros"
          >
            <Icon name="filter-variant" size={16} color={f.cantidadActivos ? '#F5A524' : '#94A3B8'} />
            <Text style={[styles.textoBoton, { color: f.cantidadActivos ? '#F5A524' : '#CBD5E1' }]}>
              Filtros{f.cantidadActivos ? ` (${f.cantidadActivos})` : ''}
            </Text>
          </Pressable>
        }
      />

      <View style={styles.columna}>
        <DateRangeFilter
          from={f.from}
          to={f.to}
          onFromChange={f.setFrom}
          onToChange={f.setTo}
          onSearch={f.buscar}
          activePreset={f.preset ?? undefined}
          onPresetChange={f.setPreset}
          presets={PRESETS_ANALITICA}
          comparar={f.comparar}
          onCompararChange={f.setComparar}
        />

        <FiltrosActivos filtros={f.filtros} opciones={opciones.data} onCambiar={f.setFiltro} onLimpiar={f.limpiarFiltros} />

        {pendientes > 0 && (
          <View className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 flex-row gap-2 items-center">
            <Icon name="progress-clock" size={16} color="#60A5FA" />
            <Text className="text-blue-200 text-[11px] font-bold flex-1">
              Procesando ventas antiguas: {calidad.data?.lineas.porcentajeProcesado ?? 0}%. Sabores y tamaños de fechas viejas
              pueden aparecer incompletos hasta que termine.
            </Text>
          </View>
        )}

        <SegmentedControl options={TABS} value={tab} onChange={setTab} />

        <Tab consulta={f.consulta} version={version} onFiltrar={f.setFiltro} onIrA={setTab} />
      </View>

      <FiltrosPanel
        visible={panelAbierto}
        filtros={f.filtros}
        opciones={opciones.data}
        onAplicar={(nuevos) => {
          f.reemplazarFiltros(nuevos);
          setPanelAbierto(false);
        }}
        onCerrar={() => setPanelAbierto(false)}
      />
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  columna: { gap: 16, paddingBottom: 32 },
  botonFiltros: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  botonFiltrosActivo: { backgroundColor: 'rgba(245,165,36,0.12)', borderColor: 'rgba(245,165,36,0.4)' },
  textoBoton: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
});
