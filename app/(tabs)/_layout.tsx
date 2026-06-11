import { Redirect, Slot, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Bell, Building2, Compass, PenLine, QrCode, ShieldCheck, Store, Trophy, UserCircle, UserPlus, Users } from 'lucide-react-native';

import { AppNavigation, AppNavItem } from '../../src/components/AppNavigation';
import { BootScreen } from '../../src/features/app/BootScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { CompanyAdminSession, fetchCurrentCompanyAdminSession } from '../../src/services/companyAdmin';
import { colors } from '../../src/theme/tokens';

type AccessRoute =
  | 'discover'
  | 'publish'
  | 'research'
  | 'marketplace'
  | 'create'
  | 'join'
  | 'request'
  | 'crews'
  | 'notifications'
  | 'account'
  | 'company';

const routeById: Record<AccessRoute, string> = {
  discover: '/discover',
  publish: '/publish',
  research: '/research',
  marketplace: '/marketplace',
  create: '/create',
  join: '/join',
  request: '/request',
  crews: '/crews',
  notifications: '/notifications',
  account: '/account',
  company: '/company',
};

const accessRoutes: AccessRoute[] = [
  'discover',
  'publish',
  'research',
  'marketplace',
  'create',
  'join',
  'request',
  'crews',
  'notifications',
  'account',
  'company',
];

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
      subtitle="Knowledge network"
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
  return firstSegment && accessRoutes.includes(firstSegment) ? firstSegment : 'discover';
}

function accessNavItems(activeId: AccessRoute, showCompanyControls: boolean): AppNavItem[] {
  const iconColor = (id: AccessRoute) => (activeId === id ? colors.brandDeep : '#d8e0ef');

  return [
    {
      id: 'discover',
      label: 'Discover',
      description: 'Knowledge feed',
      group: 'Network',
      icon: <Compass size={19} color={iconColor('discover')} />,
    },
    {
      id: 'publish',
      label: 'Publish',
      description: 'Creator studio',
      group: 'Network',
      icon: <PenLine size={19} color={iconColor('publish')} />,
    },
    {
      id: 'research',
      label: 'Research',
      description: 'Funding campaigns',
      group: 'Network',
      icon: <Trophy size={19} color={iconColor('research')} />,
    },
    {
      id: 'marketplace',
      label: 'Market',
      description: 'Ownership and fees',
      group: 'Network',
      icon: <Store size={19} color={iconColor('marketplace')} />,
    },
    {
      id: 'create',
      label: 'Schools',
      description: 'Create a school',
      group: 'Schools',
      icon: <Building2 size={19} color={iconColor('create')} />,
    },
    {
      id: 'join',
      label: 'Join',
      description: 'Use invite code',
      group: 'Schools',
      icon: <QrCode size={19} color={iconColor('join')} />,
    },
    {
      id: 'request',
      label: 'Request',
      description: 'Ask a school admin',
      group: 'Schools',
      icon: <UserPlus size={19} color={iconColor('request')} />,
    },
    {
      id: 'crews',
      label: 'Crews',
      description: 'Study groups',
      group: 'Schools',
      icon: <Users size={19} color={iconColor('crews')} />,
    },
    {
      id: 'notifications',
      label: 'Activity',
      description: 'Alerts and updates',
      group: 'Profile',
      icon: <Bell size={19} color={iconColor('notifications')} />,
    },
    {
      id: 'account',
      label: 'Profile',
      description: 'Public identity',
      group: 'Profile',
      icon: <UserCircle size={19} color={iconColor('account')} />,
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
