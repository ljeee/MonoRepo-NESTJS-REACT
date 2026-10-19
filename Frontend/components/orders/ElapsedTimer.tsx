import React, { useEffect, useState } from 'react';
import { View, Text } from '../../tw';
import { minutosDesde, urgenciaOrden } from '@/src/shared';

/** Minutos desde `fecha`, refrescados cada 30 s. */
export function useMinutosDesde(fecha: string | Date): number {
  const [mins, setMins] = useState(() => minutosDesde(fecha));
  useEffect(() => {
    setMins(minutosDesde(fecha));
    const iv = setInterval(() => setMins(minutosDesde(fecha)), 30000);
    return () => clearInterval(iv);
  }, [fecha]);
  return mins;
}

/** Círculo con los minutos de espera, coloreado por urgencia (KDS y POS). */
export const ElapsedTimer = React.memo(function ElapsedTimer({
  mins,
  estado,
  size = 44,
}: {
  mins: number;
  estado?: string | null;
  size?: number;
}) {
  const u = urgenciaOrden(mins, estado);
  const grande = size >= 52;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: grande ? 4 : 3.5,
        borderColor: u.color,
        backgroundColor: `${u.color}1A`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: u.texto, fontSize: grande ? 16 : 13, fontFamily: 'SpaceGrotesk-Bold', lineHeight: grande ? 18 : 14 }}>
        {mins > 0 ? mins : '<1'}
      </Text>
      <Text style={{ color: u.texto, fontSize: grande ? 7 : 6, fontFamily: 'Outfit', opacity: 0.8, letterSpacing: 0.5 }}>MIN</Text>
    </View>
  );
});
