import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBaseUrl } from '../services/api';
import { useToast } from '../contexts/ToastContext';

export function useOrdenesSocket(dispositivo: string = 'cajero', onRefresh?: () => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { showToast } = useToast();
  const onRefreshRef = useRef(onRefresh);
  const showToastRef = useRef(showToast);

  const log = (...args: unknown[]) => {
    console.log(...args);
  };

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    const url = getBaseUrl();
    
    // Create socket connection specifying namespace
    const socketInstance = io(`${url}/ordenes`, {
      transports: ['websocket'],
      auth: { dispositivo },
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      log(`[Socket] Conectado a /ordenes. Dispositivo: ${dispositivo}`);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      log('[Socket] Desconectado');
    });

    socketInstance.on('orden:nueva', (data) => {
      log('[Socket] Nueva orden:', data);
      onRefreshRef.current?.();
    });

    socketInstance.on('orden:actualizada', (data) => {
      log('[Socket] Orden actualizada:', data);
      onRefreshRef.current?.();
    });

    socketInstance.on('whatsapp:handoff', (data) => {
      log('[Socket] WhatsApp Handoff:', data);
      showToastRef.current('⚠️ WhatsApp: Atención de cliente requerida', 'error');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [dispositivo]);

  return { socket, isConnected };
}
