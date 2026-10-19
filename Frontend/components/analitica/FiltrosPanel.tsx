import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { View, Text, ScrollView, Pressable, TextInput } from '../../tw';
import { Button, ChipGroup, Icon } from '../ui';
import type { ChipOption } from '../ui';
import { CATEGORIAS_PRODUCTO, normalizePhone } from '@/src/shared';
import type { CategoriaProducto, OpcionesAnalitica, TamanoPizza } from '@/src/shared';
import type { FiltrosExtra } from '../../hooks/use-analitica-filtros';
import {
  CANAL_LABEL,
  DIA_LABEL,
  ESTADO_PAGO_LABEL,
  METODO_LABEL,
  TAMANO_LABEL,
  TIPO_PEDIDO_LABEL,
  etiquetaCategoria,
} from './etiquetas';

export interface FiltrosPanelProps {
  visible: boolean;
  filtros: FiltrosExtra;
  opciones?: OpcionesAnalitica;
  onAplicar: (filtros: FiltrosExtra) => void;
  onCerrar: () => void;
}

const opcionesDe = <T extends string>(mapa: Record<string, string>, claves: readonly T[]): ChipOption<T>[] =>
  claves.map((c) => ({ value: c, label: mapa[c] ?? c }));

const HORAS: ChipOption<number>[] = Array.from({ length: 24 }, (_, h) => ({ value: h, label: `${h}h` }));

/**
 * Panel con todos los filtros de la analítica. Edita un borrador local y solo aplica
 * al confirmar, para no disparar una consulta por cada chip tocado.
 */
export function FiltrosPanel({ visible, filtros, opciones, onAplicar, onCerrar }: FiltrosPanelProps) {
  const [borrador, setBorrador] = useState<FiltrosExtra>(filtros);
  const [busquedaProducto, setBusquedaProducto] = useState('');

  useEffect(() => {
    if (visible) setBorrador(filtros);
  }, [visible, filtros]);

  const set = <K extends keyof FiltrosExtra>(k: K, v: FiltrosExtra[K] | undefined) =>
    setBorrador((prev) => ({ ...prev, [k]: v === undefined || (Array.isArray(v) && v.length === 0) ? undefined : v }));

  const productos = useMemo<ChipOption<number>[]>(() => {
    const q = busquedaProducto.trim().toLowerCase();
    return (opciones?.productos ?? [])
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .map((p) => ({ value: p.productoId, label: p.nombre }));
  }, [opciones, busquedaProducto]);

  const grupos = useMemo<ChipOption<number>[]>(
    () => (opciones?.grupos ?? []).map((g) => ({ value: g.id, label: g.nombre })),
    [opciones],
  );

  const sabores = useMemo<ChipOption<number>[]>(
    () => (opciones?.sabores ?? []).map((s) => ({ value: s.saborId, label: s.nombre })),
    [opciones],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={styles.fondo}>
        <View className="bg-slate-950 border border-white/10" style={styles.panel}>
          <View style={styles.cabecera}>
            <Icon name="filter-variant" size={20} color="#F5A524" />
            <Text className="text-white font-black text-lg uppercase flex-1" style={styles.titulo}>
              Filtros
            </Text>
            <Pressable onPress={onCerrar} accessibilityLabel="Cerrar filtros" style={styles.cerrar}>
              <Icon name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView style={styles.cuerpo} contentContainerStyle={styles.cuerpoContenido}>
            <Seccion titulo="Tipo de pedido">
              <ChipGroup
                multiple
                options={opcionesDe(TIPO_PEDIDO_LABEL, ['mesa', 'llevar', 'domicilio'] as const)}
                value={borrador.tipoPedido ?? []}
                onChange={(v) => set('tipoPedido', v)}
              />
            </Seccion>

            <Seccion titulo="Categoría de producto">
              <ChipGroup
                multiple
                options={CATEGORIAS_PRODUCTO.map((c) => ({ value: c as CategoriaProducto, label: etiquetaCategoria(c) }))}
                value={borrador.categoria ?? []}
                onChange={(v) => set('categoria', v)}
              />
            </Seccion>

            <Seccion titulo="Tamaño de pizza">
              <ChipGroup
                multiple
                options={opcionesDe(TAMANO_LABEL, ['pequena', 'mediana', 'grande'] as const)}
                value={(borrador.tamano ?? []) as TamanoPizza[]}
                onChange={(v) => set('tamano', v)}
              />
            </Seccion>

            <Seccion titulo="Producto">
              <TextInput
                value={busquedaProducto}
                onChangeText={setBusquedaProducto}
                placeholder="Buscar producto…"
                placeholderTextColor="#475569"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm mb-2"
              />
              <ChipGroup multiple options={productos} value={borrador.productoId ?? []} onChange={(v) => set('productoId', v)} />
            </Seccion>

            <Seccion titulo="Sabor">
              <ChipGroup multiple options={sabores} value={borrador.saborId ?? []} onChange={(v) => set('saborId', v)} />
            </Seccion>

            {grupos.length > 1 && (
              <Seccion titulo="Grupo de sabores">
                <ChipGroup multiple options={grupos} value={borrador.saborGrupoId ?? []} onChange={(v) => set('saborGrupoId', v)} />
              </Seccion>
            )}

            <Seccion titulo="Método de pago">
              <ChipGroup
                multiple
                options={opcionesDe(METODO_LABEL, ['efectivo', 'transferencia', 'mixto', 'sin_metodo'] as const)}
                value={borrador.metodoPago ?? []}
                onChange={(v) => set('metodoPago', v)}
              />
            </Seccion>

            <Seccion titulo="Estado de pago">
              <ChipGroup
                multiple
                options={opcionesDe(ESTADO_PAGO_LABEL, ['cobrada', 'parcial', 'pendiente'] as const)}
                value={borrador.estadoPago ?? []}
                onChange={(v) => set('estadoPago', v)}
              />
            </Seccion>

            <Seccion titulo="Día de la semana">
              <ChipGroup
                multiple
                options={DIA_LABEL.map((d, i) => ({ value: i + 1, label: d }))}
                value={borrador.diaSemana ?? []}
                onChange={(v) => set('diaSemana', v)}
              />
            </Seccion>

            <Seccion titulo="Franja horaria">
              <Text className="text-slate-500 text-[10px] font-bold mb-1">Desde</Text>
              <ChipGroup scroll options={HORAS} value={borrador.horaDesde ?? null} allowEmpty onChange={(v) => set('horaDesde', v ?? undefined)} />
              <Text className="text-slate-500 text-[10px] font-bold mt-2 mb-1">Hasta</Text>
              <ChipGroup scroll options={HORAS} value={borrador.horaHasta ?? null} allowEmpty onChange={(v) => set('horaHasta', v ?? undefined)} />
            </Seccion>

            <Seccion titulo="Canal">
              <ChipGroup
                multiple
                options={opcionesDe(CANAL_LABEL, ['pos', 'web'] as const)}
                value={borrador.canal ?? []}
                onChange={(v) => set('canal', v)}
              />
            </Seccion>

            {!!opciones?.domiciliarios.length && (
              <Seccion titulo="Domiciliario">
                <ChipGroup
                  options={opciones.domiciliarios.map((d) => ({ value: d.telefono, label: d.nombre }))}
                  value={borrador.domiciliario ?? null}
                  allowEmpty
                  onChange={(v) => set('domiciliario', v ?? undefined)}
                />
              </Seccion>
            )}

            {!!opciones?.usuarios.length && (
              <Seccion titulo="Creada por">
                <ChipGroup
                  options={opciones.usuarios.map((u) => ({ value: u.id, label: u.nombre }))}
                  value={borrador.usuario ?? null}
                  allowEmpty
                  onChange={(v) => set('usuario', v ?? undefined)}
                />
              </Seccion>
            )}

            <Seccion titulo="Precio manual">
              <ChipGroup
                options={[
                  { value: 'si', label: 'Con precio manual' },
                  { value: 'no', label: 'Precio normal' },
                ]}
                value={borrador.precioManual == null ? null : borrador.precioManual ? 'si' : 'no'}
                allowEmpty
                onChange={(v) => set('precioManual', v == null ? undefined : v === 'si')}
              />
            </Seccion>

            <Seccion titulo="Cliente (teléfono)">
              <TextInput
                value={borrador.cliente ?? ''}
                onChangeText={(t) => set('cliente', normalizePhone(t) || undefined)}
                placeholder="3001234567"
                keyboardType="phone-pad"
                placeholderTextColor="#475569"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
              />
            </Seccion>
          </ScrollView>

          <View style={styles.pie}>
            <View style={styles.flex}>
              <Button title="Limpiar" variant="ghost" size="md" onPress={() => setBorrador({})} />
            </View>
            <View style={styles.flex}>
              <Button title="Aplicar" icon="check" variant="primary" size="md" onPress={() => onAplicar(borrador)} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.seccion}>
      <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">{titulo}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(2,6,23,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  panel: { width: '100%', maxWidth: 640, maxHeight: '92%', borderRadius: 28, overflow: 'hidden' },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  titulo: { fontFamily: 'Space Grotesk' },
  cerrar: { padding: 6 },
  cuerpo: { flexGrow: 0 },
  cuerpoContenido: { padding: 18, gap: 18 },
  seccion: {},
  separador: { height: 8 },
  pie: { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  flex: { flex: 1 },
});
