import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Avatar } from '@/components/ui/Avatar';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOOD_TAGS = [
  '🎵 Música', '📸 Fotos', '💡 Ideas', '🚀 Tech',
  '🌊 Vibes', '❤️ Amor', '🎨 Arte', '🌍 Travel',
];

const FILTERS = [
  { id: 'none', label: 'Original', tint: undefined },
  { id: 'warm', label: 'Cálido', tint: 'rgba(255,180,100,0.25)' },
  { id: 'cool', label: 'Frío', tint: 'rgba(100,160,255,0.25)' },
  { id: 'vintage', label: 'Vintage', tint: 'rgba(180,140,100,0.3)' },
  { id: 'fade', label: 'Fade', tint: 'rgba(200,200,200,0.3)' },
  { id: 'drama', label: 'Drama', tint: 'rgba(40,0,80,0.3)' },
];

type MediaAsset = {
  uri: string;
  type: 'image' | 'video';
  base64?: string;
  mimeType?: string;
  fileName?: string;
};

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => { p.loop = true; p.muted = true; });
  return (
    <VideoView
      player={player}
      style={styles.mediaPreviewImage}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

async function uploadMedia(
  asset: MediaAsset,
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const ext = asset.mimeType?.split('/')[1] ?? (asset.type === 'video' ? 'mp4' : 'jpg');
    const fileName = `${userId}/${Date.now()}.${ext}`;

    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('posts-media')
        .upload(fileName, blob, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
      if (error) return { url: null, error: error.message };
    } else {
      // Mobile: use base64
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      const { error } = await supabase.storage
        .from('posts-media')
        .upload(fileName, arrayBuffer, { contentType: asset.mimeType ?? 'image/jpeg', upsert: false });
      if (error) return { url: null, error: error.message };
    }

    const { data } = supabase.storage.from('posts-media').getPublicUrl(fileName);
    return { url: data.publicUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e.message ?? 'Upload failed' };
  }
}

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addPost } = useApp();
  const { profile } = useAuth();

  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [activeFilter, setActiveFilter] = useState('none');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const MAX_CHARS = 280;
  const remaining = MAX_CHARS - content.length;
  const progress = content.length / MAX_CHARS;

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) setContent(text);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag].slice(0, 3)
    );
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir fotos y videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        fileName: asset.fileName ?? undefined,
      });
      setActiveFilter('none');
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        fileName: asset.fileName ?? undefined,
      });
      setActiveFilter('none');
    }
  };

  const showMediaOptions = () => {
    Alert.alert('Agregar media', 'Elige una fuente', [
      { text: 'Cámara', onPress: pickFromCamera },
      { text: 'Galería', onPress: pickFromGallery },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const removeMedia = () => {
    setMedia(null);
    setActiveFilter('none');
  };

  const handlePublish = useCallback(async () => {
    if (!content.trim() && !media) {
      Alert.alert('Oops', 'Escribe algo o agrega una foto/video antes de publicar.');
      return;
    }
    if (!profile?.id) return;

    setLoading(true);
    setUploadProgress(0);

    let imageUrl: string | undefined;
    let videoUrl: string | undefined;

    if (media) {
      setUploadProgress(30);
      const { url, error: uploadError } = await uploadMedia(media, profile.id);
      if (uploadError || !url) {
        setLoading(false);
        setUploadProgress(0);
        Alert.alert('Error al subir', uploadError ?? 'Error desconocido');
        return;
      }
      setUploadProgress(80);
      if (media.type === 'video') {
        videoUrl = url;
      } else {
        imageUrl = url;
      }
    }

    setUploadProgress(90);
    const { error } = await addPost(content.trim(), imageUrl, videoUrl);
    setLoading(false);
    setUploadProgress(0);

    if (error) {
      Alert.alert('Error', error);
      return;
    }

    setContent('');
    setSelectedTags([]);
    setMedia(null);
    setActiveFilter('none');

    Alert.alert('¡Publicado!', 'Tu post ya está en el Feed 🌊', [
      { text: 'Ver Feed', onPress: () => router.push('/(tabs)/') },
      { text: 'Seguir creando', style: 'cancel' },
    ]);
  }, [content, media, profile, addPost, router]);

  const currentFilter = FILTERS.find(f => f.id === activeFilter) ?? FILTERS[0];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.cancelBtn}
            onPress={() => { setContent(''); setMedia(null); }}
            hitSlop={8}
          >
            <Text style={styles.cancelText}>Limpiar</Text>
          </Pressable>
          <Text style={styles.title}>Nuevo Post</Text>
          <Pressable onPress={handlePublish} disabled={(!content.trim() && !media) || loading}>
            <LinearGradient
              colors={
                (content.trim() || media) && !loading
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
                <Text style={[styles.publishText, (!content.trim() && !media) ? styles.publishTextDisabled : null]}>
                  Publicar
                </Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* Upload progress bar */}
        {loading && uploadProgress > 0 ? (
          <View style={styles.progressBarWrapper}>
            <View style={[styles.progressBarFill, { width: `${uploadProgress}%` as any }]} />
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* User + Input */}
          <View style={styles.inputArea}>
            <Avatar uri={profile?.avatar ?? 'https://i.pravatar.cc/150?img=7'} size={44} />
            <View style={styles.inputWrapper}>
              <Text style={styles.userHandle}>@{profile?.username ?? 'tu'}</Text>
              <TextInput
                style={styles.textInput}
                placeholder="¿Qué está pasando en tu onda? 🌊"
                placeholderTextColor={Colors.textMuted}
                multiline
                value={content}
                onChangeText={handleTextChange}
                autoFocus={!media}
              />
            </View>
          </View>

          {/* Media Preview */}
          {media ? (
            <View style={styles.mediaPreviewWrapper}>
              <View style={styles.mediaPreviewContainer}>
                {media.type === 'image' ? (
                  <View style={styles.mediaPreviewImageWrapper}>
                    <Image
                      source={{ uri: media.uri }}
                      style={styles.mediaPreviewImage}
                      contentFit="cover"
                      transition={200}
                    />
                    {/* Filter overlay */}
                    {currentFilter.tint ? (
                      <View
                        style={[
                          StyleSheet.absoluteFill,
                          { backgroundColor: currentFilter.tint, borderRadius: Radii.md },
                        ]}
                        pointerEvents="none"
                      />
                    ) : null}
                  </View>
                ) : (
                  <VideoPreview uri={media.uri} />
                )}
                <Pressable style={styles.removeMediaBtn} onPress={removeMedia} hitSlop={8}>
                  <Ionicons name="close-circle" size={26} color="#fff" />
                </Pressable>
                {media.type === 'video' ? (
                  <View style={styles.videoLabel}>
                    <Ionicons name="videocam" size={14} color="#fff" />
                    <Text style={styles.videoLabelText}>Video</Text>
                  </View>
                ) : null}
              </View>

              {/* Filters row — only for images */}
              {media.type === 'image' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filtersRow}
                >
                  {FILTERS.map(f => (
                    <Pressable
                      key={f.id}
                      style={[styles.filterBtn, activeFilter === f.id ? styles.filterBtnActive : null]}
                      onPress={() => setActiveFilter(f.id)}
                    >
                      <View style={styles.filterThumb}>
                        <Image source={{ uri: media.uri }} style={styles.filterThumbImage} contentFit="cover" />
                        {f.tint ? (
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: f.tint, borderRadius: 8 }]} pointerEvents="none" />
                        ) : null}
                      </View>
                      <Text style={[styles.filterLabel, activeFilter === f.id ? styles.filterLabelActive : null]}>
                        {f.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ) : null}

          {/* Mood Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tema</Text>
            <View style={styles.tagsGrid}>
              {MOOD_TAGS.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    style={[styles.tag, isSelected ? styles.tagSelected : null]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[styles.tagText, isSelected ? styles.tagTextSelected : null]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Media action buttons */}
          <View style={styles.mediaRow}>
            <Pressable style={styles.mediaBtn} onPress={pickFromCamera}>
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
              <Text style={styles.mediaBtnLabel}>Cámara</Text>
            </Pressable>
            <Pressable style={styles.mediaBtn} onPress={pickFromGallery}>
              <Ionicons name="image-outline" size={22} color={Colors.primary} />
              <Text style={styles.mediaBtnLabel}>Galería</Text>
            </Pressable>
            <Pressable style={styles.mediaBtn} onPress={pickFromGallery}>
              <Ionicons name="videocam-outline" size={22} color={Colors.primary} />
              <Text style={styles.mediaBtnLabel}>Video</Text>
            </Pressable>
            <Pressable style={styles.mediaBtn}>
              <Ionicons name="at-outline" size={22} color={Colors.primary} />
              <Text style={styles.mediaBtnLabel}>Mencionar</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* Character counter */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.counterBar}>
            <View
              style={[
                styles.counterFill,
                {
                  width: `${progress * 100}%` as any,
                  backgroundColor:
                    remaining < 20 ? Colors.error : remaining < 60 ? Colors.warning : Colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.counterText, remaining < 20 ? { color: Colors.error } : null]}>
            {remaining} caracteres restantes
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  cancelBtn: { minWidth: 70 },
  cancelText: { color: Colors.textMuted, fontSize: FontSize.base },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  publishBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    minWidth: 84,
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
  },
  publishText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.base },
  publishTextDisabled: { color: Colors.textMuted },
  progressBarWrapper: {
    height: 3,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  inputArea: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  inputWrapper: { flex: 1, gap: 6 },
  userHandle: { color: Colors.primaryLight, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  textInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 26,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  mediaPreviewWrapper: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  mediaPreviewContainer: {
    position: 'relative',
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  mediaPreviewImageWrapper: {
    position: 'relative',
  },
  mediaPreviewImage: {
    width: '100%',
    height: SCREEN_WIDTH - Spacing.md * 2 - Spacing.md,
    maxHeight: 360,
    borderRadius: Radii.md,
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 14,
  },
  videoLabel: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  videoLabelText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  filtersRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    gap: 12,
    flexDirection: 'row',
  },
  filterBtn: {
    alignItems: 'center',
    gap: 4,
    opacity: 0.75,
  },
  filterBtnActive: {
    opacity: 1,
  },
  filterThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterThumbImage: { width: '100%', height: '100%' },
  filterLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  filterLabelActive: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  section: { padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tagSelected: { backgroundColor: Colors.primary + '33', borderColor: Colors.primary },
  tagText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  tagTextSelected: { color: Colors.primary },
  mediaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  mediaBtn: {
    alignItems: 'center',
    gap: 4,
    padding: Spacing.sm,
    minWidth: 60,
    minHeight: 60,
    justifyContent: 'center',
  },
  mediaBtnLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: 6,
  },
  counterBar: { height: 3, backgroundColor: Colors.surfaceElevated, borderRadius: 2, overflow: 'hidden' },
  counterFill: { height: 3, borderRadius: 2 },
  counterText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right' },
});
