import React, { useCallback, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PostCard } from '@/components/feature/PostCard';
import { StoryBar } from '@/components/feature/StoryBar';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppPost } from '@/types/database';
import { MOCK_STORIES } from '@/constants/mockData';

// ─── Filter configuration ────────────────────────────────────────────────────

type FilterCategory = 'Todo' | 'Fotos' | 'Videos' | 'Trending';

const FILTERS: {
  id: FilterCategory;
  label: string;
  icon: string;
  iconLib: 'ionicons' | 'mci';
}[] = [
  { id: 'Todo', label: 'Todo', icon: 'grid-outline', iconLib: 'ionicons' },
  { id: 'Fotos', label: 'Fotos', icon: 'image-outline', iconLib: 'ionicons' },
  { id: 'Videos', label: 'Videos', icon: 'videocam-outline', iconLib: 'ionicons' },
  { id: 'Trending', label: 'Trending', icon: 'trending-up', iconLib: 'mci' },
];

// ─── Post skeleton loader ─────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[skeletonStyles.card, { opacity }]}>
      <View style={skeletonStyles.header}>
        <View style={skeletonStyles.avatar} />
        <View style={skeletonStyles.headerText}>
          <View style={skeletonStyles.nameLine} />
          <View style={skeletonStyles.subLine} />
        </View>
      </View>
      <View style={skeletonStyles.contentLine1} />
      <View style={skeletonStyles.contentLine2} />
      <View style={skeletonStyles.image} />
      <View style={skeletonStyles.actionsRow}>
        <View style={skeletonStyles.actionPill} />
        <View style={skeletonStyles.actionPill} />
        <View style={skeletonStyles.actionPill} />
      </View>
    </Animated.View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceElevated },
  headerText: { flex: 1, gap: 6 },
  nameLine: { height: 12, width: '50%', borderRadius: 6, backgroundColor: Colors.surfaceElevated },
  subLine: { height: 10, width: '35%', borderRadius: 5, backgroundColor: Colors.surfaceElevated },
  contentLine1: { height: 11, width: '90%', borderRadius: 5, backgroundColor: Colors.surfaceElevated, marginBottom: 6 },
  contentLine2: { height: 11, width: '70%', borderRadius: 5, backgroundColor: Colors.surfaceElevated, marginBottom: Spacing.md },
  image: { height: 180, borderRadius: Radii.md, backgroundColor: Colors.surfaceElevated, marginBottom: Spacing.md },
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  actionPill: { height: 26, width: 56, borderRadius: 13, backgroundColor: Colors.surfaceElevated },
});

// ─── Filter chip ──────────────────────────────────────────────────────────────

interface FilterChipProps {
  item: (typeof FILTERS)[number];
  active: boolean;
  count?: number;
  onPress: () => void;
}

function FilterChip({ item, active, count, onPress }: FilterChipProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      style={[
        chipStyles.chip,
        active ? chipStyles.chipActive : null,
        pressed ? chipStyles.chipPressed : null,
      ]}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={6}
    >
      {active ? (
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={chipStyles.activeGradient}
        >
          <ChipIcon item={item} active={true} />
          <Text style={chipStyles.labelActive}>{item.label}</Text>
          {count != null && count > 0 ? (
            <View style={chipStyles.countBubbleActive}>
              <Text style={chipStyles.countTextActive}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </LinearGradient>
      ) : (
        <>
          <ChipIcon item={item} active={false} />
          <Text style={chipStyles.label}>{item.label}</Text>
          {count != null && count > 0 ? (
            <View style={chipStyles.countBubble}>
              <Text style={chipStyles.countText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

function ChipIcon({ item, active }: { item: (typeof FILTERS)[number]; active: boolean }) {
  const color = active ? '#fff' : Colors.textMuted;
  if (item.iconLib === 'mci') {
    return <MaterialCommunityIcons name={item.icon as any} size={14} color={color} />;
  }
  return <Ionicons name={item.icon as any} size={14} color={color} />;
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  chipActive: {
    borderColor: 'transparent',
    paddingHorizontal: 0,
  },
  chipPressed: { opacity: 0.75 },
  activeGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    height: 36,
  },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  labelActive: { fontSize: FontSize.sm, color: '#fff', fontWeight: FontWeight.semibold },
  countBubble: {
    backgroundColor: Colors.surfaceBorder,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBubbleActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: { fontSize: 10, color: Colors.textMuted, fontWeight: FontWeight.semibold },
  countTextActive: { fontSize: 10, color: '#fff', fontWeight: FontWeight.semibold },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyFeed({
  loading,
  filter,
  onCreatePost,
}: {
  loading: boolean;
  filter: FilterCategory;
  onCreatePost: () => void;
}) {
  if (loading) return null;

  const config = {
    Todo: {
      icon: 'telescope-outline' as const,
      title: 'El feed está vacío',
      subtitle: 'Crea tu primer post y empieza a conectar con el mundo 🌊',
      cta: 'Crear primer post',
    },
    Fotos: {
      icon: 'images-outline' as const,
      title: 'Sin fotos por aquí',
      subtitle: 'Sube una foto increíble y muéstrasela a todos 📸',
      cta: 'Subir foto',
    },
    Videos: {
      icon: 'videocam-outline' as const,
      title: 'Sin videos todavía',
      subtitle: 'Graba o sube un video para inspirar a tu comunidad 🎥',
      cta: 'Subir video',
    },
    Trending: {
      icon: 'trending-up-outline' as const,
      title: 'Nada en tendencia',
      subtitle: 'Las publicaciones más populares aparecerán aquí pronto 🔥',
      cta: undefined,
    },
  };

  const c = config[filter];

  return (
    <View style={emptyStyles.container}>
      <LinearGradient
        colors={[Colors.primary + '20', Colors.secondary + '10']}
        style={emptyStyles.iconBg}
      >
        <Ionicons name={c.icon} size={44} color={Colors.primary} />
      </LinearGradient>
      <Text style={emptyStyles.title}>{c.title}</Text>
      <Text style={emptyStyles.subtitle}>{c.subtitle}</Text>
      {c.cta ? (
        <Pressable onPress={onCreatePost} style={{ borderRadius: Radii.full, overflow: 'hidden', marginTop: Spacing.sm }}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={emptyStyles.ctaBtn}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={emptyStyles.ctaText}>{c.cta}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted, textAlign: 'center', lineHeight: 24 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radii.full,
  },
  ctaText: { color: '#fff', fontWeight: FontWeight.semibold, fontSize: FontSize.base },
});

// ─── Feed screen ──────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const {
    posts,
    toggleLike,
    loadingPosts,
    refreshPosts,
    loadMorePosts,
    loadingMorePosts,
    hasMorePosts,
  } = useApp();

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('Todo');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Derive filtered posts and counts per category
  const { filteredPosts, counts } = useMemo(() => {
    const avgLikes =
      posts.length > 0
        ? posts.reduce((s, p) => s + p.likes_count, 0) / posts.length
        : 0;

    const fotos = posts.filter(p => p.image_url != null || p.media_type === 'image');
    const videos = posts.filter(p => p.media_type === 'video');
    const trending = posts.filter(p => p.likes_count >= avgLikes * 1.5 && p.likes_count > 0);

    const counts: Record<FilterCategory, number> = {
      Todo: posts.length,
      Fotos: fotos.length,
      Videos: videos.length,
      Trending: trending.length,
    };

    let filtered: AppPost[];
    switch (activeFilter) {
      case 'Fotos': filtered = fotos; break;
      case 'Videos': filtered = videos; break;
      case 'Trending': filtered = trending; break;
      default: filtered = posts;
    }

    return { filteredPosts: filtered, counts };
  }, [posts, activeFilter]);

  // Header shadow on scroll
  const headerElevation = scrollY.interpolate({
    inputRange: [0, 30],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const renderPost = useCallback(
    ({ item }: { item: AppPost }) => <PostCard post={item} onLike={toggleLike} />,
    [toggleLike]
  );

  const keyExtractor = useCallback((item: AppPost) => item.id, []);

  const ListHeaderComponent = useCallback(
    () => (
      <View>
        <StoryBar stories={MOCK_STORIES} />
        {/* Filter chips row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={filterBarStyles.row}
          style={filterBarStyles.wrapper}
        >
          {FILTERS.map(f => (
            <FilterChip
              key={f.id}
              item={f}
              active={activeFilter === f.id}
              count={counts[f.id]}
              onPress={() => setActiveFilter(f.id)}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [activeFilter, counts]
  );

  const ListEmptyComponent = useCallback(
    () =>
      loadingPosts ? (
        <View style={styles.skeletonList}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <EmptyFeed
          loading={loadingPosts}
          filter={activeFilter}
          onCreatePost={() => router.push('/(tabs)/create' as any)}
        />
      ),
    [loadingPosts, activeFilter, router]
  );

  const ListFooterComponent = useCallback(() => {
    if (loadingMorePosts) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={Colors.primary} size="small" />
        </View>
      );
    }
    if (!hasMorePosts && filteredPosts.length > 0) {
      return (
        <View style={styles.endReached}>
          <View style={styles.endReachedLine} />
          <Text style={styles.endReachedText}>Has visto todo 🌊</Text>
          <View style={styles.endReachedLine} />
        </View>
      );
    }
    return <View style={{ height: Spacing.xl }} />;
  }, [loadingMorePosts, hasMorePosts, filteredPosts.length]);

  const handleEndReached = useCallback(() => {
    if (activeFilter === 'Todo' && !loadingMorePosts && hasMorePosts) {
      loadMorePosts();
    }
  }, [activeFilter, loadingMorePosts, hasMorePosts, loadMorePosts]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          {
            borderBottomWidth: headerElevation,
            shadowOpacity: Animated.multiply(headerElevation, 0.3),
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Text style={styles.logoText}>CW</Text>
          </LinearGradient>
          <View>
            <Text style={styles.appName}>ConnectWave</Text>
            <Text style={styles.appTagline}>Descubre lo que pasa 🌊</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="search-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <View>
              <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
              {/* Notification dot */}
              <View style={styles.notifDot} />
            </View>
          </Pressable>
        </View>
      </Animated.View>

      {/* ── Feed list ────────────────────────────────────────────────────── */}
      <Animated.FlatList
        data={filteredPosts}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          filteredPosts.length === 0 ? styles.emptyList : styles.list
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={loadingPosts && posts.length > 0}
            onRefresh={refreshPosts}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        removeClippedSubviews={Platform.OS !== 'web'}
        windowSize={7}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        initialNumToRender={4}
      />
    </View>
  );
}

// ─── Filter bar styles ────────────────────────────────────────────────────────

const filterBarStyles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 8,
    alignItems: 'center',
  },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoGradient: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  appName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  appTagline: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 14,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  notifDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },
  list: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  emptyList: {
    flexGrow: 1,
  },
  skeletonList: {
    paddingTop: Spacing.md,
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  endReached: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  endReachedLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  endReachedText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
});
