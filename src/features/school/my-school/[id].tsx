import { SchoolWorkspaceScreen } from '../SchoolWorkspaceScreen';
import { ActiveSchoolMembership } from '../../../types';

type MySchoolRouteScreenProps = {
  membership: ActiveSchoolMembership;
  onSwitchSchool: () => void;
};

export function MySchoolRouteScreen({ membership, onSwitchSchool }: MySchoolRouteScreenProps) {
  return <SchoolWorkspaceScreen membership={membership} onSwitchSchool={onSwitchSchool} />;
}

export default MySchoolRouteScreen;
