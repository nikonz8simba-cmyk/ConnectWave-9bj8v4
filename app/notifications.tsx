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
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { fetchNotifications, AppNotification } from '@/services/notificationService';
import { Colors, Spacing, FontSize, FontWeight, Radii } from '@/constants/theme';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NotifSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[skelStyles.row, { opacity }]}>
      <View style={skelStyles.avatar} />
      <View style={skelStyles.info}>
        <View style={skelStyles.line1} />
        <View style={skelStyles.line2} />
      </View>
      <View style={skelStyles.dot} />
    </Animated.View>
  );
}

const skelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceElevated },
  info: { flex: 1, gap: 8 },
  line1: { height: 12, width: '70%', borderRadius: 6, backgroundColor: Colors.surfaceElevated },
  line2: { height: 10, width: '45%', borderRadius: 5, backgroundColor: Colors.surfaceElevated },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.surfaceElevated },
});

// ─── Notification item ────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  const config = {
    like: { icon: 'heart', color: Colors.secondary, bg: Colors.secondary + '25' },
    comment: { icon: 'chatbubble', color: Colors.primary, bg: Colors.primary + '25' },
    mention: { icon: 'at', color: Colors.info, bg: Colors.info + '25' },
  };
  const c = config[type];
  return (
    <View style={[notifStyles.iconBadge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon as any} size={12} color={c.color} />
    </View>
  );
}

function NotifItem({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  const actionLabel = {
    like: 'le dio like a tu publicación',
    comment: 'comentó en tu publicación',
    mention: 'te mencionó en un comentario',
  }[item.type];

  const preview = item.postPreview
    ? item.postPreview.length > 60
      ? item.postPreview.slice(0, 60) + '…'
      : item.postPreview
    : null;

  return (
    <Pressable
      style={({ pressed }) => [
        notifStyles.row,
        pressed ? notifStyles.rowPressed : null,
      ]}
      onPress={() => onPress(item)}
    >
      {/* Avatar + type icon badge */}
      <View style={notifStyles.avatarWrapper}>
        <Avatar uri={item.actor.avatar} size={48} />
        <NotifIcon type={item.type} />
      </View>

      {/* Text */}
      <View style={notifStyles.textCol}>
        <Text style={notifStyles.text} numberOfLines={2}>
          <Text style={notifStyles.actorName}>
            {item.actor.name || `@${item.actor.username}`}
          </Text>
          {item.actor.verified ? (
            <Text> ✓</Text>
          ) : null}
          <Text style={notifStyles.action}> {actionLabel}</Text>
        </Text>
        {preview ? (
          <Text style={notifStyles.preview} numberOfLines={1}>
            "{preview}"
          </Text>
        ) : null}
        <Text style={notifStyles.time}>{item.timestamp}</Text>
      </View>

      {/* Unread dot */}
      {!item.read ? <View style={notifStyles.unreadDot} /> : null}
    </Pressable>
  );
}

const notifStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 12,
  },
  rowPressed: { backgroundColor: Colors.surfaceElevated + '55' },
  avatarWrapper: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  textCol: { flex: 1, gap: 3 },
  text: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  actorName: { fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  action: { color: Colors.textSecondary },
  preview: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  time: { fontSize: FontSize.xs, color: Colors.textMuted },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    flexShrink: 0,
  },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.label}>{label}</Text>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={emptyStyles.container}>
      <LinearGradient
        colors={[Colors.primary + '20', Colors.secondary + '10']}
        style={emptyStyles.iconBg}
      >
        <Ionicons name="notifications-outline" size={40} color={Colors.primary} />
      </LinearGradient>
      <Text style={emptyStyles.title}>Sin notificaciones</Text>
      <Text style={emptyStyles.subtitle}>
        Cuando alguien interactúe con tus posts{'\n'}aparecerá aquí.
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

// ─── Grouped notifications list ───────────────────────────────────────────────

type ListItem =
  | { _type: 'section'; label: string; key: string }
  | { _type: 'notif'; key: string; notif: AppNotification };

function groupNotifications(notifications: AppNotification[]): ListItem[] {
  const now = new Date();
  const items: ListItem[] = [];

  const today: AppNotification[] = [];
  const thisWeek: AppNotification[] = [];
  const older: AppNotification[] = [];

  for (const n of notifications) {
    const date = new Date(n.createdAt);
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) {
      today.push(n);
    } else if (diffDays < 7) {
      thisWeek.push(n);
    } else {
      older.push(n);
    }
  }

  if (today.length > 0) {
    items.push({ _type: 'section', label: 'Hoy', key: 'sec_today' });
    today.forEach(n => items.push({ _type: 'notif', key: n.id, notif: n }));
  }
  if (thisWeek.length > 0) {
    items.push({ _type: 'section', label: 'Esta semana', key: 'sec_week' });
    thisWeek.forEach(n => items.push({ _type: 'notif', key: n.id, notif: n }));
  }
  if (older.length > 0) {
    items.push({ _type: 'section', label: 'Anterior', key: 'sec_older' });
    older.forEach(n => items.push({ _type: 'notif', key: n.id, notif: n }));
  }

  return items;
}

// ─── Notifications Screen ─────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const { markNotificationsRead } = useApp();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const data = await fetchNotifications(user.id);
    setNotifications(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Mark all as read in the global counter as soon as the screen mounts
  useEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleNotifPress = useCallback(
    (n: AppNotification) => {
      // Navigate to the actor's profile or to the post (future: post detail screen)
      router.push(`/profile/${n.actor.id}` as any);
    },
    [router]
  );

  const listData = groupNotifications(notifications);
  const unreadCount = notifications.filter(n => !n.read).length;

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item._type === 'section') {
        return <SectionHeader label={item.label} />;
      }
      return (
        <NotifItem
          item={item.notif}
          onPress={handleNotifPress}
        />
      );
    },
    [handleNotifPress]
  );

  const keyExtractor = useCallback((item: ListItem) => item.key, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          {unreadCount > 0 && !loading ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
        {/* Mark all read button (visual — no DB needed) */}
        {notifications.length > 0 && !loading ? (
          <Pressable
            onPress={() =>
              setNotifications(prev => prev.map(n => ({ ...n, read: true })))
            }
            hitSlop={8}
            style={styles.markAllBtn}
          >
            <Text style={styles.markAllText}>Marcar leídas</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {loading ? (
        <View>
          {[1, 2, 3, 4, 5].map(i => (
            <NotifSkeleton key={i} />
          ))}
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ItemSeparatorComponent={({ leadingItem }) =>
            leadingItem?._type === 'notif' ? (
              <View style={styles.separator} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radii.full,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  markAllBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radii.full,
  },
  markAllText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceBorder,
  },
  listContent: { paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: {
    height: 1,
    backgroundColor: Colors.surfaceBorder + '44',
    marginLeft: 72,
    marginRight: Spacing.md,
  },
});
