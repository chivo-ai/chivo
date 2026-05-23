import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { AccessAccountScreen } from '../../src/features/onboarding/screens/AccessAccountScreen';
import { RouteScreen } from '../../src/features/shell/RouteScreen';
import { useAppSession } from '../../src/features/shell/AppSessionProvider';
import { supabase } from '../../src/lib/supabase';

export default function AccountRoute() {
  const { user } = useAppSession();
  const [profileName, setProfileName] = useState(user?.user_metadata?.full_name ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState('English');
  const [learningLevel, setLearningLevel] = useState('balanced');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileStickerKey, setProfileStickerKey] = useState('spark');
  const [submitting, setSubmitting] = useState<'request' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      return;
    }

    (supabase as any)
      .from('profiles')
      .select('full_name, preferred_language, learning_level, avatar_url, sticker_key')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: profileError }: any) => {
        if (profileError) {
          setError(profileError.message);
          return;
        }

        if (data) {
          setProfileName(data.full_name ?? '');
          setPreferredLanguage(data.preferred_language ?? 'English');
          setLearningLevel(data.learning_level ?? 'balanced');
          setProfileAvatarUrl(data.avatar_url ?? '');
          setProfileStickerKey(data.sticker_key ?? 'spark');
        }
      });
  }, [user?.id]);

  async function saveProfile() {
    if (!supabase || !user) {
      return;
    }

    setError(null);
    setMessage(null);

    if (!profileName.trim()) {
      setError('Full name is required.');
      return;
    }

    setSubmitting('request');
    try {
      const { error: updateError } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: profileName.trim(),
          preferred_language: preferredLanguage.trim() || 'English',
          learning_level: learningLevel.trim() || 'balanced',
          avatar_url: profileAvatarUrl.trim() || null,
          sticker_key: profileStickerKey,
        })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage('Account updated.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update account.');
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
      {message ? <Text>{message}</Text> : null}
      <AccessAccountScreen
        user={user}
        values={{ profileName, preferredLanguage, learningLevel }}
        imageValues={{ profileAvatarUrl, profileStickerKey }}
        imagePathPrefix={`profiles/${user.id}`}
        submitting={submitting}
        onChange={{ setProfileName, setPreferredLanguage, setLearningLevel }}
        onImageChange={{ setProfileAvatarUrl, setProfileStickerKey }}
        onError={setError}
        onSave={saveProfile}
      />
    </RouteScreen>
  );
}
