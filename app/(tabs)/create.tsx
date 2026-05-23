import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { CreateSchoolScreen } from '../../src/features/onboarding/screens/CreateSchoolScreen';
import { membershipFromCreateResult } from '../../src/features/onboarding/accessTypes';
import { RouteScreen } from '../../src/features/shell/RouteScreen';
import { useAppSession } from '../../src/features/shell/AppSessionProvider';
import { createSchool } from '../../src/services/auth';

export default function CreateSchoolRoute() {
  const { user, setActiveMembership } = useAppSession();
  const [schoolName, setSchoolName] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');
  const [schoolBannerUrl, setSchoolBannerUrl] = useState('');
  const [schoolStickerKey, setSchoolStickerKey] = useState('spark');
  const [submitting, setSubmitting] = useState<'create' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);

    if (!schoolName.trim()) {
      setError('School name is required.');
      return;
    }

    setSubmitting('create');
    try {
      const result = await createSchool({
        name: schoolName,
        country,
        city,
        logoUrl: schoolLogoUrl,
        bannerUrl: schoolBannerUrl,
        stickerKey: schoolStickerKey,
      });
      const membership = membershipFromCreateResult(result);
      if (membership) {
        await setActiveMembership(membership);
        router.replace('/admin');
      } else {
        router.replace('/home');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create school.');
    } finally {
      setSubmitting(null);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <RouteScreen>
      {error ? <Text>{error}</Text> : null}
      <CreateSchoolScreen
        userId={user.id}
        values={{ schoolName, country, city, schoolLogoUrl, schoolBannerUrl, schoolStickerKey }}
        submitting={submitting}
        onChange={{ setSchoolName, setCountry, setCity, setSchoolLogoUrl, setSchoolBannerUrl, setSchoolStickerKey }}
        onCreate={handleCreate}
        onError={setError}
      />
    </RouteScreen>
  );
}
