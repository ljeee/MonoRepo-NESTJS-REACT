

import axios from 'axios';
import { useState } from 'react';
import { API_BASE_URL } from '../constants/api';

export interface CreateOrdenItemDto {
  tamano: string;
  sabor1: string;
  sabor2?: string;
  cantidad: number;
}

export interface OrderData {
  tipoPedido: string;
  estadoOrden?: string;
  fechaOrden?: string;
  telefonoCliente?: number;
  nombreCliente?: string;
  direccionCliente?: string;
  telefonoDomiciliario?: number;
  metodo?: string;
  productos?: CreateOrdenItemDto[];
}

export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  /**
   * Envía una orden al backend para crearla.
   * @param order Datos de la orden a crear
   */
  const createOrder = async (order: OrderData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await axios.post(`${API_BASE_URL}/orden`, order);
      setSuccess(true);
      return true;
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { createOrder, loading, error, success };
}
