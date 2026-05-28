import { Redirect, Slot, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Bell, Building2, Home, QrCode, ShieldCheck, UserCircle, UserPlus, Users } from 'lucide-react-native';

import { AppNavigation, AppNavItem } from '../../src/components/AppNavigation';
import { BootScreen } from '../../src/features/app/BootScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { CompanyAdminSession, fetchCurrentCompanyAdminSession } from '../../src/services/companyAdmin';
import { colors } from '../../src/theme/tokens';

type AccessRoute = 'home' | 'notifications' | 'account' | 'create' | 'join' | 'request' | 'crews' | 'company';

const routeById: Record<AccessRoute, string> = {
  home: '/home',
  notifications: '/notifications',
  account: '/account',
  create: '/create',
  join: '/join',
  request: '/request',
  crews: '/crews',
  company: '/company',
};

const accessRoutes: AccessRoute[] = ['home', 'notifications', 'account', 'create', 'join', 'request', 'crews', 'company'];

export default function TabsLayout() {
  const pathname = usePathname();
  const { loading, user } = useAppSession();
  const [companySession, setCompanySession] = useState<CompanyAdminSession | null>(null);
  const activeId = activeRouteFromPath(pathname);
  const items = accessNavItems(activeId, Boolean(companySession?.isActive));

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setCompanySession(null);
      return;
    }

    fetchCurrentCompanyAdminSession()
      .then((session) => {
        if (isMounted) {
          setCompanySession(session);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCompanySession(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (loading) {
    return <BootScreen />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <AppNavigation
      title="Chivo AI"
      subtitle="Schools, crews, account"
      items={items}
      activeId={activeId}
      onSelect={(id) => router.push(routeById[id as AccessRoute] as any)}
    >
      <Slot />
    </AppNavigation>
  );
}

function activeRouteFromPath(pathname: string): AccessRoute {
  const firstSegment = pathname.split('/').filter(Boolean)[0] as AccessRoute | undefined;
  return firstSegment && accessRoutes.includes(firstSegment) ? firstSegment : 'home';
}

function accessNavItems(activeId: AccessRoute, showCompanyControls: boolean): AppNavItem[] {
  const iconColor = (id: AccessRoute) => (activeId === id ? colors.brandDeep : '#d8e0ef');

  return [
    {
      id: 'home',
      label: 'Home',
      description: 'Schools and access',
      group: 'Access',
      icon: <Home size={19} color={iconColor('home')} />,
    },
    {
      id: 'notifications',
      label: 'Activity',
      description: 'Alerts and updates',
      group: 'Access',
      icon: <Bell size={19} color={iconColor('notifications')} />,
    },
    {
      id: 'account',
      label: 'Account',
      description: 'Personal profile',
      group: 'Access',
      icon: <UserCircle size={19} color={iconColor('account')} />,
    },
    {
      id: 'create',
      label: 'Create',
      description: 'Start a school',
      group: 'School',
      icon: <Building2 size={19} color={iconColor('create')} />,
    },
    {
      id: 'join',
      label: 'Join',
      description: 'Use invite code',
      group: 'School',
      icon: <QrCode size={19} color={iconColor('join')} />,
    },
    {
      id: 'request',
      label: 'Request',
      description: 'Ask a school admin',
      group: 'School',
      icon: <UserPlus size={19} color={iconColor('request')} />,
    },
    {
      id: 'crews',
      label: 'Crews',
      description: 'Study groups',
      group: 'Study',
      icon: <Users size={19} color={iconColor('crews')} />,
    },
    {
      id: 'company',
      label: 'Control',
      description: 'Company authority',
      group: 'Company',
      visible: showCompanyControls,
      icon: <ShieldCheck size={19} color={iconColor('company')} />,
    },
  ];
}
