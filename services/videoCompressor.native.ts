/**
 * Native (iOS / Android) implementation.
 * react-native-compressor is only available on native targets.
 */
import { Video as VideoCompressor } from 'react-native-compressor';

export async function compressVideo(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  return VideoCompressor.compress(
    uri,
    {
      compressionMethod: 'auto',
      maxSize: 1280,
      bitrate: 2_000_000,
      minimumFileSizeForCompress: 5,
    },
    (progress) => {
      onProgress?.(progress);
    }
  );
}
