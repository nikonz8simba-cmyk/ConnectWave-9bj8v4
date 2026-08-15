import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PostCard } from '@/components/feature/PostCard';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { fetchPostsByHashtag } from '@/services/hashtagService';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppPost } from '@/types/database';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
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
    <Animated.View style={[skelStyles.card, { opacity }]}>
      <View style={skelStyles.header}>
        <View style={skelStyles.avatar} />
        <View style={skelStyles.headerText}>
          <View style={skelStyles.nameLine} />
          <View style={skelStyles.subLine} />
        </View>
      </View>
      <View style={skelStyles.line1} />
      <View style={skelStyles.line2} />
      <View style={skelStyles.img} />
    </Animated.View>
  );
}

const skelStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  header: { flexDirection: 'row', gap: 10, marginBottom: 14, alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.surfaceElevated },
  headerText: { flex: 1, gap: 7 },
  nameLine: { height: 12, width: '45%', borderRadius: 6, backgroundColor: Colors.surfaceElevated },
  subLine: { height: 10, width: '30%', borderRadius: 5, backgroundColor: Colors.surfaceElevated },
  line1: { height: 11, width: '90%', borderRadius: 5, backgroundColor: Colors.surfaceElevated, marginBottom: 6 },
  line2: { height: 11, width: '65%', borderRadius: 5, backgroundColor: Colors.surfaceElevated, marginBottom: 14 },
  img: { height: 160, borderRadius: Radii.md, backgroundColor: Colors.surfaceElevated },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tag }: { tag: string }) {
  return (
    <View style={emptyStyles.container}>
      <LinearGradient
        colors={[Colors.secondary + '25', Colors.primary + '10']}
        style={emptyStyles.iconBg}
      >
        <Text style={emptyStyles.hashIcon}>#</Text>
      </LinearGradient>
      <Text style={emptyStyles.title}>Sin posts con #{tag}</Text>
      <Text style={emptyStyles.subtitle}>
        Nadie ha publicado con este hashtag todavía.{'\n'}
        ¡Sé el primero en usarlo!
      </Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xxl + Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  iconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  hashIcon: {
    fontSize: 44,
    fontWeight: FontWeight.bold,
    color: Colors.secondary,
    lineHeight: 52,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
});

// ─── Hashtag Feed Screen ──────────────────────────────────────────────────────

export default function HashtagFeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { user } = useAuth();
  const { toggleLike } = useApp();

  const [posts, setPosts] = useState<AppPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!tag || !user?.id) return;
    const data = await fetchPostsByHashtag(tag, user.id);
    setPosts(data);
    setLoading(false);
  }, [tag, user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, [loadPosts]);

  const renderPost = useCallback(
    ({ item }: { item: AppPost }) => <PostCard post={item} onLike={toggleLike} />,
    [toggleLike]
  );

  const keyExtractor = useCallback((item: AppPost) => item.id, []);

  const ListHeaderComponent = useCallback(
    () => (
      <View style={headerStyles.hero}>
        <LinearGradient
          colors={[Colors.secondary + 'CC', Colors.primary + '88']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={headerStyles.heroBg}
        />
        <View style={headerStyles.tagRow}>
          <Text style={headerStyles.hashSymbol}>#</Text>
          <Text style={headerStyles.tagName}>{tag}</Text>
        </View>
        <Text style={headerStyles.tagMeta}>
          {loading ? '…' : `${posts.length} ${posts.length === 1 ? 'publicación' : 'publicaciones'}`}
        </Text>
      </View>
    ),
    [tag, posts.length, loading]
  );

  const ListFooterComponent = useCallback(() => {
    if (posts.length > 0) {
      return (
        <View style={footerStyles.row}>
          <View style={footerStyles.line} />
          <Text style={footerStyles.text}>Fin de #{tag}</Text>
          <View style={footerStyles.line} />
        </View>
      );
    }
    return <View style={{ height: Spacing.xl }} />;
  }, [posts.length, tag]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Navigation bar ─────────────────────────────────────────────── */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>#{tag}</Text>
        <View style={styles.backBtn} />
      </View>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={item => String(item)}
          renderItem={() => <SkeletonCard />}
          ListHeaderComponent={ListHeaderComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={<EmptyState tag={tag ?? ''} />}
          ListFooterComponent={ListFooterComponent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={posts.length === 0 ? styles.emptyList : styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    backgroundColor: Colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  list: { paddingTop: 0, paddingBottom: Spacing.xxl },
  emptyList: { flexGrow: 1 },
});

const headerStyles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl + 4,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 6,
  },
  hashSymbol: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.secondary,
    lineHeight: 40,
  },
  tagName: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    lineHeight: 40,
    flexShrink: 1,
  },
  tagMeta: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
});

const footerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  line: { flex: 1, height: 1, backgroundColor: Colors.surfaceBorder },
  text: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: FontWeight.medium },
});
