import { User } from '@supabase/supabase-js';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserCircle } from 'lucide-react-native';

import { colors } from '../../../theme/tokens';
import { AccessProfileImageValues, AccessProfileValues, AccessSubmitting } from '../accessTypes';
import { Card, Field, IdentityMark, ScreenHeader, ScreenShell, StickerPicker, SubmitButton } from '../accessUi';
import { ImageUploadButton } from '../../../components/ImageUploadButton';

type AccessAccountScreenProps = {
  user: User;
  values: AccessProfileValues;
  imageValues: AccessProfileImageValues;
  imagePathPrefix: string;
  submitting: AccessSubmitting;
  onChange: {
    setProfileName: (value: string) => void;
    setPreferredLanguage: (value: string) => void;
    setLearningLevel: (value: string) => void;
  };
  onImageChange: {
    setProfileAvatarUrl: (value: string) => void;
    setProfileStickerKey: (value: string) => void;
  };
  onError: (message: string) => void;
  onSave: () => void;
};

export function AccessAccountScreen({
  user,
  values,
  imageValues,
  imagePathPrefix,
  submitting,
  onChange,
  onImageChange,
  onError,
  onSave,
}: AccessAccountScreenProps) {
  return (
    <ScreenShell>
      <ScreenHeader
        icon={<UserCircle size={25} color="#ffffff" />}
        title="Account"
        body="Manage the personal profile schools will see when you join, learn, or teach."
      />

      <Card>
        <View style={styles.accountHeader}>
          <IdentityMark
            imageUrl={imageValues.profileAvatarUrl}
            stickerKey={imageValues.profileStickerKey}
            label={values.profileName || user.email || 'Account'}
            size="large"
          />
          <View style={styles.flexText}>
            <Text style={styles.recordTitle}>{values.profileName || 'Your profile'}</Text>
            <Text style={styles.recordMeta}>{user.email}</Text>
          </View>
        </View>
        <Field label="Full name" value={values.profileName} onChangeText={onChange.setProfileName} placeholder="Your name" />
        <View style={styles.formRow}>
          <View style={styles.fieldFlex}>
            <Field label="Preferred language" value={values.preferredLanguage} onChangeText={onChange.setPreferredLanguage} placeholder="English" />
          </View>
          <View style={styles.fieldFlex}>
            <Field label="Learning level" value={values.learningLevel} onChangeText={onChange.setLearningLevel} placeholder="balanced" />
          </View>
        </View>
        <ImageUploadButton
          label={imageValues.profileAvatarUrl ? 'Replace profile image' : 'Upload profile image'}
          pathPrefix={imagePathPrefix}
          onUploaded={onImageChange.setProfileAvatarUrl}
          onError={onError}
        />
        <StickerPicker selectedKey={imageValues.profileStickerKey} onSelect={onImageChange.setProfileStickerKey} />
        <SubmitButton label="Save account" loading={submitting === 'request'} onPress={onSave} />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Access</Text>
        <Text style={styles.cardBody}>
          Your account is separate from school access. Schools decide which classes, lessons, crews, and admin tools this account can use.
        </Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  accountHeader: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldFlex: {
    flex: 1,
    minWidth: 180,
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 19,
  },
});
