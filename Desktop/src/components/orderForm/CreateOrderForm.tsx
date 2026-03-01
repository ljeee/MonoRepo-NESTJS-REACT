import { isAxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useOrder } from '../../contexts/OrderContext';
import { useToast } from '../../contexts/ToastContext';
import { useClientByPhone } from '../../hooks/use-client-by-phone';
import { useDomiciliariosList } from '../../hooks/use-domiciliarios-list';
import type { CreateOrdenDto, OrderCartItem, Producto, ProductoVariante } from '../../types/models';
import { sendWhatsAppDomicilio } from '../../utils/printReceipt';
import CartPanel from './CartPanel';
import MenuPicker from './MenuPicker';
import './order-form.css';

let cartIdCounter = 0;

function nextCartId() {
  cartIdCounter += 1;
  return `cart-${cartIdCounter}-${Date.now()}`;
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
      .map((item) => {
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
  } else if (typeof responseData?.message === 'string') {
    msg = responseData.message;
  } else if (typeof responseData?.error === 'string') {
    msg = responseData.error;
  }

  if (status === 400) return `Datos inválidos: ${msg || 'Verifique los datos ingresados'}`;
  if (status === 404) return 'Servicio no encontrado. Verifique que el backend esté funcionando.';
  if (status === 500) return `Error del servidor: ${msg || 'Intente nuevamente'}`;
  return `Error (${status}): ${msg || 'No se pudo crear la orden'}`;
}

export default function CreateOrderForm() {
  const navigate = useNavigate();
  const { formState, updateForm, clearCart, isHydrated } = useOrder();
  const { showToast } = useToast();
  const { client, fetchClient } = useClientByPhone();
  const { data: domiciliarios } = useDomiciliariosList();
  const [loading, setLoading] = useState(false);

  const cartItems = useMemo(() => formState.cart as OrderCartItem[], [formState.cart]);
  const hasClienteDirecciones = useMemo(
    () => Boolean(client && [client.direccion, client.direccionDos, client.direccionTres].filter(Boolean).length),
    [client],
  );

  useEffect(() => {
    if (formState.tipoPedido === 'domicilio' && formState.telefonoCliente.length === 10) {
      fetchClient(formState.telefonoCliente);
    }
  }, [fetchClient, formState.telefonoCliente, formState.tipoPedido]);

  useEffect(() => {
    if (formState.tipoPedido === 'domicilio' && client?.clienteNombre) {
      updateForm({ nombreCliente: client.clienteNombre });
    }
  }, [client, formState.tipoPedido, updateForm]);

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

  const addToCart = useCallback(
    (producto: Producto, variante: ProductoVariante, sabores?: string[]) => {
      const newItem: OrderCartItem = {
        id: nextCartId(),
        productoNombre: producto.productoNombre,
        varianteNombre: variante.nombre,
        varianteId: variante.varianteId,
        precioUnitario: Number(variante.precio),
        cantidad: 1,
        sabores,
      };

      const existing = sabores?.length ? undefined : cartItems.find((item) => item.varianteId === variante.varianteId);

      if (existing) {
        updateForm({
          cart: cartItems.map((item) =>
            item.varianteId === variante.varianteId ? { ...item, cantidad: item.cantidad + 1 } : item,
          ),
        });
        return;
      }

      updateForm({ cart: [...cartItems, newItem] });
    },
    [cartItems, updateForm],
  );

  const removeFromCart = useCallback(
    (id: string) => {
      updateForm({ cart: cartItems.filter((item) => item.id !== id) });
    },
    [cartItems, updateForm],
  );

  const updateCartCantidad = useCallback(
    (id: string, cantidad: number) => {
      updateForm({
        cart: cartItems.map((item) => (item.id === id ? { ...item, cantidad: Math.max(1, cantidad) } : item)),
      });
    },
    [cartItems, updateForm],
  );

  const handleSubmit = async () => {
    setLoading(true);

    if (formState.tipoPedido === 'mesa' && !formState.numeroMesa.trim()) {
      setLoading(false);
      showToast('Debe seleccionar un número de mesa', 'error');
      return;
    }

    if (formState.tipoPedido === 'domicilio') {
      if (!formState.nombreCliente.trim()) {
        setLoading(false);
        showToast('Debe ingresar el nombre del cliente', 'error');
        return;
      }

      const direccion = hasClienteDirecciones
        ? formState.selectedAddress === '__nueva__'
          ? formState.newAddress
          : formState.selectedAddress
        : formState.newAddress;

      if (!direccion || !direccion.trim()) {
        setLoading(false);
        showToast('Debe ingresar o seleccionar una dirección', 'error');
        return;
      }
    }

    if (formState.tipoPedido === 'llevar' && !formState.nombreCliente.trim()) {
      setLoading(false);
      showToast('Debe ingresar el nombre del cliente', 'error');
      return;
    }

    if (cartItems.length === 0) {
      setLoading(false);
      showToast('Debe agregar al menos un producto al pedido', 'error');
      return;
    }

    try {
      const direccionCliente =
        formState.tipoPedido === 'domicilio'
          ? hasClienteDirecciones
            ? formState.selectedAddress === '__nueva__'
              ? formState.newAddress
              : formState.selectedAddress
            : formState.newAddress
          : undefined;

      const payload: CreateOrdenDto = {
        tipoPedido: formState.tipoPedido,
        telefonoCliente: formState.telefonoCliente || undefined,
        nombreCliente: formState.tipoPedido === 'mesa' ? formState.numeroMesa : formState.nombreCliente,
        direccionCliente,
        telefonoDomiciliario: formState.telefonoDomiciliario || undefined,
        costoDomicilio:
          formState.tipoPedido === 'domicilio' && formState.costoDomicilio
            ? Number(formState.costoDomicilio)
            : undefined,
        metodo: formState.metodo,
        observaciones: formState.observaciones || undefined,
        productos: cartItems.map((item) => ({
          tipo: item.productoNombre,
          varianteId: item.varianteId,
          cantidad: item.cantidad,
          sabor1: item.sabores?.[0],
          sabor2: item.sabores?.[1],
          sabor3: item.sabores?.[2],
        })),
      };

      await api.ordenes.create(payload);

      if (formState.tipoPedido === 'domicilio' && formState.telefonoDomiciliario) {
        const costoDom = formState.costoDomicilio ? Number(formState.costoDomicilio) : 0;
        const total = cartItems.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0) + costoDom;
        sendWhatsAppDomicilio(formState.telefonoDomiciliario, {
          clienteNombre: formState.nombreCliente,
          direccion: direccionCliente || '',
          telefonoCliente: formState.telefonoCliente || undefined,
          productos: cartItems.map((item) => ({
            nombre: `${item.productoNombre}${item.varianteNombre ? ` - ${item.varianteNombre}` : ''}${item.sabores?.length ? ` (${item.sabores.join(', ')})` : ''
              }`,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          })),
          total,
          costoDomicilio: costoDom || undefined,
          metodo: formState.metodo,
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
      showToast('¡Orden creada exitosamente!', 'success', 2000);
      setTimeout(() => navigate('/ordenes'), 700);
    } catch (error) {
      showToast(extractErrorMessage(error), 'error', 5000);
    } finally {
      setLoading(false);
    }
  };

  if (!isHydrated) {
    return <div>Cargando formulario...</div>;
  }

  return (
    <div className="order-form">
      <section className="order-section">
        <h1 className="order-title">Crear Orden</h1>
        <h3 className="section-title">Detalles del pedido</h3>
        <div className="order-grid">
          <div className="order-field">
            <label>Tipo de pedido</label>
            <select
              value={formState.tipoPedido}
              onChange={(event) => updateForm({ tipoPedido: event.target.value as 'mesa' | 'domicilio' | 'llevar' })}
            >
              <option value="domicilio">Domicilio</option>
              <option value="llevar">Llevar</option>
              <option value="mesa">Mesa</option>
            </select>
          </div>

          <div className="order-field">
            <label>Método de pago</label>
            <select value={formState.metodo} onChange={(event) => updateForm({ metodo: event.target.value })}>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
            </select>
          </div>

          {formState.tipoPedido === 'domicilio' && (
            <div className="order-field">
              <label>Teléfono cliente</label>
              <input
                value={formState.telefonoCliente}
                onChange={(event) => updateForm({ telefonoCliente: event.target.value.replace(/\D/g, '').slice(0, 10) })}
              />
            </div>
          )}

          <div className="order-field">
            <label>{formState.tipoPedido === 'mesa' ? 'Mesa' : 'Nombre cliente'}</label>
            {formState.tipoPedido === 'mesa' ? (
              <select
                value={formState.numeroMesa}
                onChange={(event) => updateForm({ numeroMesa: event.target.value, nombreCliente: event.target.value })}
              >
                <option value="">Seleccione mesa</option>
                {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((mesa) => (
                  <option key={mesa} value={mesa}>
                    Mesa {mesa}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={formState.nombreCliente}
                onChange={(event) => updateForm({ nombreCliente: event.target.value })}
                disabled={formState.tipoPedido === 'domicilio' && Boolean(client?.clienteNombre)}
              />
            )}
          </div>
        </div>

        {formState.tipoPedido === 'domicilio' && (
          <div className="order-grid order-grid-top">
            <div className="order-field">
              <label>Dirección cliente</label>
              {hasClienteDirecciones ? (
                <>
                  <select
                    value={formState.selectedAddress}
                    onChange={(event) => updateForm({ selectedAddress: event.target.value })}
                  >
                    <option value="">Seleccione dirección</option>
                    {[client?.direccion, client?.direccionDos, client?.direccionTres]
                      .filter((value): value is string => Boolean(value))
                      .map((address) => (
                        <option key={address} value={address}>
                          {address}
                        </option>
                      ))}
                    <option value="__nueva__">Nueva dirección...</option>
                  </select>
                  {formState.selectedAddress === '__nueva__' && (
                    <input
                      value={formState.newAddress}
                      onChange={(event) => updateForm({ newAddress: event.target.value })}
                    />
                  )}
                </>
              ) : (
                <input value={formState.newAddress} onChange={(event) => updateForm({ newAddress: event.target.value })} />
              )}
            </div>

            <div className="order-field">
              <label>Domiciliario</label>
              <select
                value={formState.telefonoDomiciliario}
                onChange={(event) => updateForm({ telefonoDomiciliario: event.target.value })}
              >
                <option value="">Seleccione domiciliario</option>
                {domiciliarios.map((domiciliario) => (
                  <option key={domiciliario.telefono} value={domiciliario.telefono}>
                    {domiciliario.domiciliarioNombre || `Sin nombre (${domiciliario.telefono})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="order-field">
              <label>Costo domicilio</label>
              <input
                value={formState.costoDomicilio}
                onChange={(event) => updateForm({ costoDomicilio: event.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
        )}

        <h3 className="section-title section-title-top">
          Productos
        </h3>
        <MenuPicker onAdd={addToCart} />

        <h3 className="section-title section-title-top">
          Observaciones
        </h3>
        <div className="order-field">
          <textarea
            value={formState.observaciones}
            onChange={(event) => updateForm({ observaciones: event.target.value })}
          />
        </div>
      </section>

      <section className="order-section">
        <h3 className="section-title section-title-tight">
          Resumen del pedido
        </h3>
        <CartPanel
          items={cartItems}
          onRemove={removeFromCart}
          onUpdateCantidad={updateCartCantidad}
          costoDomicilio={formState.tipoPedido === 'domicilio' && formState.costoDomicilio ? Number(formState.costoDomicilio) : 0}
        />

        <button type="button" className="create-order-btn" disabled={loading} onClick={handleSubmit}>
          {loading ? 'Creando...' : 'Crear Orden'}
        </button>
      </section>
    </div>
  );
}