import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Keyboard, QrCode, ScanLine } from 'lucide-react-native';

import { colors } from '../../../theme/tokens';
import { AccessSubmitting } from '../accessTypes';
import { Card, Field, ScreenHeader, ScreenShell, SubmitButton } from '../accessUi';

type JoinSchoolScreenProps = {
  inviteCode: string;
  submitting: AccessSubmitting;
  onChangeInviteCode: (value: string) => void;
  onJoin: () => void;
};

export function JoinSchoolScreen({
  inviteCode,
  submitting,
  onChangeInviteCode,
  onJoin,
}: JoinSchoolScreenProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  async function openScanner() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
      setScannerOpen(false);
      return;
    }

    if (!permission?.granted) {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted) {
        return;
      }
    }

    setScanned(false);
    setScannerOpen(true);
  }

  function handleScanned(result: BarcodeScanningResult) {
    if (scanned) {
      return;
    }

    const code = extractInviteCode(result.data);
    setScanned(true);
    setScannerOpen(false);
    onChangeInviteCode(code.toUpperCase());
  }

  return (
    <ScreenShell>
      <ScreenHeader
        icon={<QrCode size={25} color="#ffffff" />}
        title="Join school"
        body="Use an invite code or scan a school QR code to enter the right school or class."
      />

      <Card>
        <Field
          label="Invite or class code"
          value={inviteCode}
          onChangeText={(value) => onChangeInviteCode(value.toUpperCase())}
          placeholder="STU-ABC-123"
          autoCapitalize="characters"
        />
        <View style={styles.actionRow}>
          <Pressable onPress={openScanner} style={styles.scanButton}>
            <ScanLine size={17} color={colors.brandDeep} />
            <Text style={styles.scanButtonText} numberOfLines={1}>Scan QR</Text>
          </Pressable>
          <Pressable onPress={() => setScannerOpen(false)} style={styles.manualButton}>
            <Keyboard size={17} color={colors.brandDeep} />
            <Text style={styles.manualButtonText} numberOfLines={1}>Type code</Text>
          </Pressable>
        </View>

        {scannerOpen ? (
          <View style={styles.scannerBox}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleScanned}
            />
            <View style={styles.scanFrame} />
          </View>
        ) : (
          <Text style={styles.cardBody} numberOfLines={2}>QR codes can contain a plain invite code or a link with a code.</Text>
        )}

        <SubmitButton label="Use code" loading={submitting === 'join'} onPress={onJoin} disabled={!inviteCode.trim()} />
      </Card>
    </ScreenShell>
  );
}

function extractInviteCode(value: string) {
  const raw = value.trim();

  try {
    const url = new URL(raw);
    const queryCode = url.searchParams.get('code') ?? url.searchParams.get('invite') ?? url.searchParams.get('inviteCode');
    if (queryCode) {
      return queryCode.trim();
    }

    const lastSegment = url.pathname.split('/').filter(Boolean).pop();
    if (lastSegment) {
      return lastSegment.trim();
    }
  } catch {
    // Plain codes are expected.
  }

  const inviteMatch = raw.match(/[a-z]{3}-[a-z0-9]{3}-[a-z0-9]{3}/i);
  return inviteMatch?.[0] ?? raw;
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scanButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
  },
  scanButtonText: {
    color: colors.brandDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  manualButton: {
    minHeight: 42,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
  },
  manualButtonText: {
    color: colors.brandDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  scannerBox: {
    height: 202,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.brandDeep,
  },
  camera: {
    flex: 1,
  },
  scanFrame: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: 74,
    bottom: 74,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.brandGlow,
  },
  cardBody: {
    color: '#33413b',
    fontSize: 14,
    lineHeight: 19,
  },
});
