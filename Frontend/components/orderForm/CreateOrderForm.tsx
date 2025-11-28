import { Picker } from '@react-native-picker/picker';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../constants/api';

import { useClientByPhone } from '../../hooks/use-client-by-phone';
import { useDomiciliariosList } from '../../hooks/use-domiciliarios-list';
import { useBreakpoint } from '../styles/responsive';
import { colors } from '../theme';
import { orderFormStyles as styles } from '../styles/CreateOrderForm.styles';
import ProductForm from './ProductForm';

const calzoneSabores = ['D\u2019Firu Pollo', 'D\u2019Firu Carne', 'Hawaiano', 'Ranchero', 'Pollo y champi\u00f1ones', 'Arequipe y queso', 'Paisa', 'Mexicano', 'Carnes'];
const pizzaSabores = ['Carnes', 'Rachera', 'Paisa', 'Hawaiana', 'De la casa', 'D\u2019Firu Pollo', 'D\u2019Firu Carne', 'Vegetales', 'Mexicana', 'Bolo\u00f1esa', 'Napolitana', 'Jamon & Queso', 'La Quesuda', 'Pollo Tocineta', 'Pollo Maicitos', 'Pollo Champi\u00f1ones'];
const initialProduct = { tipo: '', tamano: '', sabor1: '', sabor2: '', sabor3: '', cantidad: '1' };

export default function CreateOrderForm() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const [tipoPedido, setTipoPedido] = useState('mesa');
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
    if (tipoPedido === 'mesa' && !numeroMesa) { setLoading(false); setError('Seleccione número de mesa'); return; }
    try {
      const payload = {
        tipoPedido,
        telefonoCliente: telefonoCliente || undefined,
        nombreCliente: tipoPedido === 'mesa' ? numeroMesa : nombreCliente,
        direccionCliente: tipoPedido === 'domicilio'
          ? (hasClienteDirecciones
            ? (selectedAddress === '__nueva__' ? newAddress : selectedAddress)
            : newAddress)
          : undefined,
        telefonoDomiciliario: telefonoDomiciliario || undefined,
        metodo,
        productos: productos.map(p => ({
          tipo: p.tipo ? p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1).toLowerCase() : '',
          tamano: p.tamano ? p.tamano.charAt(0).toUpperCase() + p.tamano.slice(1).toLowerCase() : undefined,
          sabor1: p.sabor1 ? p.sabor1.charAt(0).toUpperCase() + p.sabor1.slice(1).toLowerCase() : undefined,
          sabor2: p.sabor2 ? p.sabor2.charAt(0).toUpperCase() + p.sabor2.slice(1).toLowerCase() : undefined,
          sabor3: p.sabor3 ? p.sabor3.charAt(0).toUpperCase() + p.sabor3.slice(1).toLowerCase() : undefined,
          cantidad: Number(p.cantidad) || 1,
        }))
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

      // Navegar al detalle de la orden creada después de un breve delay
      setTimeout(() => {
        if (ordenId) {
          router.push(`/orden-detalle?ordenId=${ordenId}`);
        } else {
          router.push('/ordenes');
        }
      }, 800);
    } catch { setError('Error al crear la orden'); } finally { setLoading(false); }
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
          isMobile && { width: '100%', borderRadius: 0, borderWidth: 0, shadowOpacity: 0, padding: 16 }
        ]}>
          <Text style={[styles.title, isMobile && styles.titleMobile]}>Crear Orden</Text>

          <Text style={styles.sectionTitle}>Detalles del Pedido</Text>

          <Text style={styles.label}>Tipo de pedido</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={tipoPedido}
              onValueChange={setTipoPedido}
              style={styles.picker}
              itemStyle={{ color: colors.text, fontSize: 20 }}
              dropdownIconColor={colors.text}
            >
              <Picker.Item label="Domicilio" value="domicilio" />
              <Picker.Item label="Llevar" value="llevar" />
              <Picker.Item label="Mesa" value="mesa" />
            </Picker>
          </View>
          {tipoPedido === 'domicilio' && (
            <>
              <Text style={styles.label}>Teléfono Cliente</Text>
              <TextInput
                style={styles.input}
                value={telefonoCliente}
                onChangeText={setTelefonoCliente}
                placeholder="Teléfono"
                placeholderTextColor={colors.subText}
                keyboardType="numeric"
              />
            </>
          )}
          <Text style={styles.label}>Nombre Cliente</Text>
          {tipoPedido === 'mesa' ? (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={numeroMesa}
                onValueChange={val => { setNumeroMesa(val); setNombreCliente(val); }}
                style={styles.picker}
                itemStyle={{ color: colors.text, fontSize: 20 }}
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
          ) : tipoPedido === 'llevar' ? (
            <TextInput
              style={styles.input}
              value={nombreCliente}
              onChangeText={setNombreCliente}
              placeholder="Nombre"
              placeholderTextColor={colors.subText}
            />
          ) : null}
          {tipoPedido === 'domicilio' && (
            <>
              <Text style={styles.label}>Dirección Cliente</Text>
              {hasClienteDirecciones ? (
                <>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={selectedAddress}
                      onValueChange={val => setSelectedAddress(val)}
                      style={styles.picker}
                      itemStyle={{ color: colors.text, fontSize: 20 }}
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
                  placeholder="Dirección"
                  placeholderTextColor={colors.subText}
                />
              )}
              <Text style={styles.label}>Domiciliario</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={telefonoDomiciliario}
                  onValueChange={setTelefonoDomiciliario}
                  style={styles.picker}
                  itemStyle={{ color: colors.text, fontSize: 20 }}
                  dropdownIconColor={colors.text}
                >
                  <Picker.Item label="Seleccione domiciliario" value="" color={colors.subText} />
                  {domiciliarios.map(d => <Picker.Item key={d.telefono} label={d.domiciliarioNombre ? d.domiciliarioNombre : `Sin nombre (${d.telefono})`} value={d.telefono.toString()} />)}
                </Picker>
              </View>
            </>
          )}
          <Text style={styles.label}>Método de pago</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={metodo}
              onValueChange={setMetodo}
              style={styles.picker}
              itemStyle={{ color: colors.text, fontSize: 20 }}
              dropdownIconColor={colors.text}
            >
              <Picker.Item label="Efectivo" value="efectivo" />
              <Picker.Item label="QR" value="qr" />
            </Picker>
          </View>

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

          <View style={{ marginVertical: 10 }} />

          <TouchableOpacity
            style={[styles.createOrderBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.createOrderBtnText}>{loading ? 'Creando...' : 'Crear Orden'}</Text>
          </TouchableOpacity>

          {success && <Text style={styles.success}>¡Orden creada con éxito!</Text>}
          {error ? <Text style={styles.error}>{error}</Text> : null}

        </View>
        {/* Extra bottom space for system nav bar on mobile */}
        {isMobile && <View style={{ height: Platform.OS === 'android' ? 32 : 0 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}
