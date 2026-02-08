import { usePathname, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../styles/navbar.styles';
import { useBreakpoint } from '../styles/responsive';

// ── Section definitions ──
type NavItem = { label: string; route: string };
type NavSection = { title: string; icon: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: 'Órdenes',
    icon: '📋',
    items: [
      { label: 'Crear Orden', route: '/crear-orden' },
      { label: 'Órdenes del Día', route: '/ordenes' },
      { label: 'Todas las Órdenes', route: '/ordenes-todas' },
    ],
  },
  {
    title: 'Facturas',
    icon: '💰',
    items: [
      { label: 'Facturas Hoy', route: '/facturas-dia' },
      { label: 'Facturas Fechas', route: '/facturas' },
      { label: 'Gastos', route: '/facturas-pagos' },
    ],
  },
  {
    title: 'Información',
    icon: '📁',
    items: [
      { label: 'Clientes', route: '/clientes' },
      { label: 'Domiciliarios', route: '/domiciliarios' },
      { label: 'Productos', route: '/gestion-productos' },
    ],
  },
];

// ── Accordion section ──
function AccordionSection({
  section,
  expanded,
  onToggle,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate: (route: string) => void;
}) {
  const hasActive = section.items.some(i => pathname === i.route);

  return (
    <View>
      <TouchableOpacity
        style={[styles.sectionHeader, hasActive && styles.sectionHeaderActive]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.sectionTitle, hasActive && styles.sectionTitleActive]}>
          {section.icon}  {section.title}
        </Text>
        <Text style={styles.sectionArrow}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {expanded &&
        section.items.map(item => {
          const active = pathname === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => onNavigate(item.route)}
              activeOpacity={0.7}
            >
              {active && <View style={styles.activeIndicator} />}
              <Text style={[styles.link, active && styles.linkActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile } = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarWidth = 280;
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current;

  // Which sections are expanded — auto-expand section containing active route
  const activeIdx = SECTIONS.findIndex(s => s.items.some(i => pathname === i.route));
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    activeIdx >= 0 ? { [activeIdx]: true } : { 0: true },
  );

  const toggle = (idx: number) =>
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));

  const navigate = (route: string) => {
    setDrawerOpen(false);
    router.push(route as any);
  };

  // Animate drawer open/close
  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: drawerOpen ? 0 : -sidebarWidth,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [drawerOpen, translateX]);

  // ── Shared section list ──
  const renderSections = () =>
    SECTIONS.map((section, idx) => (
      <AccordionSection
        key={section.title}
        section={section}
        expanded={!!expanded[idx]}
        onToggle={() => toggle(idx)}
        pathname={pathname}
        onNavigate={navigate}
      />
    ));

  if (isMobile) {
    return (
      <>
        {!drawerOpen && (
          <View style={[styles.menuBtnContainer, { top: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 6 }]}>
            <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
              <Text style={styles.menuBtnText}>☰</Text>
            </TouchableOpacity>
          </View>
        )}
        {drawerOpen && (
          <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)} />
        )}
        <Animated.View style={[styles.sidebarMobile, { width: sidebarWidth, transform: [{ translateX }] }]}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarHeaderText}>Menú</Text>
            <TouchableOpacity onPress={() => setDrawerOpen(false)}>
              <Text style={styles.sidebarCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          {renderSections()}
        </Animated.View>
      </>
    );
  }

  // ── Desktop: horizontal bar with dropdown sections ──
  return (
    <View style={styles.navbar}>
      {renderSections()}
    </View>
  );
}
