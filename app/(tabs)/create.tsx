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
};

// ─── VideoPreview ─────────────────────────────────────────────────────────────

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.mediaPreviewImage}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadMedia(
  asset: MediaAsset,
  userId: string
): Promise<{ url: string | null; error: string | null }> {
  try {
    const ext = asset.mimeType?.split('/')[1] ?? (asset.type === 'video' ? 'mp4' : 'jpg');
    const fileName = `${userId}/${Date.now()}.${ext}`;
    const mimeType = asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');

    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('posts-media')
        .upload(fileName, blob, { contentType: mimeType, upsert: false });
      if (error) return { url: null, error: error.message };
    } else {
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
        .upload(fileName, arrayBuffer, { contentType: mimeType, upsert: false });
      if (error) return { url: null, error: error.message };
    }

    const { data } = supabase.storage.from('posts-media').getPublicUrl(fileName);
    return { url: data.publicUrl, error: null };
  } catch (e: any) {
    return { url: null, error: e?.message ?? 'Upload failed' };
  }
}

// ─── CharacterRing ────────────────────────────────────────────────────────────

function CharacterRing({ count, max }: { count: number; max: number }) {
  const ratio = count / max;
  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ratio);
  const remaining = max - count;

  const color =
    remaining < 20 ? Colors.error : remaining < 60 ? Colors.warning : Colors.primary;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background track */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: Colors.surfaceBorder,
        }}
      />
      {/* Filled arc approximation using opacity */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color,
          opacity: Math.max(0.2, ratio),
        }}
      />
      {remaining < 40 ? (
        <Text style={{ fontSize: 9, color, fontWeight: FontWeight.bold }}>
          {remaining}
        </Text>
      ) : null}
    </View>
  );
}

// ─── FilterThumbnail ──────────────────────────────────────────────────────────

function FilterThumbnail({
  filter,
  uri,
  active,
  onPress,
}: {
  filter: (typeof FILTERS)[number];
  uri: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        filterStyles.btn,
        active ? filterStyles.btnActive : null,
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <View style={[filterStyles.thumb, active ? filterStyles.thumbActive : null]}>
        <Image source={{ uri }} style={filterStyles.thumbImage} contentFit="cover" />
        {filter.tint ? (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint, borderRadius: 8 }]}
            pointerEvents="none"
          />
        ) : null}
        {active ? (
          <View style={filterStyles.thumbCheck}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
      <Text style={[filterStyles.label, active ? filterStyles.labelActive : null]}>
        {filter.label}
      </Text>
    </Pressable>
  );
}

const filterStyles = StyleSheet.create({
  btn: { alignItems: 'center', gap: 5, paddingVertical: 4 },
  btnActive: {},
  thumb: {
    width: 58,
    height: 58,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: { borderColor: Colors.primary },
  thumbImage: { width: '100%', height: '100%' },
  thumbCheck: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.medium },
  labelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
});

// ─── MediaPickerButtons ────────────────────────────────────────────────────────

function MediaPickerButtons({
  onCamera,
  onGallery,
  hasMedia,
}: {
  onCamera: () => void;
  onGallery: () => void;
  hasMedia: boolean;
}) {
  return (
    <View style={pickerStyles.row}>
      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onCamera}
      >
        <LinearGradient
          colors={[Colors.primary + '22', Colors.primary + '11']}
          style={pickerStyles.btnInner}
        >
          <Ionicons name="camera" size={20} color={Colors.primary} />
          <Text style={pickerStyles.label}>Cámara</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onGallery}
      >
        <LinearGradient
          colors={[Colors.secondary + '22', Colors.secondary + '11']}
          style={pickerStyles.btnInner}
        >
          <Ionicons name="images" size={20} color={Colors.secondary} />
          <Text style={[pickerStyles.label, { color: Colors.secondary }]}>Galería</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
        onPress={onGallery}
      >
        <LinearGradient
          colors={['rgba(56,189,248,0.15)', 'rgba(56,189,248,0.07)']}
          style={pickerStyles.btnInner}
        >
          <Ionicons name="videocam" size={20} color={Colors.info} />
          <Text style={[pickerStyles.label, { color: Colors.info }]}>Video</Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        style={({ pressed }) => [pickerStyles.btn, pressed ? pickerStyles.btnPressed : null]}
      >
        <LinearGradient
          colors={['rgba(74,222,128,0.15)', 'rgba(74,222,128,0.07)']}
          style={pickerStyles.btnInner}
        >
          <Ionicons name="location" size={20} color={Colors.success} />
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
  },
  label: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
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
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const handleReset = () => {
    setContent('');
    setSelectedTags([]);
    setMedia(null);
    setActiveFilter('none');
    setAudience('public');
  };

  const pickMedia = useCallback(async (source: 'camera' | 'gallery') => {
    if (source === 'camera') {
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
        });
        setActiveFilter('none');
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
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
        });
        setActiveFilter('none');
      }
    }
  }, []);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    if (!profile?.id) return;

    setLoading(true);
    setUploadProgress(10);

    let imageUrl: string | undefined;
    let videoUrl: string | undefined;

    if (media) {
      setUploadProgress(30);
      const { url, error: uploadError } = await uploadMedia(media, profile.id);
      if (uploadError || !url) {
        setLoading(false);
        setUploadProgress(0);
        Alert.alert('Error al subir', uploadError ?? 'Error desconocido. Intenta de nuevo.');
        return;
      }
      setUploadProgress(75);
      if (media.type === 'video') {
        videoUrl = url;
      } else {
        imageUrl = url;
      }
    }

    setUploadProgress(90);
    const finalContent = [
      content.trim(),
      selectedTags.map(id => MOOD_TAGS.find(t => t.id === id)?.label).filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join('\n\n');

    const { error } = await addPost(finalContent, imageUrl, videoUrl);
    setLoading(false);
    setUploadProgress(0);

    if (error) {
      Alert.alert('Error al publicar', error);
      return;
    }

    Alert.alert('¡Publicado! 🌊', 'Tu post ya está en el Feed.', [
      { text: 'Ver Feed', onPress: () => { handleReset(); router.push('/(tabs)/'); } },
      { text: 'Nuevo post', onPress: handleReset, style: 'cancel' },
    ]);
  }, [canPublish, profile, media, content, selectedTags, addPost, router]);

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

        {/* ── Upload progress ──────────────────────────────────────────────── */}
        {loading ? (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${uploadProgress}%` as any },
              ]}
            />
          </View>
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
                <Pressable
                  style={styles.audiencePill}
                  onPress={() => setShowAudience(v => !v)}
                >
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
                      style={[
                        styles.audienceMenuItem,
                        audience === opt.id ? styles.audienceMenuItemActive : null,
                      ]}
                      onPress={() => { setAudience(opt.id); setShowAudience(false); }}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={15}
                        color={audience === opt.id ? Colors.primary : Colors.textMuted}
                      />
                      <Text
                        style={[
                          styles.audienceMenuText,
                          audience === opt.id ? styles.audienceMenuTextActive : null,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {audience === opt.id ? (
                        <Ionicons name="checkmark" size={14} color={Colors.primary} />
                      ) : null}
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
              {/* Preview card */}
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
                          style={[
                            StyleSheet.absoluteFill,
                            {
                              backgroundColor: currentFilter.tint,
                              borderRadius: Radii.md,
                            },
                          ]}
                          pointerEvents="none"
                        />
                      ) : null}
                    </>
                  ) : (
                    <VideoPreview uri={media.uri} />
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
                    <Ionicons
                      name={media.type === 'video' ? 'videocam' : 'image'}
                      size={12}
                      color="#fff"
                    />
                    <Text style={styles.mediaBadgeText}>
                      {media.type === 'video' ? 'Video' : 'Foto'}
                    </Text>
                  </View>

                  {/* Change media button */}
                  <Pressable
                    style={styles.changeMediaBtn}
                    onPress={() => pickMedia('gallery')}
                  >
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
            /* No media placeholder */
            <Pressable
              style={styles.mediaPlaceholder}
              onPress={() => pickMedia('gallery')}
            >
              <LinearGradient
                colors={[Colors.surfaceElevated, Colors.surface]}
                style={styles.mediaPlaceholderInner}
              >
                <LinearGradient
                  colors={[Colors.primary + '30', Colors.secondary + '20']}
                  style={styles.placeholderIconBg}
                >
                  <Ionicons name="add-circle-outline" size={36} color={Colors.primary} />
                </LinearGradient>
                <Text style={styles.placeholderTitle}>Agregar foto o video</Text>
                <Text style={styles.placeholderSub}>
                  Toca para seleccionar desde tu galería
                </Text>
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
                    style={({ pressed }) => [
                      styles.tag,
                      active ? styles.tagActive : null,
                      pressed ? { opacity: 0.75 } : null,
                    ]}
                    onPress={() => toggleTag(tag.id)}
                  >
                    <Text style={[styles.tagText, active ? styles.tagTextActive : null]}>
                      {tag.label}
                    </Text>
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
            hasMedia={media != null}
          />
          {/* Character counter row */}
          <View style={styles.counterRow}>
            <View style={styles.counterTrack}>
              <View
                style={[
                  styles.counterFill,
                  {
                    width: `${Math.min(100, (content.length / MAX_CHARS) * 100)}%` as any,
                    backgroundColor:
                      remaining < 20 ? Colors.error : remaining < 60 ? Colors.warning : Colors.primary,
                  },
                ]}
              />
            </View>
            <View style={styles.counterRight}>
              <CharacterRing count={content.length} max={MAX_CHARS} />
              <Text
                style={[
                  styles.counterText,
                  remaining < 20 ? { color: Colors.error } : null,
                ]}
              >
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

  // Header
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
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  publishBtn: {
    paddingHorizontal: Spacing.md + 4,
    height: 38,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  publishText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.base,
  },
  publishDisabled: { color: Colors.textMuted },

  // Progress
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.md },

  // Compose row
  composeRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  composeRight: { flex: 1, gap: 8 },
  composeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorName: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  // Audience pill
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
  audiencePillText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // Audience dropdown
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

  // Caption input
  captionInput: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 26,
    minHeight: 90,
    textAlignVertical: 'top',
  },

  // Media section
  mediaSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  mediaCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  mediaPreviewWrapper: {
    position: 'relative',
    backgroundColor: Colors.surfaceElevated,
  },
  mediaPreviewImage: {
    width: '100%',
    height: MEDIA_HEIGHT,
  },

  // Overlay controls
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  removeBtnInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  mediaBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  mediaBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  changeMediaBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.sm,
  },
  changeMediaText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  // Filters
  filtersSection: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  filtersSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 4,
    marginBottom: Spacing.xs,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: Spacing.sm,
  },

  // Media placeholder
  mediaPlaceholder: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    borderRadius: Radii.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    borderStyle: 'dashed',
  },
  mediaPlaceholderInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  placeholderIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  placeholderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  placeholderSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Tags section
  section: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tagActive: {
    backgroundColor: Colors.primary + '25',
    borderColor: Colors.primary,
  },
  tagText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  tagTextActive: { color: Colors.primaryLight },

  // Tips
  tipsCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: 6,
  },
  tipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tipsTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  tipItem: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 20 },

  // Bottom toolbar
  toolbar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  counterTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  counterFill: { height: 4, borderRadius: 2 },
  counterRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
    minWidth: 26,
    textAlign: 'right',
  },
});
