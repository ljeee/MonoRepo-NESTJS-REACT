import { usePathname, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '../styles/theme';
import { fontSize, fontWeight, radius, shadows, spacing, layout, duration, zIndex } from '../styles/tokens';
import { useBreakpoint } from '../styles/responsive';
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
      { label: 'Crear Orden', route: '/crear-orden', icon: 'plus-circle-outline' },
      { label: 'Órdenes del Día', route: '/ordenes', icon: 'calendar-today' },
      { label: 'Todas las Órdenes', route: '/ordenes-todas', icon: 'format-list-bulleted' },
    ],
  },
  {
    title: 'Facturas',
    icon: 'cash-multiple',
    items: [
      { label: 'Balance del Día', route: '/balance-dia', icon: 'scale-balance' },
      { label: 'Balance por Fechas', route: '/balance-fechas', icon: 'chart-box-outline' },
      { label: 'Facturas Hoy', route: '/facturas-dia', icon: 'chart-bar' },
      { label: 'Facturas Fechas', route: '/facturas', icon: 'calendar-range' },
      { label: 'Gastos', route: '/facturas-pagos', icon: 'credit-card-minus-outline' },
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
  const translateX = useRef(new Animated.Value(-sidebarWidth)).current;

  // Which sections are expanded — auto-expand section containing active route
  const activeIdx = SECTIONS.findIndex((s) =>
    s.items.some((i) => pathname === i.route),
  );
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    activeIdx >= 0 ? { [activeIdx]: true } : { 0: true },
  );

  const toggle = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const navigate = (route: string) => {
    if (isMobile || isTablet) {
      setDrawerOpen(false);
    }
    router.push(route as any);
  };

  // Animate drawer open/close
  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: drawerOpen ? 0 : -sidebarWidth,
      duration: duration.normal,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [drawerOpen, translateX, sidebarWidth]);

  // ── Shared section list ──
  const renderSections = (compact = false) =>
    SECTIONS.map((section, idx) => (
      <AccordionSection
        key={section.title}
        section={section}
        expanded={!!expanded[idx]}
        onToggle={() => toggle(idx)}
        pathname={pathname}
        onNavigate={navigate}
        compact={compact}
      />
    ));

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
            { width: sidebarWidth, transform: [{ translateX }] },
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
            {renderSections()}

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
        {renderSections()}

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

const styles = StyleSheet.create({
  // ── Mobile menu button ──
  menuBtnContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: zIndex.drawer,
    padding: spacing.md,
  },
  menuBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: zIndex.overlay,
  },

  // ── Mobile sidebar ──
  sidebarMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.card,
    zIndex: zIndex.drawer,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    ...shadows.lg,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sidebarHeaderText: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Desktop sidebar ──
  sidebar: {
    width: layout.sidebarWidth,
    height: '100%',
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    ...shadows.sm,
  },
  sidebarDesktopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sidebarDesktopTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sidebarFooterText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // ── Section accordion ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderActive: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.extrabold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleActive: {
    color: colors.primary,
  },

  // ── Nav items ──
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    marginHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  navItemActive: {
    backgroundColor: colors.primaryLight,
  },
  activeIndicator: {
    width: 3,
    height: 18,
    backgroundColor: colors.primary,
    borderRadius: 2,
    position: 'absolute',
    left: spacing.sm,
  },
  link: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    letterSpacing: 0.2,
  },
  linkActive: {
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  sectionHeaderIcon: {
    marginRight: spacing.sm,
  },
  navItemIcon: {
    marginRight: spacing.md,
  },
  sidebarScroll: {
    flex: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.dangerLight,
  },
  logoutText: {
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.2,
  },
});
