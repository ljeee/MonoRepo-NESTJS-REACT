import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import { PageContainer, PageHeader, Icon, Button, SegmentedControl, PosRefreshControl, LoadingState, SectionHeader } from '../../components/ui';
import { EmptyState } from '../../components/states/EmptyState';
import { useProductos } from '@/src/shared';
import type { InventarioItem, TipoItemInventario } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';
import { useInventario } from '../../hooks/use-inventario';
import { ItemCard, ItemRow } from '../../components/inventario/StockItems';
import { SummaryStrip } from '../../components/inventario/piezas';
import { CrearItemModal, EditItemModal } from '../../components/inventario/Modales';
import { TabReglas } from '../../components/inventario/TabReglas';
import { TabMovimientos } from '../../components/inventario/TabMovimientos';
import { CATEGORIAS_BEBIDA, metaCategoria } from '../../components/inventario/meta';

type Tab = 'stock' | 'reglas' | 'movimientos';

/**
 * Inventario unificado: cajas y bebidas embotelladas sobre `/inventario/*`. Las ventas
 * descuentan solas según las reglas de consumo (y devuelven al editar, cancelar o borrar);
 * aquí se registra lo que llega, los conteos físicos y las reglas.
 */
export default function InventarioScreen() {
  const { isMobile } = useBreakpoint();
  const { productos, fetchProductos } = useProductos();
  const inv = useInventario();
  const [tab, setTab] = useState<Tab>('stock');
  const [editar, setEditar] = useState<InventarioItem | null>(null);
  const [crear, setCrear] = useState<TipoItemInventario | null>(null);

  useEffect(() => {
    void fetchProductos();
  }, [fetchProductos]);

  const bebidasPorCategoria = useMemo(
    () =>
      CATEGORIAS_BEBIDA.map((cat) => ({ cat, filas: inv.bebidas.filter((b) => metaCategoria('bebida', b.categoria).key === cat.key) })).filter(
        (g) => g.filas.length > 0,
      ),
    [inv.bebidas],
  );

  const enAlerta = (lista: InventarioItem[]) => lista.filter((i) => i.activo && i.estado !== 'ok').length;
  const total = (lista: InventarioItem[]) => lista.reduce((s, i) => s + (i.activo ? i.cantidad : 0), 0);

  const onRefresh = useCallback(() => {
    inv.recargar();
    void fetchProductos();
  }, [inv, fetchProductos]);

  return (
    <PageContainer refreshControl={<PosRefreshControl refreshing={inv.refreshing} onRefresh={onRefresh} />}>
      <PageHeader
        title="Inventario"
        subtitle="Cajas y bebidas: se descuentan solas al vender"
        icon="package-variant"
        rightContent={
          <View style={styles.acciones}>
            {inv.listo && (
              <Button title={isMobile ? '' : 'Añadir'} icon="plus" variant="primary" size="sm" onPress={() => setCrear('caja')} />
            )}
            <Button title="" icon="refresh" variant="ghost" size="sm" onPress={onRefresh} loading={inv.loading} />
          </View>
        }
      />

      {!inv.cargandoEstado && !inv.listo && (
        <Aviso
          icono="progress-clock"
          color="#60A5FA"
          texto="El inventario se está pasando al modelo nuevo. En cuanto termine aparecerá aquí; mientras tanto las ventas no descuentan stock."
        />
      )}
      {!!(inv.error || inv.errorCarga) && (
        <Aviso icono="alert-circle-outline" color="#F43F5E" texto={inv.error || inv.errorCarga || ''} onCerrar={() => inv.setError('')} />
      )}

      {inv.listo && (
        <>
          <SummaryStrip
            items={[
              { label: 'Cajas en total', value: String(total(inv.cajas)) },
              { label: 'Cajas en alerta', value: String(enAlerta(inv.cajas)), warn: enAlerta(inv.cajas) > 0 },
              { label: 'Bebidas en total', value: String(total(inv.bebidas)) },
              { label: 'Bebidas en alerta', value: String(enAlerta(inv.bebidas)), warn: enAlerta(inv.bebidas) > 0 },
            ]}
          />

          <View style={styles.pestanas}>
            <SegmentedControl
              options={[
                { value: 'stock', label: 'Stock', icon: 'package-variant' },
                { value: 'reglas', label: inv.sugerencias.length ? `Reglas (${inv.sugerencias.length})` : 'Reglas', icon: 'link-variant' },
                { value: 'movimientos', label: 'Movimientos', icon: 'history' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>

          {inv.sugerencias.length > 0 && tab === 'stock' && (
            <TouchableOpacity onPress={() => setTab('reglas')}>
              <Aviso
                icono="alert-outline"
                color="#F5A524"
                texto={`${inv.sugerencias.length} ${inv.sugerencias.length === 1 ? 'pizza o calzón no gasta' : 'pizzas o calzones no gastan'} caja al venderse. Toca para revisar las reglas.`}
              />
            </TouchableOpacity>
          )}

          {inv.loading && !inv.cajas.length && !inv.bebidas.length ? (
            <LoadingState />
          ) : tab === 'stock' ? (
            <View style={styles.stock}>
              <Seccion titulo="Cajas" icono="package-variant-closed" color="#F5A524" cantidad={inv.cajas.length} onAgregar={() => setCrear('caja')} />
              {inv.cajas.length === 0 ? (
                <EmptyState icon="package-variant" message="Sin cajas" subMessage="Agrega los tipos de caja con «Añadir»." />
              ) : (
                <View style={styles.grilla}>
                  {inv.cajas.map((c) => (
                    <View key={c.id} style={[styles.celda, !isMobile && styles.celdaAncha]}>
                      <ItemCard item={c} onMover={inv.mover} onEditar={setEditar} ocupado={inv.ocupado === c.id} />
                    </View>
                  ))}
                </View>
              )}

              <Seccion titulo="Bebidas" icono="bottle-soda" color="#60A5FA" cantidad={inv.bebidas.length} onAgregar={() => setCrear('bebida')} />
              {bebidasPorCategoria.length === 0 ? (
                <EmptyState
                  icon="bottle-soda-outline"
                  message="Sin bebidas"
                  subMessage="Solo las embotelladas (gaseosas, agua, cerveza) llevan stock. Agrégalas con «Añadir»."
                />
              ) : (
                bebidasPorCategoria.map((g) => (
                  <View key={g.cat.key} style={styles.grupo}>
                    <View style={styles.grupoCabecera}>
                      <Icon name={g.cat.icon} size={16} color={g.cat.color} />
                      <Text style={[styles.grupoTitulo, { color: g.cat.color }]}>{g.cat.label}</Text>
                      <View style={[styles.linea, { backgroundColor: `${g.cat.color}20` }]} />
                    </View>
                    <View style={styles.filas}>
                      {g.filas.map((b) => (
                        <ItemRow key={b.id} item={b} onMover={inv.mover} onEditar={setEditar} ocupado={inv.ocupado === b.id} isMobile={isMobile} />
                      ))}
                    </View>
                  </View>
                ))
              )}

              <TouchableOpacity onPress={() => inv.setVerInactivos(!inv.verInactivos)} style={styles.inactivos}>
                <Icon name={inv.verInactivos ? 'eye-off-outline' : 'eye-outline'} size={14} color="#64748B" />
                <Text style={styles.inactivosTexto}>{inv.verInactivos ? 'Ocultar inactivos' : 'Ver inactivos'}</Text>
              </TouchableOpacity>
            </View>
          ) : tab === 'reglas' ? (
            <TabReglas
              items={[...inv.cajas, ...inv.bebidas]}
              productos={productos}
              sugerencias={inv.sugerencias}
              reglas={inv.reglas}
              errorReglas={inv.errorReglas}
              onCambio={inv.recargar}
              onError={inv.setError}
            />
          ) : (
            <TabMovimientos version={inv.version} />
          )}
        </>
      )}

      <EditItemModal
        item={editar}
        onCerrar={() => setEditar(null)}
        onGuardar={async (item, dto) => {
          if (await inv.guardar(item, dto)) setEditar(null);
        }}
        onContar={async (item, n) => {
          await inv.contar(item, n);
          setEditar(null);
        }}
      />
      <CrearItemModal
        visible={crear !== null}
        tipoInicial={crear ?? 'caja'}
        productos={productos}
        variantesConBebida={inv.variantesConBebida}
        onCerrar={() => setCrear(null)}
        onCrear={async (dto) => {
          if (await inv.crear(dto)) setCrear(null);
        }}
      />
    </PageContainer>
  );
}

function Seccion({ titulo, icono, color, cantidad, onAgregar }: { titulo: string; icono: React.ComponentProps<typeof Icon>['name']; color: string; cantidad: number; onAgregar: () => void }) {
  return (
    <SectionHeader
      title={titulo}
      icon={icono}
      color={color}
      count={cantidad}
      right={
        <TouchableOpacity onPress={onAgregar} style={styles.seccionAgregar}>
          <Icon name="plus" size={14} color="#F5A524" />
          <Text style={styles.seccionAgregarTexto}>Añadir</Text>
        </TouchableOpacity>
      }
    />
  );
}

function Aviso({ icono, color, texto, onCerrar }: { icono: React.ComponentProps<typeof Icon>['name']; color: string; texto: string; onCerrar?: () => void }) {
  return (
    <View style={[styles.aviso, { backgroundColor: `${color}1A`, borderColor: `${color}33` }]}>
      <Icon name={icono} size={18} color={color} />
      <Text style={[styles.avisoTexto, { color }]}>{texto}</Text>
      {onCerrar && (
        <TouchableOpacity onPress={onCerrar} accessibilityLabel="Cerrar aviso">
          <Icon name="close" size={16} color={color} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  acciones: { flexDirection: 'row', gap: 10 },
  pestanas: { marginBottom: 18 },
  stock: { marginBottom: 32, gap: 16 },
  grilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  celda: { width: '100%', flexGrow: 1 },
  celdaAncha: { maxWidth: 330 },
  grupo: { gap: 10 },
  grupoCabecera: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grupoTitulo: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  linea: { flex: 1, height: 1 },
  filas: { gap: 8 },
  flex: { flex: 1 },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  seccionTitulo: { color: '#F8FAFC', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  seccionCantidad: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  seccionAgregar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,165,36,0.12)' },
  seccionAgregarTexto: { color: '#F5A524', fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase' },
  inactivos: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 8 },
  inactivosTexto: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  avisoTexto: { flex: 1, fontWeight: '700', fontSize: 12.5 },
});
