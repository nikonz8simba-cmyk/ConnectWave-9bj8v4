import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Avatar } from '@/components/ui/Avatar';
import { MentionInput } from '@/components/ui/MentionInput';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_HEIGHT = Math.min(SCREEN_WIDTH * 0.85, 360);

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_TAGS = [
  { label: '🎵 Música', id: 'music' },
  { label: '📸 Fotos', id: 'photos' },
  { label: '💡 Ideas', id: 'ideas' },
  { label: '🚀 Tech', id: 'tech' },
  { label: '🌊 Vibes', id: 'vibes' },
  { label: '❤️ Amor', id: 'love' },
  { label: '🎨 Arte', id: 'art' },
  { label: '🌍 Travel', id: 'travel' },
];

const FILTERS = [
  { id: 'none', label: 'Original', tint: null as string | null },
  { id: 'warm', label: 'Cálido', tint: 'rgba(255,160,80,0.28)' },
  { id: 'cool', label: 'Frío', tint: 'rgba(80,160,255,0.28)' },
  { id: 'vintage', label: 'Vintage', tint: 'rgba(180,130,90,0.32)' },
  { id: 'fade', label: 'Fade', tint: 'rgba(210,210,210,0.28)' },
  { id: 'drama', label: 'Drama', tint: 'rgba(30,0,60,0.35)' },
  { id: 'golden', label: 'Golden', tint: 'rgba(255,210,0,0.22)' },
];

const AUDIENCE_OPTIONS = [
  { id: 'public', label: 'Todos', icon: 'earth' as const },
  { id: 'followers', label: 'Seguidores', icon: 'people' as const },
  { id: 'private', label: 'Solo yo', icon: 'lock-closed' as const },
];

const MAX_CHARS = 280;

// ─── Types ────────────────────────────────────────────────────────────────────

type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  mimeType?: string;
  /** Thumbnail URI provided by the picker for videos (Android/iOS) */
  thumbnailUri?: string;
};

type LocationInfo = {
  latitude: number;
  longitude: number;
  placeName: string;
};

type UploadProgressInfo = {
  percentage: number;
  uploadedBytes: number;
  totalBytes: number;
};

// ─── VideoPreview ─────────────────────────────────────────────────────────────
// Uses expo-video with a static thumbnail fallback for content:// URIs on Android
// where the player may fail to initialise before the stream is ready.

function VideoPreview({ uri, thumbnailUri }: { uri: string; thumbnailUri?: string }) {
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);

  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    try {
      p.play();
      setPlayerReady(true);
    } catch {
      setPlayerError(true);
    }
  });

  // If the player has an error or hasn't loaded, show thumbnail / placeholder
  if (playerError) {
    return (
      <View style={[styles.mediaPreviewImage, videoPreviewStyles.fallback]}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <View style={videoPreviewStyles.playOverlay}>
          <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.85)" />
          <Text style={videoPreviewStyles.playText}>Video seleccionado</Text>
        </View>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={styles.mediaPreviewImage}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

const videoPreviewStyles = StyleSheet.create({
  fallback: {
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});

// ─── Upload helpers ────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Normalise an Android content:// URI to a stable file:// path by copying it
 * to the app cache directory. On iOS and web, the URI is returned as-is since
 * iOS already provides file:// URIs and web uses blob: URIs.
 */
async function normaliseUri(uri: string, ext: string): Promise<string> {
  // Only Android content:// URIs need copying
  if (Platform.OS !== 'android' || !uri.startsWith('content://')) return uri;
  try {
    const dest = `${FileSystem.cacheDirectory}media_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    console.log('[normaliseUri] Copied to cache:', dest);
    return dest;
  } catch (e: any) {
    console.warn('[normaliseUri] copyAsync failed, using original URI:', e?.message);
    return uri;
  }
}

/**
 * Universal upload function:
 *  1. Normalises content:// → file:// via FileSystem.copyAsync (Android only)
 *  2. fetch(uri) → Blob
 *  3. Validates blob.size > 0
 *  4. Uploads via XMLHttpRequest for real onprogress events on all platforms
 */
async function uploadMedia(
  asset: MediaAsset,
  userId: string,
  onProgress?: (info: UploadProgressInfo) => void
): Promise<{ url: string | null; error: string | null }> {
  try {
    const rawExt = asset.mimeType?.split('/')[1];
    const ext = rawExt === 'quicktime' ? 'mov' : rawExt ?? (asset.type === 'video' ? 'mp4' : 'jpg');
    const fileName = `${userId}/${Date.now()}.${ext}`;
    const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

    // Normalise content:// → file:// before doing anything else
    const safeUri = await normaliseUri(asset.uri, ext);

    console.log('[uploadMedia] Starting:', { uri: safeUri, mimeType, fileName });
    onProgress?.({ percentage: 2, uploadedBytes: 0, totalBytes: 0 });

    // ── Step 1: Fetch blob ─────────────────────────────────────────────────
    let blob: Blob;
    try {
      const response = await fetch(safeUri);
      if (!response.ok && response.status !== 0) {
        throw new Error(`fetch failed with status ${response.status}`);
      }
      blob = await response.blob();
    } catch (fetchErr: any) {
      console.error('[uploadMedia] fetch error:', fetchErr?.message);
      return { url: null, error: `No se pudo leer el archivo: ${fetchErr?.message}` };
    }

    // ── Step 2: Validate blob size ─────────────────────────────────────────
    // A 0-byte blob means the content:// URI was inaccessible (Android permission
    // or temporary URI expired). Surface this explicitly instead of uploading empty.
    if (blob.size === 0) {
      console.error('[uploadMedia] Blob is 0 bytes — content URI inaccessible');
      return {
        url: null,
        error: 'El archivo está vacío o no es accesible. Intenta seleccionarlo de nuevo.',
      };
    }

    const resolvedTotal = blob.size;
    console.log('[uploadMedia] Blob size:', formatBytes(resolvedTotal));
    onProgress?.({ percentage: 5, uploadedBytes: 0, totalBytes: resolvedTotal });

    // ── Step 3: Upload via XHR ─────────────────────────────────────────────
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const storageUrl = `${supabaseUrl}/storage/v1/object/posts-media/${fileName}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (e) => {
        const loaded = e.lengthComputable ? e.loaded : 0;
        const total  = e.lengthComputable ? e.total  : resolvedTotal;
        const pct = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
        onProgress?.({ percentage: pct, uploadedBytes: loaded, totalBytes: total });
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          console.error('[uploadMedia] XHR error:', xhr.status, xhr.responseText);
          reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Error de red durante la subida'));
      xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado'));

      xhr.open('POST', storageUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.timeout = 120_000; // 2 min timeout for large videos
      xhr.send(blob);
    });

    onProgress?.({ percentage: 100, uploadedBytes: resolvedTotal, totalBytes: resolvedTotal });

    const { data } = supabase.storage.from('posts-media').getPublicUrl(fileName);
    console.log('[uploadMedia] Success:', data.publicUrl);
    return { url: data.publicUrl, error: null };
  } catch (e: any) {
    console.error('[uploadMedia] Exception:', e?.message);
    return { url: null, error: e?.message ?? 'Error al subir el archivo' };
  }
}

// ─── UploadProgressBar ────────────────────────────────────────────────────────

function UploadProgressBar({
  progress,
  info,
}: {
  progress: number;
  info: UploadProgressInfo | null;
}) {
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fillAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 40,
      friction: 8,
    }).start();
  }, [progress]);

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const isVideo = info !== null && info.totalBytes > 500 * 1024;
  const barColor = isVideo ? Colors.info : Colors.primary;

  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.track}>
        <Animated.View
          style={[progressStyles.fill, { width: fillWidth as any, backgroundColor: barColor }]}
        />
        <View style={[progressStyles.shimmer, { backgroundColor: barColor + '33' }]} />
      </View>
      <View style={progressStyles.infoRow}>
        <View style={progressStyles.infoLeft}>
          <ActivityIndicator size="small" color={barColor} style={progressStyles.spinner} />
          <Text style={progressStyles.label}>
            {progress < 100 ? 'Subiendo...' : 'Procesando...'}
          </Text>
        </View>
        {info && info.totalBytes > 0 ? (
          <View style={progressStyles.infoRight}>
            <Text style={[progressStyles.bytes, { color: Colors.textSecondary }]}>
              {formatBytes(info.uploadedBytes)}
              <Text style={progressStyles.separator}> / </Text>
              {formatBytes(info.totalBytes)}
            </Text>
            <View style={[progressStyles.pctBadge, { backgroundColor: barColor + '22' }]}>
              <Text style={[progressStyles.pct, { color: barColor }]}>{progress}%</Text>
            </View>
          </View>
        ) : (
          <View style={[progressStyles.pctBadge, { backgroundColor: barColor + '22' }]}>
            <Text style={[progressStyles.pct, { color: barColor }]}>{progress}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  track: { height: 5, backgroundColor: Colors.surface, overflow: 'hidden', position: 'relative' },
  fill: { height: '100%', borderRadius: 3 },
  shimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  spinner: { transform: [{ scale: 0.7 }] },
  label: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  infoRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bytes: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  separator: { color: Colors.textMuted },
  pctBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.full },
  pct: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
});

// ─── CharacterRing ────────────────────────────────────────────────────────────

function CharacterRing({ count, max }: { count: number; max: number }) {
  const ratio = count / max;
  const size = 28;
  const strokeWidth = 3;
  const remaining = max - count;
  const color =
    remaining < 20 ? Colors.error : remaining < 60 ? Colors.warning : Colors.primary;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: Colors.surfaceBorder }} />
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color, opacity: Math.max(0.2, ratio) }} />
      {remaining < 40 ? (
        <Text style={{ fontSize: 9, color, fontWeight: FontWeight.bold }}>{remaining}</Text>
      ) : null}
    </View>
  );
}

// ─── FilterThumbnail ──────────────────────────────────────────────────────────

function FilterThumbnail({
  filter, uri, active, onPress,
}: {
  filter: (typeof FILTERS)[number];
  uri: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [filterStyles.btn, active ? filterStyles.btnActive : null, pressed ? { opacity: 0.8 } : null]}
    >
      <View style={[filterStyles.thumb, active ? filterStyles.thumbActive : null]}>
        <Image source={{ uri }} style={filterStyles.thumbImage} contentFit="cover" />
        {filter.tint ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint, borderRadius: 8 }]} pointerEvents="none" />
        ) : null}
        {active ? (
          <View style={filterStyles.thumbCheck}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={[filterStyles.label, active ? filterStyles.labelActive : null]}>{filter.label}</Text>
    </Pressable>
  );
}

const filterStyles = StyleSheet.create({
  btn: { alignItems: 'center', gap: 5, paddingVertical: 4 },
  btnActive: {},
  thumb: { width: 58, height: 58, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: Colors.primary },
  thumbImage: { width: '100%', height: '100%' },
  thumbCheck: {
    position: 'absolute', bottom: 4, right: 4,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.medium },
  labelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});

// ─── LocationPill ─────────────────────────────────────────────────────────────

function LocationPill({ location, onRemove }: { location: LocationInfo; onRemove: () => void }) {
  return (
    <View style={locationStyles.pill}>
      <Ionicons name="location" size={13} color={Colors.success} />
      <Text style={locationStyles.pillText} numberOfLines={1}>{location.placeName}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const locationStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    borderRadius: Radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    maxWidth: SCREEN_WIDTH - 64,
  },
  pillText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
});

// ─── MediaPickerButtons ────────────────────────────────────────────────────────

function MediaPickerButtons({
  onCamera,
  onGallery,
  onPickVideo,
  onLocation,
  locationLoading,
}: {
  onCamera: () => void;
  onGallery: () => void;
  onPickVideo: () => void;
  onLocation: () => void;
  locationLoading: boolean;
}) {
  return (
    <View style={pickerStyles.row}>
      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onCamera}
      >
        <LinearGradient colors={[Colors.primary + '22', Colors.primary + '11']} style={pickerStyles.btnInner}>
          <Ionicons name="camera" size={20} color={Colors.primary} />
          <Text style={pickerStyles.label}>Cámara</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onGallery}
      >
        <LinearGradient colors={[Colors.secondary + '22', Colors.secondary + '11']} style={pickerStyles.btnInner}>
          <Ionicons name="images" size={20} color={Colors.secondary} />
          <Text style={[pickerStyles.label, { color: Colors.secondary }]}>Galería</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onPickVideo}
      >
        <LinearGradient colors={['rgba(56,189,248,0.15)', 'rgba(56,189,248,0.07)']} style={pickerStyles.btnInner}>
          <Ionicons name="videocam" size={20} color={Colors.info} />
          <Text style={[pickerStyles.label, { color: Colors.info }]}>Video</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onLocation}
        disabled={locationLoading}
      >
        <LinearGradient colors={['rgba(74,222,128,0.15)', 'rgba(74,222,128,0.07)']} style={pickerStyles.btnInner}>
          {locationLoading ? (
            <ActivityIndicator size="small" color={Colors.success} />
          ) : (
            <Ionicons name="location" size={20} color={Colors.success} />
          )}
          <Text style={[pickerStyles.label, { color: Colors.success }]}>Lugar</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  btn: { flex: 1, borderRadius: Radii.sm, overflow: 'hidden' },
  btnPressed: { opacity: 0.75 },
  btnInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    minHeight: 58,
  },
  label: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addPost } = useApp();
  const { profile } = useAuth();

  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [audience, setAudience] = useState('public');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressInfo, setUploadProgressInfo] = useState<UploadProgressInfo | null>(null);
  const [showAudience, setShowAudience] = useState(false);

  // Animate media panel in
  const mediaAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(mediaAnim, {
      toValue: media ? 1 : 0,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [media]);

  const remaining = MAX_CHARS - content.length;
  const canPublish = (content.trim().length > 0 || media != null) && !loading;

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) setContent(text);
  };

  const toggleTag = (id: string) => {
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id].slice(0, 3)
    );
  };

  const handleReset = useCallback(() => {
    setContent('');
    setSelectedTags([]);
    setMedia(null);
    setActiveFilter('none');
    setAudience('public');
    setLocation(null);
    setUploadProgress(0);
    setUploadProgressInfo(null);
  }, []);

  // ── Media picker ──────────────────────────────────────────────────────────

  const pickMedia = useCallback(async (source: 'camera' | 'gallery', forceVideo = false) => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para capturar fotos y videos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: forceVideo ? ['videos'] : ['images', 'videos'],
        allowsEditing: !forceVideo,
        quality: 0.85,
        videoMaxDuration: 60,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const detectedType = asset.type === 'video' ? 'video' : 'image';
        const mimeType = asset.mimeType ?? (detectedType === 'video' ? 'video/mp4' : 'image/jpeg');
        const rawExt = mimeType.split('/')[1];
        const ext = rawExt === 'quicktime' ? 'mov' : rawExt ?? (detectedType === 'video' ? 'mp4' : 'jpg');
        // Normalise immediately so preview & upload both use a stable file:// URI
        const safeUri = await normaliseUri(asset.uri, ext);
        console.log('[pickMedia] camera asset:', { uri: safeUri, type: detectedType, mimeType });
        setMedia({
          uri: safeUri,
          type: detectedType,
          mimeType,
          thumbnailUri: (asset as any).videoThumbnailURI ?? undefined,
        });
        setActiveFilter('none');
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para seleccionar fotos y videos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: forceVideo ? ['videos'] : ['images', 'videos'],
        allowsEditing: !forceVideo,
        quality: 0.85,
        videoMaxDuration: 60,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const detectedType = asset.type === 'video' ? 'video' : 'image';
        const mimeType = asset.mimeType ?? (detectedType === 'video' ? 'video/mp4' : 'image/jpeg');
        const rawExt = mimeType.split('/')[1];
        const ext = rawExt === 'quicktime' ? 'mov' : rawExt ?? (detectedType === 'video' ? 'mp4' : 'jpg');
        // Normalise immediately so preview & upload both use a stable file:// URI
        const safeUri = await normaliseUri(asset.uri, ext);
        console.log('[pickMedia] gallery asset:', { uri: safeUri, type: detectedType, mimeType });
        setMedia({
          uri: safeUri,
          type: detectedType,
          mimeType,
          thumbnailUri: (asset as any).videoThumbnailURI ?? undefined,
        });
        setActiveFilter('none');
      }
    }
  }, []);

  // ── Geolocation ────────────────────────────────────────────────────────────

  const handleLocation = useCallback(async () => {
    // Toggle off if already set
    if (location) {
      setLocation(null);
      return;
    }

    setLocationLoading(true);
    try {
      // 1. Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'ConnectWave necesita acceso a tu ubicación para adjuntar el lugar al post.\n\nPuedes habilitarlo en Ajustes > Aplicaciones > ConnectWave > Permisos.',
          [{ text: 'Entendido' }]
        );
        setLocationLoading(false);
        return;
      }

      // 2. Get current position (balanced accuracy for speed)
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = pos.coords;
      let placeName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      // 3. Reverse geocode to get human-readable name
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode) {
          const parts: string[] = [];
          if (geocode.street) parts.push(geocode.street);
          if (geocode.district) parts.push(geocode.district);
          if (geocode.city) parts.push(geocode.city);
          if (geocode.country) parts.push(geocode.country);
          if (parts.length > 0) {
            // Show "Street, City, Country" (max 3 parts for readability)
            placeName = parts.slice(0, 3).join(', ');
          }
        }
      } catch (geoErr) {
        // Reverse geocode is optional — fall back to coords
        console.warn('[handleLocation] reverseGeocode failed, using coords:', geoErr);
      }

      setLocation({ latitude, longitude, placeName });
      console.log('[handleLocation] Location set:', { latitude, longitude, placeName });
    } catch (err: any) {
      console.error('[handleLocation] Error:', err?.message);
      Alert.alert(
        'No se pudo obtener la ubicación',
        'Asegúrate de tener el GPS activado e intenta de nuevo.',
        [{ text: 'OK' }]
      );
    } finally {
      setLocationLoading(false);
    }
  }, [location]);

  // ── Publish ────────────────────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    if (!profile?.id) return;

    setLoading(true);
    setUploadProgress(0);
    setUploadProgressInfo(null);

    let imageUrl: string | undefined;
    let videoUrl: string | undefined;

    if (media) {
      const { url, error: uploadError } = await uploadMedia(
        media,
        profile.id,
        (info) => {
          setUploadProgress(info.percentage);
          setUploadProgressInfo(info);
        }
      );
      if (uploadError || !url) {
        setLoading(false);
        setUploadProgress(0);
        setUploadProgressInfo(null);
        Alert.alert('Error al subir', uploadError ?? 'Error desconocido. Intenta de nuevo.');
        return;
      }
      if (media.type === 'video') {
        videoUrl = url;
      } else {
        imageUrl = url;
      }
    }

    setUploadProgress(100);

    // Build final content: caption + mood tags + optional location footer
    const moodLine = selectedTags
      .map(id => MOOD_TAGS.find(t => t.id === id)?.label)
      .filter(Boolean)
      .join(' ');

    const locationLine = location ? `📍 ${location.placeName}` : '';

    const finalContent = [content.trim(), moodLine, locationLine]
      .filter(Boolean)
      .join('\n\n');

    const { error } = await addPost(finalContent, imageUrl, videoUrl);
    setLoading(false);
    setUploadProgress(0);
    setUploadProgressInfo(null);

    if (error) {
      Alert.alert('Error al publicar', error);
      return;
    }

    Alert.alert('¡Publicado! 🌊', 'Tu post ya está en el Feed.', [
      { text: 'Ver Feed', onPress: () => { handleReset(); router.push('/(tabs)/'); } },
      { text: 'Nuevo post', onPress: handleReset, style: 'cancel' },
    ]);
  }, [canPublish, profile, media, content, selectedTags, location, addPost, router, handleReset]);

  const currentFilter = FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0];
  const selectedAudience = AUDIENCE_OPTIONS.find(a => a.id === audience) ?? AUDIENCE_OPTIONS[0];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, pressed ? { opacity: 0.6 } : null]}
            onPress={handleReset}
            hitSlop={8}
          >
            <Text style={styles.clearText}>Limpiar</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Nuevo post</Text>

          <Pressable
            onPress={handlePublish}
            disabled={!canPublish}
            style={{ borderRadius: Radii.full, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={
                canPublish
                  ? [Colors.primary, Colors.secondary]
                  : [Colors.surfaceElevated, Colors.surfaceElevated]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.publishBtn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.publishText, !canPublish ? styles.publishDisabled : null]}>
                  Publicar
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Upload progress bar ──────────────────────────────────────────── */}
        {loading ? (
          <UploadProgressBar progress={uploadProgress} info={uploadProgressInfo} />
        ) : null}

        {/* ── Content scroll ──────────────────────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >

          {/* Author + Caption */}
          <View style={styles.composeRow}>
            <Avatar uri={profile?.avatar ?? 'https://i.pravatar.cc/150?img=7'} size={46} />

            <View style={styles.composeRight}>
              <View style={styles.composeTopRow}>
                <Text style={styles.authorName}>{profile?.name ?? 'Tu nombre'}</Text>
                {/* Audience pill */}
                <Pressable style={styles.audiencePill} onPress={() => setShowAudience(v => !v)}>
                  <Ionicons name={selectedAudience.icon} size={12} color={Colors.primary} />
                  <Text style={styles.audiencePillText}>{selectedAudience.label}</Text>
                  <Ionicons name="chevron-down" size={11} color={Colors.primary} />
                </Pressable>
              </View>

              {/* Audience picker */}
              {showAudience ? (
                <View style={styles.audienceMenu}>
                  {AUDIENCE_OPTIONS.map(opt => (
                    <Pressable
                      key={opt.id}
                      style={[styles.audienceMenuItem, audience === opt.id ? styles.audienceMenuItemActive : null]}
                      onPress={() => { setAudience(opt.id); setShowAudience(false); }}
                    >
                      <Ionicons name={opt.icon} size={15} color={audience === opt.id ? Colors.primary : Colors.textMuted} />
                      <Text style={[styles.audienceMenuText, audience === opt.id ? styles.audienceMenuTextActive : null]}>
                        {opt.label}
                      </Text>
                      {audience === opt.id ? <Ionicons name="checkmark" size={14} color={Colors.primary} /> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <MentionInput
                value={content}
                onChangeText={handleTextChange}
                placeholder="¿Qué está pasando en tu onda? 🌊"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={MAX_CHARS}
                autoFocus={false}
                textAlignVertical="top"
                dropdownDirection="down"
                inputStyle={styles.captionInput}
                minHeight={90}
              />

              {/* Location pill — shown below caption when set */}
              {location ? (
                <LocationPill location={location} onRemove={() => setLocation(null)} />
              ) : null}
            </View>
          </View>

          {/* ── Media Preview ─────────────────────────────────────────────── */}
          {media ? (
            <Animated.View
              style={[
                styles.mediaSection,
                {
                  opacity: mediaAnim,
                  transform: [
                    {
                      translateY: mediaAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.mediaCard}>
                <View style={styles.mediaPreviewWrapper}>
                  {media.type === 'image' ? (
                    <>
                      <Image
                        source={{ uri: media.uri }}
                        style={styles.mediaPreviewImage}
                        contentFit="cover"
                        transition={300}
                      />
                      {currentFilter.tint ? (
                        <View
                          style={[StyleSheet.absoluteFill, { backgroundColor: currentFilter.tint, borderRadius: Radii.md }]}
                          pointerEvents="none"
                        />
                      ) : null}
                    </>
                  ) : (
                    /* key forces remount when URI changes so useVideoPlayer reinitialises */
                    <VideoPreview key={media.uri} uri={media.uri} thumbnailUri={media.thumbnailUri} />
                  )}

                  {/* Remove button */}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => { setMedia(null); setActiveFilter('none'); }}
                    hitSlop={6}
                  >
                    <View style={styles.removeBtnInner}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </View>
                  </Pressable>

                  {/* Media type badge */}
                  <View style={styles.mediaBadge}>
                    <Ionicons name={media.type === 'video' ? 'videocam' : 'image'} size={12} color="#fff" />
                    <Text style={styles.mediaBadgeText}>
                      {media.type === 'video' ? 'Video' : 'Foto'}
                    </Text>
                  </View>

                  {/* Change media button */}
                  <Pressable style={styles.changeMediaBtn} onPress={() => pickMedia('gallery')}>
                    <Ionicons name="swap-horizontal" size={14} color="#fff" />
                    <Text style={styles.changeMediaText}>Cambiar</Text>
                  </Pressable>
                </View>

                {/* Filters row — images only */}
                {media.type === 'image' ? (
                  <View style={styles.filtersSection}>
                    <Text style={styles.filtersSectionTitle}>Filtro</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.filtersRow}
                    >
                      {FILTERS.map(f => (
                        <FilterThumbnail
                          key={f.id}
                          filter={f}
                          uri={media.uri}
                          active={activeFilter === f.id}
                          onPress={() => setActiveFilter(f.id)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ) : (
            <Pressable style={styles.mediaPlaceholder} onPress={() => pickMedia('gallery')}>
              <LinearGradient colors={[Colors.surfaceElevated, Colors.surface]} style={styles.mediaPlaceholderInner}>
                <LinearGradient
                  colors={[Colors.primary + '30', Colors.secondary + '20']}
                  style={styles.placeholderIconBg}
                >
                  <Ionicons name="add-circle-outline" size={36} color={Colors.primary} />
                </LinearGradient>
                <Text style={styles.placeholderTitle}>Agregar foto o video</Text>
                <Text style={styles.placeholderSub}>Toca para seleccionar desde tu galería</Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* ── Mood tags ─────────────────────────────────────────────────── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="tag-outline" size={15} color={Colors.textMuted} />
              <Text style={styles.sectionTitle}>Etiquetas</Text>
              <Text style={styles.sectionSubtitle}>máx. 3</Text>
            </View>
            <View style={styles.tagsWrap}>
              {MOOD_TAGS.map(tag => {
                const active = selectedTags.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    style={({ pressed }) => [styles.tag, active ? styles.tagActive : null, pressed ? { opacity: 0.75 } : null]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text style={[styles.tagText, active ? styles.tagTextActive : null]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Post tips ─────────────────────────────────────────────────── */}
          {!content.trim() && !media ? (
            <View style={styles.tipsCard}>
              <View style={styles.tipsRow}>
                <Ionicons name="bulb-outline" size={15} color={Colors.warning} />
                <Text style={styles.tipsTitle}>Tips para un gran post</Text>
              </View>
              <Text style={styles.tipItem}>• Agrega una imagen para más engagement</Text>
              <Text style={styles.tipItem}>• Usa etiquetas para que te descubran</Text>
              <Text style={styles.tipItem}>• Las primeras 2 líneas son las más leídas</Text>
            </View>
          ) : null}

          <View style={{ height: Spacing.xxl }} />
        </ScrollView>

        {/* ── Bottom toolbar ───────────────────────────────────────────────── */}
        <View style={[styles.toolbar, { paddingBottom: insets.bottom + 4 }]}>
          <MediaPickerButtons
            onCamera={() => pickMedia('camera')}
            onGallery={() => pickMedia('gallery')}
            onPickVideo={() => pickMedia('gallery', true)}
            onLocation={handleLocation}
            locationLoading={locationLoading}
          />
          {/* Character counter row */}
          <View style={styles.counterRow}>
            <View style={styles.counterTrack}>
              <View
                style={[
                  styles.counterFill,
                  {
                    width: `${Math.min(100, (content.length / MAX_CHARS) * 100)}%` as any,
                    backgroundColor: remaining < 20 ? Colors.error : remaining < 60 ? Colors.warning : Colors.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.counterRight}>
              <CharacterRing count={content.length} max={MAX_CHARS} />
              <Text style={[styles.counterText, remaining < 20 ? { color: Colors.error } : null]}>
                {remaining}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  headerBtn: { minWidth: 72 },
  clearText: { color: Colors.textMuted, fontSize: FontSize.base },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  publishBtn: {
    paddingHorizontal: Spacing.md + 4,
    height: 38,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  publishText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.base },
  publishDisabled: { color: Colors.textMuted },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.md },

  composeRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  composeRight: { flex: 1, gap: 8 },
  composeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  audiencePillText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  audienceMenu: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    marginBottom: 4,
  },
  audienceMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  audienceMenuItemActive: { backgroundColor: Colors.primary + '10' },
  audienceMenuText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  audienceMenuTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },

  captionInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 26,
    minHeight: 90,
    textAlignVertical: 'top',
  },

  mediaSection: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  mediaCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  mediaPreviewWrapper: { position: 'relative', backgroundColor: Colors.surfaceElevated },
  mediaPreviewImage: { width: '100%', height: MEDIA_HEIGHT },

  removeBtn: { position: 'absolute', top: 10, right: 10 },
  removeBtnInner: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  mediaBadge: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  mediaBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  changeMediaBtn: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radii.sm,
  },
  changeMediaText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  filtersSection: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  filtersSectionTitle: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1,
    paddingHorizontal: 4, marginBottom: Spacing.xs,
  },
  filtersRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 4, paddingBottom: Spacing.sm },

  mediaPlaceholder: {
    marginHorizontal: Spacing.md, marginVertical: Spacing.sm,
    borderRadius: Radii.lg, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.surfaceBorder, borderStyle: 'dashed',
  },
  mediaPlaceholderInner: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.xl, gap: Spacing.sm,
  },
  placeholderIconBg: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
  },
  placeholderTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  placeholderSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  section: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
    color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, flex: 1,
  },
  sectionSubtitle: { fontSize: FontSize.xs, color: Colors.textMuted },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  tagActive: { backgroundColor: Colors.primary + '25', borderColor: Colors.primary },
  tagText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  tagTextActive: { color: Colors.primaryLight },

  tipsCard: {
    marginHorizontal: Spacing.md, marginTop: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder, gap: 6,
  },
  tipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tipsTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tipItem: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },

  toolbar: { backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder },
  counterRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm,
  },
  counterTrack: { flex: 1, height: 4, backgroundColor: Colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  counterFill: { height: 4, borderRadius: 2 },
  counterRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium, minWidth: 26, textAlign: 'right' },
});
