import React, { useCallback, useMemo, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { View, Text } from '../../tw';
import { Button, Card, Icon } from '../ui';
import { useApi } from '@/src/shared';
import type { InventarioItem, InventarioRegla, Producto, SugerenciaReglaCaja } from '@/src/shared';
import { metaCategoria } from './meta';
import { VarianteLista } from './Modales';

interface Props {
  items: InventarioItem[];
  productos: Producto[];
  sugerencias: SugerenciaReglaCaja[];
  reglas: InventarioRegla[];
  errorReglas: string | null;
  /** Algo cambió (los conteos de reglas de los ítems y las sugerencias se recargan). */
  onCambio: () => void;
  onError: (mensaje: string) => void;
}

/**
 * Qué descuenta cada venta. Las reglas "auto" las creó la migración por tamaño de pizza:
 * se marcan para revisar. Las sugerencias son pizzas/calzones que no gastan ninguna caja.
 */
export function TabReglas({ items, productos, sugerencias, reglas, errorReglas, onCambio, onError }: Props) {
  const api = useApi();
  const [agregarA, setAgregarA] = useState<InventarioItem | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const porItem = useMemo(() => {
    const mapa = new Map<number, InventarioRegla[]>();
    for (const r of reglas) mapa.set(r.itemId, [...(mapa.get(r.itemId) ?? []), r]);
    return mapa;
  }, [reglas]);

  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>) => {
      setOcupado(true);
      try {
        await accion();
        onCambio();
      } catch {
        onError('No se pudo guardar la regla.');
      } finally {
        setOcupado(false);
      }
    },
    [onCambio, onError],
  );

  const guardar = (r: Pick<InventarioRegla, 'itemId' | 'varianteId' | 'cantidad' | 'soloParaLlevar'>) =>
    ejecutar(() => api.inventario.guardarRegla(r));

  const pendientesRevision = reglas.filter((r) => r.origen === 'auto').length;

  return (
    <View style={styles.columna}>
      {sugerencias.length > 0 && (
        <Card style={styles.aviso}>
          <View style={styles.avisoCabecera}>
            <Icon name="alert-outline" size={18} color="#F5A524" />
            <Text style={styles.avisoTitulo}>
              {sugerencias.length} {sugerencias.length === 1 ? 'producto no gasta' : 'productos no gastan'} caja
            </Text>
          </View>
          <Text style={styles.ayuda}>Al venderlos para llevar o a domicilio no se descuenta ninguna caja.</Text>
          {sugerencias.map((s) => (
            <View key={s.varianteId} style={styles.sugerencia}>
              <Text style={styles.sugerenciaTexto} numberOfLines={1}>
                {s.productoNombre} {s.varianteNombre}
              </Text>
              {s.cajaSugerida ? (
                <Button
                  title={`Usar ${s.cajaSugerida.nombre}`}
                  size="sm"
                  variant="outline"
                  disabled={ocupado}
                  onPress={() => guardar({ itemId: s.cajaSugerida!.id, varianteId: s.varianteId, cantidad: 1, soloParaLlevar: true })}
                />
              ) : (
                <Text style={styles.sinCaja}>No hay caja {metaCategoria('caja', s.categoriaCaja).label.toLowerCase()}</Text>
              )}
            </View>
          ))}
        </Card>
      )}

      {pendientesRevision > 0 && (
        <Text style={styles.ayuda}>
          {pendientesRevision} reglas las creó la migración según el tamaño de cada pizza. Revísalas y toca «OK» en las correctas.
        </Text>
      )}

      {errorReglas && <Text style={styles.error}>{errorReglas}</Text>}

      {items
        .filter((i) => i.activo)
        .map((item) => {
          const lista = porItem.get(item.id) ?? [];
          const meta = metaCategoria(item.tipo, item.categoria);
          return (
            <Card key={item.id} style={styles.tarjeta}>
              <View style={styles.cabecera}>
                <Icon name={meta.icon} size={16} color={meta.color} />
                <Text style={styles.itemNombre} numberOfLines={1}>
                  {item.nombre}
                </Text>
                <TouchableOpacity onPress={() => setAgregarA(item)} style={styles.agregar}>
                  <Icon name="plus" size={14} color="#F5A524" />
                  <Text style={styles.agregarTexto}>Producto</Text>
                </TouchableOpacity>
              </View>
              {lista.length === 0 && <Text style={styles.ayuda}>Ningún producto la descuenta todavía.</Text>}
              {lista.map((r) => (
                <ReglaFila
                  key={r.id}
                  regla={r}
                  ocupado={ocupado}
                  onAlternarLlevar={() => guardar({ ...r, soloParaLlevar: !r.soloParaLlevar })}
                  onRevisada={() => guardar(r)}
                  onEliminar={() => ejecutar(() => api.inventario.eliminarRegla(r.id))}
                />
              ))}
            </Card>
          );
        })}

      <Modal visible={!!agregarA} transparent animationType="fade" onRequestClose={() => setAgregarA(null)}>
        <View style={styles.fondo}>
          <Card style={styles.modal}>
            <Text style={styles.modalTitulo}>¿Qué producto descuenta {agregarA?.nombre}?</Text>
            <Text style={styles.ayuda}>
              {agregarA?.tipo === 'caja' ? 'Se descuenta 1 caja por unidad, solo en pedidos para llevar o domicilio.' : 'Se descuenta 1 por cada venta.'}
            </Text>
            {agregarA && (
              <VarianteLista
                productos={productos}
                excluir={new Set((porItem.get(agregarA.id) ?? []).map((r) => r.varianteId))}
                onElegir={(v) => {
                  const item = agregarA;
                  setAgregarA(null);
                  void guardar({ itemId: item.id, varianteId: v.varianteId, cantidad: 1, soloParaLlevar: item.tipo === 'caja' });
                }}
              />
            )}
            <Button title="Cerrar" variant="secondary" onPress={() => setAgregarA(null)} />
          </Card>
        </View>
      </Modal>
    </View>
  );
}

const ReglaFila = React.memo(function ReglaFila({
  regla,
  ocupado,
  onAlternarLlevar,
  onRevisada,
  onEliminar,
}: {
  regla: InventarioRegla;
  ocupado: boolean;
  onAlternarLlevar: () => void;
  onRevisada: () => void;
  onEliminar: () => void;
}) {
  return (
    <View style={styles.regla}>
      <View style={styles.flex}>
        <Text style={styles.reglaTexto} numberOfLines={1}>
          {regla.productoNombre} {regla.varianteNombre}
          {regla.cantidad > 1 ? ` ×${regla.cantidad}` : ''}
        </Text>
        <TouchableOpacity onPress={onAlternarLlevar} disabled={ocupado}>
          <Text style={styles.reglaSub}>{regla.soloParaLlevar ? 'Solo para llevar / domicilio' : 'En todo pedido (incl. mesa)'} · cambiar</Text>
        </TouchableOpacity>
      </View>
      {regla.origen === 'auto' && (
        <TouchableOpacity onPress={onRevisada} disabled={ocupado} style={styles.revisar} accessibilityLabel="Marcar como revisada">
          <Text style={styles.revisarTexto}>Auto · OK</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={onEliminar} disabled={ocupado} style={styles.eliminar} accessibilityLabel="Quitar regla">
        <Icon name="close" size={14} color="#F43F5E" />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  columna: { gap: 14, marginBottom: 40 },
  flex: { flex: 1, minWidth: 0 },
  aviso: { padding: 16, borderWidth: 1, borderColor: 'rgba(245,165,36,0.3)', backgroundColor: 'rgba(245,165,36,0.06)' },
  avisoCabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  avisoTitulo: { color: '#FCD34D', fontSize: 14, fontWeight: '900' },
  ayuda: { color: '#64748B', fontSize: 11, marginBottom: 6 },
  error: { color: '#FB7185', fontWeight: '700' },
  sugerencia: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  sugerenciaTexto: { color: '#E2E8F0', fontSize: 13, fontWeight: '700', flex: 1 },
  sinCaja: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  tarjeta: { padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(15,23,42,0.6)' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemNombre: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', flex: 1 },
  agregar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(245,165,36,0.12)' },
  agregarTexto: { color: '#F5A524', fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase' },
  regla: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  reglaTexto: { color: '#E2E8F0', fontSize: 12.5, fontWeight: '700' },
  reglaSub: { color: '#64748B', fontSize: 10, fontWeight: '700', marginTop: 2 },
  revisar: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.14)' },
  revisarTexto: { color: '#60A5FA', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' },
  eliminar: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,63,94,0.1)' },
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 460, backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)', gap: 6 },
  modalTitulo: { color: 'white', fontSize: 16, fontFamily: 'SpaceGrotesk-Bold' },
});
