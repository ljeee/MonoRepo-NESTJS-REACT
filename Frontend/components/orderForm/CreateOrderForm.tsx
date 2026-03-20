import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { isAxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { ScrollView, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from '../../tw';
import { Badge } from '../ui';
import { api } from '../../services/api';
import { useOrder, useToast, useClientByPhone, defaultOrderFormState, useAntiDebounce } from '@monorepo/shared';
import type { CreateOrdenDto, Domiciliario, Producto, ProductoVariante, OrderFormState } from '@monorepo/shared';
import { useBreakpoint } from '../../styles/responsive';
import CartPanel, { CartItem } from './CartPanel';
import MenuPicker from './MenuPicker';
import { sendWhatsAppDomicilio } from '../../utils/printReceipt';

let _cartIdCounter = 0;
function nextCartId() {
  return `cart-${++_cartIdCounter}-${Date.now()}`;
}

function extractErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Error inesperado al crear la orden.';
  }

  if (!error.response) {
    return error.request
      ? 'No se recibió respuesta del servidor. Verifique la conexión.'
      : 'Error inesperado al crear la orden.';
  }

  const { status, data } = error.response;
  const responseData = data as { message?: unknown; error?: unknown } | undefined;

  let msg: string | undefined;
  if (Array.isArray(responseData?.message)) {
    msg = responseData.message
      .map((item: unknown) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object' && 'constraints' in item) {
          const constraints = (item as { constraints?: Record<string, string> }).constraints;
          if (constraints) {
            return Object.values(constraints).join(', ');
          }
        }
        return JSON.stringify(item);
      })
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' | ');
  } else {
    if (typeof responseData?.message === 'string') {
      msg = responseData.message;
    } else if (typeof responseData?.error === 'string') {
      msg = responseData.error;
    }
  }

  if (status === 400) return `Datos inválidos: ${msg || 'Verifique los datos ingresados'}`;
  if (status === 404) return 'Servicio no encontrado. Verifique que el backend esté funcionando.';
  if (status === 500) return `Error del servidor: ${msg || 'Intente nuevamente'}`;
  return `Error (${status}): ${msg || 'No se pudo crear la orden'}`;
}

interface CreateOrderFormProps {
  mode?: 'create' | 'edit';
  initialItem?: Partial<OrderFormState>;
  ordenId?: number;
}

export default function CreateOrderForm({ mode = 'create', initialItem, ordenId }: CreateOrderFormProps) {
  const router = useRouter();
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;
  const { formState: globalFormState, updateForm: globalUpdateForm, clearCart, isHydrated: globalIsHydrated } = useOrder();
  const { showToast } = useToast();

  const [localFormState, setLocalFormState] = useState<OrderFormState | null>(null);

  // Initialize local state if editing
  useEffect(() => {
    if (mode === 'edit' && initialItem) {
      setLocalFormState(prev => prev || { ...defaultOrderFormState, ...initialItem });
    }
  }, [mode, initialItem]);

  const formState = mode === 'edit' ? (localFormState || (initialItem as OrderFormState) || defaultOrderFormState) : globalFormState;
  const isHydrated = mode === 'edit' ? true : globalIsHydrated;

  const updateForm = useCallback((updates: Partial<OrderFormState>) => {
    if (mode === 'edit') {
      setLocalFormState(prev => prev ? ({ ...prev, ...updates }) : null);
    } else {
      globalUpdateForm(updates);
    }
  }, [mode, globalUpdateForm]);

  const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
  const fetchDomiciliarios = useCallback(async () => {
    try {
      const data = await api.domiciliarios.getAll();
      setDomiciliarios(data);
    } catch { /* silent */ }
  }, []);
  const [loading, setLoading] = useState(false);
  const { client, fetchClient } = useClientByPhone();
  const { debounce } = useAntiDebounce();

  // ==================== CARRITO ====================
  const addToCart = useCallback((producto: Producto, variante: ProductoVariante, sabores?: string[]) => {
    const newItem: CartItem = {
      id: nextCartId(),
      productoNombre: producto.productoNombre,
      varianteNombre: variante.nombre,
      varianteId: variante.varianteId,
      precioUnitario: Number(variante.precio),
      cantidad: 1,
      sabores: sabores,
    };

    // Pizzas with sabores always get their own line (different combos shouldn't merge)
    const existing = sabores?.length
      ? undefined
      : formState.cart.find(i => i.varianteId === variante.varianteId);

    if (existing) {
      // Merge with existing - update cart with updated item
      const updatedCart = formState.cart.map(i =>
        i.varianteId === variante.varianteId
          ? { ...i, cantidad: i.cantidad + 1 }
          : i,
      );
      updateForm({ cart: updatedCart });
    } else {
      // Add new
      updateForm({ cart: [...formState.cart, newItem] });
    }
  }, [formState.cart, updateForm]);

  const removeFromCart = useCallback((id: string) => {
    updateForm({ cart: formState.cart.filter(i => i.id !== id) });
  }, [formState.cart, updateForm]);

  const updateCartCantidad = useCallback((id: string, cantidad: number) => {
    updateForm({
      cart: formState.cart.map(i =>
        i.id === id ? { ...i, cantidad: Math.max(1, cantidad) } : i,
      ),
    });
  }, [formState.cart, updateForm]);

  // ==================== EFFECTS ====================
  const hasClienteDirecciones = !!(client?.direcciones?.length);

  // Buscar cliente solo cuando hay 10 dígitos y es domicilio
  useEffect(() => {
    if (formState.tipoPedido === 'domicilio' && formState.telefonoCliente.length === 10) {
      const timer = setTimeout(() => {
        void fetchClient(formState.telefonoCliente);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [fetchClient, formState.telefonoCliente, formState.tipoPedido]);

  // Cargar domiciliarios si es domicilio
  useEffect(() => {
    if (formState.tipoPedido === 'domicilio') {
      const timer = setTimeout(() => {
        void fetchDomiciliarios();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [fetchDomiciliarios, formState.tipoPedido]);

  const resolvedNombreCliente =
    formState.tipoPedido === 'domicilio'
      ? (formState.nombreCliente || client?.clienteNombre || '')
      : formState.nombreCliente;

  // ==================== SUBMIT ====================
  const handleSubmit = debounce(async () => {
    setLoading(true);

    // Validar tipo de pedido
    if (formState.tipoPedido === 'mesa' && (!formState.numeroMesa || !formState.numeroMesa.trim())) {
      setLoading(false);
      showToast('Debe seleccionar un número de mesa', 'error');
      return;
    }

    if (formState.tipoPedido === 'domicilio') {
      if (!resolvedNombreCliente || !resolvedNombreCliente.trim()) {
        setLoading(false);
        showToast('Debe ingresar el nombre del cliente', 'error');
        return;
      }

      const direccion = hasClienteDirecciones
        ? (formState.selectedAddress === '__nueva__' ? formState.newAddress : formState.selectedAddress)
        : formState.newAddress;

      if (!direccion || !direccion.trim()) {
        setLoading(false);
        showToast('Debe ingresar o seleccionar una dirección', 'error');
        return;
      }
    }

    if (formState.tipoPedido === 'llevar') {
      if (!resolvedNombreCliente || !resolvedNombreCliente.trim()) {
        setLoading(false);
        showToast('Debe ingresar el nombre del cliente', 'error');
        return;
      }
    }

    // Validar carrito
    if (formState.cart.length === 0) {
      setLoading(false);
      showToast('Debe agregar al menos un producto al pedido', 'error');
      return;
    }

    const payload: CreateOrdenDto = {
      tipoPedido: formState.tipoPedido || 'mesa',
      telefonoCliente: formState.telefonoCliente || undefined,
      nombreCliente: formState.tipoPedido === 'mesa' ? formState.numeroMesa : resolvedNombreCliente,
      direccionCliente: formState.tipoPedido === 'domicilio'
        ? (hasClienteDirecciones
          ? (formState.selectedAddress === '__nueva__' ? formState.newAddress : formState.selectedAddress)
          : formState.newAddress)
        : undefined,
      telefonoDomiciliario: formState.telefonoDomiciliario || undefined,
      costoDomicilio: formState.tipoPedido === 'domicilio' && formState.costoDomicilio
        ? Number(formState.costoDomicilio)
        : undefined,
      observaciones: formState.observaciones || undefined,
      productos: formState.cart.map(item => ({
        tipo: item.productoNombre,
        varianteId: item.varianteId,
        cantidad: item.cantidad,
        sabor1: item.sabores?.[0],
        sabor2: item.sabores?.[1],
        sabor3: item.sabores?.[2],
      })),
    };

    try {
      if (mode === 'edit' && ordenId) {
        await api.ordenes.update(ordenId, payload as any);
      } else {
        await api.ordenes.create(payload);
      }
    } catch (error: unknown) {
      showToast(extractErrorMessage(error), 'error', 5000);
      setLoading(false);
      return;
    }

    if (formState.tipoPedido === 'domicilio' && formState.telefonoDomiciliario) {
      const costoDom = formState.costoDomicilio ? Number(formState.costoDomicilio) : 0;
      const total = formState.cart.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0) + costoDom;
      const receiptProducts = formState.cart.map(i => ({
        nombre: `${i.productoNombre}${i.varianteNombre ? ' - ' + i.varianteNombre : ''}${i.sabores?.length ? ' (' + i.sabores.join(', ') + ')' : ''}`,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
      }));
      const direccion = hasClienteDirecciones
        ? (formState.selectedAddress === '__nueva__' ? formState.newAddress : formState.selectedAddress)
        : formState.newAddress;
      sendWhatsAppDomicilio(formState.telefonoDomiciliario, {
        clienteNombre: resolvedNombreCliente,
        direccion: direccion || '',
        telefonoCliente: formState.telefonoCliente || undefined,
        productos: receiptProducts,
        total,
        costoDomicilio: costoDom || undefined,
        metodo: 'Pendiente',
      });
    }

    clearCart();
    updateForm({
      numeroMesa: '',
      nombreCliente: '',
      selectedAddress: '',
      newAddress: '',
      telefonoCliente: '',
      telefonoDomiciliario: '',
      costoDomicilio: '',
      observaciones: '',
    });

    showToast(mode === 'edit' ? '¡Orden actualizada!' : '¡Orden creada exitosamente!', 'success', 2000);
    setTimeout(() => {
      router.push(mode === 'edit' ? (`/orden-detalle?ordenId=${ordenId}` as any) : '/ordenes');
    }, 2000);
    setLoading(false);
  });

  // ==================== RENDER ====================
  // Wait for AsyncStorage to hydrate before rendering
  if (!isHydrated) {
    return (
      <View className="flex-1 bg-(--color-pos-bg)">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#F5A524" />
          <Text className="text-white mt-4 font-medium">Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-(--color-pos-bg)"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerClassName="pt-2 px-5 pb-32 w-full self-stretch"
      >
        <View className={`bg-(--color-pos-surface) rounded-2xl p-4 border border-white/5 shadow-xl ${isCompact ? 'p-3' : ''}`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className={`text-2xl font-black text-white tracking-tighter ${isCompact ? 'text-xl' : ''}`} style={{ fontFamily: 'Space Grotesk' }}>
              {mode === 'edit' ? 'Editar Orden' : 'Nueva Orden'}
            </Text>
            {isCompact && (
               <Badge label={formState.tipoPedido} variant="info" size="sm" />
            )}
          </View>

          <View className="flex-row flex-wrap -mx-1">
            {/* TIPO DE PEDIDO */}
            <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/4'}`}>
              <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Tipo</Text>
              <View className="bg-black/20 rounded-lg border border-white/5 min-h-[48px] justify-center overflow-hidden">
                <Picker
                  selectedValue={formState.tipoPedido}
                  enabled={mode === 'create'}
                  onValueChange={(val) => {
                    const tipoPedido = val as 'mesa' | 'domicilio' | 'llevar';
                    updateForm({ 
                        tipoPedido,
                        selectedAddress: '',
                        newAddress: '',
                        telefonoCliente: '',
                        telefonoDomiciliario: '',
                        costoDomicilio: '',
                    });
                  }}
                  style={{ color: 'white' }}
                  itemStyle={{ color: 'white', fontSize: 14 }}
                  dropdownIconColor="#94A3B8"
                >
                  <Picker.Item label="Domicilio" value="domicilio" />
                  <Picker.Item label="Llevar" value="llevar" />
                  <Picker.Item label="Mesa" value="mesa" />
                </Picker>
              </View>
            </View>

            {/* TELEFONO (Solo Domicilio) */}
            {formState.tipoPedido === 'domicilio' && (
              <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/4'}`}>
                <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Teléfono</Text>
                <TextInput
                  className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                  value={formState.telefonoCliente}
                  onChangeText={(val) => updateForm({ telefonoCliente: val.replace(/\s/g, '') })}
                  placeholder="321..."
                  placeholderTextColor="#475569"
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* NOMBRE / MESA */}
            <View className={`px-1 mb-3 ${isCompact ? 'w-full' : (formState.tipoPedido === 'domicilio' ? 'w-2/4' : 'w-3/4')}`}>
              <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">{formState.tipoPedido === 'mesa' ? 'Mesa' : 'Cliente'}</Text>
              {formState.tipoPedido === 'mesa' ? (
                <View className="bg-black/20 rounded-lg border border-white/5 min-h-[48px] justify-center overflow-hidden">
                  <Picker
                    selectedValue={formState.numeroMesa}
                    onValueChange={(val) => {
                      updateForm({ numeroMesa: val, nombreCliente: val });
                    }}
                    style={{ color: 'white' }}
                    itemStyle={{ color: 'white', fontSize: 14 }}
                    dropdownIconColor="#94A3B8"
                  >
                    <Picker.Item label="Seleccione mesa" value="" color="#64748B" />
                    {[...Array(15)].map((_, i) => <Picker.Item key={`mesaPicker-${i + 1}`} label={`Mesa ${i + 1}`} value={`${i + 1}`} />)}
                  </Picker>
                </View>
              ) : (
                <TextInput
                  className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                  value={resolvedNombreCliente}
                  onChangeText={(val) => updateForm({ nombreCliente: val })}
                  placeholder="Nombre"
                  placeholderTextColor="#475569"
                  editable={!client || !client.clienteNombre}
                />
              )}
            </View>
          </View>

          {/* DIRECCION Y DOMICILIARIO (Solo Domicilio) */}
          {formState.tipoPedido === 'domicilio' && (
            <View className="flex-row flex-wrap -mx-1">
              <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/2'}`}>
                <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Dirección</Text>
                {hasClienteDirecciones ? (
                  <View className="flex-col gap-1">
                    <View className="bg-black/20 rounded-lg border border-white/5 min-h-[48px] justify-center overflow-hidden">
                      <Picker
                        selectedValue={formState.selectedAddress}
                        onValueChange={(val) => updateForm({ selectedAddress: val })}
                        style={{ color: 'white' }}
                        itemStyle={{ color: 'white', fontSize: 14 }}
                        dropdownIconColor="#94A3B8"
                      >
                        <Picker.Item label="Seleccionar Dirección" value="" color="#64748B" />
                        {(client?.direcciones || [])
                          .map((dir) => <Picker.Item key={dir.id} label={dir.direccion} value={dir.direccion} />)}
                        <Picker.Item label="+ Nueva dirección..." value="__nueva__" />
                      </Picker>
                    </View>
                    {formState.selectedAddress === '__nueva__' && (
                      <TextInput
                        className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                        value={formState.newAddress}
                        onChangeText={(val) => updateForm({ newAddress: val })}
                        placeholder="Calle..."
                        placeholderTextColor="#475569"
                      />
                    )}
                  </View>
                ) : (
                  <TextInput
                    className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                    value={formState.newAddress}
                    onChangeText={(val) => updateForm({ newAddress: val })}
                    placeholder="Calle..."
                    placeholderTextColor="#475569"
                  />
                )}
              </View>

              <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/4'}`}>
                <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Domiciliario</Text>
                <View className="bg-black/20 rounded-lg border border-white/5 min-h-[48px] justify-center overflow-hidden">
                  <Picker
                    selectedValue={formState.telefonoDomiciliario}
                    onValueChange={(val) => updateForm({ telefonoDomiciliario: val })}
                    style={{ color: 'white' }}
                    itemStyle={{ color: 'white', fontSize: 14 }}
                    dropdownIconColor="#94A3B8"
                  >
                    <Picker.Item label="Driver" value="" color="#64748B" />
                    {domiciliarios.map(d => (
                      <Picker.Item 
                        key={d.telefono} 
                        label={d.domiciliarioNombre || d.telefono.toString()} 
                        value={d.telefono.toString()} 
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/4'}`}>
                <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Costo</Text>
                <TextInput
                  className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                  value={formState.costoDomicilio ? Number(formState.costoDomicilio).toLocaleString('es-CO') : ''}
                  onChangeText={(val) => {
                    const numericValue = val.replace(/\D/g, '');
                    updateForm({ costoDomicilio: numericValue });
                  }}
                  placeholder="2,000"
                  placeholderTextColor="#475569"
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* =============== PRODUCTOS (MENÚ) =============== */}
          <View className="flex-row items-center mt-2 mb-3">
             <View className="h-[1px] flex-1 bg-white/5" />
             <Text className="text-[10px] font-black text-(--color-pos-primary) px-3 uppercase tracking-[3px]">Menú</Text>
             <View className="h-[1px] flex-1 bg-white/5" />
          </View>
          <MenuPicker onAdd={addToCart} />

          {/* =============== CARRITO / BALANCE =============== */}
          <CartPanel
            items={formState.cart}
            onRemove={removeFromCart}
            onUpdateCantidad={updateCartCantidad}
            costoDomicilio={formState.tipoPedido === 'domicilio' && formState.costoDomicilio ? Number(formState.costoDomicilio) : 0}
          />

          {/* =============== OBSERVACIONES =============== */}
          <View className="mt-4 mb-2">
            <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Observaciones</Text>
            <TextInput
            className="bg-black/10 rounded-lg border border-white/5 px-3 py-2 text-sm text-slate-300 h-16"
            style={{ textAlignVertical: 'top' }}
            value={formState.observaciones}
            onChangeText={(val) => updateForm({ observaciones: val })}
            placeholder="Algún detalle adicional..."
            placeholderTextColor="#475569"
            multiline
            numberOfLines={2}
            />
          </View>

          {/* =============== ACCIONES =============== */}
          <TouchableOpacity
            className={`bg-(--color-pos-primary) py-4 rounded-xl items-center mt-4 w-full shadow-lg shadow-amber-500/20 active:scale-[0.95] transition-transform ${loading ? 'opacity-60' : ''}`}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text className="text-white font-black text-lg tracking-[1px] uppercase">
              {loading ? (mode === 'edit' ? 'Guardando...' : 'Creando...') : (mode === 'edit' ? 'Actualizar Orden' : 'Confirmar Pedido')}
            </Text>
          </TouchableOpacity>

        </View>
        {/* Extra bottom space for system nav bar on mobile */}
        {isMobile && <View className="h-8" />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
