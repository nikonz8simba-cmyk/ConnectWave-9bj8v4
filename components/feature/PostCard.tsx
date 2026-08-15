import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, Radii, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { AppPost } from '@/types/database';

interface PostCardProps {
  post: AppPost;
  onLike: (id: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const PostCard = React.memo(function PostCard({ post, onLike }: PostCardProps) {
  const [scale] = useState(new Animated.Value(1));
  const [commentExpanded, setCommentExpanded] = useState(false);

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onLike(post.id);
  }, [onLike, post.id, scale]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={post.user.avatar} size={42} />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{post.user.name}</Text>
            {post.user.verified ? (
              <MaterialIcons name="verified" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
            ) : null}
          </View>
          <Text style={styles.username}>@{post.user.username} · {post.timestamp}</Text>
        </View>
        <Pressable hitSlop={8} style={styles.moreBtn}>
          <MaterialIcons name="more-horiz" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Content */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Image */}
      {post.image_url ? (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: post.image_url }}
            style={styles.postImage}
            contentFit="cover"
            transition={300}
          />
        </View>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={handleLike} hitSlop={8}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons
              name={post.liked ? 'heart' : 'heart-outline'}
              size={22}
              color={post.liked ? Colors.secondary : Colors.textSecondary}
            />
          </Animated.View>
          <Text style={[styles.actionCount, post.liked ? styles.likedCount : null]}>
            {formatCount(post.likes_count)}
          </Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={() => setCommentExpanded(v => !v)} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionCount}>{formatCount(post.comments_count)}</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} hitSlop={8}>
          <Ionicons name="arrow-redo-outline" size={21} color={Colors.textSecondary} />
          <Text style={styles.actionCount}>{formatCount(post.shares_count)}</Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, { marginLeft: 'auto' }]} hitSlop={8}>
          <Ionicons name="bookmark-outline" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {commentExpanded ? (
        <View style={styles.commentBox}>
          <Text style={styles.commentPlaceholder}>Se el primero en comentar... 💬</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    ...Shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  headerInfo: { flex: 1, marginLeft: Spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  username: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  moreBtn: { padding: Spacing.xs },
  content: { fontSize: FontSize.base, color: Colors.textPrimary, lineHeight: 24, marginBottom: Spacing.sm },
  imageWrapper: { borderRadius: Radii.md, overflow: 'hidden', marginBottom: Spacing.sm },
  postImage: { width: '100%', height: 220, borderRadius: Radii.md },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: Spacing.md,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingVertical: 4 },
  actionCount: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  likedCount: { color: Colors.secondary },
  commentBox: { marginTop: Spacing.sm, padding: Spacing.sm, backgroundColor: Colors.surfaceElevated, borderRadius: Radii.sm },
  commentPlaceholder: { color: Colors.textMuted, fontSize: FontSize.sm },
});
