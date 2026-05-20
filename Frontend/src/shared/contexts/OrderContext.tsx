import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { OrderCartItem } from '../types/models';

// ─── Storage Adapter Interface ────────────────────────────────────────────────

export interface OrderStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderFormState {
  tipoPedido: 'mesa' | 'domicilio' | 'llevar';
  telefonoCliente: string;
  nombreCliente: string;
  numeroMesa: string;
  selectedAddress: string;
  newAddress: string;
  telefonoDomiciliario: string;
  costoDomicilio: string;
  observaciones: string;
  cart: OrderCartItem[];
}

export interface OrderContextType {
  formState: OrderFormState;
  updateForm: (updates: Partial<OrderFormState>) => void;
  resetForm: () => void;
  addToCart: (item: OrderCartItem) => void;
  removeFromCart: (id: string) => void;
  updateCartItem: (id: string, cantidad: number) => void;
  clearCart: () => void;
  isHydrated: boolean;
  saveNow: () => Promise<void>;
}

export const defaultOrderFormState: OrderFormState = {
  tipoPedido: 'mesa',
  telefonoCliente: '',
  nombreCliente: '',
  numeroMesa: '',
  selectedAddress: '',
  newAddress: '',
  telefonoDomiciliario: '',
  costoDomicilio: '',
  observaciones: '',
  cart: [],
};

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const STORAGE_KEY = '@pizzeria_order_form';

// ─── Provider ─────────────────────────────────────────────────────────────────

interface OrderProviderProps {
  children: React.ReactNode;
  storage: OrderStorageAdapter;
}

export function OrderProvider({ children, storage }: OrderProviderProps) {
  const [formState, setFormState] = useState<OrderFormState>(defaultOrderFormState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load form state from storage on mount
  useEffect(() => {
    const loadFormState = async () => {
      try {
        const saved = await storage.getItem(STORAGE_KEY);
        if (saved) {
          setFormState(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load order form state:', error);
      }
      setIsHydrated(true);
    };

    loadFormState();
  }, [storage]);

  // Save form state with debounce to avoid too many writes
  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      storage.setItem(STORAGE_KEY, JSON.stringify(formState)).catch((error) => {
        console.error('Failed to save order form state:', error);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [formState, isHydrated, storage]);

  const updateForm = useCallback((updates: Partial<OrderFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(defaultOrderFormState);
  }, []);

  // Save immediately without debounce
  const saveNow = useCallback(async () => {
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify(formState));
    } catch (error) {
      console.error('Failed to save order form state:', error);
    }
  }, [formState, storage]);

  const addToCart = useCallback((item: OrderCartItem) => {
    setFormState(prev => {
      // If item has sabores, always create new line; otherwise merge if exists
      const existingIdx =
        item.sabores?.length
          ? -1
          : prev.cart.findIndex(i => i.varianteId === item.varianteId);

      if (existingIdx >= 0) {
        // Merge with existing
        const newCart = [...prev.cart];
        newCart[existingIdx] = {
          ...newCart[existingIdx],
          cantidad: newCart[existingIdx].cantidad + item.cantidad,
        };
        return { ...prev, cart: newCart };
      } else {
        // Add new
        return { ...prev, cart: [...prev.cart, item] };
      }
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setFormState(prev => ({
      ...prev,
      cart: prev.cart.filter(i => i.id !== id),
    }));
  }, []);

  const updateCartItem = useCallback((id: string, cantidad: number) => {
    setFormState(prev => ({
      ...prev,
      cart: prev.cart.map(i =>
        i.id === id ? { ...i, cantidad } : i,
      ),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setFormState(prev => ({ ...prev, cart: [] }));
  }, []);

  return (
    <OrderContext.Provider
      value={{
        formState,
        updateForm,
        resetForm,
        addToCart,
        removeFromCart,
        updateCartItem,
        clearCart,
        isHydrated,
        saveNow,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within OrderProvider');
  }
  return context;
}
