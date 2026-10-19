import React from 'react';
import { RefreshControl, type RefreshControlProps } from 'react-native';

const COLOR = '#F5A524';

/** Pull-to-refresh con el color del POS en iOS (tintColor) y Android (colors). */
export function PosRefreshControl(props: Omit<RefreshControlProps, 'tintColor' | 'colors'>) {
  return <RefreshControl tintColor={COLOR} colors={[COLOR]} {...props} />;
}
