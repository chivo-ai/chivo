import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, CheckCircle2, Clock3, DoorOpen, UserPlus } from 'lucide-react-native';

import { LessonWorkspace } from '../lessons/LessonWorkspace';
import { ClassRow, SchoolSetupState, requestClassAccess } from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type LearnerScreenProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  onWorkspaceChanged: () => void | Promise<void>;
};

export function LearnerScreen({ membership, setup, onWorkspaceChanged }: LearnerScreenProps) {
  const [savingClassId, setSavingClassId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isStaff = ['owner', 'admin', 'teacher'].includes(membership.role);

  const joinedClassIds = useMemo(
    () =>
      new Set(
        setup.classMemberships
          .filter((item) => item.school_membership_id === membership.id && item.status === 'active')
          .map((item) => item.class_id)
      ),
    [membership.id, setup.classMemberships]
  );

  const pendingClassIds = useMemo(
    () =>
      new Set(
        setup.joinRequests
          .filter((request) => request.status === 'review' && request.class_id)
          .map((request) => request.class_id as string)
      ),
    [setup.joinRequests]
  );

  async function requestClass(schoolClass: ClassRow) {
    setSavingClassId(schoolClass.id);
    setError(null);
    setMessage(null);

    try {
      const result = await requestClassAccess({
        schoolId: membership.schoolId,
        classId: schoolClass.id,
        schoolMembershipId: membership.id,
        requestedRole: membership.role === 'guardian' ? 'guardian' : 'student',
        message: `Request to join ${schoolClass.name}`,
      });

      setMessage(result.alreadyRequested ? 'Request already sent.' : result.alreadyMember ? 'Class already joined.' : 'Class request sent.');
      await onWorkspaceChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send class request.');
    } finally {
      setSavingClassId(null);
    }
  }

  return (
    <View style={styles.stack}>
      {!isStaff ? (
        <ClassAccessPanel
          classes={setup.classes}
          joinedClassIds={joinedClassIds}
          pendingClassIds={pendingClassIds}
          savingClassId={savingClassId}
          message={message}
          error={error}
          onRequest={requestClass}
        />
      ) : null}

      <LessonWorkspace membership={membership} setup={setup} onLessonsChanged={onWorkspaceChanged} mode="learn" />
    </View>
  );
}

function ClassAccessPanel({
  classes,
  joinedClassIds,
  pendingClassIds,
  savingClassId,
  message,
  error,
  onRequest,
}: {
  classes: ClassRow[];
  joinedClassIds: Set<string>;
  pendingClassIds: Set<string>;
  savingClassId: string | null;
  message: string | null;
  error: string | null;
  onRequest: (schoolClass: ClassRow) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>
          <DoorOpen size={22} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.panelTitle}>Class access</Text>
          <Text style={styles.panelText}>Join a class to see lessons, quizzes, cards, and your study work.</Text>
        </View>
      </View>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.classGrid}>
        {classes.length ? (
          classes.map((schoolClass) => {
            const joined = joinedClassIds.has(schoolClass.id);
            const pending = pendingClassIds.has(schoolClass.id);
            const loading = savingClassId === schoolClass.id;

            return (
              <View key={schoolClass.id} style={styles.classCard}>
                <View style={styles.classIcon}>
                  <BookOpen size={20} color={colors.tealDark} />
                </View>
                <View style={styles.flexText}>
                  <Text style={styles.classTitle}>{schoolClass.name}</Text>
                  <Text style={styles.classMeta}>{schoolClass.grade_level ?? 'Grade not set'}</Text>
                </View>
                <ClassStatus joined={joined} pending={pending} />
                {!joined && !pending ? (
                  <Pressable disabled={loading} onPress={() => onRequest(schoolClass)} style={styles.requestButton}>
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <UserPlus size={16} color="#ffffff" />
                        <Text style={styles.requestButtonText}>Request</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.panelText}>Classes will appear when the school adds them.</Text>
        )}
      </View>
    </View>
  );
}

function ClassStatus({ joined, pending }: { joined: boolean; pending: boolean }) {
  if (joined) {
    return (
      <View style={styles.statusPillActive}>
        <CheckCircle2 size={14} color="#ffffff" />
        <Text style={styles.statusPillTextActive}>Joined</Text>
      </View>
    );
  }

  if (pending) {
    return (
      <View style={styles.statusPill}>
        <Clock3 size={14} color={colors.tealDark} />
        <Text style={styles.statusPillText}>Pending</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  panel: {
    borderRadius: 24,
    padding: 16,
    gap: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#16251f',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  panelIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDark,
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
  },
  panelText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  classCard: {
    minWidth: 230,
    flex: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  classIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  classTitle: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
  },
  classMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
  },
  requestButton: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  requestButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.softGold,
  },
  statusPillActive: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.tealDark,
  },
  statusPillText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '900',
  },
  statusPillTextActive: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '900',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
  },
});
