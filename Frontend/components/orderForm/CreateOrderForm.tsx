import { useRouter } from 'expo-router';
import { isAxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';
import { ScrollView, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView } from '../../tw';
import { Badge, Picker, PickerItem } from '../ui';
import { api } from '../../services/api';
import { useOrder, useToast, useClientByPhone, defaultOrderFormState, useAntiDebounce } from '@/src/shared';
import type { CreateOrdenDto, Domiciliario, Producto, ProductoVariante, OrderFormState, Cliente, ClienteDireccion } from '@/src/shared';
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
  const { formState: globalFormState, updateForm: globalUpdateForm, clearCart, isHydrated: globalIsHydrated, activeSlot, setActiveSlot, slotSummaries } = useOrder();
  const { showToast } = useToast();

  const pendingTimers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  React.useEffect(() => {
    return () => {
      pendingTimers.current.forEach((t) => clearTimeout(t));
      pendingTimers.current = [];
    };
  }, []);

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
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<Cliente[]>([]);
  const [addressSuggestions, setAddressSuggestions] = useState<ClienteDireccion[]>([]);

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
  const addToCart = useCallback((producto: Producto, variante: ProductoVariante, sabores?: string[], base?: 'leche' | 'agua') => {
    // Use base-aware price: leche siempre suma $1.000 fijo
    const RECARGO_LECHE = 1000;
    const precioUnitario = base === 'leche'
      ? Number(variante.precio) + RECARGO_LECHE
      : Number(variante.precio);

    const newItem: CartItem = {
      id: nextCartId(),
      productoNombre: producto.productoNombre,
      varianteNombre: variante.nombre,
      varianteId: variante.varianteId,
      precioUnitario,
      cantidad: 1,
      sabores: sabores,
      base,
    };

    // Pizzas with sabores, or items with a base, always get their own line (never merge)
    const existing = (sabores?.length || base)
      ? undefined
      : formState.cart.find(i => i.varianteId === variante.varianteId && !i.base && !i.sabores?.length);

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

  // Cargar lista de clientes para autocompletar en llevar
  useEffect(() => {
    if (formState.tipoPedido === 'llevar') {
      api.clientes.getAll().then(setClientesList).catch(() => {});
    } else {
      setNameSuggestions([]);
    }
  }, [formState.tipoPedido]);

  // Filtrar sugerencias mientras se escribe el nombre (solo llevar)
  useEffect(() => {
    if (formState.tipoPedido !== 'llevar' || formState.nombreCliente.length < 2) {
      setNameSuggestions([]);
      return;
    }
    const q = formState.nombreCliente.toLowerCase();
    setNameSuggestions(
      clientesList.filter(c => c.clienteNombre?.toLowerCase().includes(q)).slice(0, 6)
    );
  }, [formState.nombreCliente, formState.tipoPedido, clientesList]);

  // Limpiar sugerencias de dirección cuando no aplican
  useEffect(() => {
    if (formState.tipoPedido !== 'domicilio') {
      setAddressSuggestions([]);
    }
  }, [formState.tipoPedido]);

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

      const direccion = formState.newAddress;

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
      direccionCliente: formState.tipoPedido === 'domicilio' ? formState.newAddress : undefined,
      referenciaDomicilio: formState.tipoPedido === 'domicilio' && formState.referenciaDomicilio ? formState.referenciaDomicilio : undefined,
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
        base: item.base,
      })),
    };

    try {
      if (mode === 'edit' && ordenId) {
        await api.ordenes.update(ordenId, payload as any);
      } else {
        await api.ordenes.create(payload);
        // Persistir nombre editado en el registro del cliente si fue modificado
        if (
          formState.telefonoCliente &&
          client &&
          resolvedNombreCliente &&
          resolvedNombreCliente !== client.clienteNombre
        ) {
          try {
            await api.clientes.update(formState.telefonoCliente, { clienteNombre: resolvedNombreCliente });
          } catch {
            // No crítico — no romper el flujo si falla
          }
        }
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
        nombre: `${i.productoNombre}${i.varianteNombre ? ' - ' + i.varianteNombre : ''}${i.base ? ` (${i.base})` : ''}${i.sabores?.length ? ' (' + i.sabores.join(', ') + ')' : ''}`,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
      }));
      const direccion = formState.newAddress;
      sendWhatsAppDomicilio(formState.telefonoDomiciliario, {
        clienteNombre: resolvedNombreCliente,
        direccion: direccion || '',
        referencia: formState.referenciaDomicilio || undefined,
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
      referenciaDomicilio: '',
      telefonoCliente: '',
      telefonoDomiciliario: '',
      costoDomicilio: '',
      observaciones: '',
    });

    showToast(mode === 'edit' ? '¡Orden actualizada!' : '¡Orden creada exitosamente!', 'success', 2000);
    const navTimer = setTimeout(() => {
      router.push(mode === 'edit' ? (`/orden-detalle?ordenId=${ordenId}` as any) : '/balance-dia');
    }, 2000);
    pendingTimers.current.push(navTimer);
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
        contentContainerClassName="pt-2 px-5 pb-32 max-w-7xl mx-auto w-full"
      >
        {/* ── Slot tabs — solo en modo creación ── */}
        {mode !== 'edit' && (
          <View className="flex-row gap-2 mb-4">
            {slotSummaries.map((s) => {
              const isActive = s.slot === activeSlot;
              return (
                <TouchableOpacity
                  key={s.slot}
                  onPress={() => setActiveSlot(s.slot)}
                  className={`flex-1 py-2 px-2 rounded-xl border flex-col items-center justify-center gap-0.5 md:flex-row md:gap-1.5 md:py-2.5 md:px-3 ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-500/40'
                      : 'bg-white/[0.03] border-white/10 active:bg-white/10'
                  }`}
                >
                  <View className={`w-4 h-4 rounded-full items-center justify-center ${isActive ? 'bg-amber-500' : 'bg-white/10'}`}>
                    <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 8, color: isActive ? '#000' : '#64748B' }}>
                      {s.slot + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                    {s.isEmpty ? (
                      <Text style={{ fontFamily: 'Outfit', color: '#334155', fontSize: 10, textTransform: 'uppercase' }} numberOfLines={1}>
                        Vacía
                      </Text>
                    ) : s.nombreCliente ? (
                      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: isActive ? '#F5A524' : '#94A3B8', fontSize: 10 }} numberOfLines={1}>
                        {s.nombreCliente}
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: 'Outfit', color: isActive ? '#F5A524' : '#64748B', fontSize: 10, textTransform: 'uppercase' }} numberOfLines={1}>
                        {s.tipoPedido}
                      </Text>
                    )}
                    {s.itemCount > 0 && (
                      <Text style={{ fontFamily: 'Outfit', color: isActive ? '#F59E0B' : '#475569', fontSize: 9 }}>
                        {s.itemCount} ítem{s.itemCount !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View className="flex-row flex-wrap -mx-3 items-start">
          {/* LEFT COLUMN: Header & Menu */}
          <View className={`px-3 ${isMobile ? 'w-full' : isTablet ? 'w-[60%]' : 'w-[65%]'}`}>
            <View className={`bg-(--color-pos-surface) rounded-2xl p-4 border border-white/5 shadow-xl mb-6 ${isCompact ? 'p-3' : ''}`}>
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
                            referenciaDomicilio: '',
                            telefonoCliente: '',
                            telefonoDomiciliario: '',
                            costoDomicilio: '',
                        });
                      }}
                      style={{ color: 'white', fontSize: 14 }}
                      itemStyle={{ color: 'white', fontSize: 14 }}
                      dropdownIconColor="#94A3B8"
                    >
                      <PickerItem label="Domicilio" value="domicilio" />
                      <PickerItem label="Llevar" value="llevar" />
                      <PickerItem label="Mesa" value="mesa" />
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
                        <PickerItem label="Seleccione mesa" value="" color="#64748B" />
                        {[...Array(15)].map((_, i) => <PickerItem key={`mesaPicker-${i + 1}`} label={`Mesa ${i + 1}`} value={`${i + 1}`} />)}
                      </Picker>
                    </View>
                  ) : (
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                        value={resolvedNombreCliente}
                        onChangeText={(val) => updateForm({ nombreCliente: val })}
                        placeholder="Nombre"
                        placeholderTextColor="#475569"
                        editable={true}
                        onBlur={() => {
                          const t = setTimeout(() => setNameSuggestions([]), 150);
                          pendingTimers.current.push(t);
                        }}
                      />
                      {formState.tipoPedido === 'llevar' && nameSuggestions.length > 0 && (
                        <View style={{
                          position: 'absolute', top: 50, left: 0, right: 0, zIndex: 9999,
                          backgroundColor: '#1E293B', borderRadius: 12,
                          borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
                          overflow: 'hidden', elevation: 10,
                        }}>
                          {nameSuggestions.map((c) => (
                            <TouchableOpacity
                              key={c.telefono}
                              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', alignItems: 'center', gap: 10 }}
                              onPress={() => {
                                updateForm({ nombreCliente: c.clienteNombre || '' });
                                setNameSuggestions([]);
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#F8FAFC', fontWeight: 'bold', fontSize: 13 }}>{c.clienteNombre}</Text>
                                <Text style={{ color: '#64748B', fontSize: 11 }}>{c.telefono}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* DIRECCION Y DOMICILIARIO (Solo Domicilio) */}
              {formState.tipoPedido === 'domicilio' && (
                <View className="flex-row flex-wrap -mx-1">
                  <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/2'}`}>
                    <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Dirección</Text>

                    {/* Picker de guardadas — solo si el cliente tiene historial */}
                    {(client?.direcciones?.length ?? 0) > 0 && (
                      <View className="bg-black/20 rounded-lg border border-white/5 min-h-[44px] justify-center overflow-hidden mb-2">
                        <Picker
                          selectedValue={
                            // Si el usuario editó manualmente (newAddress difiere del selectedAddress),
                            // mostrar placeholder para no confundir. Solo muestra la selección intacta.
                            formState.selectedAddress && formState.selectedAddress !== '__nueva__' && formState.newAddress === formState.selectedAddress
                              ? formState.selectedAddress
                              : formState.selectedAddress === '__nueva__' ? '__nueva__' : ''
                          }
                          onValueChange={(val) => {
                            const selected = val as string;
                            updateForm({
                              selectedAddress: selected,
                              // Carga la dirección en el TextInput; vacía si eligió "Nueva"
                              newAddress: selected === '__nueva__' || !selected ? '' : selected,
                            });
                          }}
                          style={{ color: 'white' }}
                          itemStyle={{ color: 'white', fontSize: 13 }}
                          dropdownIconColor="#94A3B8"
                        >
                          <PickerItem label="Elegir dirección guardada..." value="" color="#64748B" />
                          {(client?.direcciones ?? []).map((dir) => (
                            <PickerItem key={dir.id} label={dir.direccion} value={dir.direccion} />
                          ))}
                          <PickerItem label="+ Nueva dirección" value="__nueva__" color="#F5A524" />
                        </Picker>
                      </View>
                    )}

                    {/* TextInput siempre editable — para ajustar o ingresar dirección */}
                    <TextInput
                      className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                      value={formState.newAddress}
                      onChangeText={(val) => {
                        // Solo actualiza newAddress — NO tocar selectedAddress para evitar
                        // el loop reactivo: Picker.onChange → newAddress = '' → usuario pierde lo que escribe
                        updateForm({ newAddress: val });
                      }}
                      placeholder={(client?.direcciones?.length ?? 0) > 0 ? 'O escribe / edita la dirección...' : 'Calle...'}
                      placeholderTextColor="#475569"
                    />
                  </View>

                  <View className={`px-1 mb-3 ${isCompact ? 'w-full' : 'w-1/2'}`}>
                    <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">Referencia (Opcional)</Text>
                    <TextInput
                      className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
                      value={formState.referenciaDomicilio}
                      onChangeText={(val) => updateForm({ referenciaDomicilio: val })}
                      placeholder="Ej. Casa verde dos pisos"
                      placeholderTextColor="#475569"
                    />
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
                        <PickerItem label={domiciliarios.length === 0 ? "No hay domiciliarios" : "Sin asignar"} value="" color="#64748B" />
                        {domiciliarios.map(d => (
                          <PickerItem 
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
            </View>

            {/* =============== PRODUCTOS (MENÚ) =============== */}
            <View className="bg-(--color-pos-surface) rounded-2xl p-4 border border-white/5 shadow-xl mb-6">
              <View className="flex-row items-center mt-2 mb-3">
                 <View className="h-[1px] flex-1 bg-white/5" />
                 <Text className="text-[10px] font-black text-(--color-pos-primary) px-3 uppercase tracking-[3px]">Menú</Text>
                 <View className="h-[1px] flex-1 bg-white/5" />
              </View>
              <MenuPicker onAdd={addToCart} />
            </View>
          </View>

          {/* RIGHT COLUMN: Cart & Observations */}
          <View
            className={`px-3 self-start ${isMobile ? 'w-full' : isTablet ? 'w-[40%]' : 'w-[32%] ml-[3%]'}`}
            style={Platform.OS === 'web' && !isMobile ? ({ position: 'sticky', top: 20 } as any) : undefined}
          >
            <View className="bg-(--color-pos-surface) rounded-2xl p-4 border border-white/5 shadow-xl">
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
                className={`bg-(--color-pos-primary) py-4 rounded-xl items-center mt-4 w-full ${loading ? 'opacity-60' : ''}`}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text className="text-white font-black text-lg tracking-[1px] uppercase">
                  {loading ? (mode === 'edit' ? 'Guardando...' : 'Creando...') : (mode === 'edit' ? 'Actualizar Orden' : 'Confirmar Pedido')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Extra bottom space for system nav bar on mobile */}
        {isMobile && <View className="h-8" />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
