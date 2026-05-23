import { Redirect, Tabs } from 'expo-router';
import { Building2, Home, QrCode, UserCircle, UserPlus, Users } from 'lucide-react-native';

import { BootScreen } from '../../src/features/shell/BootScreen';
import { useAppSession } from '../../src/features/shell/AppSessionProvider';
import { colors } from '../../src/theme/tokens';

export default function TabsLayout() {
  const { loading, user } = useAppSession();

  if (loading) {
    return <BootScreen />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tealDark,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => <UserCircle size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Building2 size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="join"
        options={{
          title: 'Join',
          tabBarIcon: ({ color }) => <QrCode size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ color }) => <UserPlus size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crews"
        options={{
          title: 'Crews',
          tabBarIcon: ({ color }) => <Users size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
