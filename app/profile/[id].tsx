import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { fetchPublicProfile } from '@/services/searchService';
import { fetchUserPosts } from '@/services/postService';
import { Colors, Spacing, FontSize, FontWeight, Radii, Shadows } from '@/constants/theme';
import { AppUser, AppPost } from '@/types/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * 2) / 3;

type TabType = 'posts' | 'media';

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Grid item ────────────────────────────────────────────────────────────────

const GridItem = React.memo(function GridItem({ item }: { item: AppPost }) {
  return (
    <Pressable
      style={({ pressed }) => [gridStyles.item, pressed ? { opacity: 0.8 } : null]}
    >
      {item.media_type === 'video' && item.video_url ? (
        <View style={gridStyles.inner}>
          <Image
            source={{ uri: `https://picsum.photos/seed/${item.id}/200/200` }}
            style={gridStyles.image}
            contentFit="cover"
            transition={200}
          />
          <View style={gridStyles.badge}>
            <Ionicons name="videocam" size={11} color="#fff" />
          </View>
        </View>
      ) : item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={gridStyles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[gridStyles.image, gridStyles.textItem]}>
          <Text style={gridStyles.textContent} numberOfLines={5}>{item.content}</Text>
        </View>
      )}
    </Pressable>
  );
});

const gridStyles = StyleSheet.create({
  item: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceElevated,
  },
  inner: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 3,
  },
  textItem: {
    padding: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: { fontSize: 11, color: Colors.textSecondary, lineHeight: 16, textAlign: 'center' },
});

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonBanner} />
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonName} />
        <View style={styles.skeletonHandle} />
        <View style={styles.skeletonBio} />
      </View>
    </View>
  );
}

// ─── Public profile screen ────────────────────────────────────────────────────

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('posts');

  const loadData = useCallback(async () => {
    if (!id || !user?.id) return;
    const [profileData, postsData] = await Promise.all([
      fetchPublicProfile(id),
      (async () => {
        setPostsLoading(true);
        const data = await fetchUserPosts(id, user.id);
        setPostsLoading(false);
        return data;
      })(),
    ]);
    setProfile(profileData);
    setPosts(postsData);
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const mediaPosts = posts.filter(p => p.media_type === 'image' || p.media_type === 'video');
  const activeData = activeTab === 'posts' ? posts : mediaPosts;

  const tabs: { id: TabType; label: string; icon: string; count: number }[] = [
    { id: 'posts', label: 'Posts', icon: 'grid-outline', count: posts.length },
    { id: 'media', label: 'Media', icon: 'images-outline', count: mediaPosts.length },
  ];

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header bar */}
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={styles.headerBtn} />
        </View>
        <ProfileSkeleton />
      </View>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.centered]}>
        <View style={styles.headerBar}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Perfil</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-circle-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.errorText}>Perfil no encontrado</Text>
          <Pressable style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Volver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.username}
        </Text>
        <Pressable style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

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
        {/* ── Cover ───────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[Colors.primary + 'CC', Colors.secondary + '88', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.coverBanner}
        >
          <View style={styles.coverWave} />
        </LinearGradient>

        {/* ── Avatar row ──────────────────────────────────────────────── */}
        <View style={styles.avatarRow}>
          <Avatar uri={profile.avatar} size={86} />
          <View style={styles.avatarRowRight}>
            {/* Follow button (UI only) */}
            <Pressable style={{ borderRadius: Radii.full, overflow: 'hidden' }}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.followBtn}
              >
                <Ionicons name="person-add-outline" size={15} color="#fff" />
                <Text style={styles.followBtnText}>Seguir</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.messageBtn} onPress={() => router.back()}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.primary} />
            </Pressable>
          </View>
        </View>

        {/* ── User info ────────────────────────────────────────────────── */}
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
            <Text style={styles.bioEmpty}>Sin biografía</Text>
          )}
        </View>

        {/* ── Stats card ───────────────────────────────────────────────── */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatStat(posts.length || profile.posts_count)}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatStat(profile.followers_count)}</Text>
            <Text style={styles.statLabel}>Seguidores</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatStat(profile.following_count)}</Text>
            <Text style={styles.statLabel}>Siguiendo</Text>
          </View>
        </View>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
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

        {/* ── Grid ─────────────────────────────────────────────────────── */}
        <View style={styles.gridWrapper}>
          {postsLoading ? (
            <View style={styles.gridLoading}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : activeData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === 'posts' ? 'create-outline' : 'images-outline'}
                size={44}
                color={Colors.textMuted}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'posts' ? 'Sin publicaciones' : 'Sin fotos ni videos'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'posts'
                  ? `${profile.name || profile.username} no ha publicado nada aún`
                  : 'No hay fotos ni videos en sus posts'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={activeData}
              keyExtractor={item => item.id}
              renderItem={({ item }) => <GridItem item={item} />}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.gridRow}
              ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
              contentContainerStyle={{ paddingBottom: Spacing.xxl + insets.bottom }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { alignItems: 'center' },

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },

  // Skeleton
  skeletonContainer: { padding: Spacing.md },
  skeletonBanner: { height: 100, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.md, marginBottom: Spacing.md },
  skeletonAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: Colors.surfaceElevated, marginBottom: Spacing.sm },
  skeletonInfo: { gap: 8 },
  skeletonName: { height: 20, width: '50%', borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  skeletonHandle: { height: 14, width: '30%', borderRadius: 6, backgroundColor: Colors.surfaceElevated },
  skeletonBio: { height: 12, width: '80%', borderRadius: 5, backgroundColor: Colors.surfaceElevated },

  // Error
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.xxl,
  },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.base },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.full,
  },
  retryBtnText: { color: '#fff', fontWeight: FontWeight.semibold },

  // Cover
  coverBanner: {
    height: 100,
    marginBottom: -44,
    overflow: 'hidden',
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
  avatarRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 6,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md + 4,
    paddingVertical: 9,
    borderRadius: Radii.full,
    minWidth: 100,
    justifyContent: 'center',
  },
  followBtnText: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
    fontSize: FontSize.sm,
  },
  messageBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  bioEmpty: { fontSize: FontSize.base, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' },

  // Stats
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.md,
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
  gridWrapper: { minHeight: 200 },
  gridRow: { gap: GRID_GAP },
  gridLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
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
});
