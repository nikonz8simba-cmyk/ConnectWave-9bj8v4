/**
 * Native stub — react-native-compressor requires react-native-nitro-modules
 * which needs the New Architecture (TurboModules) native-linked in the APK.
 * Until a full native rebuild with New Arch is available, we skip JS-side
 * compression and rely on the ImagePicker's built-in videoQuality + duration
 * limits (Medium quality, max 60s) to keep files to a reasonable size.
 *
 * The upload pipeline (fetch → blob → XHR) still works correctly with the
 * original picker URI.
 */
export async function compressVideo(
  uri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Simulate instant "compression" for progress bar UX
  onProgress?.(0.5);
  await new Promise(r => setTimeout(r, 120));
  onProgress?.(1);
  return uri;
}
