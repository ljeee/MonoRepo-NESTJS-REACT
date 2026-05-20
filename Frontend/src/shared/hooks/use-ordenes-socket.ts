import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '../contexts/ToastContext';

const TOAST_COOLDOWN_MS = 6000; // min ms between toasts for the same orden

export function useOrdenesSocket(baseUrl: string, dispositivo: string = 'cajero', onRefresh?: () => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { showToast } = useToast();
  const onRefreshRef = useRef(onRefresh);
  const showToastRef = useRef(showToast);
  // Tracks last toast timestamp per orden ID to prevent duplicate notifications
  const recentToastsRef = useRef<Map<number | string, number>>(new Map());

  const log = (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args);
    }
  };

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    if (!baseUrl) return;

    const socketInstance = io(`${baseUrl}/ordenes`, {
      transports: ['websocket'],
      auth: { dispositivo },
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      log(`[Socket] Conectado a /ordenes. Dispositivo: ${dispositivo}`);
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      log(`[Socket] Desconectado: ${reason}`);
    });

    socketInstance.on('orden:nueva', (data: any) => {
      log('[Socket] Nueva orden recibida:', data);
      const id = data.ordenId || data.id;
      const now = Date.now();
      const lastShown = recentToastsRef.current.get(id) ?? 0;

      if (now - lastShown > TOAST_COOLDOWN_MS) {
        recentToastsRef.current.set(id, now);
        const cliente = data.factura?.clienteNombre || data.nombreCliente || data.cliente;
        showToastRef.current(`Nueva orden #${id} de ${cliente || 'un cliente'}`, 'info');
      }

      onRefreshRef.current?.();
    });

    socketInstance.on('orden:actualizada', (data: any) => {
      log('[Socket] Orden actualizada:', data);
      onRefreshRef.current?.();
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [baseUrl, dispositivo]);

  return { socket, isConnected };
}
