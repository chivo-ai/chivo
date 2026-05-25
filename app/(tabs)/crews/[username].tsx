import { useLocalSearchParams } from 'expo-router';

import { RouteScreen } from '../../../src/features/app/RouteScreen';
import { CrewRoomScreen } from '../../../src/features/crews/CrewRoomScreen';

export default function CrewRoomRoute() {
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const crewIdentifier = Array.isArray(params.username) ? params.username[0] : params.username ?? '';

  return (
    <RouteScreen>
      <CrewRoomScreen crewId={crewIdentifier} />
    </RouteScreen>
  );
}
