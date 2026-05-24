import React, { useState } from 'react';
import { View, ScrollView, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '../../tw';
import { DenominacionSelector } from './DenominacionSelector';
import Button from './Button';
import Icon from './Icon';
import { DenominacionesMap, useApi } from '@/src/shared';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  estadoActual: DenominacionesMap;
  cajaOrigen?: 'principal' | 'gastos';
}

type TabType = 'ingreso' | 'retiro' | 'cambio';

export function AjusteCajaModal({ visible, onClose, onSuccess, estadoActual, cajaOrigen = 'principal' }: Props) {
  const api = useApi();
  const [tab, setTab] = useState<TabType>('cambio');
  
  const [ingresoDenom, setIngresoDenom] = useState<DenominacionesMap>({});
  const [ingresoMonedas, setIngresoMonedas] = useState('');
  
  const [retiroDenom, setRetiroDenom] = useState<DenominacionesMap>({});
  const [retiroMonedas, setRetiroMonedas] = useState('');

  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helpers to calculate totals
  const calcTotal = (denoms: DenominacionesMap, monedasStr: string) => {
    const billetes = Object.entries(denoms).reduce((sum, [den, qty]) => sum + Number(den) * qty, 0);
    return billetes + (Number(monedasStr) || 0);
  };

  const totalIngreso = calcTotal(ingresoDenom, ingresoMonedas);
  const totalRetiro = calcTotal(retiroDenom, retiroMonedas);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      let finalDenominaciones: DenominacionesMap = {};
      let desc = descripcion.trim() || `Ajuste de caja (${tab})`;

      if (tab === 'ingreso') {
        if (totalIngreso === 0) throw new Error('Debe ingresar un monto mayor a 0');
        finalDenominaciones = { ...ingresoDenom };
        if (Number(ingresoMonedas) > 0) finalDenominaciones['coins'] = Number(ingresoMonedas);
      } else if (tab === 'retiro') {
        if (totalRetiro === 0) throw new Error('Debe ingresar un monto mayor a 0');
        finalDenominaciones = { ...retiroDenom };
        if (Number(retiroMonedas) > 0) finalDenominaciones['coins'] = Number(retiroMonedas);
      } else if (tab === 'cambio') {
        if (totalIngreso === 0 || totalRetiro === 0) throw new Error('Debe seleccionar billetes para ambos lados.');
        if (totalIngreso !== totalRetiro) throw new Error(`Descuadre en cambio: Entregas $${totalRetiro} pero recibes $${totalIngreso}`);
        
        // Entregas (Retiro) -> qty negativo
        for (const [den, qty] of Object.entries(retiroDenom)) {
          finalDenominaciones[den] = -(qty);
        }
        if (Number(retiroMonedas) > 0) {
            finalDenominaciones['coins'] = -(Number(retiroMonedas));
        }

        // Recibes (Ingreso) -> qty positivo
        for (const [den, qty] of Object.entries(ingresoDenom)) {
          finalDenominaciones[den] = (finalDenominaciones[den] || 0) + qty;
        }
        if (Number(ingresoMonedas) > 0) {
            finalDenominaciones['coins'] = (finalDenominaciones['coins'] || 0) + Number(ingresoMonedas);
        }
        
        desc = descripcion.trim() || 'Sencillado / Cambio de billetes';
      }

      const tipoApi = tab === 'ingreso' ? 'entrada' : tab === 'retiro' ? 'salida' : 'cambio';
      await api.cajaDenominaciones.ajuste({
        tipo: tipoApi,
        denominaciones: finalDenominaciones,
        descripcion: desc,
        cajaOrigen,
      });

      // Reset & close
      setIngresoDenom({}); setIngresoMonedas('');
      setRetiroDenom({}); setRetiroMonedas('');
      setDescripcion('');
      onSuccess();
      onClose();
    } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Error al guardar el ajuste');
    } finally {
      setLoading(false);
    }
  };

  const renderTabHeader = () => (
    <View className="flex-row p-1 bg-white/5 rounded-xl mb-4">
      {(['ingreso', 'retiro', 'cambio'] as TabType[]).map((t) => {
        const isSel = tab === t;
        let title = t === 'ingreso' ? 'Ingresar' : t === 'retiro' ? 'Retirar' : 'Sencillar';
        return (
          <TouchableOpacity
            key={t}
            onPress={() => { setTab(t); setError(''); }}
            className={`flex-1 items-center justify-center py-2.5 rounded-lg ${isSel ? 'bg-orange-500 shadow-md' : 'bg-transparent'}`}
          >
            <Text className={`font-bold ${isSel ? 'text-white' : 'text-slate-400'}`}>{title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-slate-900 w-full max-w-lg rounded-[28px] overflow-hidden border border-white/10 shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-2xl bg-orange-500/10 items-center justify-center border border-orange-500/20">
                <Icon name="swap-horizontal" size={20} color="#F5A524" />
              </View>
              <View>
                <Text className="text-white font-bold text-lg">Ajuste de Caja</Text>
                <Text className="text-slate-400 text-xs">Registra movimientos manuales o cambia billetes</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 bg-white/5 rounded-full" disabled={loading}>
              <Icon name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView className="max-h-[60vh] p-5" showsVerticalScrollIndicator={false}>
            {renderTabHeader()}

            {error ? (
                <View className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl mb-4 flex-row items-center gap-2">
                    <Icon name="alert-circle" size={16} color="#F87171" />
                    <Text className="text-red-400 text-xs flex-1">{error}</Text>
                </View>
            ) : null}

            {tab === 'ingreso' && (
              <DenominacionSelector
                titulo="Efectivo que ingresa"
                value={ingresoDenom}
                onChange={setIngresoDenom}
                monedas={ingresoMonedas}
                onMonedasChange={setIngresoMonedas}
              />
            )}

            {tab === 'retiro' && (
              <DenominacionSelector
                titulo="Efectivo que sale"
                value={retiroDenom}
                onChange={setRetiroDenom}
                disponible={estadoActual}
                monedas={retiroMonedas}
                onMonedasChange={setRetiroMonedas}
              />
            )}

            {tab === 'cambio' && (
              <View className="gap-6">
                <View className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <DenominacionSelector
                    titulo="Entregas de Caja (Sale)"
                    value={retiroDenom}
                    onChange={setRetiroDenom}
                    disponible={estadoActual}
                    monedas={retiroMonedas}
                    onMonedasChange={setRetiroMonedas}
                  />
                </View>
                <View className="items-center -my-3 z-10">
                    <View className="w-10 h-10 bg-slate-800 border-4 border-slate-900 rounded-full items-center justify-center">
                        <Icon name="arrow-down" size={16} color="#F5A524" />
                    </View>
                </View>
                <View className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                  <DenominacionSelector
                    titulo="Recibes y guardas (Entra)"
                    value={ingresoDenom}
                    onChange={setIngresoDenom}
                    monedas={ingresoMonedas}
                    onMonedasChange={setIngresoMonedas}
                  />
                </View>
              </View>
            )}

          </ScrollView>

          {/* Footer */}
          <View className="p-5 bg-white/[0.02] border-t border-white/5 flex-row items-center gap-3">
            <Button
              title="Cancelar"
              variant="outline"
              onPress={onClose}
              disabled={loading}
              className="flex-1"
            />
            <Button
              title={tab === 'cambio' && totalIngreso !== totalRetiro ? 'Descuadre' : 'Confirmar'}
              variant={tab === 'cambio' && totalIngreso !== totalRetiro ? 'danger' : 'primary'}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading || (tab === 'cambio' && (totalIngreso !== totalRetiro || totalIngreso === 0))}
              className="flex-1"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
