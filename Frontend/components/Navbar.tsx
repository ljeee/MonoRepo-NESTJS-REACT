import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors } from '../styles/theme';
import { duration, layout } from '../styles/tokens';
import { useBreakpoint } from '../styles/responsive';
import { navbarStyles as styles } from '../styles/components/navbar.styles';
import Icon, { IconName } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';

// ── Section definitions ──
type NavItem = { label: string; route: string; icon: IconName };
type NavSection = { title: string; icon: IconName; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: 'Órdenes',
    icon: 'clipboard-text-outline',
    items: [
      { label: 'Inicio', route: '/', icon: 'home-outline' },
      { label: 'Crear Orden', route: '/crear-orden', icon: 'plus-circle-outline' },
      { label: 'Órdenes del Día', route: '/ordenes', icon: 'calendar-today' },
      { label: 'Todas las Órdenes', route: '/ordenes-todas', icon: 'format-list-bulleted' },
    ],
  },
  {
    title: 'Facturación',
    icon: 'cash-multiple',
    items: [
      { label: 'Balance del Día', route: '/balance-dia', icon: 'scale-balance' },
      { label: 'Facturación del Día', route: '/facturas-dia', icon: 'chart-bar' },
      { label: 'Facturación General', route: '/facturas', icon: 'calendar-range' },
      { label: 'Balance General', route: '/balance-fechas', icon: 'chart-box-outline' },
      { label: 'Gastos', route: '/facturas-pagos', icon: 'credit-card-minus-outline' },
      { label: 'Estadísticas', route: '/estadisticas', icon: 'chart-bar' },
    ],
  },
  {
    title: 'Información',
    icon: 'database-outline',
    items: [
      { label: 'Clientes', route: '/clientes', icon: 'account-group-outline' },
      { label: 'Domiciliarios', route: '/domiciliarios', icon: 'motorbike' },
      { label: 'Productos', route: '/gestion-productos', icon: 'food-variant' },
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
  compact,
}: {
  section: NavSection;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate: (route: string) => void;
  compact?: boolean;
}) {
  const hasActive = section.items.some((i) => pathname === i.route);

  return (
    <View>
      <TouchableOpacity
        style={[styles.sectionHeader, hasActive && styles.sectionHeaderActive]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          <Icon
            name={section.icon}
            size={18}
            color={hasActive ? colors.primary : colors.textMuted}
            style={styles.sectionHeaderIcon}
          />
          {!compact && (
            <Text style={[styles.sectionTitle, hasActive && styles.sectionTitleActive]}>
              {section.title}
            </Text>
          )}
        </View>
        {!compact && (
          <Icon
            name={expanded ? 'chevron-down' : 'chevron-right'}
            size={16}
            color={colors.textMuted}
          />
        )}
      </TouchableOpacity>
      {expanded &&
        section.items.map((item) => {
          const active = pathname === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => onNavigate(item.route)}
              activeOpacity={0.7}
            >
              {active && <View style={styles.activeIndicator} />}
              <Icon
                name={item.icon}
                size={16}
                color={active ? colors.primary : colors.textSecondary}
                style={styles.navItemIcon}
              />
              {!compact && (
                <Text style={[styles.link, active && styles.linkActive]}>{item.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, isTablet } = useBreakpoint();
  const { logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarWidth = layout.sidebarWidth;
  const translateX = useSharedValue(-sidebarWidth);

  // Which sections are expanded — auto-expand section containing active route
  const activeIdx = SECTIONS.findIndex((s) =>
    s.items.some((i) => pathname === i.route),
  );
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    activeIdx >= 0 ? { [activeIdx]: true } : { 0: true },
  );

  const toggle = useCallback((idx: number) => {
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const navigate = useCallback((route: string) => {
    if (isMobile || isTablet) {
      setDrawerOpen(false);
    }
    router.push(route as any);
  }, [isMobile, isTablet, router]);

  // Animate drawer open/close
  React.useEffect(() => {
    translateX.set(withTiming(drawerOpen ? 0 : -sidebarWidth, {
      duration: duration.normal,
    }));
  }, [drawerOpen, translateX, sidebarWidth]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.get() }],
    };
  });

  const sectionNodes = useMemo(() =>
    SECTIONS.map((section, idx) => (
      <AccordionSection
        key={section.title}
        section={section}
        expanded={!!expanded[idx]}
        onToggle={() => toggle(idx)}
        pathname={pathname}
        onNavigate={navigate}
        compact={false}
      />
    )), [expanded, navigate, pathname, toggle]);

  // ── MOBILE: Hamburger + Drawer ──
  if (isMobile || isTablet) {
    return (
      <>
        {!drawerOpen && (
          <View
            style={[
              styles.menuBtnContainer,
              {
                top:
                  (Platform.OS === 'android'
                    ? StatusBar.currentHeight || 0
                    : 0) + 6,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuBtn}
              onPress={() => setDrawerOpen(true)}
            >
              <Icon name="menu" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
        )}
        {drawerOpen && (
          <Pressable
            style={styles.drawerOverlay}
            onPress={() => setDrawerOpen(false)}
          />
        )}
        <Animated.View
          style={[
            styles.sidebarMobile,
            { width: sidebarWidth },
            animatedStyle,
          ]}
        >
          <View style={styles.sidebarHeader}>
            <View style={styles.sidebarBrand}>
              <Icon name="pizza" size={24} color={colors.primary} />
              <Text style={styles.sidebarHeaderText}>Menú</Text>
            </View>
            <TouchableOpacity
              onPress={() => setDrawerOpen(false)}
              style={styles.closeBtn}
            >
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
            {sectionNodes}

            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Icon name="logout" size={20} color={colors.danger} />
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </>
    );
  }

  // ── DESKTOP: Persistent Sidebar ──
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarDesktopHeader}>
        <Icon name="pizza" size={22} color={colors.primary} />
        <Text style={styles.sidebarDesktopTitle}>POS Pizza</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.sidebarScroll} contentContainerStyle={{ flexGrow: 1 }}>
        {sectionNodes}

        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Icon name="logout" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
      {/* Footer */}
      <View style={styles.sidebarFooter}>
        <Icon name="cog-outline" size={16} color={colors.textMuted} />
        <Text style={styles.sidebarFooterText}>v1.0</Text>
      </View>
    </View>
  );
}
