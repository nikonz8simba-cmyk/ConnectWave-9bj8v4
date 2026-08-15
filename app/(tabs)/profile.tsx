import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { PostOptionsSheet } from '@/components/feature/PostOptionsSheet';
import { useAuth } from '@/hooks/useAuth';
import { signOut, updateUserProfile } from '@/services/authService';
import { fetchUserPosts } from '@/services/postService';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppPost } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * 2) / 3;

type TabType = 'posts' | 'liked' | 'media';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Decode base64 string to Uint8Array without atob (not reliable on all RN/Hermes builds). */
function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = clean.length;
  const out = new Uint8Array(Math.floor((len * 3) / 4));
  let outIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = chars.indexOf(clean[i]);
    const b = chars.indexOf(clean[i + 1]);
    const c = chars.indexOf(clean[i + 2] ?? '=');
    const d = chars.indexOf(clean[i + 3] ?? '=');
    if (a === -1 || b === -1) break;
    out[outIdx++] = (a << 2) | (b >> 4);
    if (c !== -1) out[outIdx++] = ((b & 0xf) << 4) | (c >> 2);
    if (d !== -1) out[outIdx++] = ((c & 0x3) << 6) | d;
  }
  return out.subarray(0, outIdx);
}

async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    const fileName = `${userId}/avatar_${Date.now()}.jpg`;

    // Step 1: Normalise content:// → file:// on Android
    let safeUri = uri;
    if (Platform.OS === 'android' && uri.startsWith('content://')) {
      try {
        const dest = `${FileSystem.cacheDirectory}avatar_${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        safeUri = dest;
        console.log('[uploadAvatar] Copied to cache:', dest);
      } catch (copyErr: any) {
        console.warn('[uploadAvatar] copyAsync failed, using original URI:', copyErr?.message);
      }
    }

    // Step 2: Read file as base64 via FileSystem (reliable on iOS + Android)
    // Avoids fetch() → blob → XHR.send(blob) which silently drops data on iOS/Hermes.
    const base64 = await FileSystem.readAsStringAsync(safeUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length === 0) {
      console.error('[uploadAvatar] Empty base64 data');
      return null;
    }

    // Step 3: Decode → Uint8Array and upload via XHR
    const bytes = base64ToUint8Array(base64);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');
    const storageUrl = `${supabaseUrl}/storage/v1/object/avatars/${fileName}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          console.error('[uploadAvatar] XHR error:', xhr.status, xhr.responseText);
          reject(new Error(`Avatar upload failed (${xhr.status}): ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error('XHR network error during avatar upload'));
      xhr.open('POST', storageUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('x-upsert', 'true');
      xhr.send(bytes.buffer);
    });

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    // Cache-bust so expo-image reloads the new avatar immediately
    return `${data.publicUrl}?t=${Date.now()}`;
  } catch (e: any) {
    console.error('[uploadAvatar] Exception:', e?.message);
    return null;
  }
}

// ─── Stat Item ────────────────────────────────────────────────────────────────

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updates: { name: string; bio: string; username: string; avatarUri: string }) => Promise<void>;
  initialName: string;
  initialBio: string;
  initialUsername: string;
  initialAvatar: string;
}

function EditProfileModal({
  visible,
  onClose,
  onSave,
  initialName,
  initialBio,
  initialUsername,
  initialAvatar,
}: EditProfileModalProps) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [username, setUsername] = useState(initialUsername);
  const [avatarUri, setAvatarUri] = useState(initialAvatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setBio(initialBio);
      setUsername(initialUsername);
      setAvatarUri(initialAvatar);
    }
  }, [visible, initialName, initialBio, initialUsername, initialAvatar]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'El nombre no puede estar vacío.'); return; }
    if (!username.trim()) { Alert.alert('Error', 'El usuario no puede estar vacío.'); return; }
    setSaving(true);
    await onSave({ name: name.trim(), bio: bio.trim(), username: username.trim(), avatarUri });
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={editStyles.container}>
        {/* Header */}
        <View style={editStyles.header}>
          <Pressable onPress={onClose} hitSlop={8} disabled={saving}>
            <Text style={[editStyles.cancelText, saving ? { opacity: 0.4 } : null]}>Cancelar</Text>
          </Pressable>
          <Text style={editStyles.title}>Editar perfil</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : <Text style={editStyles.saveText}>Guardar</Text>
            }
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar picker */}
          <View style={editStyles.avatarSection}>
            <Pressable onPress={pickAvatar} style={editStyles.avatarBtn}>
              <Image
                source={{ uri: avatarUri }}
                style={editStyles.avatarImage}
                contentFit="cover"
                transition={200}
              />
              <View style={editStyles.avatarOverlay}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={editStyles.avatarOverlayText}>Cambiar foto</Text>
              </View>
            </Pressable>
          </View>

          {/* Fields */}
          <View style={editStyles.fieldsContainer}>
            <View style={editStyles.field}>
              <Text style={editStyles.fieldLabel}>Nombre completo</Text>
              <TextInput
                style={editStyles.fieldInput}
                value={name}
                onChangeText={setName}
                placeholder="Tu nombre"
                placeholderTextColor={Colors.textMuted}
                maxLength={50}
              />
            </View>

            <View style={editStyles.field}>
              <Text style={editStyles.fieldLabel}>Nombre de usuario</Text>
              <View style={editStyles.usernameRow}>
                <Text style={editStyles.atSign}>@</Text>
                <TextInput
                  style={[editStyles.fieldInput, { flex: 1 }]}
                  value={username}
                  onChangeText={text => setUsername(text.replace(/\s/g, '').toLowerCase())}
                  placeholder="usuario"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
              </View>
            </View>

            <View style={editStyles.field}>
              <Text style={editStyles.fieldLabel}>Biografía</Text>
              <TextInput
                style={[editStyles.fieldInput, editStyles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="Cuéntanos sobre ti..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={160}
                textAlignVertical="top"
              />
              <Text style={editStyles.charCount}>{bio.length}/160</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Grid Item ────────────────────────────────────────────────────────────────

interface GridItemProps {
  item: AppPost;
  isOwn: boolean;
  currentUserId?: string;
  onDeleted: (postId: string) => void;
}

const GridItem = React.memo(function GridItem({ item, isOwn, onDeleted }: GridItemProps) {
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.gridItem, pressed ? { opacity: 0.8 } : null]}
        onLongPress={() => isOwn ? setOptionsOpen(true) : undefined}
        delayLongPress={350}
      >
        {item.media_type === 'video' && item.video_url ? (
          <View style={styles.gridItemInner}>
            <Image
              source={{ uri: `https://picsum.photos/seed/${item.id}/200/200` }}
              style={styles.gridImage}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.gridBadge}>
              <Ionicons name="videocam" size={11} color="#fff" />
            </View>
          </View>
        ) : item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={styles.gridImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.gridImage, styles.gridTextItem]}>
            <Text style={styles.gridTextContent} numberOfLines={5}>{item.content}</Text>
          </View>
        )}
        {item.liked ? (
          <View style={styles.gridLikedDot} />
        ) : null}
        {isOwn ? (
          <Pressable
            style={styles.gridMoreBtn}
            onPress={() => setOptionsOpen(true)}
            hitSlop={4}
          >
            <Ionicons name="ellipsis-vertical" size={13} color="#fff" />
          </Pressable>
        ) : null}
      </Pressable>

      <PostOptionsSheet
        visible={optionsOpen}
        post={item}
        isOwn={isOwn}
        onClose={() => setOptionsOpen(false)}
        onDeleted={(postId) => {
          setOptionsOpen(false);
          onDeleted(postId);
        }}
      />
    </>
  );
});

// ─── Profile Screen ───────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, loading: authLoading, refreshProfile, user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [userPosts, setUserPosts] = useState<AppPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const loadUserPosts = useCallback(async () => {
    if (!profile?.id || !user?.id) return;
    setPostsLoading(true);
    const data = await fetchUserPosts(profile.id, user.id);
    setUserPosts(data);
    setPostsLoading(false);
  }, [profile?.id, user?.id]);

  useEffect(() => {
    loadUserPosts();
  }, [loadUserPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile?.(), loadUserPosts()]);
    setRefreshing(false);
  }, [refreshProfile, loadUserPosts]);

  const handlePostDeleted = useCallback((postId: string) => {
    setUserPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  // Tabs: posts / liked / media
  const likedPosts = userPosts.filter(p => p.liked);
  const mediaPosts = userPosts.filter(
    p => p.media_type === 'image' || p.media_type === 'video'
  );

  const activeData: AppPost[] =
    activeTab === 'posts' ? userPosts
    : activeTab === 'liked' ? likedPosts
    : mediaPosts;

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleSaveProfile = async (updates: {
    name: string;
    bio: string;
    username: string;
    avatarUri: string;
  }) => {
    if (!profile?.id) return;
    let avatarUrl = profile.avatar;

    if (updates.avatarUri && updates.avatarUri !== profile.avatar) {
      const uploaded = await uploadAvatar(updates.avatarUri, profile.id);
      if (uploaded) avatarUrl = uploaded;
    }

    const { error } = await updateUserProfile(profile.id, {
      name: updates.name,
      bio: updates.bio,
      username: updates.username,
      avatar: avatarUrl,
    });

    if (error) {
      Alert.alert('Error', error);
      return;
    }
    await refreshProfile?.();
  };

  // ── Loading / error states ────────────────────────────────────────────────

  if (authLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.centered]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.centered, { gap: Spacing.md }]}>
        <Ionicons name="person-circle-outline" size={64} color={Colors.textMuted} />
        <Text style={styles.errorText}>No se pudo cargar el perfil</Text>
        <Pressable style={styles.retryBtn} onPress={() => refreshProfile?.()}>
          <Text style={styles.retryBtnText}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  const tabs: { id: TabType; label: string; icon: string; count: number }[] = [
    { id: 'posts', label: 'Posts', icon: 'grid-outline', count: userPosts.length },
    { id: 'liked', label: 'Me gusta', icon: 'heart-outline', count: likedPosts.length },
    { id: 'media', label: 'Media', icon: 'images-outline', count: mediaPosts.length },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>
            {profile.verified ? (
              <MaterialIcons name="verified" size={16} color={Colors.primary} />
            ) : null}
            {' '}{profile.username}
          </Text>
          <View style={styles.topBarActions}>
            <Pressable
              style={styles.iconBtn}
              hitSlop={8}
              onPress={() => setEditModalVisible(true)}
            >
              <Ionicons name="create-outline" size={22} color={Colors.textSecondary} />
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              hitSlop={8}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut
                ? <ActivityIndicator color={Colors.error} size="small" />
                : <Ionicons name="log-out-outline" size={22} color={Colors.error} />
              }
            </Pressable>
          </View>
        </View>

        {/* ── Cover banner ─────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Colors.primary + 'CC', Colors.secondary + '88', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverBanner}
        >
          {/* wave cutout */}
          <View style={styles.coverWave} />
        </LinearGradient>

        {/* ── Avatar row ───────────────────────────────────────────────────── */}
        <View style={styles.avatarRow}>
          <Pressable style={styles.avatarWrapper} onPress={() => setEditModalVisible(true)}>
            <Avatar uri={profile.avatar} size={86} />
            <View style={styles.avatarEditDot}>
              <MaterialIcons name="edit" size={12} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.avatarRowRight}>
            <Pressable
              style={styles.editBtn}
              onPress={() => setEditModalVisible(true)}
            >
              <Text style={styles.editBtnText}>Editar perfil</Text>
            </Pressable>
            <Pressable style={styles.shareBtn}>
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* ── User info ────────────────────────────────────────────────────── */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{profile.name || profile.username}</Text>
            {profile.verified ? (
              <MaterialIcons
                name="verified"
                size={17}
                color={Colors.primary}
                style={{ marginLeft: 5 }}
              />
            ) : null}
          </View>
          <Text style={styles.handle}>@{profile.username}</Text>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Pressable onPress={() => setEditModalVisible(true)}>
              <Text style={styles.bioPlaceholder}>+ Añade una bio</Text>
            </Pressable>
          )}
          <View style={styles.metaRow}>
            <Ionicons name="mail-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.metaText}>{profile.email}</Text>
          </View>
        </View>

        {/* ── Stats card ───────────────────────────────────────────────────── */}
        <View style={styles.statsCard}>
          <StatItem value={formatStat(userPosts.length || profile.posts_count)} label="Posts" />
          <View style={styles.statDivider} />
          <StatItem value={formatStat(profile.followers_count)} label="Seguidores" />
          <View style={styles.statDivider} />
          <StatItem value={formatStat(profile.following_count)} label="Siguiendo" />
        </View>

        {/* ── Content tabs ─────────────────────────────────────────────────── */}
        <View style={styles.tabsBar}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[styles.tabBtn, isActive ? styles.tabBtnActive : null]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={17}
                  color={isActive ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                  {tab.label}
                </Text>
                {tab.count > 0 ? (
                  <View style={[styles.tabCount, isActive ? styles.tabCountActive : null]}>
                    <Text style={[styles.tabCountText, isActive ? styles.tabCountTextActive : null]}>
                      {tab.count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* ── Posts grid ───────────────────────────────────────────────────── */}
        <View style={styles.gridWrapper}>
          {postsLoading ? (
            <View style={styles.gridLoading}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.gridLoadingText}>Cargando posts...</Text>
            </View>
          ) : activeData.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrapper}>
                <Ionicons
                  name={
                    activeTab === 'posts'
                      ? 'create-outline'
                      : activeTab === 'liked'
                      ? 'heart-outline'
                      : 'images-outline'
                  }
                  size={44}
                  color={Colors.textMuted}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'posts'
                  ? 'Sin publicaciones todavía'
                  : activeTab === 'liked'
                  ? 'Sin likes todavía'
                  : 'Sin fotos ni videos'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'posts'
                  ? 'Crea tu primer post y aparecerá aquí 🌊'
                  : activeTab === 'liked'
                  ? 'Da like a publicaciones del feed para verlas aquí'
                  : 'Sube fotos o videos en tus posts para verlos aquí'}
              </Text>
              {activeTab === 'posts' ? (
                <Pressable
                  style={styles.createFirstPostBtn}
                  onPress={() => router.push('/(tabs)/create' as any)}
                >
                  <LinearGradient
                    colors={[Colors.primary, Colors.secondary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.createFirstPostGradient}
                  >
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.createFirstPostText}>Crear post</Text>
                  </LinearGradient>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <FlatList
              data={activeData}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <GridItem
                  item={item}
                  isOwn={item.user.id === user?.id}
                  currentUserId={user?.id}
                  onDeleted={handlePostDeleted}
                />
              )}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
              contentContainerStyle={{ paddingBottom: Spacing.xl }}
            />
          )}
        </View>
      </ScrollView>

      {/* ── Edit Profile Modal ─────────────────────────────────────────────── */}
      <EditProfileModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveProfile}
        initialName={profile.name}
        initialBio={profile.bio}
        initialUsername={profile.username}
        initialAvatar={profile.avatar}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.base },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
  },
  retryBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.base },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  topBarTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  topBarActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  // Cover
  coverBanner: {
    height: 110,
    marginBottom: -44,
    overflow: 'hidden',
    position: 'relative',
  },
  coverWave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 48,
    borderTopRightRadius: 48,
  },

  // Avatar row
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  avatarWrapper: { position: 'relative' },
  avatarEditDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  avatarRowRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  editBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
    minWidth: 110,
    alignItems: 'center',
  },
  editBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User info
  userInfo: { paddingHorizontal: Spacing.md, gap: 3, marginBottom: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  displayName: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  handle: { fontSize: FontSize.base, color: Colors.textMuted },
  bio: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginTop: 4 },
  bioPlaceholder: { fontSize: FontSize.base, color: Colors.primary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Stats card
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statItem: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.surfaceBorder, alignSelf: 'center' },

  // Tabs
  tabsBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  tabCount: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabCountActive: { backgroundColor: Colors.primary + '33' },
  tabCountText: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  tabCountTextActive: { color: Colors.primary },

  // Grid
  gridWrapper: { paddingHorizontal: 0, minHeight: 200 },
  gridRow: { gap: GRID_GAP },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  gridItemInner: { width: '100%', height: '100%' },
  gridImage: { width: '100%', height: '100%' },
  gridTextItem: {
    padding: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTextContent: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, textAlign: 'center' },
  gridBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 3,
  },
  gridLikedDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.error,
  },
  gridMoreBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Grid states
  gridLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  gridLoadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  createFirstPostBtn: { marginTop: Spacing.sm, borderRadius: Radii.full, overflow: 'hidden' },
  createFirstPostGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
  },
  createFirstPostText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.base },
});

const editStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    paddingTop: 56,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cancelText: { fontSize: FontSize.base, color: Colors.textSecondary },
  saveText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatarBtn: { position: 'relative', width: 104, height: 104 },
  avatarImage: { width: 104, height: 104, borderRadius: 52 },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 38,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomLeftRadius: 52,
    borderBottomRightRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  avatarOverlayText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.medium },
  fieldsContainer: { paddingHorizontal: Spacing.md, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  field: { gap: 8 },
  fieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  atSign: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    paddingHorizontal: 10,
    paddingVertical: 13,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radii.md,
    borderBottomLeftRadius: Radii.md,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: Colors.surfaceBorder,
  },
  bioInput: { minHeight: 96 },
  charCount: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
});
