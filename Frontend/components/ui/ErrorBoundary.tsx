import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity } from '../../tw';
import Icon from './Icon';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View className="flex-1 bg-(--color-pos-bg) items-center justify-center p-6">
          <View className="bg-[#0F172A] rounded-[32px] border border-rose-500/20 p-10 w-full max-w-[450px] items-center scale-[0.95] md:scale-100 shadow-2xl">
            <View className="w-24 h-24 rounded-full bg-rose-500/10 items-center justify-center mb-6">
              <Icon name="alert-decagram-outline" size={64} color="#F43F5E" />
            </View>
            
            <Text className="text-slate-100 text-2xl font-black mb-4 text-center tracking-tight uppercase" style={{ fontFamily: 'Space Grotesk' }}>¡UPS! ALGO SALIÓ MAL</Text>
            
            <Text className="text-slate-400 text-sm leading-6 text-center mb-6">
              La aplicación encontró un error inesperado. Hemos registrado el incidente para solucionarlo pronto.
            </Text>

            {this.state.error && (
                <View className="bg-black/30 rounded-2xl p-4 mb-8 w-full border border-white/5">
                    <Text className="text-rose-500 font-mono text-xs text-center" numberOfLines={3}>
                        {this.state.error.message}
                    </Text>
                </View>
            )}

            <TouchableOpacity 
              className="bg-amber-500 flex-row items-center justify-center py-4 px-8 rounded-2xl gap-3 w-full active:opacity-80"
              onPress={this.handleReset}
              activeOpacity={0.8}
            >
              <Icon name="refresh" size={20} color="#000" />
              <Text className="text-[#0F172A] font-black text-sm tracking-widest uppercase">REINTENTAR CARGAR</Text>
            </TouchableOpacity>

            <Text className="mt-8 text-slate-600 text-[10px] font-black uppercase tracking-[2px]">Dfiru POS — Sistema de Resiliencia</Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}
