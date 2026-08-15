import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PostCard } from '@/components/feature/PostCard';
import { StoryBar } from '@/components/feature/StoryBar';
import { useApp } from '@/hooks/useApp';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppPost } from '@/types/database';
import { MOCK_STORIES } from '@/constants/mockData';

const FILTER_CATEGORIES = ['Todo', 'Fotos', 'Videos', 'Trending'] as const;
type FilterCategory = (typeof FILTER_CATEGORIES)[number];

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { posts, toggleLike, loadingPosts, refreshPosts, loadMorePosts, loadingMorePosts, hasMorePosts } = useApp();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('Todo');

  const filteredPosts = posts.filter(p => {
    if (activeFilter === 'Todo') return true;
    if (activeFilter === 'Fotos') return p.media_type === 'image' || p.image_url != null;
    if (activeFilter === 'Videos') return p.media_type === 'video';
    // Trending: top 20% by likes
    const avgLikes = posts.reduce((s, pp) => s + pp.likes_count, 0) / Math.max(posts.length, 1);
    return p.likes_count >= avgLikes;
  });

  const renderPost = useCallback(
    ({ item }: { item: AppPost }) => (
      <PostCard post={item} onLike={toggleLike} />
    ),
    [toggleLike]
  );

  const keyExtractor = useCallback((item: AppPost) => item.id, []);

  const ListHeaderComponent = useCallback(
    () => (
      <>
        <StoryBar stories={MOCK_STORIES} />
        {/* Category filter chips */}
        <View style={styles.filterRow}>
          {FILTER_CATEGORIES.map(cat => {
            const active = activeFilter === cat;
            return (
              <Pressable
                key={cat}
                style={[styles.chip, active ? styles.chipActive : null]}
                onPress={() => setActiveFilter(cat)}
                hitSlop={6}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </>
    ),
    [activeFilter]
  );

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyState}>
        {loadingPosts ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : (
          <>
            <Ionicons name="newspaper-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>El feed esta vacio</Text>
            <Text style={styles.emptySubtitle}>
              Crea tu primer post o espera a que otros publiquen 🌊
            </Text>
          </>
        )}
      </View>
    ),
    [loadingPosts]
  );

  const ListFooterComponent = useCallback(
    () => {
      if (!loadingMorePosts && !hasMorePosts && filteredPosts.length > 0) {
        return (
          <View style={styles.endReached}>
            <Text style={styles.endReachedText}>Has llegado al final 🌊</Text>
          </View>
        );
      }
      if (loadingMorePosts) {
        return (
          <View style={styles.loadingMore}>
            <ActivityIndicator color={Colors.primary} size="small" />
          </View>
        );
      }
      return null;
    },
    [loadingMorePosts, hasMorePosts, filteredPosts.length]
  );

  const handleEndReached = useCallback(() => {
    if (activeFilter === 'Todo' && !loadingMorePosts && hasMorePosts) {
      loadMorePosts();
    }
  }, [activeFilter, loadingMorePosts, hasMorePosts, loadMorePosts]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <LinearGradient
          colors={[Colors.primary, Colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.logoGradient}
        >
          <Text style={styles.logoText}>CW</Text>
        </LinearGradient>
        <Text style={styles.appName}>ConnectWave</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="notifications-outline" size={24} color={Colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.iconBtn} hitSlop={8}>
            <Ionicons name="search-outline" size={24} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={filteredPosts}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={filteredPosts.length === 0 ? styles.emptyList : styles.list}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={loadingPosts}
            onRefresh={refreshPosts}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        removeClippedSubviews
        windowSize={7}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    gap: 10,
  },
  logoGradient: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: FontWeight.bold,
  },
  appName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: FontWeight.semibold,
  },
  list: {
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  endReached: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  endReachedText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
});
