import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';
import { Conversation } from '@/constants/mockData';

interface ChatListItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export const ChatListItem = React.memo(function ChatListItem({
  conversation,
  onPress,
}: ChatListItemProps) {
  const hasUnread = conversation.unread > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed ? styles.pressed : null]}
      onPress={onPress}
    >
      <Avatar uri={conversation.user.avatar} size={52} online={conversation.online} />
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread ? styles.nameUnread : null]} numberOfLines={1}>
            {conversation.user.name}
          </Text>
          <Text style={[styles.time, hasUnread ? styles.timeUnread : null]}>
            {conversation.lastTime}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[styles.lastMessage, hasUnread ? styles.lastMessageUnread : null]}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
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
    gap: Spacing.sm,
  },
  pressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  timeUnread: {
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  lastMessage: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  lastMessageUnread: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
});
