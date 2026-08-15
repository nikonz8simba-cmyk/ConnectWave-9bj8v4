import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { AppUser, DbUserProfile } from '@/types/database';
import { mapDbProfileToAppUser } from '@/services/authService';

// ─── StoryBar ─────────────────────────────────────────────────────────────────
// Shows the current user's "add story" button + recently active real users.
// Data is fetched from user_profiles; no mock data is used.

export function StoryBar() {
  const { user, profile } = useAuth();
  const [recentUsers, setRecentUsers] = useState<AppUser[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      setLoading(true);
      // Fetch other users ordered by most recently updated (proxy for activity),
      // excluding the current user, up to 12 entries.
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, name, avatar, bio, verified, posts_count, followers_count, following_count, email, created_at, updated_at')
        .neq('id', user.id)
        .order('updated_at', { ascending: false })
        .limit(12);

      if (!error && data) {
        setRecentUsers((data as DbUserProfile[]).map(mapDbProfileToAppUser));
      }
      setLoading(false);
    };

    load();
  }, [user?.id]);

  const handleStoryPress = (id: string) => {
    setSeenIds(prev => new Set([...prev, id]));
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ── My Story (current user) ─────────────────────────────────── */}
        <Pressable style={styles.storyItem}>
          <View style={styles.myStoryWrapper}>
            <Avatar uri={profile?.avatar ?? 'https://i.pravatar.cc/150?img=7'} size={56} />
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.addBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.plusIcon}>+</Text>
            </LinearGradient>
          </View>
          <Text style={styles.storyName} numberOfLines={1}>Tu historia</Text>
        </Pressable>

        {/* ── Other real users ────────────────────────────────────────── */}
        {loading ? (
          // Skeleton placeholders while loading
          [1, 2, 3, 4].map(i => (
            <View key={i} style={styles.storyItem}>
              <View style={[styles.storyRing, styles.skeletonRing]}>
                <View style={styles.skeletonAvatar} />
              </View>
              <View style={styles.skeletonName} />
            </View>
          ))
        ) : recentUsers.length === 0 ? (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyText}>Invita amigos{'\n'}para ver sus historias</Text>
          </View>
        ) : (
          recentUsers.map(u => {
            const seen = seenIds.has(u.id);
            return (
              <Pressable
                key={u.id}
                style={styles.storyItem}
                onPress={() => handleStoryPress(u.id)}
              >
                <View style={styles.storyRingWrapper}>
                  {!seen ? (
                    <LinearGradient
                      colors={[Colors.primary, Colors.secondary]}
                      style={styles.storyRing}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View style={styles.storyInner}>
                        <Avatar uri={u.avatar} size={50} />
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.storyRing, styles.seenRing]}>
                      <View style={styles.storyInner}>
                        <Avatar uri={u.avatar} size={50} />
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.storyName} numberOfLines={1}>
                  {(u.name || u.username).split(' ')[0]}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 100,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceBorder,
    marginBottom: Spacing.md,
  },
  content: {
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
    width: 70,
  },
  myStoryWrapper: {
    position: 'relative',
  },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  plusIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: FontWeight.bold,
    lineHeight: 16,
  },
  storyRingWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenRing: {
    borderColor: Colors.textMuted,
  },
  storyInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyName: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
  // Skeleton
  skeletonRing: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: 'transparent',
  },
  skeletonAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceBorder,
  },
  skeletonName: {
    height: 10,
    width: 44,
    borderRadius: 5,
    backgroundColor: Colors.surfaceElevated,
  },
  // Empty hint
  emptyHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    opacity: 0.55,
  },
  emptyText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
