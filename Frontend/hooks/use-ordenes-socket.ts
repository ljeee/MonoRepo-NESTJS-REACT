import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBaseUrl } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { Orden } from '../types/models';

export function useOrdenesSocket(dispositivo: string = 'cajero', onRefresh?: () => void) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const url = getBaseUrl();
    
    // Create socket connection specifying namespace
    const socketInstance = io(`${url}/ordenes`, {
      transports: ['websocket'],
      auth: { dispositivo },
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log(`[Socket] Conectado a /ordenes. Dispositivo: ${dispositivo}`);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket] Desconectado');
    });

    socketInstance.on('orden:nueva', (data) => {
      console.log('[Socket] Nueva orden:', data);
      if (onRefresh) onRefresh();
    });

    socketInstance.on('orden:actualizada', (data) => {
      console.log('[Socket] Orden actualizada:', data);
      if (onRefresh) onRefresh();
    });

    socketInstance.on('whatsapp:handoff', (data) => {
      console.log('[Socket] WhatsApp Handoff:', data);
      showToast('⚠️ WhatsApp: Atención de cliente requerida', 'error');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [dispositivo, showToast]);

  return { socket, isConnected };
}
