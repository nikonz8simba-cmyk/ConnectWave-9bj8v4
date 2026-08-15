import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { CommentsBottomSheet } from '@/components/feature/CommentsBottomSheet';
import { MentionText } from '@/components/ui/MentionText';
import { Colors, Spacing, Radii, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { AppPost } from '@/types/database';

interface PostCardProps {
  post: AppPost;
  onLike: (id: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─────────────────────────────────────────────
// VideoPost — inline video player
// ─────────────────────────────────────────────
function VideoPost({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
  });
  const [muted, setMuted] = useState(true);

  const toggleMute = () => {
    player.muted = !player.muted;
    setMuted(v => !v);
  };

  return (
    <View style={styles.videoWrapper}>
      <VideoView
        player={player}
        style={styles.postVideo}
        contentFit="cover"
        nativeControls={false}
      />
      <Pressable style={styles.muteBtn} onPress={toggleMute} hitSlop={8}>
        <Ionicons
          name={muted ? 'volume-mute' : 'volume-high'}
          size={16}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────
// PostCard
// ─────────────────────────────────────────────
export const PostCard = React.memo(function PostCard({ post, onLike }: PostCardProps) {
  const [scale] = useState(new Animated.Value(1));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(post.comments_count);

  const handleLike = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.35, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 110, useNativeDriver: true }),
    ]).start();
    onLike(post.id);
  }, [onLike, post.id, scale]);

  const handleCommentCountChange = useCallback((delta: number) => {
    setLocalCommentsCount(prev => Math.max(0, prev + delta));
  }, []);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={post.user.avatar} size={42} />
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{post.user.name}</Text>
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
      {post.content ? (
        <MentionText
          text={post.content}
          style={styles.content}
        />
      ) : null}

      {/* Media */}
      {post.media_type === 'video' && post.video_url ? (
        <VideoPost uri={post.video_url} />
      ) : post.image_url ? (
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

        <Pressable
          style={styles.actionBtn}
          onPress={() => setCommentsOpen(true)}
          hitSlop={8}
        >
          <Ionicons
            name={commentsOpen ? 'chatbubble' : 'chatbubble-outline'}
            size={20}
            color={commentsOpen ? Colors.primary : Colors.textSecondary}
          />
          <Text style={styles.actionCount}>{formatCount(localCommentsCount)}</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} hitSlop={8}>
          <Ionicons name="arrow-redo-outline" size={21} color={Colors.textSecondary} />
          <Text style={styles.actionCount}>{formatCount(post.shares_count)}</Text>
        </Pressable>

        <Pressable style={[styles.actionBtn, { marginLeft: 'auto' }]} hitSlop={8}>
          <Ionicons name="bookmark-outline" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Comments bottom sheet */}
      <CommentsBottomSheet
        visible={commentsOpen}
        postId={post.id}
        commentsCount={localCommentsCount}
        onClose={() => setCommentsOpen(false)}
        onCountChange={handleCommentCountChange}
      />
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
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  username: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  moreBtn: { padding: Spacing.xs },
  content: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  imageWrapper: { borderRadius: Radii.md, overflow: 'hidden', marginBottom: Spacing.sm },
  postImage: { width: '100%', height: 240, borderRadius: Radii.md },
  videoWrapper: {
    borderRadius: Radii.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    height: 240,
    position: 'relative',
    backgroundColor: Colors.background,
  },
  postVideo: { width: '100%', height: '100%' },
  muteBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: Spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    paddingVertical: 4,
  },
  actionCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  likedCount: { color: Colors.secondary },
});
