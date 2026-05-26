import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookOpen, CheckCircle2, GraduationCap, UserPlus, Users } from 'lucide-react-native';

import { LessonWorkspace } from '../lessons/LessonWorkspace';
import {
  ClassMembershipRow,
  ClassRow,
  SchoolMemberRow,
  SchoolSetupState,
  assignMemberToClass,
  removeMemberFromClass,
} from '../../services/school';
import { colors } from '../../theme/tokens';
import { ActiveSchoolMembership } from '../../types';

type TeacherScreenProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  onWorkspaceChanged: () => void | Promise<void>;
};

export function TeacherScreen({ membership, setup, onWorkspaceChanged }: TeacherScreenProps) {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageAll = membership.role === 'owner' || membership.role === 'admin';

  const manageableClasses = useMemo(
    () => classesForTeacher(setup, membership.id, canManageAll),
    [canManageAll, membership.id, setup]
  );

  useEffect(() => {
    if (selectedClassId && manageableClasses.some((schoolClass) => schoolClass.id === selectedClassId)) {
      return;
    }

    setSelectedClassId(manageableClasses[0]?.id ?? null);
  }, [manageableClasses, selectedClassId]);

  const selectedClass = manageableClasses.find((schoolClass) => schoolClass.id === selectedClassId) ?? null;
  const classMemberships = selectedClass
    ? setup.classMemberships.filter((item) => item.class_id === selectedClass.id && item.status === 'active')
    : [];
  const classMemberIds = new Set(classMemberships.map((item) => item.school_membership_id));
  const availableMembers = setup.members.filter((member) => member.status === 'active' && !classMemberIds.has(member.id));

  useEffect(() => {
    if (selectedMemberId && availableMembers.some((member) => member.id === selectedMemberId)) {
      return;
    }

    setSelectedMemberId(availableMembers[0]?.id ?? null);
  }, [availableMembers, selectedMemberId]);

  async function saveRoster(action: string, work: () => Promise<void>, success: string) {
    setSaving(action);
    setError(null);
    setMessage(null);

    try {
      await work();
      setMessage(success);
      await onWorkspaceChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update class roster.');
    } finally {
      setSaving(null);
    }
  }

  async function addMember() {
    const member = setup.members.find((item) => item.id === selectedMemberId);

    await saveRoster(
      'add-member',
      async () => {
        await assignMemberToClass({
          classId: selectedClass?.id ?? '',
          schoolMembershipId: member?.id ?? '',
          role: member?.role ?? 'student',
        });
      },
      'Class roster updated.'
    );
  }

  async function removeMember(classMembershipId: string) {
    await saveRoster(
      `remove-member-${classMembershipId}`,
      async () => {
        await removeMemberFromClass(classMembershipId);
      },
      'Member removed from class.'
    );
  }

  return (
    <View style={styles.stack}>
      <ClassRosterPanel
        classes={manageableClasses}
        selectedClassId={selectedClass?.id ?? null}
        members={setup.members}
        classMemberships={classMemberships}
        availableMembers={availableMembers}
        selectedMemberId={selectedMemberId}
        saving={saving}
        message={message}
        error={error}
        onSelectClass={setSelectedClassId}
        onSelectMember={setSelectedMemberId}
        onAddMember={addMember}
        onRemoveMember={removeMember}
      />

      <LessonWorkspace membership={membership} setup={setup} onLessonsChanged={onWorkspaceChanged} mode="teach" />
    </View>
  );
}

function ClassRosterPanel({
  classes,
  selectedClassId,
  members,
  classMemberships,
  availableMembers,
  selectedMemberId,
  saving,
  message,
  error,
  onSelectClass,
  onSelectMember,
  onAddMember,
  onRemoveMember,
}: {
  classes: ClassRow[];
  selectedClassId: string | null;
  members: SchoolMemberRow[];
  classMemberships: ClassMembershipRow[];
  availableMembers: SchoolMemberRow[];
  selectedMemberId: string | null;
  saving: string | null;
  message: string | null;
  error: string | null;
  onSelectClass: (classId: string) => void;
  onSelectMember: (memberId: string) => void;
  onAddMember: () => void;
  onRemoveMember: (classMembershipId: string) => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>
          <Users size={22} color="#ffffff" />
        </View>
        <View style={styles.flexText}>
          <Text style={styles.panelTitle}>Class roster</Text>
          <Text style={styles.panelText}>Manage the students and staff in the classes you teach.</Text>
        </View>
      </View>

      {message ? <Text style={styles.successText}>{message}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {classes.length ? (
        <>
          <View style={styles.classTabs}>
            {classes.map((schoolClass) => {
              const active = schoolClass.id === selectedClassId;

              return (
                <Pressable
                  key={schoolClass.id}
                  onPress={() => onSelectClass(schoolClass.id)}
                  style={[styles.classTab, active && styles.classTabActive]}
                >
                  <BookOpen size={16} color={active ? '#ffffff' : colors.tealDark} />
                  <Text style={[styles.classTabText, active && styles.classTabTextActive]}>{schoolClass.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.rosterGrid}>
            <View style={styles.rosterColumn}>
              <Text style={styles.columnTitle}>Members</Text>
              {classMemberships.length ? (
                classMemberships.map((classMembership) => {
                  const member = members.find((item) => item.id === classMembership.school_membership_id);

                  return (
                    <View key={classMembership.id} style={styles.memberRow}>
                      <View style={styles.memberBadge}>
                        <CheckCircle2 size={15} color={colors.tealDark} />
                      </View>
                      <View style={styles.flexText}>
                        <Text style={styles.memberName}>{member?.profiles?.full_name ?? 'Class member'}</Text>
                        <Text style={styles.memberMeta}>{formatRole(member?.role ?? classMembership.role)}</Text>
                      </View>
                      <Pressable
                        disabled={saving === `remove-member-${classMembership.id}`}
                        onPress={() => onRemoveMember(classMembership.id)}
                        style={styles.removeButton}
                      >
                        {saving === `remove-member-${classMembership.id}` ? (
                          <ActivityIndicator color={colors.tealDark} />
                        ) : (
                          <Text style={styles.removeButtonText}>Remove</Text>
                        )}
                      </Pressable>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.panelText}>No class members yet.</Text>
              )}
            </View>

            <View style={styles.rosterColumn}>
              <Text style={styles.columnTitle}>Add member</Text>
              <View style={styles.memberChoices}>
                {availableMembers.length ? (
                  availableMembers.map((member) => {
                    const active = member.id === selectedMemberId;

                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => onSelectMember(member.id)}
                        style={[styles.memberChoice, active && styles.memberChoiceActive]}
                      >
                        <GraduationCap size={15} color={active ? '#ffffff' : colors.tealDark} />
                        <Text style={[styles.memberChoiceText, active && styles.memberChoiceTextActive]}>
                          {member.profiles?.full_name ?? formatRole(member.role)}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.panelText}>All active members are already in this class.</Text>
                )}
              </View>
              <Pressable
                disabled={!selectedMemberId || saving === 'add-member'}
                onPress={onAddMember}
                style={[styles.addButton, (!selectedMemberId || saving === 'add-member') && styles.disabledButton]}
              >
                {saving === 'add-member' ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <UserPlus size={16} color="#ffffff" />
                    <Text style={styles.addButtonText}>Add to class</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.panelText}>Classes will appear here when an admin assigns you to teach.</Text>
      )}
    </View>
  );
}

function classesForTeacher(setup: SchoolSetupState, membershipId: string, canManageAll: boolean) {
  if (canManageAll) {
    return setup.classes;
  }

  const classIds = new Set<string>();

  setup.classSubjects
    .filter((item) => item.teacher_membership_id === membershipId)
    .forEach((item) => classIds.add(item.class_id));

  setup.classMemberships
    .filter((item) => item.school_membership_id === membershipId && item.status === 'active' && ['owner', 'admin', 'teacher'].includes(item.role))
    .forEach((item) => classIds.add(item.class_id));

  return setup.classes.filter((schoolClass) => classIds.has(schoolClass.id));
}

function formatRole(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  panel: {
    borderRadius: 18,
    padding: 12,
    gap: 12,
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
    gap: 10,
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
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  panelText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  classTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classTab: {
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  classTabActive: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  classTabText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '700',
  },
  classTabTextActive: {
    color: '#ffffff',
  },
  rosterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rosterColumn: {
    minWidth: 280,
    flex: 1,
    gap: 10,
  },
  columnTitle: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  memberRow: {
    minHeight: 54,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  memberBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softTeal,
  },
  memberName: {
    color: colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  memberMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
  },
  memberChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  memberChoice: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
  },
  memberChoiceActive: {
    backgroundColor: colors.ink,
  },
  memberChoiceText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '700',
  },
  memberChoiceTextActive: {
    color: '#ffffff',
  },
  addButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.tealDark,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  removeButton: {
    minHeight: 34,
    borderRadius: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softGold,
  },
  removeButtonText: {
    color: '#6f5520',
    fontSize: 12,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  successText: {
    color: colors.tealDark,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  errorText: {
    color: '#9d2e24',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
