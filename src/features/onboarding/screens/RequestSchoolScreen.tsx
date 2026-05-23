import { StyleSheet, Text, View } from 'react-native';
import { UserPlus } from 'lucide-react-native';

import { SchoolMembershipRole } from '../../../types';
import { colors } from '../../../theme/tokens';
import { AccessSubmitting, formatRole, requestRoles } from '../accessTypes';
import { Card, ChoicePill, Field, ScreenHeader, ScreenShell, SubmitButton } from '../accessUi';

type RequestSchoolScreenProps = {
  schoolCode: string;
  requestRole: SchoolMembershipRole;
  requestMessage: string;
  submitting: AccessSubmitting;
  onChangeSchoolCode: (value: string) => void;
  onChangeRole: (value: SchoolMembershipRole) => void;
  onChangeMessage: (value: string) => void;
  onRequest: () => void;
};

export function RequestSchoolScreen({
  schoolCode,
  requestRole,
  requestMessage,
  submitting,
  onChangeSchoolCode,
  onChangeRole,
  onChangeMessage,
  onRequest,
}: RequestSchoolScreenProps) {
  return (
    <ScreenShell>
      <ScreenHeader
        icon={<UserPlus size={25} color="#ffffff" />}
        title="Request access"
        body="Ask a school admin for entry when you do not have an invite code."
      />

      <Card>
        <Text style={styles.cardBody}>Use the school code from the school profile.</Text>
        <Field
          label="School code"
          value={schoolCode}
          onChangeText={(value) => onChangeSchoolCode(value.toLowerCase())}
          placeholder="bestcity-academy"
          autoCapitalize="none"
        />
        <View style={styles.pillRow}>
          {requestRoles.map((role) => (
            <ChoicePill
              key={role}
              selected={role === requestRole}
              label={formatRole(role)}
              onPress={() => onChangeRole(role)}
            />
          ))}
        </View>
        <Field
          label="Message"
          value={requestMessage}
          onChangeText={onChangeMessage}
          placeholder="Your class, child name, or staff note"
        />
        <SubmitButton label="Send request" loading={submitting === 'request'} onPress={onRequest} disabled={!schoolCode.trim()} />
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 21,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
