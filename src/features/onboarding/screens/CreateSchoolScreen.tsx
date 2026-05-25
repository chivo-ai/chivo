import { StyleSheet, Text, View } from 'react-native';
import { Building2 } from 'lucide-react-native';

import { colors } from '../../../theme/tokens';
import { AccessSchoolValues, AccessSubmitting } from '../accessTypes';
import {
  Card,
  Field,
  IdentityMark,
  ScreenHeader,
  ScreenShell,
  StickerPicker,
  SubmitButton,
  UploadPair,
} from '../accessUi';

type CreateSchoolScreenProps = {
  userId: string;
  values: AccessSchoolValues;
  submitting: AccessSubmitting;
  creationDisabledReason?: string | null;
  checkingAvailability?: boolean;
  onChange: {
    setSchoolName: (value: string) => void;
    setSchoolUsername: (value: string) => void;
    setCountry: (value: string) => void;
    setCity: (value: string) => void;
    setSchoolLogoUrl: (value: string) => void;
    setSchoolBannerUrl: (value: string) => void;
    setSchoolStickerKey: (value: string) => void;
  };
  onCreate: () => void;
  onError: (message: string) => void;
};

export function CreateSchoolScreen({
  userId,
  values,
  submitting,
  creationDisabledReason,
  checkingAvailability,
  onChange,
  onCreate,
  onError,
}: CreateSchoolScreenProps) {
  const creationDisabled = Boolean(creationDisabledReason) || Boolean(checkingAvailability);

  return (
    <ScreenShell>
      <ScreenHeader
        icon={<Building2 size={25} color="#ffffff" />}
        title="Create school"
        body="Start a private school workspace for people, classes, subjects, lessons, and study materials."
      />

      <Card>
        {creationDisabledReason ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>School creation is paused</Text>
            <Text style={styles.noticeBody}>{creationDisabledReason}</Text>
          </View>
        ) : null}
        <Field label="School name" value={values.schoolName} onChangeText={onChange.setSchoolName} placeholder="BestCity Academy" />
        <Field label="School username" value={values.schoolUsername} onChangeText={onChange.setSchoolUsername} placeholder="bestcity-academy" autoCapitalize="none" />
        <View style={styles.formRow}>
          <View style={styles.fieldFlex}>
            <Field label="Country" value={values.country} onChangeText={onChange.setCountry} placeholder="Nigeria" />
          </View>
          <View style={styles.fieldFlex}>
            <Field label="City" value={values.city} onChangeText={onChange.setCity} placeholder="Lagos" />
          </View>
        </View>
        <View style={styles.identityPreview}>
          <IdentityMark imageUrl={values.schoolLogoUrl} stickerKey={values.schoolStickerKey} label={values.schoolName || 'School'} size="large" />
          <View style={styles.flexText}>
            <Text style={styles.recordTitle}>{values.schoolName || 'School identity'}</Text>
            <Text style={styles.recordMeta}>Add a logo, banner, or visual marker for the school.</Text>
          </View>
        </View>
        <UploadPair
          logoUrl={values.schoolLogoUrl}
          bannerUrl={values.schoolBannerUrl}
          logoPrefix={`drafts/${userId}/school-logo`}
          bannerPrefix={`drafts/${userId}/school-banner`}
          onLogoUploaded={onChange.setSchoolLogoUrl}
          onBannerUploaded={onChange.setSchoolBannerUrl}
          onError={onError}
        />
        <StickerPicker selectedKey={values.schoolStickerKey} onSelect={onChange.setSchoolStickerKey} />
        <SubmitButton
          label={checkingAvailability ? 'Checking access' : 'Create school'}
          loading={submitting === 'create'}
          disabled={creationDisabled}
          onPress={onCreate}
        />
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldFlex: {
    flex: 1,
    minWidth: 180,
  },
  identityPreview: {
    minHeight: 96,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  recordTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  recordMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  noticeCard: {
    borderRadius: 18,
    padding: 14,
    gap: 5,
    backgroundColor: colors.softGold,
    borderWidth: 1,
    borderColor: '#efd27f',
  },
  noticeTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
  },
  noticeBody: {
    color: '#4b4030',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
});
