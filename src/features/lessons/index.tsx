import { LessonWorkspace } from './LessonWorkspace';
import { SchoolSetupState } from '../../services/school';
import { ActiveSchoolMembership } from '../../types';

type LessonsRouteScreenProps = {
  membership: ActiveSchoolMembership;
  setup: SchoolSetupState;
  mode: 'learn' | 'teach';
  initialClassId?: string | null;
  initialLessonId?: string | null;
  onWorkspaceChanged: () => void | Promise<void>;
};

export function LessonsRouteScreen({
  membership,
  setup,
  mode,
  initialClassId,
  initialLessonId,
  onWorkspaceChanged,
}: LessonsRouteScreenProps) {
  return (
    <LessonWorkspace
      membership={membership}
      setup={setup}
      mode={mode}
      initialClassId={initialClassId}
      initialLessonId={initialLessonId}
      onLessonsChanged={onWorkspaceChanged}
    />
  );
}

export default LessonsRouteScreen;
