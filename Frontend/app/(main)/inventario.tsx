import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, TouchableOpacity } from 'react-native';
import { View, Text, ScrollView, TextInput } from '../../tw';
import { api } from '../../services/api';
import { PageContainer, PageHeader, Card, Icon, Button, ConfirmModal, BebidaMovimientosWidget } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { EmptyState } from '../../components/states/EmptyState';
import { useProductos } from '@/src/shared';
import type { InventarioCaja, InventarioCajasMovimiento, Producto, ProductoVariante } from '@/src/shared';
import { useBreakpoint } from '../../styles/responsive';

// ─── Estado unificado (una sola regla, usada en píldora, número y medidor) ────

type Estado = 'ok' | 'bajo' | 'critico';

function clasificar(cantidad: number, alerta: number | null | undefined): Estado {
  if (cantidad <= 0) return 'critico';
  if (alerta == null) return 'ok';
  if (cantidad <= alerta) return 'critico';
  if (cantidad <= alerta * 1.5) return 'bajo';
  return 'ok';
}

const ESTADO_META: Record<Estado, { color: string; bg: string }> = {
  ok: { color: '#10B981', bg: 'rgba(16,185,129,0.14)' },
  bajo: { color: '#F5A524', bg: 'rgba(245,165,36,0.16)' },
  critico: { color: '#F43F5E', bg: 'rgba(244,63,94,0.16)' },
};

function estadoLabel(estado: Estado, cantidad: number): string {
  if (estado === 'ok') return 'OK';
  if (estado === 'bajo') return 'Bajo';
  return cantidad <= 0 ? 'Agotado' : 'Crítico';
}

// El medidor se llena contra un objetivo REAL (no un divisor inventado). Si no
// hay objetivo configurado, se estima uno para no dejar la barra vacía, pero se
// marca como estimado en la UI para invitar a configurarlo.
function gauge(cantidad: number, alerta: number | null | undefined, objetivo: number | null | undefined) {
  const estimated = !(objetivo && objetivo > 0);
  const target = estimated ? Math.max((alerta ?? 0) * 4, cantidad, 10) : objetivo!;
  const fillPct = Math.max(0, Math.min(cantidad / target, 1)) * 100;
  const markPct = alerta != null && alerta > 0 ? Math.min(alerta / target, 1) * 100 : null;
  return { target, fillPct, markPct, estimated };
}

// ─── Categorías de bebida (data-driven con fallback por nombre) ───────────────

const CATEGORIAS: { key: string; label: string; icon: IconName; color: string }[] = [
  { key: 'gaseosa', label: 'Gaseosas', icon: 'bottle-soda', color: '#60A5FA' },
  { key: 'jugo', label: 'Jugos', icon: 'cup', color: '#F59E0B' },
  { key: 'cerveza', label: 'Cervezas', icon: 'glass-mug-variant', color: '#FBBF24' },
  { key: 'agua', label: 'Agua', icon: 'water', color: '#38BDF8' },
  { key: 'otra', label: 'Otras', icon: 'bottle-tonic-outline', color: '#94A3B8' },
];
const CAT_META = (k: string) => CATEGORIAS.find((c) => c.key === k) ?? CATEGORIAS[4];

const BEBIDA_NAME_RE = /gaseosa|jugo|pulpa|limonada|cerveza|agua|bebida|gatorade|hidrat/i;

function deriveCategoria(nombreProducto: string): string {
  const n = nombreProducto.toLowerCase();
  if (/gaseosa/.test(n)) return 'gaseosa';
  if (/jugo|pulpa|limonada/.test(n)) return 'jugo';
  if (/cerveza/.test(n)) return 'cerveza';
  if (/agua/.test(n)) return 'agua';
  return 'otra';
}

interface BebidaRowData {
  varianteId: number;
  nombre: string;
  productoNombre: string;
  categoria: string;
  stock: number;
  alerta: number | null;
  objetivo: number | null;
}

// ─── Piezas reutilizables ─────────────────────────────────────────────────────

const StatePill = React.memo(({ estado, cantidad }: { estado: Estado; cantidad: number }) => {
  const m = ESTADO_META[estado];
  return (
    <View style={{ backgroundColor: m.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
      <Text style={{ color: m.color, fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {estadoLabel(estado, cantidad)}
      </Text>
    </View>
  );
});

const Gauge = React.memo(({ cantidad, alerta, objetivo, color }: { cantidad: number; alerta: number | null; objetivo: number | null; color: string }) => {
  const g = gauge(cantidad, alerta, objetivo);
  return (
    <View style={{ marginTop: 12 }}>
      <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, height: 6, width: `${g.fillPct}%` as any, backgroundColor: color, borderRadius: 6 }} />
      </View>
      {/* Marca de alerta sobre la misma escala */}
      {g.markPct != null && (
        <View style={{ position: 'absolute', top: -3, left: `${g.markPct}%` as any, width: 2, height: 12, backgroundColor: '#E2E8F0', borderRadius: 2 }} />
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {alerta != null ? `Alerta ${alerta}` : 'Sin alerta'}
        </Text>
        <Text style={{ color: '#64748B', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {g.estimated ? `Objetivo ~${g.target}` : `Objetivo ${g.target}`}
        </Text>
      </View>
    </View>
  );
});

const Stepper = React.memo(({ value, onMinus, onPlus, disabled }: { value: number | string; onMinus: () => void; onPlus: () => void; disabled?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 11, padding: 5, paddingHorizontal: 8 }}>
    <TouchableOpacity onPress={onMinus} disabled={disabled} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(244,63,94,0.14)', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: '#F43F5E', fontSize: 18, fontWeight: '900', lineHeight: 20 }}>−</Text>
    </TouchableOpacity>
    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', minWidth: 34, textAlign: 'center', fontFamily: 'SpaceGrotesk-Bold' }}>{value}</Text>
    <TouchableOpacity onPress={onPlus} disabled={disabled} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.14)', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ color: '#34D399', fontSize: 18, fontWeight: '900', lineHeight: 20 }}>+</Text>
    </TouchableOpacity>
  </View>
));

// Campo "¿Cuántas llegaron?" — mismo control para cajas y bebidas.
const ArrivalField = React.memo(({ onRegister, width }: { onRegister: (n: number) => void; width?: number }) => {
  const [val, setVal] = useState('');
  const n = Number(val);
  const canRegister = val.trim().length > 0 && n > 0;
  const commit = () => {
    if (!canRegister) return;
    onRegister(n);
    setVal('');
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, width }}>
      <TextInput
        value={val}
        onChangeText={(v: string) => setVal(v.replace(/\D/g, ''))}
        placeholder="¿Cuántas llegaron?"
        placeholderTextColor="#475569"
        keyboardType="numeric"
        onSubmitEditing={commit}
        style={{ flex: 1, minWidth: 0, height: 34, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: canRegister ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 10, color: '#F8FAFC', fontSize: 12, fontWeight: '700' }}
      />
      <TouchableOpacity onPress={commit} disabled={!canRegister} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: canRegister ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', opacity: canRegister ? 1 : 0.5 }}>
        <Icon name="check" size={16} color={canRegister ? '#34D399' : '#475569'} />
      </TouchableOpacity>
    </View>
  );
});

// ─── Tarjeta de caja ──────────────────────────────────────────────────────────

const CajaCard = React.memo(({ caja, onAdjust, onEdit, busy }: {
  caja: InventarioCaja;
  onAdjust: (id: number, delta: number) => void;
  onEdit: (caja: InventarioCaja) => void;
  busy: boolean;
}) => {
  const estado = clasificar(caja.cantidad, caja.alertaMinimo);
  const meta = ESTADO_META[estado];
  return (
    <Card style={{ padding: 16, borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1, backgroundColor: 'rgba(15,23,42,0.75)', position: 'relative', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: meta.color }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ color: '#F8FAFC', fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3, flex: 1, marginRight: 8 }} numberOfLines={1}>
          {caja.nombre}
        </Text>
        <StatePill estado={estado} cantidad={caja.cantidad} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={{ color: meta.color, fontSize: 42, fontWeight: '900', lineHeight: 44, fontFamily: 'SpaceGrotesk-Bold' }}>{caja.cantidad}</Text>
        <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>cajas</Text>
      </View>

      <Gauge cantidad={caja.cantidad} alerta={caja.alertaMinimo} objetivo={caja.nivelObjetivo} color={meta.color} />

      <View style={{ marginTop: 14 }}>
        <Stepper value={caja.cantidad} onMinus={() => onAdjust(caja.id, -1)} onPlus={() => onAdjust(caja.id, 1)} disabled={busy} />
      </View>
      <View style={{ marginTop: 10 }}>
        <ArrivalField onRegister={(n) => onAdjust(caja.id, n)} />
      </View>

      <TouchableOpacity onPress={() => onEdit(caja)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', marginTop: 13, paddingTop: 11 }}>
        <Text style={{ color: '#94A3B8', fontSize: 10.5, fontWeight: '700' }}>
          {caja.alertaMinimo != null ? `Alerta ≤ ${caja.alertaMinimo}` : 'Sin alerta'}{caja.nivelObjetivo != null ? ` · Objetivo ${caja.nivelObjetivo}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Icon name="pencil-outline" size={13} color="#F5A524" />
          <Text style={{ color: '#F5A524', fontSize: 10.5, fontWeight: '800' }}>Editar</Text>
        </View>
      </TouchableOpacity>
    </Card>
  );
});

// ─── Fila de bebida ───────────────────────────────────────────────────────────

const BebidaRow = React.memo(({ row, onAdjust, onEdit, busy, isMobile }: {
  row: BebidaRowData;
  onAdjust: (varianteId: number, delta: number) => void;
  onEdit: (row: BebidaRowData) => void;
  busy: boolean;
  isMobile: boolean;
}) => {
  const estado = clasificar(row.stock, row.alerta);
  const meta = ESTADO_META[estado];
  return (
    <Card style={{ padding: 13, paddingHorizontal: 16, borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1, backgroundColor: 'rgba(15,23,42,0.6)', position: 'relative', overflow: 'hidden' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: meta.color }} />
      <View style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? 12 : 16 }}>
        <View style={{ flex: isMobile ? undefined : 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 }} numberOfLines={1}>{row.nombre}</Text>
            <Text style={{ color: '#64748B', fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', marginTop: 3 }} numberOfLines={1}>
              {row.productoNombre}{row.alerta != null ? ` · alerta ≤ ${row.alerta}` : ''}
            </Text>
          </View>
          <StatePill estado={estado} cantidad={row.stock} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          <View style={{ minWidth: 44, alignItems: 'center' }}>
            <Text style={{ color: estado === 'critico' ? '#F43F5E' : '#F8FAFC', fontSize: 22, fontWeight: '900', lineHeight: 24, fontFamily: 'SpaceGrotesk-Bold' }}>{busy ? '…' : row.stock}</Text>
            <Text style={{ color: '#334155', fontSize: 7, fontWeight: '700', textTransform: 'uppercase' }}>uds</Text>
          </View>
          <Stepper value={row.stock} onMinus={() => onAdjust(row.varianteId, -1)} onPlus={() => onAdjust(row.varianteId, 1)} disabled={busy} />
          <ArrivalField onRegister={(n) => onAdjust(row.varianteId, n)} width={isMobile ? undefined : 190} />
          <TouchableOpacity onPress={() => onEdit(row)} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(245,165,36,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pencil-outline" size={15} color="#F5A524" />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
});

// ─── Modal de edición (alerta + objetivo, y categoría para bebidas) ───────────

function EditModal({ visible, title, subtitle, showCategoria, categoria, alerta, objetivo, onSave, onDelete, onClose }: {
  visible: boolean;
  title: string;
  subtitle: string;
  showCategoria: boolean;
  categoria?: string;
  alerta: number | null;
  objetivo: number | null;
  onSave: (v: { categoria?: string; alerta: number | null; objetivo: number | null }) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState(categoria ?? 'otra');
  const [a, setA] = useState(alerta != null ? String(alerta) : '');
  const [o, setO] = useState(objetivo != null ? String(objetivo) : '');

  // Re-sincroniza al abrir con otro item
  useEffect(() => {
    if (visible) {
      setCat(categoria ?? 'otra');
      setA(alerta != null ? String(alerta) : '');
      setO(objetivo != null ? String(objetivo) : '');
    }
  }, [visible, categoria, alerta, objetivo]);

  const numOrNull = (s: string) => (s.trim() === '' ? null : Math.max(0, Number(s.replace(/\D/g, ''))));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Card style={{ width: '100%', maxWidth: 420, backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: 'white', fontSize: 18, fontFamily: 'SpaceGrotesk-Bold' }}>{title}</Text>
          <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2, marginBottom: 18 }}>{subtitle}</Text>

          {showCategoria && (
            <>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                {CATEGORIAS.map((c) => {
                  const on = cat === c.key;
                  return (
                    <TouchableOpacity key={c.key} onPress={() => setCat(c.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? `${c.color}22` : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: on ? `${c.color}55` : 'rgba(255,255,255,0.08)' }}>
                      <Icon name={c.icon} size={14} color={on ? c.color : '#64748B'} />
                      <Text style={{ color: on ? c.color : '#94A3B8', fontSize: 11, fontWeight: '800' }}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 22 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Alerta ≤</Text>
              <TextInput value={a} onChangeText={(v: string) => setA(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="Ej: 10" placeholderTextColor="#475569" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 14 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Objetivo</Text>
              <TextInput value={o} onChangeText={(v: string) => setO(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="Ej: 100" placeholderTextColor="#475569" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontSize: 14 }} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Guardar" variant="primary" onPress={() => onSave({ categoria: cat, alerta: numOrNull(a), objetivo: numOrNull(o) })} style={{ flex: 1 }} />
          </View>

          {onDelete && (
            <TouchableOpacity onPress={onDelete} style={{ marginTop: 16, alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: '#F43F5E', fontSize: 12, fontWeight: '800' }}>Eliminar esta caja</Text>
            </TouchableOpacity>
          )}
        </Card>
      </View>
    </Modal>
  );
}

// ─── Resumen superior ─────────────────────────────────────────────────────────

const SummaryStrip = React.memo(({ items }: { items: { label: string; value: string; warn?: boolean }[] }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
    {items.map((it) => (
      <View key={it.label} style={{ flex: 1, minWidth: 150, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}>
        <Text style={{ color: '#94A3B8', fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 }}>{it.label}</Text>
        <Text style={{ color: it.warn ? '#F5A524' : '#F8FAFC', fontSize: 24, fontWeight: '900', marginTop: 4, fontFamily: 'SpaceGrotesk-Bold' }}>{it.value}</Text>
      </View>
    ))}
  </View>
));

// ─── Pantalla ─────────────────────────────────────────────────────────────────

type Tab = 'cajas' | 'bebidas' | 'movimientos';

export default function InventarioScreen() {
  const { isMobile } = useBreakpoint();
  const { productos, fetchProductos } = useProductos();

  const [tab, setTab] = useState<Tab>('cajas');
  const [cajas, setCajas] = useState<InventarioCaja[]>([]);
  const [movimientos, setMovimientos] = useState<InventarioCajasMovimiento[]>([]);
  const [stockOverride, setStockOverride] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyCaja, setBusyCaja] = useState<number | null>(null);
  const [busyBebida, setBusyBebida] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Modales
  const [editCaja, setEditCaja] = useState<InventarioCaja | null>(null);
  const [editBebida, setEditBebida] = useState<BebidaRowData | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventarioCaja | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [est, movs] = await Promise.all([
        api.inventarioCajas.getEstado(),
        api.inventarioCajas.getMovimientos(30),
      ]);
      setCajas(Array.isArray(est) ? est : []);
      setMovimientos(Array.isArray(movs) ? movs : []);
      await fetchProductos();
      setError('');
    } catch {
      setError('No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchProductos]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  // ── Bebidas derivadas de los productos ──
  const bebidasPorCategoria = useMemo(() => {
    const rows: BebidaRowData[] = [];
    for (const p of productos as Producto[]) {
      const esBebidaProd = BEBIDA_NAME_RE.test(p.productoNombre);
      for (const v of p.variantes ?? []) {
        if (!v.activo) continue;
        const tracked = v.categoriaBebida != null || esBebidaProd;
        if (!tracked) continue;
        rows.push({
          varianteId: v.varianteId,
          nombre: v.nombre,
          productoNombre: p.productoNombre,
          categoria: v.categoriaBebida ?? deriveCategoria(p.productoNombre),
          stock: stockOverride[v.varianteId] ?? v.stockBebida ?? 0,
          alerta: v.alertaBebida ?? null,
          objetivo: v.nivelObjetivoBebida ?? null,
        });
      }
    }
    const grouped = CATEGORIAS.map((c) => ({ cat: c, rows: rows.filter((r) => r.categoria === c.key) })).filter((g) => g.rows.length > 0);
    return { grouped, total: rows.reduce((s, r) => s + r.stock, 0), enAlerta: rows.filter((r) => clasificar(r.stock, r.alerta) !== 'ok').length };
  }, [productos, stockOverride]);

  // ── Acciones cajas ──
  const adjustCaja = useCallback(async (id: number, delta: number) => {
    setBusyCaja(id);
    try {
      const updated = await api.inventarioCajas.ajustar(id, { delta, tipo: delta > 0 ? 'entrada' : 'salida' });
      setCajas((prev) => prev.map((c) => (c.id === id ? updated : c)));
      api.inventarioCajas.getMovimientos(30).then((m) => setMovimientos(Array.isArray(m) ? m : [])).catch(() => {});
    } catch {
      setError('Error al ajustar la caja.');
    } finally {
      setBusyCaja(null);
    }
  }, []);

  const saveCaja = useCallback(async (id: number, alerta: number | null, objetivo: number | null) => {
    try {
      const updated = await api.inventarioCajas.configurar(id, {
        ...(alerta != null ? { alertaMinimo: alerta } : {}),
        ...(objetivo != null ? { nivelObjetivo: objetivo } : {}),
      });
      setCajas((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
    } catch {
      setError('Error al guardar la configuración.');
    }
  }, []);

  const crearCaja = useCallback(async (data: { nombre: string; cantidad: number; alerta: number | null; objetivo: number | null }) => {
    try {
      await api.inventarioCajas.crear({
        nombre: data.nombre,
        cantidad: data.cantidad,
        ...(data.alerta != null ? { alertaMinimo: data.alerta } : {}),
        ...(data.objetivo != null ? { nivelObjetivo: data.objetivo } : {}),
      });
      setShowCreate(false);
      fetchData();
    } catch {
      setError('Error al crear la caja.');
    }
  }, [fetchData]);

  const eliminarCaja = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.inventarioCajas.eliminar(deleteTarget.id);
      setCajas((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    } catch {
      setError('Error al eliminar.');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // ── Acciones bebidas ──
  const adjustBebida = useCallback(async (varianteId: number, delta: number) => {
    setBusyBebida(varianteId);
    try {
      const updated = await api.productos.ajustarStockBebida(varianteId, delta);
      setStockOverride((prev) => ({ ...prev, [varianteId]: updated.stockBebida ?? 0 }));
    } catch {
      setError('Error al ajustar el stock.');
    } finally {
      setBusyBebida(null);
    }
  }, []);

  const saveBebida = useCallback(async (varianteId: number, categoria: string, alerta: number | null, objetivo: number | null) => {
    try {
      await api.productos.configurarBebida(varianteId, {
        categoriaBebida: categoria,
        alertaBebida: alerta,
        nivelObjetivoBebida: objetivo,
      });
      await fetchProductos();
    } catch {
      setError('Error al guardar la configuración.');
    }
  }, [fetchProductos]);

  const totalCajas = cajas.reduce((s, c) => s + c.cantidad, 0);
  const cajasEnAlerta = cajas.filter((c) => clasificar(c.cantidad, c.alertaMinimo) !== 'ok').length;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'cajas', label: 'Cajas' },
    { key: 'bebidas', label: 'Bebidas' },
    { key: 'movimientos', label: 'Movimientos' },
  ];

  return (
    <PageContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F5A524" colors={['#F5A524']} />}>
      <PageHeader
        title="Inventario"
        subtitle="Empaques y bebidas en una sola vista"
        icon="package-variant"
        rightContent={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {tab === 'cajas' && <Button title={isMobile ? '' : 'Añadir Caja'} icon="plus" variant="primary" size="sm" onPress={() => setShowCreate(true)} />}
            <Button title="" icon="refresh" variant="ghost" size="sm" onPress={fetchData} loading={loading} />
          </View>
        }
      />

      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(244,63,94,0.1)', padding: 14, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(244,63,94,0.2)' }}>
          <Icon name="alert-circle-outline" size={18} color="#F43F5E" />
          <Text style={{ color: '#FB7185', flex: 1, fontWeight: '700' }}>{error}</Text>
        </View>
      ) : null}

      {/* Resumen */}
      <SummaryStrip items={[
        { label: 'Cajas en total', value: String(totalCajas) },
        { label: 'Tipos en alerta', value: String(cajasEnAlerta), warn: cajasEnAlerta > 0 },
        { label: 'Bebidas en total', value: String(bebidasPorCategoria.total) },
        { label: 'Bebidas en alerta', value: String(bebidasPorCategoria.enAlerta), warn: bebidasPorCategoria.enAlerta > 0 },
      ]} />

      {/* Tabs */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: on ? 'rgba(245,165,36,0.15)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: on ? 'rgba(245,165,36,0.35)' : 'rgba(255,255,255,0.08)' }}>
              <Text style={{ color: on ? '#F5A524' : '#94A3B8', fontSize: 12, fontWeight: '800' }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && cajas.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 60 }}><ActivityIndicator size="large" color="#F5A524" /></View>
      ) : tab === 'cajas' ? (
        cajas.length === 0 ? (
          <EmptyState icon="package-variant" message="Sin cajas registradas" subMessage="Agrega tipos de caja con el botón de arriba" />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 32 }}>
            {cajas.map((c) => (
              <View key={c.id} style={{ width: '100%', maxWidth: isMobile ? undefined : 330, flexGrow: 1 }}>
                <CajaCard caja={c} onAdjust={adjustCaja} onEdit={setEditCaja} busy={busyCaja === c.id} />
              </View>
            ))}
          </View>
        )
      ) : tab === 'bebidas' ? (
        bebidasPorCategoria.grouped.length === 0 ? (
          <EmptyState icon="bottle-soda-outline" message="Sin bebidas rastreadas" subMessage="Crea productos de bebida (gaseosa, jugo, cerveza…) en Catálogo de Productos" />
        ) : (
          <View style={{ marginBottom: 32, gap: 24 }}>
            {bebidasPorCategoria.grouped.map((g) => (
              <View key={g.cat.key}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: `${g.cat.color}18`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${g.cat.color}30` }}>
                    <Icon name={g.cat.icon} size={18} color={g.cat.color} />
                  </View>
                  <Text style={{ color: g.cat.color, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>{g.cat.label}</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: `${g.cat.color}20` }} />
                  <Text style={{ color: g.cat.color, fontSize: 11, fontWeight: '800' }}>{g.rows.length}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {g.rows.map((r) => (
                    <BebidaRow key={r.varianteId} row={r} onAdjust={adjustBebida} onEdit={setEditBebida} busy={busyBebida === r.varianteId} isMobile={isMobile} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )
      ) : (
        // ── Movimientos ──
        <View style={{ marginBottom: 40, gap: 24 }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Movimientos de cajas</Text>
            {movimientos.length === 0 ? (
              <Text style={{ color: '#475569', fontSize: 13 }}>Sin movimientos recientes.</Text>
            ) : movimientos.map((mov) => {
              const isEntrada = mov.delta > 0;
              return (
                <View key={mov.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: isEntrada ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={isEntrada ? 'plus' : 'minus'} size={14} color={isEntrada ? '#10B981' : '#F43F5E'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 12 }}>{mov.cajaNombre}</Text>
                    <Text style={{ color: isEntrada ? '#10B981' : '#F43F5E', fontWeight: '900', fontSize: 11 }}>{isEntrada ? '+' : ''}{mov.delta} → quedó en {mov.cantidadResultante}</Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{new Date(mov.creadoEn).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</Text>
                </View>
              );
            })}
          </View>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 }}>Movimientos de bebidas</Text>
            <BebidaMovimientosWidget />
          </View>
        </View>
      )}

      {/* Modal editar caja */}
      <EditModal
        visible={!!editCaja}
        title={editCaja ? `Configurar ${editCaja.nombre}` : ''}
        subtitle="El umbral avisa cuándo reponer; el objetivo llena el medidor."
        showCategoria={false}
        alerta={editCaja?.alertaMinimo ?? null}
        objetivo={editCaja?.nivelObjetivo ?? null}
        onSave={(v) => { if (editCaja) { saveCaja(editCaja.id, v.alerta, v.objetivo); setEditCaja(null); } }}
        onDelete={editCaja ? () => { setDeleteTarget(editCaja); setEditCaja(null); } : undefined}
        onClose={() => setEditCaja(null)}
      />

      {/* Modal editar bebida */}
      <EditModal
        visible={!!editBebida}
        title={editBebida ? `Configurar ${editBebida.nombre}` : ''}
        subtitle="Clasifícala, define umbral de alerta y objetivo del medidor."
        showCategoria
        categoria={editBebida?.categoria}
        alerta={editBebida?.alerta ?? null}
        objetivo={editBebida?.objetivo ?? null}
        onSave={(v) => { if (editBebida) { saveBebida(editBebida.varianteId, v.categoria ?? 'otra', v.alerta, v.objetivo); setEditBebida(null); } }}
        onClose={() => setEditBebida(null)}
      />

      {/* Modal crear caja */}
      <CreateCajaModal visible={showCreate} onCreate={crearCaja} onClose={() => setShowCreate(false)} />

      {/* Confirmar eliminación */}
      <ConfirmModal
        visible={!!deleteTarget}
        title="¿Eliminar Caja?"
        message={`Se eliminará "${deleteTarget?.nombre}" con su recuento y movimientos. Esta acción es irreversible.`}
        icon="trash-can"
        variant="danger"
        confirmText="Eliminar permanentemente"
        onConfirm={eliminarCaja}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}

// ─── Modal de creación de caja ────────────────────────────────────────────────

function CreateCajaModal({ visible, onCreate, onClose }: {
  visible: boolean;
  onCreate: (data: { nombre: string; cantidad: number; alerta: number | null; objetivo: number | null }) => void;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('0');
  const [alerta, setAlerta] = useState('');
  const [objetivo, setObjetivo] = useState('');

  useEffect(() => {
    if (visible) { setNombre(''); setCantidad('0'); setAlerta(''); setObjetivo(''); }
  }, [visible]);

  const numOrNull = (s: string) => (s.trim() === '' ? null : Math.max(0, Number(s.replace(/\D/g, ''))));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Card style={{ width: '100%', maxWidth: 420, backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: 'white', fontSize: 18, fontFamily: 'SpaceGrotesk-Bold', marginBottom: 16 }}>Añadir Tipo de Caja</Text>

          <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Nombre (Ej: Caja Pizza Grande)</Text>
          <TextInput value={nombre} onChangeText={setNombre} placeholder="Caja Mediana…" placeholderTextColor="#475569" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Stock inicial</Text>
              <TextInput value={cantidad} onChangeText={(v: string) => setCantidad(v.replace(/\D/g, ''))} keyboardType="numeric" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Alerta ≤</Text>
              <TextInput value={alerta} onChangeText={(v: string) => setAlerta(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="10" placeholderTextColor="#475569" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 4 }}>Objetivo</Text>
              <TextInput value={objetivo} onChangeText={(v: string) => setObjetivo(v.replace(/\D/g, ''))} keyboardType="numeric" placeholder="100" placeholderTextColor="#475569" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title="Crear Caja"
              variant="primary"
              onPress={() => { if (nombre.trim()) onCreate({ nombre: nombre.trim(), cantidad: Number(cantidad) || 0, alerta: numOrNull(alerta), objetivo: numOrNull(objetivo) }); }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
