import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../../services/api';
import { useOrder } from '../../contexts/OrderContext';
import { useToast } from '../../contexts/ToastContext';

import { useClientByPhone } from '../../hooks/use-client-by-phone';
import { Domiciliario } from '../../types/models';
import { Producto, ProductoVariante } from '../../hooks/use-productos';
import { useBreakpoint } from '../../styles/responsive';
import { colors } from '../../styles/theme';
import { orderFormStyles as styles } from '../../styles/ordenes/CreateOrderForm.styles';
import CartPanel, { CartItem } from './CartPanel';
import MenuPicker from './MenuPicker';
import { sendWhatsAppDomicilio } from '../../utils/printReceipt';

let _cartIdCounter = 0;
function nextCartId() {
  return `cart-${++_cartIdCounter}-${Date.now()}`;
}

function extractErrorMessage(err: any): string {
  if (!err?.response) {
    return err?.request
      ? 'No se recibió respuesta del servidor. Verifique la conexión.'
      : 'Error inesperado al crear la orden.';
  }
  const { status, data = {} } = err.response;
  let msg: string | undefined;
  if (Array.isArray(data.message)) {
    msg = data.message
      .map((m: any) =>
        typeof m === 'string' ? m : m.constraints ? Object.values(m.constraints).join(', ') : JSON.stringify(m),
      )
      .join(' | ');
  } else {
    msg = data.message ?? data.error;
  }
  if (status === 400) return `Datos inválidos: ${msg || 'Verifique los datos ingresados'}`;
  if (status === 404) return 'Servicio no encontrado. Verifique que el backend esté funcionando.';
  if (status === 500) return `Error del servidor: ${msg || 'Intente nuevamente'}`;
  return `Error (${status}): ${msg || 'No se pudo crear la orden'}`;
}

export default function CreateOrderForm() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const { formState, updateForm, clearCart, isHydrated } = useOrder();
  const { showToast } = useToast();

  const [domiciliarios, setDomiciliarios] = useState<Domiciliario[]>([]);
  const fetchDomiciliarios = useCallback(async () => {
    try {
      const data = await api.domiciliarios.getAll();
      setDomiciliarios(data);
    } catch { /* silent */ }
  }, []);
  const [loading, setLoading] = useState(false);
  const { client, fetchClient } = useClientByPhone();

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
  const hasClienteDirecciones = !!(client && [client.direccion, client.direccionDos, client.direccionTres].filter(Boolean).length);

  // Buscar cliente solo cuando hay 10 dígitos y es domicilio
  useEffect(() => {
    if (formState.tipoPedido === 'domicilio' && formState.telefonoCliente.length === 10) {
      fetchClient(formState.telefonoCliente);
    }
  }, [fetchClient, formState.telefonoCliente, formState.tipoPedido]);

  // Cargar domiciliarios si es domicilio
  useEffect(() => {
    if (formState.tipoPedido === 'domicilio') fetchDomiciliarios();
  }, [fetchDomiciliarios, formState.tipoPedido]);

  // Autocompletar nombre si el cliente existe
  useEffect(() => {
    if (formState.tipoPedido === 'domicilio' && client?.clienteNombre) {
      updateForm({ nombreCliente: client.clienteNombre });
    }
  }, [client, formState.tipoPedido, updateForm]);

  // Limpiar direcciones al salir de domicilio
  useEffect(() => {
    if (formState.tipoPedido !== 'domicilio') {
      updateForm({
        selectedAddress: '',
        newAddress: '',
        telefonoCliente: '',
        telefonoDomiciliario: '',
        costoDomicilio: '',
      });
    }
  }, [formState.tipoPedido, updateForm]);

  // ==================== SUBMIT ====================
  const handleSubmit = async () => {
    setLoading(true);

    // Validar tipo de pedido
    if (formState.tipoPedido === 'mesa' && (!formState.numeroMesa || !formState.numeroMesa.trim())) {
      setLoading(false);
      showToast('Debe seleccionar un número de mesa', 'error');
      return;
    }

    if (formState.tipoPedido === 'domicilio') {
      if (!formState.nombreCliente || !formState.nombreCliente.trim()) {
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
      if (!formState.nombreCliente || !formState.nombreCliente.trim()) {
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

    try {
      const payload = {
        tipoPedido: formState.tipoPedido || 'mesa',
        telefonoCliente: formState.telefonoCliente || undefined,
        nombreCliente: formState.tipoPedido === 'mesa' ? formState.numeroMesa : formState.nombreCliente,
        direccionCliente: formState.tipoPedido === 'domicilio'
          ? (hasClienteDirecciones
            ? (formState.selectedAddress === '__nueva__' ? formState.newAddress : formState.selectedAddress)
            : formState.newAddress)
          : undefined,
        telefonoDomiciliario: formState.telefonoDomiciliario || undefined,
        costoDomicilio: formState.tipoPedido === 'domicilio' && formState.costoDomicilio
          ? Number(formState.costoDomicilio)
          : undefined,
        metodo: formState.metodo,
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

      const response = await api.ordenes.create(payload as any);
      const ordenId = response?.ordenId || (response as any)?.id;

      // WhatsApp al domiciliario (solo domicilio)
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
          clienteNombre: formState.nombreCliente,
          direccion: direccion || '',
          telefonoCliente: formState.telefonoCliente || undefined,
          productos: receiptProducts,
          total,
          costoDomicilio: costoDom || undefined,
          metodo: formState.metodo,
        });
      }

      // Limpiar formulario
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

      // Mostrar éxito y redirigir
      showToast('¡Orden creada exitosamente!', 'success', 2000);
      setTimeout(() => {
        router.push('/ordenes');
      }, 2000);
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error', 5000);
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER ====================
  // Wait for AsyncStorage to hydrate before rendering
  if (!isHydrated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 16 }}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[
          styles.formCard,
          isMobile && { padding: 20, borderRadius: 16 }
        ]}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Crear Orden</Text>

          <Text style={styles.sectionTitle}>Detalles del Pedido</Text>

          <View style={styles.row}>
            {/* TIPO DE PEDIDO */}
            <View style={[styles.col4, isMobile && styles.col4Mobile]}>
              <Text style={styles.label}>Tipo de pedido</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formState.tipoPedido}
                  onValueChange={(val) => updateForm({ tipoPedido: val as any })}
                  style={styles.picker}
                  itemStyle={{ color: colors.text, fontSize: 16 }}
                  dropdownIconColor={colors.text}
                >
                  <Picker.Item label="Domicilio" value="domicilio" />
                  <Picker.Item label="Llevar" value="llevar" />
                  <Picker.Item label="Mesa" value="mesa" />
                </Picker>
              </View>
            </View>

            {/* METODO DE PAGO */}
            <View style={[styles.col4, isMobile && styles.col4Mobile]}>
              <Text style={styles.label}>Método de pago</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formState.metodo}
                  onValueChange={(val) => updateForm({ metodo: val })}
                  style={styles.picker}
                  itemStyle={{ color: colors.text, fontSize: 16 }}
                  dropdownIconColor={colors.text}
                >
                  <Picker.Item label="Efectivo" value="efectivo" />
                  <Picker.Item label="QR" value="qr" />
                </Picker>
              </View>
            </View>

            {/* TELEFONO (Solo Domicilio) */}
            {formState.tipoPedido === 'domicilio' && (
              <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                <Text style={styles.label}>Teléfono Cliente</Text>
                <TextInput
                  style={styles.input}
                  value={formState.telefonoCliente}
                  onChangeText={(val) => updateForm({ telefonoCliente: val })}
                  placeholder=""
                  placeholderTextColor={colors.subText}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* NOMBRE / MESA */}
            <View style={[styles.col4, isMobile && styles.col4Mobile]}>
              <Text style={styles.label}>Nombre / Mesa</Text>
              {formState.tipoPedido === 'mesa' ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formState.numeroMesa}
                    onValueChange={(val) => {
                      updateForm({ numeroMesa: val, nombreCliente: val });
                    }}
                    style={styles.picker}
                    itemStyle={{ color: colors.text, fontSize: 16 }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Seleccione mesa" value="" color={colors.subText} />
                    {[...Array(10)].map((_, i) => <Picker.Item key={i + 1} label={`Mesa ${i + 1}`} value={`${i + 1}`} />)}
                  </Picker>
                </View>
              ) : formState.tipoPedido === 'domicilio' ? (
                <TextInput
                  style={styles.input}
                  value={formState.nombreCliente}
                  onChangeText={(val) => updateForm({ nombreCliente: val })}
                  placeholder=""
                  placeholderTextColor={colors.subText}
                  editable={!client || !client.clienteNombre}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={formState.nombreCliente}
                  onChangeText={(val) => updateForm({ nombreCliente: val })}
                  placeholder=""
                  placeholderTextColor={colors.subText}
                />
              )}
            </View>
          </View>

          {/* DIRECCION Y DOMICILIARIO (Solo Domicilio) */}
          {formState.tipoPedido === 'domicilio' && (
            <View style={styles.row}>
              <View style={[styles.col6, isMobile && styles.col6Mobile]}>
                <Text style={styles.label}>Dirección Cliente</Text>
                {hasClienteDirecciones ? (
                  <>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={formState.selectedAddress}
                        onValueChange={(val) => updateForm({ selectedAddress: val })}
                        style={styles.picker}
                        itemStyle={{ color: colors.text, fontSize: 16 }}
                        dropdownIconColor={colors.text}
                      >
                        <Picker.Item label="Seleccione dirección" value="" color={colors.subText} />
                        {[client!.direccion, client!.direccionDos, client!.direccionTres]
                          .filter(Boolean)
                          .map((dir, idx) => <Picker.Item key={idx} label={dir!} value={dir!} />)}
                        <Picker.Item label="Nueva dirección..." value="__nueva__" />
                      </Picker>
                    </View>
                    {formState.selectedAddress === '__nueva__' && (
                      <TextInput
                        style={styles.input}
                        value={formState.newAddress}
                        onChangeText={(val) => updateForm({ newAddress: val })}
                        placeholder=""
                        placeholderTextColor={colors.subText}
                      />
                    )}
                  </>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={formState.newAddress}
                    onChangeText={(val) => updateForm({ newAddress: val })}
                    placeholder=""
                    placeholderTextColor={colors.subText}
                  />
                )}
              </View>

              <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                <Text style={styles.label}>Domiciliario</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formState.telefonoDomiciliario}
                    onValueChange={(val) => updateForm({ telefonoDomiciliario: val })}
                    style={styles.picker}
                    itemStyle={{ color: colors.text, fontSize: 16 }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Seleccione domiciliario" value="" color={colors.subText} />
                    {domiciliarios.map(d => <Picker.Item key={d.telefono} label={d.domiciliarioNombre ? d.domiciliarioNombre : `Sin nombre (${d.telefono})`} value={d.telefono.toString()} />)}
                  </Picker>
                </View>
              </View>

              <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                <Text style={styles.label}>Costo Domicilio</Text>
                <TextInput
                  style={styles.input}
                  value={formState.costoDomicilio ? Number(formState.costoDomicilio).toLocaleString('es-CO') : ''}
                  onChangeText={(val) => {
                    // Remove all non-numeric characters
                    const numericValue = val.replace(/\D/g, '');
                    updateForm({ costoDomicilio: numericValue });
                  }}
                  placeholder=""
                  placeholderTextColor={colors.subText}
                  keyboardType="numeric"
                />
              </View>
            </View>
          )}

          {/* =============== PRODUCTOS (MENÚ) =============== */}
          <Text style={styles.sectionTitle}>Productos</Text>
          <MenuPicker onAdd={addToCart} />

          {/* =============== CARRITO / BALANCE =============== */}
          <CartPanel
            items={formState.cart}
            onRemove={removeFromCart}
            onUpdateCantidad={updateCartCantidad}
            costoDomicilio={formState.tipoPedido === 'domicilio' && formState.costoDomicilio ? Number(formState.costoDomicilio) : 0}
          />

          {/* =============== OBSERVACIONES =============== */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Observaciones</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                value={formState.observaciones}
                onChangeText={(val) => updateForm({ observaciones: val })}
                placeholder=""
                placeholderTextColor={colors.subText}
                multiline
                numberOfLines={5}
              />
            </View>
          </View>

          {/* =============== ACCIONES =============== */}
          <TouchableOpacity
            style={[styles.createOrderBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.createOrderBtnText}>{loading ? 'Creando...' : 'Crear Orden'}</Text>
          </TouchableOpacity>

        </View>
        {/* Extra bottom space for system nav bar on mobile */}
        {isMobile && <View style={{ height: Platform.OS === 'android' ? 32 : 0 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}
