import { AccessCrewsScreen } from '../../src/features/onboarding/screens/AccessCrewsScreen';
import { RouteScreen } from '../../src/features/shell/RouteScreen';

export default function CrewsRoute() {
  return (
    <RouteScreen>
      <AccessCrewsScreen />
    </RouteScreen>
  );
}
