import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
        <ActivityIndicator color={colors.brandDeep} />
      ) : (
        <>
          <View style={styles.iconBox}>
            <ImagePlus size={16} color={colors.brandDeep} />
          </View>
          <Text style={styles.text} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 46,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.softBlue,
    borderWidth: 1,
    borderColor: '#c7d7ff',
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dce5f2',
  },
  disabled: {
    opacity: 0.55,
  },
  text: {
    flexShrink: 1,
    color: colors.brandDeep,
    fontSize: 13,
    fontWeight: '800',
  },
});
