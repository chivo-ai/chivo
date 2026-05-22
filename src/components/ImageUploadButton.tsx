import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { ImagePlus } from 'lucide-react-native';

import { uploadImageFromDevice } from '../services/media';
import { colors } from '../theme/tokens';

type ImageUploadButtonProps = {
  label: string;
  pathPrefix: string;
  onUploaded: (url: string) => void;
  onError?: (message: string) => void;
};

export function ImageUploadButton({ label, pathPrefix, onUploaded, onError }: ImageUploadButtonProps) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    setUploading(true);
    try {
      const url = await uploadImageFromDevice(pathPrefix);
      onUploaded(url);
    } catch (caught) {
      onError?.(caught instanceof Error ? caught.message : 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Pressable disabled={uploading} onPress={handleUpload} style={[styles.button, uploading && styles.disabled]}>
      {uploading ? (
        <ActivityIndicator color={colors.tealDark} />
      ) : (
        <>
          <ImagePlus size={16} color={colors.tealDark} />
          <Text style={styles.text}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softTeal,
    borderWidth: 1,
    borderColor: '#d4e8df',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
  },
});
