import React from 'react';
import { StyleSheet, Switch } from 'react-native';
import { View, Text } from '../../tw';
import { Role, useToast } from '@/src/shared';
import { useAuth } from '../../contexts/AuthContext';
import { useArqueoActivo } from '../../hooks/use-arqueo';
import Icon from './Icon';

/**
 * Interruptor del arqueo de caja. Solo lo ve el admin: mientras el dueño atiende la caja lo
 * apaga (se cobra y se da cambio sin desglosar billetes); al irse lo enciende y deja la caja
 * arqueada para quien sigue. Para el resto del personal no renderiza nada.
 */
export function ArqueoSwitch() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { arqueoActivo, guardando, cambiar } = useArqueoActivo();

  if (!user?.roles?.includes(Role.Admin)) return null;

  const alternar = async (valor: boolean) => {
    const ok = await cambiar(valor);
    if (!ok) showToast('No se pudo cambiar el arqueo', 'error');
    else showToast(valor ? 'Arqueo activado: cuenta la caja para dejarla arqueada' : 'Arqueo desactivado', 'success');
  };

  return (
    <View style={[styles.fila, arqueoActivo ? styles.filaOn : styles.filaOff]}>
      <Icon name={arqueoActivo ? 'cash-lock' : 'cash-lock-open'} size={20} color={arqueoActivo ? '#10B981' : '#94A3B8'} />
      <View style={styles.texto}>
        <Text style={styles.titulo}>Arqueo de caja {arqueoActivo ? 'activado' : 'desactivado'}</Text>
        <Text style={styles.detalle}>
          {arqueoActivo
            ? 'Se controla la caja por billetes y el cambio se desglosa al cobrar.'
            : 'Se cobra y se da cambio sin desglosar. Actívalo al irte y deja la caja arqueada.'}
        </Text>
      </View>
      <Switch
        value={arqueoActivo}
        onValueChange={alternar}
        disabled={guardando}
        trackColor={{ false: '#334155', true: '#10B98199' }}
        thumbColor={arqueoActivo ? '#10B981' : '#94A3B8'}
        accessibilityLabel="Activar o desactivar el arqueo de caja"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  filaOn: { backgroundColor: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' },
  filaOff: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  texto: { flex: 1, minWidth: 0 },
  titulo: { color: '#F8FAFC', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  detalle: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
});
