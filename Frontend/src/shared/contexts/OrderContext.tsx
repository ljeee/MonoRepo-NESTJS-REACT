import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  referenciaDomicilio: string;
  telefonoDomiciliario: string;
  costoDomicilio: string;
  metodo?: string;
  observaciones: string;
  cart: OrderCartItem[];
}

export interface SlotSummary {
  slot: number;
  itemCount: number;
  tipoPedido: string;
  nombreCliente: string;
  isEmpty: boolean;
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
  // ── Multi-slot ──
  activeSlot: number;
  setActiveSlot: (slot: number) => void;
  slotSummaries: SlotSummary[];
}

export const defaultOrderFormState: OrderFormState = {
  tipoPedido: 'mesa',
  telefonoCliente: '',
  nombreCliente: '',
  numeroMesa: '',
  selectedAddress: '',
  newAddress: '',
  referenciaDomicilio: '',
  telefonoDomiciliario: '',
  costoDomicilio: '',
  observaciones: '',
  cart: [],
};

const NUM_SLOTS = 3;
const SLOT_KEY = (n: number) => `@pizzeria_order_form_${n}`;
const ACTIVE_SLOT_KEY = '@pizzeria_order_active_slot';

/** @deprecated Use SLOT_KEY instead — kept for one-time migration */
const LEGACY_KEY = '@pizzeria_order_form';

const OrderContext = createContext<OrderContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface OrderProviderProps {
  children: React.ReactNode;
  storage: OrderStorageAdapter;
}

export function OrderProvider({ children, storage }: OrderProviderProps) {
  const [activeSlot, setActiveSlotState] = useState<number>(0);
  // All three slot states kept in memory; only active one is "formState"
  const slotsRef = useRef<OrderFormState[]>([
    { ...defaultOrderFormState },
    { ...defaultOrderFormState },
    { ...defaultOrderFormState },
  ]);
  const [formState, setFormState] = useState<OrderFormState>(defaultOrderFormState);
  const [isHydrated, setIsHydrated] = useState(false);

  // ── Hydrate all slots from storage on mount ──────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // One-time migration: if legacy key exists and slot_0 doesn't, copy it over
        const [legacyRaw, slotActiveRaw, ...slotRaws] = await Promise.all([
          storage.getItem(LEGACY_KEY),
          storage.getItem(ACTIVE_SLOT_KEY),
          ...Array.from({ length: NUM_SLOTS }, (_, i) => storage.getItem(SLOT_KEY(i))),
        ]);

        const loaded: OrderFormState[] = Array.from({ length: NUM_SLOTS }, (_, i) => {
          const raw = slotRaws[i];
          if (raw) {
            try { return JSON.parse(raw) as OrderFormState; } catch { /* ignore */ }
          }
          // Migration: first slot from legacy key
          if (i === 0 && legacyRaw) {
            try { return JSON.parse(legacyRaw) as OrderFormState; } catch { /* ignore */ }
          }
          return { ...defaultOrderFormState };
        });

        slotsRef.current = loaded;

        const slot = Math.min(
          Math.max(0, Number(slotActiveRaw ?? '0') || 0),
          NUM_SLOTS - 1
        );
        setActiveSlotState(slot);
        setFormState(loaded[slot]);
      } catch (err) {
        console.error('Failed to load order form state:', err);
      }
      setIsHydrated(true);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced save of active slot ────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated) return;
    const timer = setTimeout(() => {
      slotsRef.current[activeSlot] = formState;
      storage.setItem(SLOT_KEY(activeSlot), JSON.stringify(formState)).catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [formState, isHydrated, activeSlot, storage]);

  // ── Switch slot ──────────────────────────────────────────────────────────
  const setActiveSlot = useCallback((slot: number) => {
    if (slot === activeSlot) return;
    // Persist current slot synchronously in memory
    slotsRef.current[activeSlot] = formState;
    // Save to storage immediately (no debounce)
    storage.setItem(SLOT_KEY(activeSlot), JSON.stringify(formState)).catch(console.error);
    storage.setItem(ACTIVE_SLOT_KEY, String(slot)).catch(console.error);
    // Load target slot
    setActiveSlotState(slot);
    setFormState(slotsRef.current[slot]);
  }, [activeSlot, formState, storage]);

  // ── Slot summaries for tab UI ────────────────────────────────────────────
  const slotSummaries: SlotSummary[] = Array.from({ length: NUM_SLOTS }, (_, i) => {
    const s = i === activeSlot ? formState : slotsRef.current[i];
    const isEmpty = s.cart.length === 0 && !s.telefonoCliente && !s.nombreCliente;
    return {
      slot: i,
      itemCount: s.cart.reduce((sum, item) => sum + item.cantidad, 0),
      tipoPedido: s.tipoPedido,
      nombreCliente: s.nombreCliente || s.telefonoCliente,
      isEmpty,
    };
  });

  // ── Form mutations ───────────────────────────────────────────────────────
  const updateForm = useCallback((updates: Partial<OrderFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetForm = useCallback(() => {
    setFormState({ ...defaultOrderFormState });
  }, []);

  const saveNow = useCallback(async () => {
    try {
      slotsRef.current[activeSlot] = formState;
      await storage.setItem(SLOT_KEY(activeSlot), JSON.stringify(formState));
    } catch (err) {
      console.error('Failed to save order form state:', err);
    }
  }, [formState, activeSlot, storage]);

  const addToCart = useCallback((item: OrderCartItem) => {
    setFormState(prev => {
      const existingIdx =
        item.sabores?.length
          ? -1
          : prev.cart.findIndex(i => i.varianteId === item.varianteId && !i.base);

      if (existingIdx >= 0) {
        const newCart = [...prev.cart];
        newCart[existingIdx] = {
          ...newCart[existingIdx],
          cantidad: newCart[existingIdx].cantidad + item.cantidad,
        };
        return { ...prev, cart: newCart };
      }
      return { ...prev, cart: [...prev.cart, item] };
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setFormState(prev => ({ ...prev, cart: prev.cart.filter(i => i.id !== id) }));
  }, []);

  const updateCartItem = useCallback((id: string, cantidad: number) => {
    setFormState(prev => ({
      ...prev,
      cart: prev.cart.map(i => i.id === id ? { ...i, cantidad } : i),
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
        activeSlot,
        setActiveSlot,
        slotSummaries,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (!context) throw new Error('useOrder must be used within OrderProvider');
  return context;
}
