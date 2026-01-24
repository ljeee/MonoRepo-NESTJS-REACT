import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../constants/api';

import { useClientByPhone } from '../../hooks/use-client-by-phone';
import { useDomiciliariosList } from '../../hooks/use-domiciliarios-list';
import { useBreakpoint } from '../../styles/responsive';
import { colors } from '../../styles/theme';
import { orderFormStyles as styles } from '../../styles/CreateOrderForm.styles';
import ProductForm from './ProductForm';

const calzoneSabores = ['D\u2019Firu Pollo', 'D\u2019Firu Carne', 'Hawaiano', 'Ranchero', 'Pollo y champi\u00f1ones', 'Arequipe y queso', 'Paisa', 'Mexicano', 'Carnes'];
const pizzaSabores = ['Carnes', 'Rachera', 'Paisa', 'Hawaiana', 'De la casa', 'D\u2019Firu Pollo', 'D\u2019Firu Carne', 'Vegetales', 'Mexicana', 'Bolo\u00f1esa', 'Napolitana', 'Jamon & Queso', 'La Quesuda', 'Pollo Tocineta', 'Pollo Maicitos', 'Pollo Champi\u00f1ones'];
const initialProduct = { tipo: '', tamano: '', sabor1: '', sabor2: '', sabor3: '', cantidad: '1' };

export default function CreateOrderForm() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const [tipoPedido, setTipoPedido] = useState<'mesa' | 'domicilio' | 'llevar'>('mesa');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [numeroMesa, setNumeroMesa] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [telefonoDomiciliario, setTelefonoDomiciliario] = useState('');
  const { domiciliarios, fetchDomiciliarios } = useDomiciliariosList();
  const [metodo, setMetodo] = useState('efectivo');
  const [productos, setProductos] = useState([{ ...initialProduct }]);
  const [saboresVisibles, setSaboresVisibles] = useState([1]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const { client, fetchClient } = useClientByPhone();

  // Computado de direcciones del cliente
  const hasClienteDirecciones = !!(client && [client.direccion, client.direccionDos, client.direccionTres].filter(Boolean).length);

  // Buscar cliente solo cuando hay 10 dígitos y es domicilio
  useEffect(() => {
    if (tipoPedido === 'domicilio' && telefonoCliente.length === 10) fetchClient(telefonoCliente);
    // fetchClient is stable from hook, only depends on telefonoCliente and tipoPedido
  }, [fetchClient, telefonoCliente, tipoPedido]);

  // Cargar domiciliarios si es domicilio
  useEffect(() => {
    if (tipoPedido === 'domicilio') fetchDomiciliarios();
    // fetchDomiciliarios is stable from hook, only depends on tipoPedido
  }, [fetchDomiciliarios, tipoPedido]);

  // Autocompletar nombre si el cliente existe
  useEffect(() => {
    if (tipoPedido === 'domicilio' && client?.clienteNombre) setNombreCliente(client.clienteNombre);
    // Only depends on client and tipoPedido
  }, [client, tipoPedido]);

  // Limpiar direcciones al salir de domicilio
  useEffect(() => {
    if (tipoPedido !== 'domicilio') {
      setSelectedAddress('');
      setNewAddress('');
      setTelefonoCliente('');
      setTelefonoDomiciliario('');
    }
    // Only depends on tipoPedido
  }, [tipoPedido]);

  const handleProductChange = useCallback((index: number, field: string, value: string) => {
    setProductos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }, []);

  const addProduct = useCallback(() => {
    setProductos(prev => [...prev, { ...initialProduct }]);
    setSaboresVisibles(prev => [...prev, 1]);
  }, []);

  const removeProduct = useCallback((index: number) => {
    setProductos(prev => prev.filter((_, i) => i !== index));
    setSaboresVisibles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async () => {
    setLoading(true); setError(''); setSuccess(false);

    // Validaciones
    if (tipoPedido === 'mesa' && !numeroMesa) {
      setLoading(false);
      setError('Debe seleccionar un número de mesa');
      return;
    }

    if (tipoPedido === 'domicilio') {
      if (!nombreCliente || !nombreCliente.trim()) {
        setLoading(false);
        setError('Debe ingresar el nombre del cliente');
        return;
      }

      const direccion = hasClienteDirecciones
        ? (selectedAddress === '__nueva__' ? newAddress : selectedAddress)
        : newAddress;

      if (!direccion || !direccion.trim()) {
        setLoading(false);
        setError('Debe ingresar o seleccionar una dirección');
        return;
      }
    }

    if (tipoPedido === 'llevar') {
      if (!nombreCliente || !nombreCliente.trim()) {
        setLoading(false);
        setError('Debe ingresar el nombre del cliente');
        return;
      }
    }

    // Validar que haya al menos un producto válido
    const productosValidos = productos.filter(p => p.tipo && p.tipo.trim());
    if (productosValidos.length === 0) {
      setLoading(false);
      setError('Debe agregar al menos un producto válido');
      return;
    }

    // Validar tipoPedido
    if (!tipoPedido || (tipoPedido !== 'mesa' && tipoPedido !== 'domicilio')) {
      setError('Debes seleccionar un tipo de pedido');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        tipoPedido: tipoPedido || 'mesa',
        telefonoCliente: telefonoCliente || undefined,
        nombreCliente: tipoPedido === 'mesa' ? numeroMesa : nombreCliente,
        direccionCliente: tipoPedido === 'domicilio'
          ? (hasClienteDirecciones
            ? (selectedAddress === '__nueva__' ? newAddress : selectedAddress)
            : newAddress)
          : undefined,
        telefonoDomiciliario: telefonoDomiciliario || undefined,
        metodo,
        productos: productosValidos.map(p => {
          const item: any = {
            tipo: p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1).toLowerCase(),
            cantidad: Number(p.cantidad) || 1,
          };
          if (p.tamano) item.tamano = p.tamano.charAt(0).toUpperCase() + p.tamano.slice(1).toLowerCase();
          if (p.sabor1) item.sabor1 = p.sabor1.charAt(0).toUpperCase() + p.sabor1.slice(1).toLowerCase();
          if (p.sabor2) item.sabor2 = p.sabor2.charAt(0).toUpperCase() + p.sabor2.slice(1).toLowerCase();
          if (p.sabor3) item.sabor3 = p.sabor3.charAt(0).toUpperCase() + p.sabor3.slice(1).toLowerCase();
          return item;
        })
      };

      const response = await axios.post(`${API_BASE_URL}/ordenes`, payload);
      const ordenId = response.data?.ordenId || response.data?.id;

      setSuccess(true);

      // Limpiar formulario
      setProductos([{ ...initialProduct }]);
      setNumeroMesa('');
      setNombreCliente('');
      setSelectedAddress('');
      setNewAddress('');
      setTelefonoCliente('');
      setTelefonoDomiciliario('');

      // Navegar al detalle de la orden creada después de un breve delay
      setTimeout(() => {
        if (ordenId) {
          router.push(`/orden-detalle?ordenId=${ordenId}`);
        } else {
          router.push('/ordenes');
        }
      }, 800);
    } catch (err: any) {
      console.error('Error creating order:', err);

      if (err?.response) {
        const status = err.response.status;
        const data = err.response.data || {};
        console.error('Backend response data:', data);

        // Normalizar mensajes de validación que vienen como array
        let message: string | undefined;
        if (Array.isArray(data.message)) {
          try {
            message = data.message.map((m: any) => {
              if (typeof m === 'string') return m;
              if (m.constraints) return Object.values(m.constraints).join(', ');
              return JSON.stringify(m);
            }).join(' | ');
          } catch (e) {
            message = JSON.stringify(data.message);
          }
        } else if (typeof data.message === 'string') {
          message = data.message;
        } else if (data.error) {
          message = data.error;
        }

        if (status === 400) {
          setError(`Datos inválidos: ${message || 'Verifique los datos ingresados'}`);
        } else if (status === 404) {
          setError('Servicio no encontrado. Verifique que el backend esté funcionando.');
        } else if (status === 500) {
          setError(`Error del servidor: ${message || 'Intente nuevamente'}`);
        } else {
          setError(`Error (${status}): ${message || 'No se pudo crear la orden'}`);
        }
      } else if (err.request) {
        setError('No se recibió respuesta del servidor. Verifique la conexión.');
        console.error('Request info:', err.request);
      } else {
        setError('Error inesperado al crear la orden.');
      }
    } finally {
      setLoading(false);
    }
  };

  const pickerTextStyle = isMobile ? { color: '#000', fontSize: 18 } : { color: '#000' };
  const inputTextStyle = isMobile ? { color: '#000', fontSize: 18 } : { color: '#000' };
  const placeholderTextColor = isMobile ? '#666' : '#999';
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
                  selectedValue={tipoPedido}
                  onValueChange={setTipoPedido}
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
                  selectedValue={metodo}
                  onValueChange={setMetodo}
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
            {tipoPedido === 'domicilio' && (
              <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                <Text style={styles.label}>Teléfono Cliente</Text>
                <TextInput
                  style={styles.input}
                  value={telefonoCliente}
                  onChangeText={setTelefonoCliente}
                  placeholder="Teléfono (10 dígitos)"
                  placeholderTextColor={colors.subText}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* NOMBRE / MESA */}
            <View style={[styles.col4, isMobile && styles.col4Mobile]}>
              <Text style={styles.label}>Nombre / Mesa</Text>
              {tipoPedido === 'mesa' ? (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={numeroMesa}
                    onValueChange={val => { setNumeroMesa(val); setNombreCliente(val); }}
                    style={styles.picker}
                    itemStyle={{ color: colors.text, fontSize: 16 }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Seleccione mesa" value="" color={colors.subText} />
                    {[...Array(10)].map((_, i) => <Picker.Item key={i + 1} label={`Mesa ${i + 1}`} value={`${i + 1}`} />)}
                  </Picker>
                </View>
              ) : tipoPedido === 'domicilio' ? (
                <TextInput
                  style={styles.input}
                  value={nombreCliente}
                  onChangeText={setNombreCliente}
                  placeholder={client === null ? 'Nuevo cliente' : 'Nombre'}
                  placeholderTextColor={colors.subText}
                  editable={!client || !client.clienteNombre}
                />
              ) : (
                <TextInput
                  style={styles.input}
                  value={nombreCliente}
                  onChangeText={setNombreCliente}
                  placeholder="Nombre Cliente"
                  placeholderTextColor={colors.subText}
                />
              )}
            </View>
          </View>

          {/* DIRECCION Y DOMICILIARIO (Solo Domicilio) */}
          {tipoPedido === 'domicilio' && (
            <View style={styles.row}>
              <View style={[styles.col6, isMobile && styles.col6Mobile]}>
                <Text style={styles.label}>Dirección Cliente</Text>
                {hasClienteDirecciones ? (
                  <>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={selectedAddress}
                        onValueChange={val => setSelectedAddress(val)}
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
                    {selectedAddress === '__nueva__' && (
                      <TextInput
                        style={styles.input}
                        value={newAddress}
                        onChangeText={setNewAddress}
                        placeholder="Ingrese nueva dirección"
                        placeholderTextColor={colors.subText}
                      />
                    )}
                  </>
                ) : (
                  <TextInput
                    style={styles.input}
                    value={newAddress}
                    onChangeText={setNewAddress}
                    placeholder="Dirección completa"
                    placeholderTextColor={colors.subText}
                  />
                )}
              </View>

              <View style={[styles.col6, isMobile && styles.col6Mobile]}>
                <Text style={styles.label}>Domiciliario</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={telefonoDomiciliario}
                    onValueChange={setTelefonoDomiciliario}
                    style={styles.picker}
                    itemStyle={{ color: colors.text, fontSize: 16 }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Seleccione domiciliario" value="" color={colors.subText} />
                    {domiciliarios.map(d => <Picker.Item key={d.telefono} label={d.domiciliarioNombre ? d.domiciliarioNombre : `Sin nombre (${d.telefono})`} value={d.telefono.toString()} />)}
                  </Picker>
                </View>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Productos</Text>
          {productos.map((p, idx) => (
            <ProductForm
              key={idx}
              product={p}
              index={idx}
              saboresVisibles={saboresVisibles}
              handleProductChange={handleProductChange}
              setSaboresVisibles={setSaboresVisibles}
              removeProduct={removeProduct}
              pizzaSabores={pizzaSabores}
              calzoneSabores={calzoneSabores}
              totalProducts={productos.length}
            />
          ))}
          <TouchableOpacity style={styles.addProductBtn} onPress={addProduct} activeOpacity={0.8}>
            <Text style={styles.addProductBtnText}>+ AGREGAR PRODUCTO</Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={[styles.createOrderBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.createOrderBtnText}>{loading ? 'Creando...' : 'Crear Orden'}</Text>
          </TouchableOpacity>


          {success && (
            <View style={styles.successContainer}>
              <Text style={styles.success}>✓ ¡Orden creada con éxito!</Text>
            </View>
          )}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

        </View>
        {/* Extra bottom space for system nav bar on mobile */}
        {isMobile && <View style={{ height: Platform.OS === 'android' ? 32 : 0 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}
