import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CartItem } from '../components/orderForm/CartPanel';

interface OrderFormState {
  tipoPedido: 'mesa' | 'domicilio' | 'llevar';
  telefonoCliente: string;
  nombreCliente: string;
  numeroMesa: string;
  selectedAddress: string;
  newAddress: string;
  telefonoDomiciliario: string;
  costoDomicilio: string;
  metodo: string;
  cart: CartItem[];
}

interface OrderContextType {
  formState: OrderFormState;
  updateForm: (updates: Partial<OrderFormState>) => void;
  resetForm: () => void;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  updateCartItem: (id: string, cantidad: number) => void;
  clearCart: () => void;
  isHydrated: boolean;
  saveNow: () => Promise<void>;
}

const defaultFormState: OrderFormState = {
  tipoPedido: 'mesa',
  telefonoCliente: '',
  nombreCliente: '',
  numeroMesa: '',
  selectedAddress: '',
  newAddress: '',
  telefonoDomiciliario: '',
  costoDomicilio: '',
  metodo: 'efectivo',
  cart: [],
};

const OrderContext = createContext<OrderContextType | undefined>(undefined);

const STORAGE_KEY = '@pizzeria_order_form';

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const [formState, setFormState] = useState<OrderFormState>(defaultFormState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load form state from AsyncStorage on mount
  useEffect(() => {
    const loadFormState = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          setFormState(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load order form state:', error);
      } finally {
        setIsHydrated(true);
      }
    };

    loadFormState();
  }, []);

  // Save cart changes immediately (no debounce)
  useEffect(() => {
    if (!isHydrated) return;
    const saveCartImmediately = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
      } catch (error) {
        console.error('Failed to save cart:', error);
      }
    };
    saveCartImmediately();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState.cart, isHydrated]);

  // Save other form fields with debounce to avoid too many writes
  useEffect(() => {
    if (!isHydrated) return;
    const saveFormState = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
      } catch (error) {
        console.error('Failed to save order form state:', error);
      }
    };

    // Debounce saves (500ms) for form fields only
    const timer = setTimeout(saveFormState, 500);
    return () => clearTimeout(timer);
  }, [formState.tipoPedido, formState.telefonoCliente, formState.nombreCliente, formState.numeroMesa, formState.selectedAddress, formState.newAddress, formState.telefonoDomiciliario, formState.costoDomicilio, formState.metodo, isHydrated, formState]);

  const updateForm = useCallback((updates: Partial<OrderFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState(defaultFormState);
  }, []);

  // Save immediately without debounce
  const saveNow = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
    } catch (error) {
      console.error('Failed to save order form state:', error);
    }
  }, [formState]);

  const addToCart = useCallback((item: CartItem) => {
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
