/**
 * Web stub — browsers don't support react-native-compressor.
 * Returns the original URI unchanged; the upload still works via XHR.
 */
export async function compressVideo(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  onProgress?.(1);
  return uri;
}
