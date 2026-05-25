import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { CreateSchoolScreen } from '../../src/features/onboarding/screens/CreateSchoolScreen';
import { membershipFromCreateResult } from '../../src/features/onboarding/accessTypes';
import { RouteScreen } from '../../src/features/app/RouteScreen';
import { useAppSession } from '../../src/features/app/AppSessionProvider';
import { createSchool } from '../../src/services/auth';
import { fetchSchoolCreationAvailability, SchoolCreationAvailability } from '../../src/services/platform';

export default function CreateSchoolRoute() {
  const { user, setActiveMembership } = useAppSession();
  const [schoolName, setSchoolName] = useState('');
  const [schoolUsername, setSchoolUsername] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');
  const [schoolBannerUrl, setSchoolBannerUrl] = useState('');
  const [schoolStickerKey, setSchoolStickerKey] = useState('spark');
  const [submitting, setSubmitting] = useState<'create' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [schoolCreation, setSchoolCreation] = useState<SchoolCreationAvailability>({
    enabled: true,
    message: null,
  });

  useEffect(() => {
    let active = true;

    fetchSchoolCreationAvailability()
      .then((availability) => {
        if (active) {
          setSchoolCreation(availability);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Could not check school creation access.');
        }
      })
      .finally(() => {
        if (active) {
          setCheckingAvailability(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreate() {
    setError(null);

    if (!schoolCreation.enabled) {
      setError(schoolCreation.message ?? 'School creation is paused.');
      return;
    }

    if (!schoolName.trim()) {
      setError('School name is required.');
      return;
    }

    setSubmitting('create');
    try {
      const result = await createSchool({
        name: schoolName,
        username: schoolUsername,
        country,
        city,
        logoUrl: schoolLogoUrl,
        bannerUrl: schoolBannerUrl,
        stickerKey: schoolStickerKey,
      });
      const membership = membershipFromCreateResult(result);
      if (membership) {
        await setActiveMembership(membership);
        router.replace(`/school/my-school/${membership.school.slug}` as never);
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
        values={{ schoolName, schoolUsername, country, city, schoolLogoUrl, schoolBannerUrl, schoolStickerKey }}
        submitting={submitting}
        checkingAvailability={checkingAvailability}
        creationDisabledReason={schoolCreation.enabled ? null : schoolCreation.message ?? 'School creation is paused.'}
        onChange={{ setSchoolName, setSchoolUsername, setCountry, setCity, setSchoolLogoUrl, setSchoolBannerUrl, setSchoolStickerKey }}
        onCreate={handleCreate}
        onError={setError}
      />
    </RouteScreen>
  );
}
