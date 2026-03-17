import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '../contexts/ToastContext';

export function useOrdenesSocket(baseUrl: string, dispositivo: string = 'cajero', onRefresh?: () => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { showToast } = useToast();
  const onRefreshRef = useRef(onRefresh);
  const showToastRef = useRef(showToast);

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

    // Create socket connection specifying namespace
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
      const cliente = data.factura?.clienteNombre || data.nombreCliente || data.cliente;
      showToastRef.current(`Nueva orden #${id} de ${cliente || 'un cliente'}`, 'info');
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
