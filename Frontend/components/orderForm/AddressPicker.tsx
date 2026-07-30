import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from '../../tw';
import Icon from '../ui/Icon';
import { formatCurrency } from '@/src/shared';
import type { ClienteDireccion } from '@/src/shared';

// Selector de direcciones guardadas del cliente.
//
// La versión anterior era un dropdown con `position:'absolute'` sobre el input:
// con 3 o más direcciones la lista se salía de la tarjeta del formulario y
// quedaba RECORTADA (el contenedor padre la cortaba), así que las últimas
// direcciones eran inalcanzables. Además solo aparecía al enfocar el campo, de
// modo que ni se descubría que el cliente tenía direcciones guardadas.
//
// Ahora la lista va EN FLUJO (nada absoluto): no puede recortarse, crece hacia
// abajo y el ScrollView del formulario la acompaña. Se puede colapsar para no
// alargar el formulario cuando ya hay una elegida.

interface Props {
  direcciones: ClienteDireccion[];
  selectedId?: number;
  value: string;
  onSelect: (dir: ClienteDireccion) => void;
  onChangeText: (val: string) => void;
  compact?: boolean;
}

const AddressRow = React.memo(({
  dir,
  active,
  onPress,
}: {
  dir: ClienteDireccion;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className={`flex-row items-start gap-2.5 px-3 py-2.5 rounded-xl border mb-1.5 ${
      active ? 'bg-amber-500/15 border-amber-500/45' : 'bg-black/20 border-white/5'
    }`}
  >
    <View className="pt-0.5">
      <Icon
        name={active ? 'check-circle' : 'map-marker-outline'}
        size={15}
        color={active ? '#F5A524' : '#64748B'}
      />
    </View>
    <View className="flex-1">
      <Text
        className={`text-[13px] font-bold ${active ? 'text-white' : 'text-slate-300'}`}
        numberOfLines={2}
      >
        {dir.direccion}
      </Text>
      {dir.referencia ? (
        <Text className="text-slate-500 text-[10.5px] mt-0.5" numberOfLines={1}>
          {dir.referencia}
        </Text>
      ) : null}
    </View>
    {dir.costoDomicilio ? (
      <View className="bg-white/5 px-2 py-0.5 rounded-md">
        <Text className="text-slate-400 text-[10px] font-black">
          ${formatCurrency(dir.costoDomicilio)}
        </Text>
      </View>
    ) : null}
  </TouchableOpacity>
));

export default function AddressPicker({
  direcciones,
  selectedId,
  value,
  onSelect,
  onChangeText,
  compact,
}: Props) {
  const hasSaved = direcciones.length > 0;
  // Si ya hay una dirección elegida, la lista arranca plegada para no alargar
  // el formulario; si no hay ninguna, se muestra abierta para que el cajero vea
  // de una que el cliente tiene direcciones guardadas.
  const [expanded, setExpanded] = useState(!selectedId);

  return (
    <View>
      <Text className="text-[10px] font-black text-slate-400 ml-1 mb-1 uppercase tracking-wider">
        Dirección
      </Text>

      <TextInput
        className="bg-black/20 rounded-lg border border-white/5 px-3 py-2 text-sm text-white min-h-[48px]"
        value={value}
        onChangeText={onChangeText}
        placeholder="Escribe o elige una guardada..."
        placeholderTextColor="#475569"
        multiline={!compact}
      />

      {hasSaved && (
        <View className="mt-2">
          <TouchableOpacity
            onPress={() => setExpanded((v) => !v)}
            className="flex-row items-center gap-1.5 mb-2 self-start"
          >
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} color="#F5A524" />
            <Text className="text-[10px] font-black text-(--color-pos-primary) uppercase tracking-wider">
              {direcciones.length} {direcciones.length === 1 ? 'guardada' : 'guardadas'}
            </Text>
          </TouchableOpacity>

          {expanded && (
            <View>
              {direcciones.map((dir) => (
                <AddressRow
                  key={dir.id}
                  dir={dir}
                  active={selectedId === dir.id}
                  onPress={() => onSelect(dir)}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
