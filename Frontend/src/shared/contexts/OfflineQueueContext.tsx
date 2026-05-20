import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';

export interface OfflinePayment {
  ordenId: number;
  metodo: string;
  idempotencyKey: string;
  timestamp: number;
  retryCount: number;
}

export interface OfflineQueueStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface OfflineQueueContextType {
  queue: OfflinePayment[];
  addPayment: (ordenId: number, metodo: string, idempotencyKey: string) => Promise<void>;
  syncPayments: () => Promise<void>;
  isSyncing: boolean;
  hasItems: boolean;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);

const STORAGE_KEY = '@pizzeria_offline_payments';

interface OfflineQueueProviderProps {
  children: React.ReactNode;
  storage: OfflineQueueStorageAdapter;
  onSyncPayment: (payment: OfflinePayment) => Promise<void>;
}

export function OfflineQueueProvider({ children, storage, onSyncPayment }: OfflineQueueProviderProps) {
  const [queue, setQueue] = useState<OfflinePayment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const isSyncingRef = useRef(false);

  // Load from storage
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const saved = await storage.getItem(STORAGE_KEY);
        if (saved) {
          setQueue(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load offline queue:', error);
      }
      setIsHydrated(true);
    };
    loadQueue();
  }, [storage]);

  // Save to storage
  useEffect(() => {
    if (!isHydrated) return;
    storage.setItem(STORAGE_KEY, JSON.stringify(queue)).catch(err => {
      console.error('Failed to save offline queue:', err);
    });
  }, [queue, isHydrated, storage]);

  const addPayment = useCallback(async (ordenId: number, metodo: string, idempotencyKey: string) => {
    const newPayment: OfflinePayment = {
      ordenId,
      metodo,
      idempotencyKey,
      timestamp: Date.now(),
      retryCount: 0,
    };
    setQueue(prev => [...prev, newPayment]);
  }, []);

  const syncPayments = useCallback(async () => {
    if (isSyncingRef.current || queue.length === 0) return;
    
    setIsSyncing(true);
    isSyncingRef.current = true;

    const remainingPayments = [...queue];
    const successfullySynced: string[] = [];

    for (const payment of remainingPayments) {
      try {
        await onSyncPayment(payment);
        successfullySynced.push(payment.idempotencyKey);
      } catch (error) {
        console.error(`Failed to sync payment for order ${payment.ordenId}:`, error);
        // Error handling will be handled by increasing retry count or just leaving it for next time
      }
    }

    if (successfullySynced.length > 0) {
      setQueue(prev => prev.filter(p => !successfullySynced.includes(p.idempotencyKey)));
    }

    setIsSyncing(false);
    isSyncingRef.current = false;
  }, [queue, onSyncPayment]);

  // Periodic auto-sync (simple strategy)
  useEffect(() => {
    const timer = setInterval(() => {
      if (queue.length > 0) {
        syncPayments();
      }
    }, 60000); // Try every minute
    return () => clearInterval(timer);
  }, [queue.length, syncPayments]);

  return (
    <OfflineQueueContext.Provider 
      value={{ 
        queue, 
        addPayment, 
        syncPayments, 
        isSyncing,
        hasItems: queue.length > 0 
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const context = useContext(OfflineQueueContext);
  if (!context) {
    throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  }
  return context;
}
