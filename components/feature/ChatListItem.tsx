import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { AppConversation } from '@/types/database';

interface ChatListItemProps {
  conversation: AppConversation;
  onPress: () => void;
  currentUserId?: string;
}

export const ChatListItem = React.memo(function ChatListItem({
  conversation,
  onPress,
  currentUserId,
}: ChatListItemProps) {
  const hasUnread = conversation.unread > 0;
  const user = conversation.other_user;

  // Determine last message display
  const lastMsg = conversation.last_message ?? '';
  const isMyMessage =
    currentUserId &&
    (conversation as any).last_message_sender_id === currentUserId;

  let lastMsgDisplay = lastMsg;
  if (lastMsg === '📷 Foto' || lastMsg === '🎥 Video') {
    lastMsgDisplay = lastMsg; // already emoji-prefixed
  } else if (lastMsg.length > 60) {
    lastMsgDisplay = lastMsg.slice(0, 60) + '…';
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      {/* Avatar with online dot */}
      <View style={styles.avatarContainer}>
        <Avatar uri={user.avatar} size={54} online={conversation.online} />
        {hasUnread ? <View style={styles.unreadRing} /> : null}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.topRow}>
          <View style={styles.nameWrapper}>
            <Text
              style={[styles.name, hasUnread ? styles.nameUnread : null]}
              numberOfLines={1}
            >
              {user.name}
            </Text>
            {user.verified ? (
              <Ionicons name="checkmark-circle" size={13} color={Colors.primary} style={{ marginLeft: 3 }} />
            ) : null}
          </View>
          <Text style={[styles.time, hasUnread ? styles.timeUnread : null]}>
            {conversation.last_time}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.previewRow}>
            {isMyMessage ? (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={hasUnread ? Colors.primary : Colors.textMuted}
                style={styles.sentIcon}
              />
            ) : null}
            <Text
              style={[styles.lastMessage, hasUnread ? styles.lastMessageUnread : null]}
              numberOfLines={1}
            >
              {lastMsgDisplay || 'Inicia la conversación...'}
            </Text>
          </View>

          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {conversation.unread > 9 ? '9+' : conversation.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    gap: 12,
  },
  pressed: { backgroundColor: Colors.surfaceElevated + '88' },
  avatarContainer: { position: 'relative' },
  unreadRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  info: { flex: 1, gap: 5 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameWrapper: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  name: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    flexShrink: 1,
  },
  nameUnread: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  timeUnread: { color: Colors.primary, fontWeight: FontWeight.semibold },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  sentIcon: { marginRight: 3 },
  lastMessage: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
  },
  lastMessageUnread: { color: Colors.textSecondary, fontWeight: FontWeight.medium },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold },
});
