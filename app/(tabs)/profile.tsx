import React, { useState, useCallback, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { signOut, updateUserProfile } from '@/services/authService';
import { supabase } from '@/lib/supabase';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppPost } from '@/types/database';

type TabType = 'posts' | 'liked' | 'media';

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

async function uploadAvatar(uri: string, userId: string): Promise<string | null> {
  try {
    const ext = 'jpg';
    const fileName = `${userId}/avatar.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();

    if (Platform.OS === 'web') {
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) return null;
    } else {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      });
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (error) return null;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl + `?t=${Date.now()}`;
  } catch {
    return null;
  }
}

// ─── Edit Profile Modal ───────────────────────────────────────────────────────
interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (updates: { name: string; bio: string; username: string; avatar?: string }) => Promise<void>;
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
  }, [visible]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'El nombre no puede estar vacío.'); return; }
    if (!username.trim()) { Alert.alert('Error', 'El usuario no puede estar vacío.'); return; }
    setSaving(true);
    await onSave({ name: name.trim(), bio: bio.trim(), username: username.trim(), avatar: avatarUri });
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={editStyles.container}>
        <View style={editStyles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={editStyles.cancelText}>Cancelar</Text>
          </Pressable>
          <Text style={editStyles.title}>Editar perfil</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            {saving ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={editStyles.saveText}>Guardar</Text>
            )}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
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
                <Ionicons name="camera" size={22} color="#fff" />
                <Text style={editStyles.avatarOverlayText}>Cambiar foto</Text>
              </View>
            </Pressable>
          </View>

          {/* Fields */}
          <View style={editStyles.fieldsContainer}>
            <View style={editStyles.field}>
              <Text style={editStyles.fieldLabel}>Nombre</Text>
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
              <Text style={editStyles.fieldLabel}>Usuario</Text>
              <View style={editStyles.usernameRow}>
                <Text style={editStyles.atSign}>@</Text>
                <TextInput
                  style={[editStyles.fieldInput, { flex: 1 }]}
                  value={username}
                  onChangeText={text => setUsername(text.replace(/\s/g, '').toLowerCase())}
                  placeholder="usuario"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
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
              />
              <Text style={editStyles.charCount}>{bio.length}/160</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, loading, refreshProfile } = useAuth();
  const { posts } = useApp();
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [signingOut, setSigningOut] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Filter posts by current user
  const userPosts = posts.filter(p => p.user.id === profile?.id);
  const likedPosts = posts.filter(p => p.liked);
  const mediaPosts = posts.filter(
    p => p.user.id === profile?.id && (p.media_type === 'image' || p.media_type === 'video')
  );

  const activeData: AppPost[] =
    activeTab === 'posts' ? userPosts : activeTab === 'liked' ? likedPosts : mediaPosts;

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
    avatar?: string;
  }) => {
    if (!profile?.id) return;
    let avatarUrl = profile.avatar;

    // Upload new avatar if changed
    if (updates.avatar && updates.avatar !== profile.avatar) {
      const uploaded = await uploadAvatar(updates.avatar, profile.id);
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

  if (loading || !profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'posts', label: 'Posts', icon: 'grid-outline' },
    { id: 'liked', label: 'Me gusta', icon: 'heart-outline' },
    { id: 'media', label: 'Media', icon: 'images-outline' },
  ];

  const renderGridItem = ({ item }: { item: AppPost }) => (
    <Pressable style={styles.gridItem}>
      {item.media_type === 'video' && item.video_url ? (
        <View style={styles.gridImage}>
          <Image
            source={{ uri: `https://i.pravatar.cc/200?img=${Math.floor(Math.random() * 30)}` }}
            style={styles.gridImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.gridVideoLabel}>
            <Ionicons name="videocam" size={12} color="#fff" />
          </View>
        </View>
      ) : item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.gridImage} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.gridImage, styles.gridTextPost]}>
          <Text style={styles.gridTextContent} numberOfLines={4}>{item.content}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          <View style={styles.headerActions}>
            <Pressable hitSlop={8} style={styles.headerBtn} onPress={() => setEditModalVisible(true)}>
              <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
            </Pressable>
            <Pressable onPress={handleSignOut} hitSlop={8} style={styles.headerBtn} disabled={signingOut}>
              {signingOut ? (
                <ActivityIndicator color={Colors.error} size="small" />
              ) : (
                <Ionicons name="log-out-outline" size={22} color={Colors.error} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Cover Banner */}
        <LinearGradient
          colors={[Colors.primary, Colors.secondary, Colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverBanner}
        >
          <View style={styles.waveLine} />
        </LinearGradient>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <Pressable style={styles.avatarWrapper} onPress={() => setEditModalVisible(true)}>
            <Avatar uri={profile.avatar} size={82} />
            <View style={styles.editAvatarBtn}>
              <MaterialIcons name="edit" size={14} color="#fff" />
            </View>
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable style={styles.editProfileBtn} onPress={() => setEditModalVisible(true)}>
              <Text style={styles.editProfileBtnText}>Editar perfil</Text>
            </Pressable>
            <Pressable style={styles.shareBtn}>
              <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name || profile.username}</Text>
            {profile.verified ? (
              <MaterialIcons name="verified" size={16} color={Colors.primary} style={{ marginLeft: 4 }} />
            ) : null}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          <Text style={styles.metaText}>{profile.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatItem value={formatStat(userPosts.length || profile.posts_count)} label="Posts" />
          <View style={styles.statDivider} />
          <StatItem value={formatStat(profile.followers_count)} label="Seguidores" />
          <View style={styles.statDivider} />
          <StatItem value={formatStat(profile.following_count)} label="Siguiendo" />
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {tabs.map(tab => (
            <Pressable
              key={tab.id}
              style={[styles.tabBtn, activeTab === tab.id ? styles.tabBtnActive : null]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.id ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.tabLabel, activeTab === tab.id ? styles.tabLabelActive : null]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content Grid */}
        <View style={styles.gridContainer}>
          {activeData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === 'posts' ? 'create-outline' : activeTab === 'liked' ? 'heart-outline' : 'images-outline'}
                size={48}
                color={Colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'posts'
                  ? 'Sin posts todavía'
                  : activeTab === 'liked'
                  ? 'Sin likes todavía'
                  : 'Sin media todavía'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'posts' ? 'Crea tu primer post 🌊' : 'Explora el feed para interactuar'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeData}
              keyExtractor={item => item.id}
              renderItem={renderGridItem}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              ItemSeparatorComponent={() => <View style={{ height: 3 }} />}
            />
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      {profile ? (
        <EditProfileModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          onSave={handleSaveProfile}
          initialName={profile.name}
          initialBio={profile.bio}
          initialUsername={profile.username}
          initialAvatar={profile.avatar}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  coverBanner: {
    height: 120,
    marginBottom: -40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  waveLine: {
    width: '150%',
    height: 40,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    position: 'absolute',
    bottom: 0,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  avatarWrapper: { position: 'relative' },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  editProfileBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.primary,
  },
  editProfileBtnText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.sm },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { paddingHorizontal: Spacing.md, gap: 4, marginBottom: Spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  username: { fontSize: FontSize.base, color: Colors.textMuted },
  bio: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 22, marginTop: 4 },
  metaText: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.surfaceBorder, alignSelf: 'center' },
  tabsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.surfaceBorder,
    marginBottom: Spacing.xs,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
  tabLabelActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  gridContainer: { paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xl },
  gridRow: { gap: 3 },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: '33.3%',
    borderRadius: Radii.sm,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  gridImage: { width: '100%', height: '100%' },
  gridVideoLabel: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 3,
  },
  gridTextPost: {
    padding: 8,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  gridTextContent: {
    fontSize: 10,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  emptySubtitle: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', lineHeight: 22 },
});

const editStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    paddingTop: 56,
  },
  title: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cancelText: { fontSize: FontSize.base, color: Colors.textSecondary },
  saveText: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  avatarBtn: { position: 'relative', width: 100, height: 100 },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  avatarOverlayText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.medium },
  fieldsContainer: { paddingHorizontal: Spacing.md, gap: Spacing.md },
  field: { gap: 6 },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  atSign: { fontSize: FontSize.base, color: Colors.textMuted, paddingLeft: 4 },
  bioInput: { minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
});
