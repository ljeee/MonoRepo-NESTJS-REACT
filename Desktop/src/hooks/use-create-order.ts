import { useState } from 'react';
import { api } from '../services/api';
import type { CreateOrdenDto } from '../types/models';

// Re-export for backward compat
export type OrderData = CreateOrdenDto;
export type CreateOrdenItemDto = CreateOrdenDto['productos'] extends (infer T)[] | undefined ? T : never;

export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createOrder = async (order: CreateOrdenDto) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await api.ordenes.create(order);
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
