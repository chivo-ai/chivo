import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../lib/supabase';

const mediaBucket = 'chivo-media';

function client() {
  if (!supabase) {
    throw new Error('Media upload is not available right now.');
  }

  return supabase;
}

export async function uploadImageFromDevice(pathPrefix: string) {
  const image = Platform.OS === 'web' ? await chooseWebImage() : await chooseNativeImage();
  const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${image.extension}`;
  const { error } = await client().storage.from(mediaBucket).upload(path, image.file, {
    contentType: image.contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  const { data } = client().storage.from(mediaBucket).getPublicUrl(path);
  return data.publicUrl;
}

type UploadableImage = {
  file: File | ArrayBuffer;
  extension: string;
  contentType: string;
};

function chooseWebImage(): Promise<UploadableImage> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp,image/gif';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No image selected.'));
        return;
      }

      resolve({
        file,
        extension: getExtension(file.name, file.type),
        contentType: file.type || 'image/jpeg',
      });
    };

    input.click();
  });
}

async function chooseNativeImage(): Promise<UploadableImage> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo access is needed to upload an image.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.86,
  });

  if (result.canceled || !result.assets[0]) {
    throw new Error('No image selected.');
  }

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const file = await response.arrayBuffer();
  const contentType = asset.mimeType || 'image/jpeg';

  return {
    file,
    extension: getExtension(asset.fileName, contentType),
    contentType,
  };
}

function getExtension(fileName: string | null | undefined, contentType: string) {
  const fromName = fileName?.split('.').pop()?.toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
    return fromName;
  }

  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  if (contentType.includes('gif')) {
    return 'gif';
  }

  return 'jpg';
}
