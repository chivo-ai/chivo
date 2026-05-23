import { useState } from 'react';
import { Text } from 'react-native';

import { RequestSchoolScreen } from '../../src/features/onboarding/screens/RequestSchoolScreen';
import { RouteScreen } from '../../src/features/shell/RouteScreen';
import { requestSchoolAccess } from '../../src/services/auth';
import { SchoolMembershipRole } from '../../src/types';

export default function RequestSchoolRoute() {
  const [schoolCode, setSchoolCode] = useState('');
  const [requestRole, setRequestRole] = useState<SchoolMembershipRole>('student');
  const [requestMessage, setRequestMessage] = useState('');
  const [submitting, setSubmitting] = useState<'request' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRequest() {
    setError(null);
    setMessage(null);

    if (!schoolCode.trim()) {
      setError('School code is required.');
      return;
    }

    setSubmitting('request');
    try {
      await requestSchoolAccess({
        schoolCode,
        requestedRole: requestRole,
        message: requestMessage,
      });
      setMessage('Request sent to the school.');
      setSchoolCode('');
      setRequestMessage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send request.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <RouteScreen>
      {error ? <Text>{error}</Text> : null}
      {message ? <Text>{message}</Text> : null}
      <RequestSchoolScreen
        schoolCode={schoolCode}
        requestRole={requestRole}
        requestMessage={requestMessage}
        submitting={submitting}
        onChangeSchoolCode={setSchoolCode}
        onChangeRole={setRequestRole}
        onChangeMessage={setRequestMessage}
        onRequest={handleRequest}
      />
    </RouteScreen>
  );
}
