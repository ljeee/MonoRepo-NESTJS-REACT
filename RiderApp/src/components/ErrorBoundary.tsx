import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

// Red de seguridad de último recurso: cualquier error lanzado durante el
// render/ciclo de vida de un componente hijo (dato inesperado del API, acceso
// a una propiedad de null, etc.) tumbaría la app entera a un crash nativo en
// release. Este boundary lo atrapa y muestra una pantalla de recuperación con
// botón "Reintentar" en vez de cerrar la app — el domiciliario nunca se queda
// sin herramienta en plena entrega.
//
// Limitación conocida (propia de React): NO captura errores en callbacks async
// (fetch, timers, event handlers) ni en la background task headless. Esos ya
// están blindados con try/catch en sus propios sitios.

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Queda en logcat para diagnóstico; no se propaga.
    console.error('[RiderApp] Error de render capturado:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>⚠️</Text>
          </View>

          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.subtitle}>
            La app tuvo un problema inesperado. Toca reintentar; si sigue pasando, cierra sesión y vuelve a entrar.
          </Text>

          {this.state.error ? (
            <ScrollView style={styles.errBox} contentContainerStyle={{ padding: 12 }}>
              <Text style={styles.errText} selectable>
                {this.state.error.message}
              </Text>
            </ScrollView>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
            onPress={this.handleReset}
          >
            <Text style={styles.buttonText}>REINTENTAR</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.25)',
    padding: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(244,63,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: { fontSize: 34 },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  errBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 22,
  },
  errText: {
    color: '#FB7185',
    fontSize: 11,
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#F5A524',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },
});
