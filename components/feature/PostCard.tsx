import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Share, Platform } from 'react-native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { CommentsBottomSheet } from '@/components/feature/CommentsBottomSheet';
import { PostOptionsSheet } from '@/components/feature/PostOptionsSheet';
import { MentionText } from '@/components/ui/MentionText';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, Radii, FontSize, FontWeight, Shadows } from '@/constants/theme';
import { AppPost } from '@/types/database';

interface PostCardProps {
  post: AppPost;
  onLike: (id: string) => void;
  onDeleted?: (postId: string) => void;
  /** When provided, auto-plays only the video whose postId matches */
  visiblePostId?: string | null;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatVideoTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoPost — inline video player
//
// Android SurfaceView limitation:
//   expo-video renders via a hardware-accelerated SurfaceView on Android.
//   SurfaceViews exist in a separate z-layer BELOW the regular View hierarchy,
//   so any absoluteFill overlay causes the video surface to appear black.
//   Fix: on Android, delegate all controls to nativeControls=true (which also
//   provides a native volume slider). On iOS/web we keep our custom seek bar.
// ─────────────────────────────────────────────────────────────────────────────
const IS_ANDROID = Platform.OS === 'android';

function VideoPost({ uri, autoPlay }: { uri: string; autoPlay: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekBarWidthRef = useRef(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    // On Android we let native controls manage mute; start unmuted so the
    // user can hear audio immediately (matching typical Android video UX).
    p.muted = IS_ANDROID ? false : true;
  });

  // React to autoPlay changes (viewability-driven)
  useEffect(() => {
    if (!player) return;
    if (autoPlay) {
      try { player.play(); setPlaying(true); } catch { /* noop */ }
    } else {
      try { player.pause(); setPlaying(false); } catch { /* noop */ }
    }
  }, [autoPlay]);

  // Poll currentTime + duration at 4fps while playing (iOS/web custom controls)
  useEffect(() => {
    if (IS_ANDROID || !playing) return;
    const interval = setInterval(() => {
      try {
        const ct = player.currentTime ?? 0;
        const dur = player.duration ?? 0;
        setCurrentTime(ct);
        if (dur > 0) setDuration(dur);
      } catch { /* noop */ }
    }, 250);
    return () => clearInterval(interval);
  }, [playing, player]);

  // Grab duration once on mount (iOS/web)
  useEffect(() => {
    if (IS_ANDROID) return;
    const timer = setTimeout(() => {
      try {
        const dur = player.duration ?? 0;
        if (dur > 0) setDuration(dur);
      } catch { /* noop */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [player]);

  // Animate seek bar fill (iOS/web only)
  useEffect(() => {
    if (IS_ANDROID) return;
    const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [currentTime, duration]);

  const togglePlay = useCallback(() => {
    if (!player) return;
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  }, [player, playing]);

  const toggleMute = useCallback(() => {
    if (!player) return;
    const next = !muted;
    player.muted = next;
    setMuted(next);
  }, [player, muted]);

  const handleSeek = useCallback((event: any) => {
    if (!player || duration <= 0 || seekBarWidthRef.current <= 0) return;
    const { locationX } = event.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / seekBarWidthRef.current));
    const seekTo = ratio * duration;
    try {
      player.currentTime = seekTo;
      setCurrentTime(seekTo);
    } catch { /* noop */ }
  }, [player, duration]);

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── Android: delegate everything to native controls ────────────────────────
  // nativeControls=true forces Android to properly initialise the SurfaceView
  // render path AND provides a built-in volume slider + scrubber.
  if (IS_ANDROID) {
    return (
      <View style={styles.videoWrapper}>
        <VideoView
          player={player}
          style={styles.postVideo}
          contentFit="cover"
          nativeControls={true}
          allowsFullscreen={false}
        />
      </View>
    );
  }

  // ── iOS / Web: custom seek bar + play/pause overlay ───────────────────────
  return (
    <View style={styles.videoWrapper}>
      <VideoView
        player={player}
        style={styles.postVideo}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />

      {/* Tap area (above seek bar) to play/pause */}
      <Pressable
        style={[StyleSheet.absoluteFill, { bottom: 44 }]}
        onPress={togglePlay}
      >
        {!playing ? (
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>
        ) : null}
      </Pressable>

      {/* ── Bottom seek bar ── */}
      <View style={styles.seekBarArea} pointerEvents="box-none">
        <View style={styles.videoTimeRow}>
          <Text style={styles.videoTimeText}>{formatVideoTime(currentTime)}</Text>
          <Text style={styles.videoTimeText}>{formatVideoTime(duration)}</Text>
        </View>
        <Pressable
          style={styles.seekBarTrack}
          onPress={handleSeek}
          onLayout={e => { seekBarWidthRef.current = e.nativeEvent.layout.width; }}
          hitSlop={{ top: 10, bottom: 10 }}
        >
          <View style={styles.seekBarBg} />
          <Animated.View style={[styles.seekBarFill, { width: fillWidth as any }]} />
          <Animated.View
            style={[
              styles.seekBarThumb,
              {
                left: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, seekBarWidthRef.current > 0 ? seekBarWidthRef.current - 10 : 10],
                }) as any,
              },
            ]}
          />
        </Pressable>
      </View>

      {/* Mute button — top-right */}
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
export const PostCard = React.memo(function PostCard({ post, onLike, onDeleted, visiblePostId }: PostCardProps) {
  const autoPlay = visiblePostId === post.id;
  const { user } = useAuth();
  const [scale] = useState(new Animated.Value(1));
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState(post.comments_count);
  const [deleted, setDeleted] = useState(false);

  const isOwnPost = user?.id === post.user.id;

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

  const handleShare = useCallback(async () => {
    try {
      const author = post.user.name || `@${post.user.username}`;
      const preview = post.content.length > 120
        ? post.content.slice(0, 120) + '…'
        : post.content;
      await Share.share({
        message: `${author} en ConnectWave:\n\n"${preview}"`,
        title: `Post de ${author}`,
      });
    } catch {
      // User cancelled
    }
  }, [post]);

  const handleDeleted = useCallback((postId: string) => {
    setDeleted(true);
    onDeleted?.(postId);
  }, [onDeleted]);

  if (deleted) return null;

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
          <Text style={styles.username}>@{post.user.username}</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.timestampRelative}>{post.timestamp}</Text>
            <Text style={styles.timeDot}>·</Text>
            <Text style={styles.timestampAbsolute}>{post.datetime}</Text>
          </View>
        </View>
        <Pressable hitSlop={8} style={styles.moreBtn} onPress={() => setOptionsOpen(true)}>
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
        <VideoPost uri={post.video_url} autoPlay={autoPlay} />
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

        <Pressable style={styles.actionBtn} hitSlop={8} onPress={handleShare}>
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

      {/* Post options sheet */}
      <PostOptionsSheet
        visible={optionsOpen}
        post={post}
        isOwn={isOwnPost}
        onClose={() => setOptionsOpen(false)}
        onDeleted={handleDeleted}
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  timestampRelative: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  timeDot: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  timestampAbsolute: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: FontWeight.regular,
  },
  moreBtn: { padding: Spacing.xs },
  content: {
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  imageWrapper: { borderRadius: Radii.md, overflow: 'hidden', marginBottom: Spacing.sm },
  postImage: { width: '100%', height: 240, borderRadius: Radii.md },

  // ── Video player ──
  videoWrapper: {
    borderRadius: Radii.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    height: 280,
    position: 'relative',
    backgroundColor: '#000',
  },
  postVideo: { width: '100%', height: '100%' },
  playOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Seek bar area ──
  seekBarArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 24,
    // Subtle dark gradient so controls are readable over any video frame
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  videoTimeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  seekBarTrack: {
    height: 18,
    justifyContent: 'center',
    position: 'relative',
  },
  seekBarBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  seekBarFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  seekBarThumb: {
    position: 'absolute',
    top: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 4,
  },

  // Mute button — top-right corner
  muteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Actions row ──
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
