import { StyleSheet, Text } from 'react-native';
import { Users } from 'lucide-react-native';

import { Card, ScreenHeader, ScreenShell } from '../accessUi';
import { colors } from '../../../theme/tokens';

export function AccessCrewsScreen() {
  return (
    <ScreenShell>
      <ScreenHeader
        icon={<Users size={25} color="#ffffff" />}
        title="Crews"
        body="Study groups connected to your schools will appear here."
      />

      <Card>
        <Text style={styles.cardTitle}>No crews yet</Text>
        <Text style={styles.cardBody}>
          Crews will let students study together without mixing unrelated schools or classes.
        </Text>
      </Card>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
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
