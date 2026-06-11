import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { JoinSchoolScreen } from '../../src/features/onboarding/screens/JoinSchoolScreen';
import { membershipFromInviteResult } from '../../src/features/onboarding/accessTypes';
import { RouteScreen } from '../../src/features/app/RouteScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { acceptInvite } from '../../src/services/auth';

export default function JoinSchoolRoute() {
  const { setActiveMembership } = useAppSession();
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState<'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setError(null);

    if (!inviteCode.trim()) {
      setError('Enter an invite or class code.');
      return;
    }

    setSubmitting('join');
    try {
      const result = await acceptInvite(inviteCode);
      const membership = membershipFromInviteResult(result);
      if (membership) {
        await setActiveMembership(membership);
        router.replace('/learn');
      } else {
        router.replace('/discover');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not use that code.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <RouteScreen>
      {error ? <Text>{error}</Text> : null}
      <JoinSchoolScreen
        inviteCode={inviteCode}
        submitting={submitting}
        onChangeInviteCode={setInviteCode}
        onJoin={handleJoin}
      />
    </RouteScreen>
  );
}
