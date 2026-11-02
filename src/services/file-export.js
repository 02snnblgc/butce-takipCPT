import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { downloadBlob } from './utils.js';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Dosya içeriği hazırlanamadı.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Android'de dosyayı uygulama önbelleğine yazar ve Android paylaşım ekranını açar.
 * Web önizlemesinde standart tarayıcı indirmesini kullanır.
 */
export async function exportFile(blob, filename, mimeType = 'application/octet-stream') {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, filename);
    return;
  }
  const data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: filename,
    data,
    directory: Directory.Cache,
    recursive: true
  });
  await Share.share({
    title: filename,
    text: `${filename} dosyasını kaydedin veya paylaşın.`,
    url: result.uri,
    dialogTitle: 'Dosyayı dışa aktar'
  });
}
