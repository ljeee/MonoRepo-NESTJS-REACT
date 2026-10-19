import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Animated } from '../../tw/animated';

export interface AnimatedOrbProps {
  /** Desfase del ciclo (0, 1, 2…) para que varios orbes no laten a la vez. */
  delay?: number;
  size?: number;
  color?: string;
  /** 'suave' = más tenue y lento (fondos con mucho texto encima). */
  intensidad?: 'normal' | 'suave';
  style?: StyleProp<ViewStyle>;
}

const NIVELES = {
  normal: { base: 0.15, alto: 0.25, bajo: 0.12, escalaMax: 1.08, escalaMin: 0.95, opacidadMs: 3000, escalaMs: 4000 },
  suave: { base: 0.12, alto: 0.22, bajo: 0.09, escalaMax: 1.09, escalaMin: 0.94, opacidadMs: 3200, escalaMs: 4200 },
};

/** Círculo de color que "respira" de fondo (login, editar orden, mis domicilios). Antes había 3 copias. */
export default function AnimatedOrb({ delay = 0, size = 200, color = '#F5A524', intensidad = 'normal', style }: AnimatedOrbProps) {
  const n = NIVELES[intensidad];
  const opacity = useSharedValue(n.base);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(n.alto, { duration: n.opacidadMs + delay * 500 }),
        withTiming(n.bajo, { duration: n.opacidadMs + delay * 500 }),
      ),
      -1,
      true,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(n.escalaMax, { duration: n.escalaMs + delay * 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(n.escalaMin, { duration: n.escalaMs + delay * 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [delay, n, opacity, scale]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[animStyle, { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}
