import { useState } from 'react';
import { useApi } from '../contexts/ApiContext';
import type { CreateOrdenDto } from '../types/models';

export type OrderData = CreateOrdenDto;
export type CreateOrdenItemDto = CreateOrdenDto['productos'] extends (infer T)[] | undefined ? T : never;

export function useCreateOrder() {
  const api = useApi();
  const [state, setState] = useState<{ loading: boolean; error: string | null; success: boolean }>({
    loading: false,
    error: null,
    success: false,
  });
  const { loading, error, success } = state;

  const createOrder = async (order: CreateOrdenDto) => {
    setState({ loading: true, error: null, success: false });
    try {
      await api.ordenes.create(order);
      setState({ loading: false, error: null, success: true });
      return true;
    } catch (err: any) {
      setState({ loading: false, error: err.message || 'Error desconocido', success: false });
      return null;
    }
  };

  return { createOrder, loading, error, success };
}
