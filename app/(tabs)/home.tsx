import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, Building2, DoorOpen, QrCode, Sparkles, UserPlus } from 'lucide-react-native';

import { useAccessMemberships } from '../../src/features/onboarding/useAccessMemberships';
import { Card, CardHeader, ScreenHeader, ScreenShell } from '../../src/features/onboarding/accessUi';
import { RouteScreen } from '../../src/features/app/RouteScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { colors } from '../../src/theme/tokens';

export default function HomeTabRoute() {
  const { user } = useAppSession();
  const { activeMemberships, pendingMemberships } = useAccessMemberships(user);

  if (!user) {
    return null;
  }

  return (
    <RouteScreen>
      <ScreenShell>
        <ScreenHeader
          icon={<Sparkles size={25} color="#ffffff" />}
          title="Chivo AI"
          body="Turn real classroom teaching into clear summaries, quizzes, flashcards, and personal study."
        />

        <View style={styles.grid}>
          <Card>
            <CardHeader icon={<DoorOpen size={20} color={colors.teal} />} title="Open schools" />
            <Text style={styles.cardBody}>
              {activeMemberships.length
                ? `${activeMemberships.length} active school${activeMemberships.length === 1 ? '' : 's'} ready.`
                : 'Create, join, or request access to a school workspace.'}
            </Text>
            <ActionButton label="My schools" icon={<Building2 size={17} color="#ffffff" />} onPress={() => router.push('/school/my-school' as never)} />
          </Card>

          <Card>
            <CardHeader icon={<BookOpen size={20} color={colors.blue} />} title="Learning flow" />
            <Text style={styles.cardBody}>
              Teachers record lessons. Students get study notes, audio, quizzes, cards, and progress insight.
            </Text>
            <ActionButton label="Learn" icon={<BookOpen size={17} color="#ffffff" />} onPress={() => router.push('/learn')} />
          </Card>

          <Card>
            <CardHeader icon={<QrCode size={20} color={colors.gold} />} title="Join a school" />
            <Text style={styles.cardBody}>Use an invite code or scan a QR code from your school.</Text>
            <ActionButton label="Join" icon={<QrCode size={17} color="#ffffff" />} onPress={() => router.push('/join')} />
          </Card>

          <Card>
            <CardHeader icon={<UserPlus size={20} color={colors.coral} />} title="Requests" />
            <Text style={styles.cardBody}>
              {pendingMemberships.length
                ? `${pendingMemberships.length} request${pendingMemberships.length === 1 ? '' : 's'} waiting.`
                : 'Ask a school admin for access when you do not have a code.'}
            </Text>
            <ActionButton label="Request" icon={<UserPlus size={17} color="#ffffff" />} onPress={() => router.push('/request')} />
          </Card>
        </View>
      </ScreenShell>
    </RouteScreen>
  );
}

function ActionButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.actionButton}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
  },
  actionButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.tealDark,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});
