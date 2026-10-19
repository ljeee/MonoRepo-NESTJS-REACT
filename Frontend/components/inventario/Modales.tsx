import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { View, Text, TextInput, ScrollView } from '../../tw';
import { Button, Card, ChipGroup, Icon, SearchInput, SegmentedControl } from '../ui';
import type { ActualizarItemInventarioDto, CrearItemInventarioDto, InventarioItem, Producto, ProductoVariante, TipoItemInventario } from '@/src/shared';
import { CATEGORIAS_BEBIDA, CATEGORIAS_CAJA } from './meta';

const soloDigitos = (v: string) => v.replace(/\D/g, '');
const numOrNull = (s: string) => (s.trim() === '' ? null : Math.max(0, Number(soloDigitos(s))));

function Shell({ visible, onCerrar, children }: { visible: boolean; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.fondo}>
        <Card style={styles.caja}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContenido} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Card>
      </View>
    </Modal>
  );
}

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.flex}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v: string) => onChange(soloDigitos(v))}
        keyboardType="numeric"
        placeholder={placeholder}
        placeholderTextColor="#475569"
        style={styles.input}
      />
    </View>
  );
}

function ChipsCategoria({ tipo, value, onChange }: { tipo: TipoItemInventario; value: string; onChange: (v: string) => void }) {
  const lista = tipo === 'caja' ? CATEGORIAS_CAJA : CATEGORIAS_BEBIDA;
  return (
    <View style={styles.bloque}>
      <Text style={styles.label}>{tipo === 'caja' ? 'Tamaño de caja' : 'Categoría'}</Text>
      <ChipGroup
        value={value}
        onChange={(v) => v && onChange(v)}
        options={lista.map((c) => ({ value: c.key, label: c.label, icon: c.icon }))}
        size="md"
      />
    </View>
  );
}

// ─── Editar (configuración + conteo físico + activar/desactivar) ──────────────

export function EditItemModal({
  item,
  onGuardar,
  onContar,
  onCerrar,
}: {
  item: InventarioItem | null;
  onGuardar: (item: InventarioItem, dto: ActualizarItemInventarioDto) => void;
  onContar: (item: InventarioItem, contado: number) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('otra');
  const [alerta, setAlerta] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [conteo, setConteo] = useState('');

  useEffect(() => {
    if (!item) return;
    setNombre(item.nombre);
    setCategoria(item.categoria ?? 'otra');
    setAlerta(item.alertaMinimo != null ? String(item.alertaMinimo) : '');
    setObjetivo(item.nivelObjetivo != null ? String(item.nivelObjetivo) : '');
    setConteo('');
  }, [item]);

  if (!item) return null;
  return (
    <Shell visible onCerrar={onCerrar}>
      <Text style={styles.titulo}>Configurar {item.nombre}</Text>
      <Text style={styles.subtitulo}>La alerta avisa cuándo reponer; el objetivo llena el medidor.</Text>

      <View style={styles.bloque}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput value={nombre} onChangeText={setNombre} style={styles.input} placeholderTextColor="#475569" />
      </View>
      <ChipsCategoria tipo={item.tipo} value={categoria} onChange={setCategoria} />
      <View style={[styles.fila, styles.bloque]}>
        <Campo label="Alerta ≤" value={alerta} onChange={setAlerta} placeholder="Ej: 10" />
        <Campo label="Objetivo" value={objetivo} onChange={setObjetivo} placeholder="Ej: 100" />
      </View>

      <View style={styles.botones}>
        <Button title="Cancelar" variant="secondary" onPress={onCerrar} style={styles.flex} />
        <Button
          title="Guardar"
          variant="primary"
          disabled={!nombre.trim()}
          onPress={() =>
            onGuardar(item, { nombre: nombre.trim(), categoria, alertaMinimo: numOrNull(alerta), nivelObjetivo: numOrNull(objetivo) })
          }
          style={styles.flex}
        />
      </View>

      <View style={styles.separador} />
      <Text style={styles.label}>Conteo físico</Text>
      <Text style={styles.ayuda}>
        Escribe cuántas hay de verdad. El sistema registra la diferencia contra las {item.cantidad} que tenía anotadas.
      </Text>
      <View style={styles.fila}>
        <TextInput
          value={conteo}
          onChangeText={(v: string) => setConteo(soloDigitos(v))}
          keyboardType="numeric"
          placeholder={String(item.cantidad)}
          placeholderTextColor="#475569"
          style={[styles.input, styles.flex]}
        />
        <Button
          title="Registrar conteo"
          icon="counter"
          variant="outline"
          disabled={conteo.trim() === ''}
          onPress={() => onContar(item, Number(conteo))}
        />
      </View>

      <TouchableOpacity onPress={() => onGuardar(item, { activo: !item.activo })} style={styles.enlace}>
        <Text style={[styles.enlaceTexto, { color: item.activo ? '#F43F5E' : '#10B981' }]}>
          {item.activo ? 'Desactivar (deja de descontarse al vender)' : 'Reactivar'}
        </Text>
      </TouchableOpacity>
    </Shell>
  );
}

// ─── Lista de variantes con búsqueda (vincular bebidas / reglas) ──────────────

export function VarianteLista({
  productos,
  seleccionada,
  onElegir,
  excluir,
  filtro,
}: {
  productos: Producto[];
  seleccionada?: number | null;
  onElegir: (variante: ProductoVariante, producto: Producto) => void;
  excluir?: Set<number>;
  filtro?: (p: Producto) => boolean;
}) {
  const [q, setQ] = useState('');
  const grupos = useMemo(() => {
    const texto = q.trim().toLowerCase();
    return productos
      .filter((p) => p.activo !== false && (!filtro || filtro(p)))
      .map((p) => ({
        producto: p,
        variantes: (p.variantes ?? []).filter(
          (v) =>
            v.activo &&
            !excluir?.has(v.varianteId) &&
            (!texto || `${p.productoNombre} ${v.nombre}`.toLowerCase().includes(texto)),
        ),
      }))
      .filter((g) => g.variantes.length > 0);
  }, [productos, q, excluir, filtro]);

  return (
    <View style={styles.bloque}>
      <SearchInput value={q} onChangeText={setQ} placeholder="Buscar producto…" className="mb-2" />
      <ScrollView style={styles.listaVariantes} nestedScrollEnabled>
        {grupos.length === 0 && <Text style={styles.ayuda}>Nada que mostrar.</Text>}
        {grupos.map((g) => (
          <View key={g.producto.productoId} style={styles.grupo}>
            <Text style={styles.grupoTitulo}>{g.producto.productoNombre}</Text>
            {g.variantes.map((v) => {
              const activa = seleccionada === v.varianteId;
              return (
                <TouchableOpacity
                  key={v.varianteId}
                  onPress={() => onElegir(v, g.producto)}
                  style={[styles.opcion, activa && styles.opcionActiva]}
                >
                  <Text style={[styles.opcionTexto, activa && { color: '#F5A524' }]}>{v.nombre}</Text>
                  {activa && <Icon name="check" size={14} color="#F5A524" />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Crear ítem ───────────────────────────────────────────────────────────────

export function CrearItemModal({
  visible,
  tipoInicial,
  productos,
  variantesConBebida,
  onCrear,
  onCerrar,
}: {
  visible: boolean;
  tipoInicial: TipoItemInventario;
  productos: Producto[];
  /** Variantes que ya descuentan alguna bebida (no se ofrecen de nuevo). */
  variantesConBebida: Set<number>;
  onCrear: (dto: CrearItemInventarioDto) => void;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoItemInventario>(tipoInicial);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('otra');
  const [cantidad, setCantidad] = useState('');
  const [alerta, setAlerta] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [varianteId, setVarianteId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTipo(tipoInicial);
    setNombre('');
    setCategoria(tipoInicial === 'caja' ? 'grande' : 'gaseosa');
    setCantidad('');
    setAlerta('');
    setObjetivo('');
    setVarianteId(null);
  }, [visible, tipoInicial]);

  const cambiarTipo = (t: TipoItemInventario) => {
    setTipo(t);
    setCategoria(t === 'caja' ? 'grande' : 'gaseosa');
    setVarianteId(null);
  };

  return (
    <Shell visible={visible} onCerrar={onCerrar}>
      <Text style={styles.titulo}>Añadir al inventario</Text>
      <View style={styles.bloque}>
        <SegmentedControl
          options={[
            { value: 'caja', label: 'Caja', icon: 'package-variant-closed' },
            { value: 'bebida', label: 'Bebida', icon: 'bottle-soda' },
          ]}
          value={tipo}
          onChange={cambiarTipo}
        />
      </View>

      {tipo === 'bebida' && (
        <>
          <Text style={styles.label}>¿Qué producto la descuenta al venderse?</Text>
          <Text style={styles.ayuda}>Cada venta de esa variante resta 1. Puedes dejarlo vacío y agregar reglas después.</Text>
          <VarianteLista
            productos={productos}
            seleccionada={varianteId}
            excluir={variantesConBebida}
            filtro={(p) => p.categoria === 'bebida' || p.categoria == null || p.categoria === 'otro'}
            onElegir={(v, p) => {
              setVarianteId(v.varianteId === varianteId ? null : v.varianteId);
              if (!nombre.trim()) setNombre(`${p.productoNombre} ${v.nombre}`.trim());
            }}
          />
        </>
      )}

      <View style={styles.bloque}>
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          value={nombre}
          onChangeText={setNombre}
          placeholder={tipo === 'caja' ? 'Caja Pizza Grande' : 'Coca-Cola 400 ml'}
          placeholderTextColor="#475569"
          style={styles.input}
        />
      </View>
      <ChipsCategoria tipo={tipo} value={categoria} onChange={setCategoria} />
      <View style={[styles.fila, styles.bloque]}>
        <Campo label="Stock inicial" value={cantidad} onChange={setCantidad} placeholder="0" />
        <Campo label="Alerta ≤" value={alerta} onChange={setAlerta} placeholder="10" />
        <Campo label="Objetivo" value={objetivo} onChange={setObjetivo} placeholder="100" />
      </View>

      <View style={styles.botones}>
        <Button title="Cancelar" variant="secondary" onPress={onCerrar} style={styles.flex} />
        <Button
          title="Crear"
          variant="primary"
          disabled={!nombre.trim()}
          onPress={() =>
            onCrear({
              tipo,
              nombre: nombre.trim(),
              categoria,
              cantidad: Number(cantidad) || 0,
              ...(numOrNull(alerta) != null ? { alertaMinimo: numOrNull(alerta)! } : {}),
              ...(numOrNull(objetivo) != null ? { nivelObjetivo: numOrNull(objetivo)! } : {}),
              ...(tipo === 'bebida' && varianteId != null ? { varianteId } : {}),
            })
          }
          style={styles.flex}
        />
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  caja: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)', padding: 0 },
  scroll: { flexGrow: 0 },
  scrollContenido: { padding: 20 },
  titulo: { color: 'white', fontSize: 18, fontFamily: 'SpaceGrotesk-Bold', marginBottom: 4 },
  subtitulo: { color: '#64748B', fontSize: 12, marginBottom: 16 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  ayuda: { color: '#64748B', fontSize: 11, marginBottom: 8 },
  bloque: { marginBottom: 16 },
  fila: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  flex: { flex: 1 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: 'white',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontSize: 14,
  },
  botones: { flexDirection: 'row', gap: 10, marginTop: 4 },
  separador: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 18 },
  enlace: { marginTop: 18, alignItems: 'center', paddingVertical: 8 },
  enlaceTexto: { fontSize: 12, fontWeight: '800' },
  listaVariantes: { maxHeight: 220 },
  grupo: { marginBottom: 8 },
  grupoTitulo: { color: '#64748B', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 4,
  },
  opcionActiva: { backgroundColor: 'rgba(245,165,36,0.12)' },
  opcionTexto: { color: '#E2E8F0', fontSize: 13, fontWeight: '700' },
});
