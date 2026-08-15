import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { MentionInput } from '@/components/ui/MentionInput';
import { MentionText } from '@/components/ui/MentionText';
import { useAuth } from '@/hooks/useAuth';
import { fetchComments, addComment, deleteComment } from '@/services/commentService';
import { supabase } from '@/lib/supabase';
import { AppComment } from '@/types/database';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

// ─── Comment item ─────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: AppComment;
  currentUserId?: string;
  onDelete: (id: string) => void;
}

function CommentItem({ comment, currentUserId, onDelete }: CommentItemProps) {
  const isOwn = comment.user.id === currentUserId;
  return (
    <View style={itemStyles.row}>
      <Avatar uri={comment.user.avatar} size={36} />
      <View style={itemStyles.body}>
        <View style={itemStyles.header}>
          <Text style={itemStyles.name} numberOfLines={1}>{comment.user.name}</Text>
          {comment.user.verified ? (
            <MaterialIcons name="verified" size={12} color={Colors.primary} />
          ) : null}
          {isOwn ? (
            <Pressable
              onPress={() => onDelete(comment.id)}
              hitSlop={8}
              style={itemStyles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={13} color={Colors.error} />
            </Pressable>
          ) : null}
        </View>
        <MentionText text={comment.content} style={itemStyles.content} />
        <View style={itemStyles.timeRow}>
          <Ionicons name="time-outline" size={10} color={Colors.textMuted} />
          <Text style={itemStyles.timeRelative}>{comment.timestamp}</Text>
          <Text style={itemStyles.timeDot}>·</Text>
          <Text style={itemStyles.timeAbsolute}>{comment.datetime}</Text>
        </View>
      </View>
    </View>
  );
}

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    gap: 10,
  },
  body: { flex: 1, gap: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginLeft: 'auto' as any,
  },
  deleteBtn: { padding: 2, marginLeft: 4 },
  content: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  timeRelative: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  timeDot: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  timeAbsolute: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyComments() {
  return (
    <View style={emptyStyles.container}>
      <LinearGradient
        colors={[Colors.primary + '20', Colors.secondary + '10']}
        style={emptyStyles.iconBg}
      >
        <Ionicons name="chatbubble-outline" size={32} color={Colors.primary} />
      </LinearGradient>
      <Text style={emptyStyles.title}>Sin comentarios</Text>
      <Text style={emptyStyles.sub}>Se el primero en comentar</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  sub: {
    fontSize: FontSize.base,
    color: Colors.textMuted,
  },
});

// ─── CommentsBottomSheet ──────────────────────────────────────────────────────

interface CommentsBottomSheetProps {
  visible: boolean;
  postId: string;
  commentsCount: number;
  onClose: () => void;
  onCountChange: (delta: number) => void;
}

export function CommentsBottomSheet({
  visible,
  postId,
  commentsCount,
  onClose,
  onCountChange,
}: CommentsBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<AppComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Load comments when opened
  useEffect(() => {
    if (visible && postId) {
      setLoading(true);
      fetchComments(postId).then(data => {
        setComments(data);
        setLoading(false);
      });
    } else {
      setComments([]);
      setInputText('');
    }
  }, [visible, postId]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Real-time subscription
  useEffect(() => {
    if (!visible || !postId) return;

    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        payload => {
          const newRow = payload.new as any;
          // Don't add duplicates (we add optimistically for current user)
          if (newRow.user_id === user?.id) return;
          fetchComments(postId).then(data => setComments(data));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [visible, postId, user?.id]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !user?.id || sending) return;

    // Optimistic comment
    const optimistic: AppComment = {
      id: `temp_${Date.now()}`,
      post_id: postId,
      user: {
        id: user.id,
        username: profile?.username ?? '',
        email: profile?.email ?? '',
        name: profile?.name ?? '',
        avatar: profile?.avatar ?? '',
        bio: profile?.bio ?? '',
        verified: profile?.verified ?? false,
        posts_count: profile?.posts_count ?? 0,
        followers_count: profile?.followers_count ?? 0,
        following_count: profile?.following_count ?? 0,
      },
      content: text,
      created_at: new Date().toISOString(),
      timestamp: 'ahora',
      datetime: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };

    setComments(prev => [...prev, optimistic]);
    setInputText('');
    setSending(true);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const { data, error } = await addComment(postId, user.id, text);
    setSending(false);

    if (error) {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setInputText(text);
    } else if (data) {
      setComments(prev => prev.map(c => c.id === optimistic.id ? data : c));
      onCountChange(1);
    }
  }, [inputText, user, profile, postId, sending, onCountChange]);

  const handleDelete = useCallback(async (commentId: string) => {
    if (!user?.id) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    const { error } = await deleteComment(commentId, user.id);
    if (!error) onCountChange(-1);
    else {
      // Revert
      fetchComments(postId).then(data => setComments(data));
    }
  }, [user?.id, postId, onCountChange]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropAnim }]}
          pointerEvents="auto"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleWrapper}>
            <View style={styles.handle} />
          </View>

          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Comentarios</Text>
            <Text style={styles.sheetCount}>{commentsCount + (comments.length - commentsCount < 0 ? 0 : 0)}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Comments list */}
          {loading ? (
            <View style={styles.loadingWrapper}>
              <ActivityIndicator color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={comments}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <CommentItem
                  comment={item}
                  currentUserId={user?.id}
                  onDelete={handleDelete}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={<EmptyComments />}
            />
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <Avatar uri={profile?.avatar ?? 'https://i.pravatar.cc/150?img=7'} size={34} />
            <View style={styles.inputWrapper}>
              <MentionInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Añade un comentario..."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSend}
                dropdownDirection="up"
                inputStyle={[styles.input, { maxHeight: 100 }]}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              style={[styles.sendBtn, (!inputText.trim() || sending) ? styles.sendBtnDisabled : null]}
            >
              <LinearGradient
                colors={
                  inputText.trim() && !sending
                    ? [Colors.primary, Colors.secondary]
                    : [Colors.surfaceElevated, Colors.surfaceElevated]
                }
                style={styles.sendBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {sending ? (
                  <ActivityIndicator color={Colors.textMuted} size="small" />
                ) : (
                  <Ionicons
                    name="send"
                    size={16}
                    color={inputText.trim() ? '#fff' : Colors.textMuted}
                    style={{ marginLeft: 2 }}
                  />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    overflow: 'hidden',
  },
  handleWrapper: { alignItems: 'center', paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceBorder,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  sheetTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  sheetCount: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
    marginHorizontal: Spacing.md,
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: Spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceBorder + '55',
    marginLeft: 58,
    marginRight: Spacing.md,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    minHeight: 40,
    justifyContent: 'center',
  },
  input: {
    color: Colors.textPrimary,
    fontSize: FontSize.base,
    lineHeight: 22,
    maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
