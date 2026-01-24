import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles/navbar.styles';
import { useBreakpoint } from '../styles/responsive';

export default function Navbar() {
  const router = useRouter();
  const { isMobile } = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarWidth = 260;
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current;

  // Animate drawer open/close
  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: drawerOpen ? 0 : -sidebarWidth,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [drawerOpen, translateX]);

  if (isMobile) {
    return (
      <>
        {/* Menu button always visible at top left */}
        {!drawerOpen && (
          <View style={[styles.menuBtnContainer, { top: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 6 }]}>
            <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
              <Text style={styles.menuBtnText}>☰</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Overlay and drawer */}
        {drawerOpen && (
          <>
            <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)} />

          </>
        )}
        <Animated.View style={[styles.sidebarMobile, { transform: [{ translateX }] }]}>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/crear-orden' as any); }}>
            <Text style={styles.link}>Crear Orden</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/ordenes' as any); }}>
            <Text style={styles.link}>Órdenes del Día</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/domiciliarios'); }}>
            <Text style={styles.link}>Domiciliarios</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/clientes'); }}>
            <Text style={styles.link}>Clientes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/facturas-dia'); }}>
            <Text style={styles.link}>Facturas Hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/facturas'); }}>
            <Text style={styles.link}>Facturas Fechas</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/facturas-pagos'); }}>
            <Text style={styles.link}>Pagos/Gastos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sidebarBtnMobile} onPress={() => { setDrawerOpen(false); router.push('/gestion-productos' as any); }}>
            <Text style={styles.link}>Productos</Text>
          </TouchableOpacity>
        </Animated.View>
      </>
    );
  }
  return (
    <View style={styles.navbar}>
      <TouchableOpacity onPress={() => router.push('/crear-orden' as any)}>
        <Text style={styles.link}>Crear Orden</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/ordenes' as any)}>
        <Text style={styles.link}>Órdenes del Día</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/domiciliarios')}>
        <Text style={styles.link}>Domiciliarios</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/clientes')}>
        <Text style={styles.link}>Clientes</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/facturas-dia')}>
        <Text style={styles.link}>Facturas Hoy</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/facturas')}>
        <Text style={styles.link}>Facturas Fechas</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/facturas-pagos')}>
        <Text style={styles.link}>Pagos/Gastos</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/gestion-productos' as any)}>
        <Text style={styles.link}>Productos</Text>
      </TouchableOpacity>
    </View>
  );
}

// styles imported from Navbar.styles
