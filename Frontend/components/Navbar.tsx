import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from '../tw';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Animated } from '../tw/animated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '../styles/responsive';
import Icon, { IconName } from './ui/Icon';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Section definitions ──
type NavItem = { label: string; route: string; icon: IconName };
type NavSection = { title: string; icon: IconName; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: 'Operativo',
    icon: 'clipboard-text-outline',
    items: [
      { label: 'Dashboard', route: '/', icon: 'home-variant-outline' },
      { label: 'Mis Domicilios', route: '/mis-domicilios', icon: 'truck-delivery-outline' },
      { label: 'Crear Orden', route: '/crear-orden', icon: 'plus-circle-outline' },
      { label: 'Órdenes Activas', route: '/ordenes', icon: 'clock-outline' },
      { label: 'Historial Local', route: '/ordenes-todas', icon: 'history' },
    ],
  },
  {
    title: 'Finanzas Día',
    icon: 'cash-register',
    items: [
      { label: 'Balance Caja', route: '/balance-dia', icon: 'currency-usd' },
      { label: 'Facturación', route: '/facturas-dia', icon: 'file-document-outline' },
      { label: 'Gastos / Egresos', route: '/facturas-pagos', icon: 'cash-minus' },
      { label: 'Cierre de Turno', route: '/cierre-caja', icon: 'lock-outline' },
    ],
  },
  {
    title: 'Informes Históricos',
    icon: 'chart-box-outline',
    items: [
      { label: 'Balance Global', route: '/balance-fechas', icon: 'chart-timeline-variant' },
      { label: 'Consultar Facturas', route: '/facturas', icon: 'database-search-outline' },
      { label: 'Analíticas', route: '/estadisticas', icon: 'chart-areaspline' },
      { label: 'Analíticas Domiciliarios', route: '/estadisticas-domiciliarios', icon: 'chart-bar' },
    ],
  },
  {
    title: 'Directorio',
    icon: 'folder-account-outline',
    items: [
      { label: 'Gestión Clientes', route: '/clientes', icon: 'account-group-outline' },
      { label: 'Domiciliarios', route: '/domiciliarios', icon: 'moped-outline' },
    ],
  },
  {
    title: 'Sistema',
    icon: 'cog-outline',
    items: [
      { label: 'Usuarios', route: '/usuarios', icon: 'account-cog-outline' },
      { label: 'Catálogo Productos', route: '/gestion-productos', icon: 'food-variant' },
      { label: 'Gestión Sabores', route: '/gestion-sabores', icon: 'pizza' },
      { label: 'Configuración POS', route: '/ajustes-negocio', icon: 'storefront-outline' },
      { label: 'Monitoreo de Sistema', route: '/monitoreo', icon: 'pulse' },
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
    <View className="mb-2">
      <Pressable
        className={`flex-row items-center justify-between px-4 py-3.5 rounded-2xl mx-3 transition-colors active:opacity-70 ${hasActive ? 'bg-orange-500/5' : ''}`}
        onPress={onToggle}
      >
        <View className="flex-row items-center gap-3">
          <View className={`w-8 h-8 rounded-lg items-center justify-center ${hasActive ? 'bg-orange-500/20' : 'bg-transparent'}`}>
            <Icon
              name={section.icon}
              size={18}
              color={hasActive ? '#F5A524' : '#94A3B8'}
            />
          </View>
          {!compact && (
            <Text className={`text-xs font-black uppercase tracking-widest ${hasActive ? 'text-white' : 'text-slate-500'}`}>
              {section.title}
            </Text>
          )}
        </View>
        {!compact && (
          <Icon
            name={expanded ? 'chevron-down' : 'chevron-right'}
            size={14}
            color={hasActive ? '#F5A524' : '#475569'}
          />
        )}
      </Pressable>
      
      {!compact && expanded && (
        <View className="mt-1 overflow-hidden">
          {section.items.map((item) => {
            const active = pathname === item.route;
            return (
              <Pressable
                key={item.route}
                className={`flex-row items-center px-4 py-3 mx-4 my-0.5 rounded-xl active:opacity-80 ${active ? 'bg-orange-500/10' : ''}`}
                onPress={() => onNavigate(item.route)}
              >
                <View className={`w-1 h-3 rounded-full mr-4 ${active ? 'bg-orange-500' : 'bg-transparent'}`} />
                <Icon
                  name={item.icon}
                  size={16}
                  color={active ? '#F5A524' : '#64748B'}
                />
                <Text 
                  numberOfLines={1}
                  className={`ml-4 text-[13px] flex-1 ${active ? 'text-white font-black' : 'text-slate-400 font-medium'}`}
                  style={{ display: compact ? 'none' : 'flex' }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Shared Sidebar Content ──
function SidebarContent({ compact, onClose }: { compact?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const isDomiciliario = (user as any)?.roles?.includes('domiciliario');

  // ── Hooks siempre al tope (Rules of Hooks) ───────────────────────────────────
  const activeIdx = SECTIONS.findIndex((s) =>
    s.items.some((i) => pathname === i.route),
  );
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    activeIdx >= 0 ? { [activeIdx]: true } : { 0: true },
  );
  const toggle = useCallback((idx: number) => {
    setExpanded((prev: Record<number, boolean>) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);
  const navigate = useCallback((route: string) => {
    router.push(route as any);
    if (onClose) onClose();
  }, [router, onClose]);

  // ── Footer de logout (shared) ─────────────────────────────────────────────────
  const LogoutButton = (
    <View className="p-6 border-t border-white/5">
      <Pressable
        className={`flex-row items-center py-4 rounded-2xl bg-red-500/10 border border-red-500/20 ${compact ? 'px-0 justify-center' : 'px-5'}`}
        onPress={logout}
      >
        <Icon name="logout-variant" size={20} color="#F43F5E" />
        {!compact && <Text className="ml-4 text-xs font-black uppercase tracking-widest text-red-500">Cerrar Sesión</Text>}
      </Pressable>
    </View>
  );

  // ── Vista exclusiva para domiciliarios ───────────────────────────────────────
  if (isDomiciliario) {
    return (
      <>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
          <Pressable
            className={`flex-row items-center px-4 py-3 mx-4 my-0.5 rounded-xl active:opacity-80 ${pathname === '/mis-domicilios' ? 'bg-orange-500/10' : ''}`}
            onPress={() => {
              router.push('/mis-domicilios' as any);
              if (onClose) onClose();
            }}
          >
            <View className={`w-1 h-3 rounded-full mr-4 ${pathname === '/mis-domicilios' ? 'bg-orange-500' : 'bg-transparent'}`} />
            <Icon name="truck-delivery-outline" size={18} color={pathname === '/mis-domicilios' ? '#F5A524' : '#64748B'} />
            {!compact && (
              <Text className={`ml-4 text-[13px] flex-1 ${pathname === '/mis-domicilios' ? 'text-white font-black' : 'text-slate-400 font-medium'}`}>
                Mis Domicilios
              </Text>
            )}
          </Pressable>
        </ScrollView>
        {LogoutButton}
      </>
    );
  }

  const isAdmin = (user as any)?.role?.toLowerCase() === 'admin' || (user as any)?.roles?.includes('admin');

  // ── Menú completo para otros roles ───────────────────────────────────────────
  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 16 }}>
        {SECTIONS.map((section, idx) => {
          let items = section.items;
          
          // Filtrar Mis Domicilios para Admins
          if (isAdmin) {
            items = items.filter(i => i.label !== 'Mis Domicilios');
          }

          const filteredItems = compact ? items.filter(i => i.route !== '/ajustes-negocio') : items;
          const sectionWithFilter: NavSection = { ...section, items: filteredItems };
          
          if (sectionWithFilter.items.length === 0) return null;

          return (
            <React.Fragment key={section.title}>
              <AccordionSection
                section={sectionWithFilter}
                expanded={compact ? false : !!expanded[idx]}
                onToggle={() => !compact && toggle(idx)}
                pathname={pathname}
                onNavigate={navigate}
                compact={compact}
              />
            </React.Fragment>
          );
        })}
      </ScrollView>
      {LogoutButton}
    </>
  );
}


// ── Main Export (Web Sidebar with Collapse) ──
export default function Navbar({ onClose }: { onClose?: () => void } = {}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const width = useSharedValue(280); 
  const insets = useSafeAreaInsets();
  const { isMobile, isTablet } = useBreakpoint();
  const isCompact = isMobile || isTablet;

  useEffect(() => {
    if (isCompact) {
      setIsCollapsed(false);
      width.value = 280;
      return;
    }
    AsyncStorage.getItem('@Auth:sidebarCollapsed').then((val: string | null) => {
      if (val === 'true') {
        setIsCollapsed(true);
        width.value = 88; 
      }
    });
  }, [isCompact]);

  const toggleCollapse = () => {
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    width.value = withTiming(nextValue ? 88 : 280, { duration: 300 });
    AsyncStorage.setItem('@Auth:sidebarCollapsed', String(nextValue));
  };

  const animatedStyle = useAnimatedStyle(() => ({
    width: width.value,
  }));

  const logoOpacity = useAnimatedStyle(() => ({
    opacity: withTiming(isCollapsed ? 0 : 1),
    transform: [{ scale: withTiming(isCollapsed ? 0.8 : 1) }]
  }));

  return (
    <Animated.View 
      style={[animatedStyle, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}
      className={`h-full border-r border-white/5 bg-(--color-pos-surface) overflow-hidden flex-shrink-0`}
    >
      {/* Brand Header */}
      <View className="h-24 px-6 flex-row items-center justify-between border-b border-white/5 bg-black/10">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-2xl bg-orange-500/20 items-center justify-center mr-4 border border-orange-500/30">
            <Icon name="pizza" size={24} color="#F5A524" />
          </View>
          <Animated.View style={logoOpacity}>
            {!isCollapsed && (
              <View>
                <Text 
                  numberOfLines={1}
                  className="text-xl font-black text-white tracking-widest leading-none" 
                  style={{ fontFamily: 'Space Grotesk' }}
                >
                  POS PIZZA
                </Text>
                <Text className="text-[10px] text-orange-500 font-black tracking-widest uppercase mt-1">D Firu</Text>
              </View>
            )}
          </Animated.View>
        </View>

        {!isCompact && !isCollapsed && (
            <Pressable 
                onPress={toggleCollapse}
                className="w-8 h-8 rounded-xl bg-white/5 items-center justify-center border border-white/5"
            >
                <Icon name="chevron-left" size={16} color="#94A3B8" />
            </Pressable>
        )}
      </View>
      
      {!isCompact && isCollapsed && (
          <Pressable 
            onPress={toggleCollapse}
            className="h-10 border-b border-white/5 items-center justify-center bg-white/5"
          >
              <Icon name="chevron-right" size={16} color="#475569" />
          </Pressable>
      )}

      <SidebarContent compact={isCollapsed} onClose={onClose} />
    </Animated.View>
  );
}
