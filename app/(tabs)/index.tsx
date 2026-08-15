import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PostCard } from '@/components/feature/PostCard';
import { StoryBar } from '@/components/feature/StoryBar';
import { useApp } from '@/hooks/useApp';
import { MOCK_STORIES } from '@/constants/mockData';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { posts, toggleLike } = useApp();

  const renderPost = useCallback(
    ({ item }: { item: typeof posts[0] }) => (
      <PostCard post={item} onLike={toggleLike} />
    ),
    [toggleLike]
  );

  const ListHeader = useCallback(
    () => (
      <View>
        <StoryBar stories={MOCK_STORIES} />
      </View>
    ),
    []
  );

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
        data={posts}
        keyExtractor={item => item.id}
        renderItem={renderPost}
        ListHeaderComponent={ListHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
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
  list: {
    paddingBottom: Spacing.xl,
  },
});
